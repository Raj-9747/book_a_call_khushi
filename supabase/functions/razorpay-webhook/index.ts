// Supabase Edge Function: razorpay-webhook
//
// The authoritative payment channel. Razorpay calls this server-to-server,
// so it works even when the client's browser never comes back — a closed
// tab, a dead phone, a UPI app that doesn't redirect.
//
// Authentication is the X-Razorpay-Signature header: an HMAC-SHA256 over
// the RAW request body, keyed with the webhook secret set in the Razorpay
// dashboard. The body must be read as text and verified BEFORE parsing —
// re-serializing parsed JSON produces different bytes and a failing digest.
//
// Deploy:
//   supabase functions deploy razorpay-webhook --no-verify-jwt
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//                   RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
//
// Then in the Razorpay dashboard (Account & Settings -> Webhooks) add this
// function's URL, the same secret, and the events:
//   payment.captured, payment.failed, refund.created, refund.processed, refund.failed

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { paiseToRupees, verifyWebhookSignature } from "../_shared/razorpay.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RazorpayEntity {
  id?: string;
  order_id?: string;
  payment_id?: string;
  amount?: number;
  notes?: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Raw text first — the signature covers these exact bytes.
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!(await verifyWebhookSignature(rawBody, signature))) {
    console.warn("razorpay-webhook: signature verification failed");
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  let event: { event?: string; payload?: Record<string, { entity?: RazorpayEntity }> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const eventName = event.event ?? "";

  /** Finds the booking a webhook entity refers to. Prefers the booking id
   * we set in the order's notes; falls back to the stored order id. */
  async function findBookingId(entity: RazorpayEntity): Promise<string | null> {
    const fromNotes = entity.notes?.booking_id;
    if (fromNotes) return fromNotes;
    if (!entity.order_id) return null;
    const { data } = await admin
      .from("bookings")
      .select("id")
      .eq("razorpay_order_id", entity.order_id)
      .maybeSingle();
    return data?.id ?? null;
  }

  try {
    if (eventName === "payment.captured") {
      const entity = event.payload?.payment?.entity ?? {};
      const bookingId = await findBookingId(entity);
      if (!bookingId) {
        // Nothing to do, but still 200 — a non-2xx makes Razorpay retry
        // this forever for an event we can never match.
        console.warn("razorpay-webhook: no booking for captured payment", entity.id);
        return jsonResponse({ received: true, matched: false });
      }

      // Idempotent: a duplicate delivery finds the booking already
      // confirmed and changes nothing.
      const { error } = await admin.rpc("confirm_booking_payment", {
        p_booking_id: bookingId,
        p_razorpay_order_id: entity.order_id ?? null,
        p_razorpay_payment_id: entity.id ?? null,
        p_amount_paid: entity.amount != null ? paiseToRupees(entity.amount) : null,
      });
      if (error) throw error;
      return jsonResponse({ received: true, matched: true });
    }

    if (eventName === "payment.failed") {
      const entity = event.payload?.payment?.entity ?? {};
      const bookingId = await findBookingId(entity);
      if (bookingId) {
        // Leaves the booking on hold so the client can retry within the
        // window; only records that this attempt failed.
        const { error } = await admin.rpc("fail_booking_payment", {
          p_booking_id: bookingId,
          p_razorpay_payment_id: entity.id ?? null,
        });
        if (error) throw error;
      }
      return jsonResponse({ received: true });
    }

    if (eventName === "refund.processed" || eventName === "refund.failed" || eventName === "refund.created") {
      const entity = event.payload?.refund?.entity ?? {};
      if (entity.id && entity.payment_id) {
        const status = eventName === "refund.processed" ? "processed" : eventName === "refund.failed" ? "failed" : "pending";
        const { data: booking } = await admin
          .from("bookings")
          .select("id")
          .eq("razorpay_payment_id", entity.payment_id)
          .maybeSingle();

        if (booking) {
          // Upsert, not update: a refund made straight from the Razorpay
          // dashboard has no ledger row yet and should still show up here.
          // A late "created" must never downgrade an already-settled row.
          const { data: existing } = await admin
            .from("booking_refunds")
            .select("status")
            .eq("razorpay_refund_id", entity.id)
            .maybeSingle();
          if (!(existing && existing.status !== "pending" && status === "pending")) {
            const { error } = await admin.from("booking_refunds").upsert(
              {
                booking_id: booking.id,
                razorpay_refund_id: entity.id,
                razorpay_payment_id: entity.payment_id,
                amount: paiseToRupees(entity.amount ?? 0),
                status,
                processed_at: status === "processed" ? new Date().toISOString() : null,
              },
              { onConflict: "razorpay_refund_id" }
            );
            if (error) throw error;
            const { error: syncError } = await admin.rpc("sync_booking_refund", { p_booking_id: booking.id });
            if (syncError) throw syncError;
          }
        }
      }
      return jsonResponse({ received: true });
    }

    // Unsubscribed event types still get a 200 so Razorpay stops retrying.
    return jsonResponse({ received: true, ignored: eventName });
  } catch (err) {
    console.error("razorpay-webhook: handler failed", eventName, err);
    // A 500 tells Razorpay to retry — appropriate for a transient DB error.
    return jsonResponse({ error: "Handler failed" }, 500);
  }
});
