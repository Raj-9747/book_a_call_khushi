// Supabase Edge Function: refund-razorpay-payment
//
// Called from the admin dashboard when the admin cancels a booking (directly
// or by approving a client's cancellation request) and chooses to refund. Requires a logged-in admin who owns the booking — the
// Razorpay secret means this can't be a plain RLS-guarded table write.
//
// Every refund Razorpay accepts is written to the `booking_refunds` ledger
// with Razorpay's own refund id and status. The booking's refund_amount /
// refund_status / payment_status are derived from that ledger by
// sync_booking_refund(), so "refunded" only ever counts money Razorpay has
// confirmed (the `razorpay-webhook` settles pending → processed/failed).
//
// Deploy:
//   supabase functions deploy refund-razorpay-payment
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//                   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { paiseToRupees, RazorpayError, refundRazorpayPayment, rupeesToPaise } from "../_shared/razorpay.ts";

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

  const { booking_id, amount, reason, request_id, admin_note } = await req.json();
  const refundAmount = Number(amount);
  if (!booking_id || !Number.isFinite(refundAmount) || refundAmount <= 0) {
    return jsonResponse({ error: "Invalid refund amount." }, 400);
  }

  // Authenticates the caller AND, via RLS, confirms they own this booking.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: booking, error: bookingError } = await callerClient
    .from("bookings")
    .select("id, razorpay_payment_id, amount_paid")
    .eq("id", booking_id)
    .maybeSingle();

  if (bookingError || !booking) {
    return jsonResponse({ error: "Booking not found." }, 404);
  }
  if (!booking.razorpay_payment_id) {
    return jsonResponse({ error: "This booking has no payment to refund." }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Refundable = paid − everything already refunded or in flight. Failed
  // refunds don't count against it.
  const { data: ledger } = await admin
    .from("booking_refunds")
    .select("amount, status")
    .eq("booking_id", booking_id)
    .neq("status", "failed");
  const committed = (ledger ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const amountPaid = Number(booking.amount_paid ?? 0);
  if (committed + refundAmount > amountPaid) {
    return jsonResponse({ error: `Only ₹${Math.max(amountPaid - committed, 0)} is left to refund on this booking.` }, 400);
  }

  let refund;
  try {
    refund = await refundRazorpayPayment(booking.razorpay_payment_id, rupeesToPaise(refundAmount), {
      booking_id,
    });
  } catch (err) {
    console.error("refund-razorpay-payment: Razorpay refund failed", err);
    const message = err instanceof RazorpayError ? err.message : "Could not reach Razorpay.";
    return jsonResponse({ error: `Razorpay rejected the refund: ${message}` }, 502);
  }

  const { error: insertError } = await admin.from("booking_refunds").upsert(
    {
      booking_id,
      razorpay_refund_id: refund.id,
      razorpay_payment_id: booking.razorpay_payment_id,
      amount: paiseToRupees(refund.amount),
      // Test-mode refunds often come back already "processed".
      status: refund.status === "processed" ? "processed" : refund.status === "failed" ? "failed" : "pending",
      reason: typeof reason === "string" && reason.trim() ? reason.trim() : null,
      processed_at: refund.status === "processed" ? new Date().toISOString() : null,
    },
    { onConflict: "razorpay_refund_id" }
  );
  if (insertError) {
    // The money HAS moved on Razorpay — surface the id so it isn't lost.
    console.error("refund-razorpay-payment: ledger insert failed", insertError);
    return jsonResponse({ error: `Refund ${refund.id} was created on Razorpay but could not be recorded.` }, 500);
  }

  await admin.rpc("sync_booking_refund", { p_booking_id: booking_id });

  if (request_id) {
    // Deliberately the RLS-scoped `callerClient`: `request_id` is
    // client-supplied, and filtering on booking_id too means this can only
    // resolve the request that belongs to the booking just refunded.
    await callerClient
      .from("booking_change_requests")
      .update({ status: "approved", admin_note: admin_note || null, resolved_at: new Date().toISOString() })
      .eq("id", request_id)
      .eq("booking_id", booking_id);
  }

  return jsonResponse({ refunded: refundAmount, refund_id: refund.id, status: refund.status });
});
