// Supabase Edge Function: relay-booking-to-n8n
//
// Triggered by a Supabase Database Webhook on INSERT into `bookings` (set
// this up in Supabase Dashboard → Database → Webhooks — see
// supabase/functions/README.md). Looks up the admin + event type, refreshes
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
//   BOOKING_WEBHOOK_SECRET

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const N8N_BOOKING_WEBHOOK_URL = Deno.env.get("N8N_BOOKING_WEBHOOK_URL")!;
const BOOKING_WEBHOOK_SECRET = Deno.env.get("BOOKING_WEBHOOK_SECRET")!;

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

async function refreshGoogleAccessToken(refreshToken: string): Promise<string | null> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  return response.ok ? data.access_token : null;
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

  const { data: admin } = await supabase
    .from("admins")
    .select("id, name, email, phone, timezone, google_calendar_connected, google_refresh_token, notification_config")
    .eq("id", booking.admin_id)
    .maybeSingle();

  const { data: eventType } = await supabase
    .from("event_types")
    .select("name, duration_minutes")
    .eq("id", booking.event_type_id)
    .maybeSingle();

  let googleAccessToken: string | null = null;
  if (admin?.google_calendar_connected && admin.google_refresh_token) {
    googleAccessToken = await refreshGoogleAccessToken(admin.google_refresh_token);
  }

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
        client_name: booking.client_name,
        client_email: booking.client_email,
        client_phone: booking.client_phone,
        client_timezone: booking.client_timezone,
        custom_answers: booking.custom_answers,
      },
      admin: admin ? { id: admin.id, name: admin.name, email: admin.email, phone: admin.phone, timezone: admin.timezone } : null,
      event_type: eventType ? { name: eventType.name, duration_minutes: eventType.duration_minutes } : null,
      google_access_token: googleAccessToken,
    }),
  });

  if (!n8nResponse.ok) {
    return jsonResponse({ error: `n8n webhook returned ${n8nResponse.status}` }, 502);
  }

  return jsonResponse({ success: true });
});
