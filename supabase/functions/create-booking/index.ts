// Supabase Edge Function: create-booking
//
// The single entry point for the public booking page. Anonymous callers hit
// this instead of an RPC, because a paid booking has to be created and its
// Razorpay order opened in one server-side step — the client must never be
// able to mint a booking without a matching order, or to influence the
// amount.
//
// Everything that decides the price (event price, discount validity,
// discount percent) is resolved inside `create_booking_priced` in Postgres.
// This function forwards only identifiers and client-supplied contact
// details; there is deliberately no amount field in the request body.
//
// Deploy:
//   supabase functions deploy create-booking --no-verify-jwt
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//                   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createRazorpayOrder, RAZORPAY_KEY_ID, rupeesToPaise } from "../_shared/razorpay.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// How long an unpaid booking holds its slot.
const HOLD_MINUTES = 10;

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

  const adminSlug = String(body.admin_slug ?? "").trim();
  const eventSlug = String(body.event_slug ?? "").trim();
  const clientName = String(body.client_name ?? "").trim();
  const clientEmail = String(body.client_email ?? "").trim().toLowerCase();
  const clientPhone = String(body.client_phone ?? "").trim();
  const startTime = String(body.start_time ?? "").trim();
  const clientTimezone = String(body.client_timezone ?? "").trim() || "Asia/Kolkata";
  const discountCode = body.discount_code ? String(body.discount_code).trim() : null;
  const customAnswers = (body.custom_answers ?? {}) as Record<string, string>;

  if (!adminSlug || !eventSlug || !clientName || !clientEmail || !startTime) {
    return jsonResponse({ error: "Missing required booking details." }, 400);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail)) {
    return jsonResponse({ error: "Please enter a valid email address." }, 400);
  }
  if (Number.isNaN(Date.parse(startTime))) {
    return jsonResponse({ error: "Invalid slot." }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Validates the admin, event type, slot, notice window, booking window,
  // discount code and conflicts — then prices and inserts. Raises on any
  // failure, with a message written to be shown to the client as-is.
  const { data, error } = await admin.rpc("create_booking_priced", {
    p_admin_slug: adminSlug,
    p_event_slug: eventSlug,
    p_client_name: clientName,
    p_client_email: clientEmail,
    p_client_phone: clientPhone || null,
    p_custom_answers: customAnswers,
    p_start_time: startTime,
    p_client_timezone: clientTimezone,
    p_discount_code: discountCode,
    p_hold_minutes: HOLD_MINUTES,
  });

  if (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  const booking = data?.[0];
  if (!booking) {
    return jsonResponse({ error: "Booking failed — please try again." }, 400);
  }

  const amountDue = Number(booking.amount_due);

  // Free (or fully discounted) — already confirmed, nothing to charge.
  if (amountDue <= 0) {
    return jsonResponse({
      free: true,
      booking_id: booking.id,
      start_time: booking.start_time,
      amount_due: 0,
      manage_token: booking.manage_token,
    });
  }

  try {
    const order = await createRazorpayOrder({
      amountInPaise: rupeesToPaise(amountDue),
      receipt: booking.id,
      notes: { booking_id: booking.id, admin_slug: adminSlug, event_slug: eventSlug },
    });

    await admin.from("bookings").update({ razorpay_order_id: order.id }).eq("id", booking.id);

    // The manage_token is deliberately withheld until payment succeeds.
    return jsonResponse({
      free: false,
      booking_id: booking.id,
      start_time: booking.start_time,
      amount_due: amountDue,
      order_id: order.id,
      amount_in_paise: order.amount,
      currency: order.currency,
      key_id: RAZORPAY_KEY_ID,
    });
  } catch (err) {
    // The order never opened, so expire the hold immediately. Backdating
    // `hold_expires_at` (rather than setting status directly) frees the
    // slot right away — every conflict check treats a lapsed hold as gone —
    // while still leaving the row for the sweep, which is what refunds the
    // discount code's use.
    await admin
      .from("bookings")
      .update({ hold_expires_at: new Date().toISOString() })
      .eq("id", booking.id)
      .eq("status", "pending_payment");

    console.error("create-booking: order creation failed", err);
    return jsonResponse({ error: "Couldn't start the payment. Please try again." }, 502);
  }
});
