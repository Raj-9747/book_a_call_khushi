// Supabase Edge Function: relay-booking-to-n8n
//
// Triggered by a Supabase Database Webhook on INSERT **or UPDATE** of
// `bookings` (set this up in Supabase Dashboard → Database → Webhooks — see
// supabase/functions/README.md). UPDATE matters now that paid bookings are
// inserted as 'pending_payment' and only become 'confirmed' once payment is
// verified: firing on INSERT alone would have emailed the client before
// they paid, and not at all afterwards.
//
// The guard for that is below — this returns early unless the booking is
// confirmed and hasn't been announced yet, and claims the send by flipping
// `confirmation_sent` before dispatching, so a burst of updates can't
// produce duplicate emails.
//
// Looks up the admin + event type, refreshes
// the admin's Google access token if they've connected Calendar, and hands
// everything off to the n8n webhook, which does the actual Calendar/Meet
// creation and sends the confirmation email.
//
// This function is called by Supabase's own webhook system, not by an end
// user — it's authorized by a shared secret header instead of a user JWT.
//
// Deploy:
//   supabase functions deploy relay-booking-to-n8n --no-verify-jwt
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, N8N_BOOKING_WEBHOOK_URL,
//   BOOKING_WEBHOOK_SECRET, PUBLIC_BASE_URL

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { refreshGoogleAccessToken } from "../_shared/google.ts";
import { splitE164Phone } from "../_shared/phoneSplit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const N8N_BOOKING_WEBHOOK_URL = Deno.env.get("N8N_BOOKING_WEBHOOK_URL")!;
const BOOKING_WEBHOOK_SECRET = Deno.env.get("BOOKING_WEBHOOK_SECRET")!;
// Where the app is reachable from, for building the client's magic link.
// Falls back to localhost so a local test still produces a usable URL.
const PUBLIC_BASE_URL = (Deno.env.get("PUBLIC_BASE_URL") ?? "http://localhost:3000").replace(/\/$/, "");

/** Formats an ISO instant for display in a given IANA timezone, e.g.
 * "04 Sep 2026, 12:00 PM" — computed once here so every downstream channel
 * (email, WhatsApp, future SMS) gets a ready-to-use string instead of each
 * n8n node needing its own Luxon/date-formatting expression. */
function formatInTimeZone(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso; // Invalid/unknown timezone string — fall back to the raw ISO rather than throwing.
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Supabase Database Webhooks let you add a custom header — set
  // `x-webhook-secret: <BOOKING_WEBHOOK_SECRET>` when configuring it, so
  // this function can't be triggered by anyone who finds the URL.
  if (req.headers.get("x-webhook-secret") !== BOOKING_WEBHOOK_SECRET) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const payload = await req.json();
  const booking = payload.record;
  if (!booking?.id) {
    return jsonResponse({ error: "No booking record in payload" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Only confirmed bookings get announced. A 'pending_payment' insert, a
  // cancellation, a lead-note edit — all land here and all stop at this
  // line.
  if (booking.status !== "confirmed") {
    return jsonResponse({ skipped: "not confirmed", status: booking.status });
  }

  // Claim the send atomically: the UPDATE only matches while
  // confirmation_sent is still false, so of two concurrent deliveries for
  // the same booking exactly one proceeds past here.
  const { data: claimed } = await supabase
    .from("bookings")
    .update({ confirmation_sent: true })
    .eq("id", booking.id)
    .eq("confirmation_sent", false)
    .select("id, manage_token")
    .maybeSingle();

  if (!claimed) {
    return jsonResponse({ skipped: "already sent" });
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("id, name, email, phone, timezone, google_calendar_connected, google_refresh_token, notification_config")
    .eq("id", booking.admin_id)
    .maybeSingle();

  const { data: eventType } = await supabase
    .from("event_types")
    .select("name, duration_minutes, record_meeting")
    .eq("id", booking.event_type_id)
    .maybeSingle();

  let googleAccessToken: string | null = null;
  if (admin?.google_calendar_connected && admin.google_refresh_token) {
    googleAccessToken = await refreshGoogleAccessToken(admin.google_refresh_token);
  }

  // Zaple wants the dial code and national number as separate fields —
  // client_phone is E.164, unlike the admin's bare 10-digit number sent
  // below. Null when the number doesn't match a recognized dial code; n8n
  // gates the WhatsApp send on that and still sends email regardless.
  const clientPhoneSplit = splitE164Phone(booking.client_phone);

  const n8nResponse = await fetch(N8N_BOOKING_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      booking: {
        id: booking.id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        // Pre-formatted for direct use in messages — "start_time" above
        // stays raw ISO for anything that needs to compute with it (e.g.
        // the Google Calendar event creation step).
        start_time_ist: formatInTimeZone(booking.start_time, "Asia/Kolkata"),
        start_time_client_tz: formatInTimeZone(booking.start_time, booking.client_timezone || "Asia/Kolkata"),
        // A reschedule runs through this same pipeline as a first booking
        // (approveReschedule re-opens confirmation_sent), so this flag is
        // the only thing that lets n8n say "rescheduled to …" instead of
        // "your booking is accepted". rescheduled_at is written in the same
        // UPDATE as the new time, so it's already on this webhook record.
        is_reschedule: Boolean(booking.rescheduled_at),
        previous_start_time_ist: booking.previous_start_time
          ? formatInTimeZone(booking.previous_start_time, "Asia/Kolkata")
          : null,
        previous_start_time_client_tz: booking.previous_start_time
          ? formatInTimeZone(booking.previous_start_time, booking.client_timezone || "Asia/Kolkata")
          : null,
        client_name: booking.client_name,
        client_email: booking.client_email,
        client_phone: booking.client_phone,
        client_phone_country_code: clientPhoneSplit?.countryCode ?? null,
        client_phone_national: clientPhoneSplit?.national ?? null,
        client_timezone: booking.client_timezone,
        custom_answers: booking.custom_answers,
        // Where the client manages this booking (view details, request a
        // reschedule or cancellation). Include this in the confirmation
        // email/WhatsApp template.
        manage_link: `${PUBLIC_BASE_URL}/booking/${claimed.manage_token}`,
        amount_paid: booking.amount_paid,
        payment_status: booking.payment_status,
      },
      admin: admin ? { id: admin.id, name: admin.name, email: admin.email, phone: admin.phone, timezone: admin.timezone } : null,
      event_type: eventType
        ? { name: eventType.name, duration_minutes: eventType.duration_minutes, record_meeting: eventType.record_meeting }
        : null,
      google_access_token: googleAccessToken,
    }),
  });

  if (!n8nResponse.ok) {
    return jsonResponse({ error: `n8n webhook returned ${n8nResponse.status}` }, 502);
  }

  return jsonResponse({ success: true });
});
