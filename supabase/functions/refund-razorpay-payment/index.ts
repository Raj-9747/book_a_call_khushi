// Supabase Edge Function: refund-razorpay-payment
//
// Called only from the admin's Requests page, when they approve a
// cancellation with a refund attached. Requires a logged-in admin who owns
// the booking — the Razorpay secret means this can't be a plain RLS-guarded
// table write, unlike most of the Requests flow.
//
// The actual refund_amount/refund_status/refunded_at fields get their
// final value from the `razorpay-webhook`'s `refund.processed` handler,
// same idempotent pattern as payment confirmation — this function just
// kicks the refund off and stamps a "processing" status so the UI has
// something to show immediately.
//
// Deploy:
//   supabase functions deploy refund-razorpay-payment
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//                   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { refundRazorpayPayment, rupeesToPaise } from "../_shared/razorpay.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const { booking_id, amount, request_id, admin_note } = await req.json();
  const refundAmount = Number(amount);
  if (!booking_id || !Number.isFinite(refundAmount) || refundAmount <= 0) {
    return jsonResponse({ error: "Invalid refund amount." }, 400);
  }

  // Authenticates the caller AND, via RLS, confirms they own this booking —
  // the same admin-scoped policy every other booking read/write relies on.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: booking, error: bookingError } = await callerClient
    .from("bookings")
    .select("id, razorpay_payment_id, amount_paid, refund_amount, status")
    .eq("id", booking_id)
    .maybeSingle();

  if (bookingError || !booking) {
    return jsonResponse({ error: "Booking not found." }, 404);
  }
  if (!booking.razorpay_payment_id) {
    return jsonResponse({ error: "This booking has no payment to refund." }, 400);
  }

  const alreadyRefunded = Number(booking.refund_amount ?? 0);
  const amountPaid = Number(booking.amount_paid ?? 0);
  if (alreadyRefunded + refundAmount > amountPaid) {
    return jsonResponse({ error: "That's more than what's left to refund on this booking." }, 400);
  }

  try {
    await refundRazorpayPayment(booking.razorpay_payment_id, rupeesToPaise(refundAmount));
  } catch (err) {
    console.error("refund-razorpay-payment: Razorpay refund failed", err);
    return jsonResponse({ error: "Razorpay rejected the refund. Please check the payment and try again." }, 502);
  }

  // service_role from here: stamping refund status and resolving the
  // change request both touch rows the admin already owns, but doing it
  // as one atomic-ish sequence server-side avoids a half-applied state if
  // the browser drops connection right after the refund call above.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  await admin
    .from("bookings")
    .update({
      refund_amount: alreadyRefunded + refundAmount,
      refund_status: "processing",
    })
    .eq("id", booking_id);

  if (request_id) {
    await admin
      .from("booking_change_requests")
      .update({ status: "approved", admin_note: admin_note || null, resolved_at: new Date().toISOString() })
      .eq("id", request_id);
  }

  return jsonResponse({ refunded: refundAmount });
});
