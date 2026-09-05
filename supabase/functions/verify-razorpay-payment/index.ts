// Supabase Edge Function: verify-razorpay-payment
//
// The browser's fast path. Razorpay Checkout hands the client three values
// on success and the client relays them here. None of them are trusted
// until the signature checks out: it's an HMAC over "order_id|payment_id"
// keyed with our secret, which only this function holds — so a forged
// "I paid" call can't be constructed.
//
// This is NOT the source of truth. The webhook confirms independently, so
// a client that closes the tab mid-redirect still gets a confirmed booking.
// Both call the same idempotent RPC; whichever arrives first wins and the
// other is a no-op.
//
// Deploy:
//   supabase functions deploy verify-razorpay-payment --no-verify-jwt
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//                   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { fetchRazorpayPayment, paiseToRupees, verifyCheckoutSignature } from "../_shared/razorpay.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  const bookingId = String(body.booking_id ?? "");
  const orderId = String(body.razorpay_order_id ?? "");
  const paymentId = String(body.razorpay_payment_id ?? "");
  const signature = String(body.razorpay_signature ?? "");

  if (!bookingId || !orderId || !paymentId || !signature) {
    return jsonResponse({ error: "Missing payment details." }, 400);
  }

  if (!(await verifyCheckoutSignature(orderId, paymentId, signature))) {
    console.warn("verify-razorpay-payment: signature mismatch", { bookingId, orderId });
    return jsonResponse({ error: "Payment could not be verified." }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // The signature proves the order/payment pair is genuine, but not that it
  // belongs to THIS booking — check that the order id we stored matches, so
  // one client's valid receipt can't confirm someone else's booking.
  const { data: booking } = await admin
    .from("bookings")
    .select("id, razorpay_order_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking || booking.razorpay_order_id !== orderId) {
    return jsonResponse({ error: "Payment could not be matched to this booking." }, 400);
  }

  // Read the captured amount back from Razorpay rather than believing
  // anything the browser said about it.
  let amountPaid: number | null = null;
  try {
    const payment = await fetchRazorpayPayment(paymentId);
    if (payment.order_id !== orderId) {
      return jsonResponse({ error: "Payment could not be matched to this booking." }, 400);
    }
    amountPaid = paiseToRupees(payment.amount);
  } catch (err) {
    // Non-fatal: the signature already established authenticity, and the
    // webhook will fill in the exact amount shortly.
    console.error("verify-razorpay-payment: amount lookup failed", err);
  }

  const { data, error } = await admin.rpc("confirm_booking_payment", {
    p_booking_id: bookingId,
    p_razorpay_order_id: orderId,
    p_razorpay_payment_id: paymentId,
    p_amount_paid: amountPaid,
  });

  if (error) {
    console.error("verify-razorpay-payment: confirm failed", error);
    return jsonResponse({ error: "Couldn't confirm your booking. Please contact support." }, 500);
  }

  const result = data?.[0];
  return jsonResponse({
    confirmed: true,
    status: result?.status,
    manage_token: result?.manage_token,
    slot_conflict: result?.slot_conflict ?? false,
  });
});
