// Supabase Edge Function: delete-booking-calendar-event
//
// Called when an admin cancels a booking from their dashboard, to also
// remove the corresponding event from their real Google Calendar (if one
// was created). Ownership is enforced via RLS through the caller's own
// JWT before any service-role action happens — an admin can only ever
// delete the calendar event for their OWN booking.
//
// Deploy:
//   supabase functions deploy delete-booking-calendar-event
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { refreshGoogleAccessToken } from "../_shared/google.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
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

  const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: caller },
  } = await callerClient.auth.getUser();
  if (!caller) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  const { data: callerAdmin } = await callerClient
    .from("admins")
    .select("id")
    .eq("auth_user_id", caller.id)
    .maybeSingle();
  if (!callerAdmin) {
    return jsonResponse({ error: "No admin account linked to this login" }, 403);
  }

  const { booking_id } = await req.json();
  if (!booking_id) {
    return jsonResponse({ error: "booking_id is required" }, 400);
  }

  // RLS (bookings_all_own) means this only ever returns the caller's own
  // booking — a different admin's booking id would just come back null.
  const { data: booking } = await callerClient
    .from("bookings")
    .select("google_event_id")
    .eq("id", booking_id)
    .maybeSingle();

  if (!booking?.google_event_id) {
    return jsonResponse({ success: true, deleted: false });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: adminRow } = await adminClient
    .from("admins")
    .select("google_refresh_token")
    .eq("id", callerAdmin.id)
    .maybeSingle();

  const accessToken = adminRow?.google_refresh_token
    ? await refreshGoogleAccessToken(adminRow.google_refresh_token)
    : null;
  if (!accessToken) {
    // Expired/revoked token — cancellation in Zaptly still proceeds
    // regardless; the admin can remove the stale calendar event manually.
    return jsonResponse({ success: true, deleted: false });
  }

  const deleteResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.google_event_id}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );

  // 410 Gone means it was already deleted directly in Google — treat as success either way.
  const deleted = deleteResponse.ok || deleteResponse.status === 410;
  return jsonResponse({ success: true, deleted });
});
