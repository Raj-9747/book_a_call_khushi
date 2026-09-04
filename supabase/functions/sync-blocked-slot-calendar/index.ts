// Supabase Edge Function: sync-blocked-slot-calendar
//
// Called by the admin's own "Block time off" / remove-block actions to
// mirror the block onto their actual Google Calendar (as a plain busy
// event), so it's visible everywhere they check their calendar, not just
// on the Zaptly booking page. Only touches the CALLING admin's own data —
// ownership of the blocked_slot is enforced via RLS through the caller's
// own JWT before any service-role action happens.
//
// Deploy:
//   supabase functions deploy sync-blocked-slot-calendar
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

  // Scoped to the caller's own JWT — RLS means the lookups below can only
  // ever return the calling admin's own rows.
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
    .select("id, google_calendar_connected")
    .eq("auth_user_id", caller.id)
    .maybeSingle();
  if (!callerAdmin) {
    return jsonResponse({ error: "No admin account linked to this login" }, 403);
  }

  const { action, blocked_slot_id } = await req.json();
  if (!blocked_slot_id || (action !== "create" && action !== "delete")) {
    return jsonResponse({ error: "blocked_slot_id and a valid action are required" }, 400);
  }

  // Nothing to sync if this admin hasn't connected Calendar — not an error,
  // the block still works fine within Zaptly itself.
  if (!callerAdmin.google_calendar_connected) {
    return jsonResponse({ success: true, synced: false });
  }

  const { data: blockedSlot } = await callerClient
    .from("blocked_slots")
    .select("id, start_time, end_time, reason, google_event_id")
    .eq("id", blocked_slot_id)
    .maybeSingle();
  if (!blockedSlot) {
    return jsonResponse({ error: "Blocked slot not found" }, 404);
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
    // Expired/revoked token — don't fail the block itself over this.
    return jsonResponse({ success: true, synced: false });
  }

  if (action === "delete") {
    if (blockedSlot.google_event_id) {
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${blockedSlot.google_event_id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
      ).catch(() => {
        // Best-effort — e.g. already deleted directly in Google Calendar.
      });
    }
    return jsonResponse({ success: true });
  }

  // action === "create"
  const createResponse = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: blockedSlot.reason ? `Blocked (Zaptly): ${blockedSlot.reason}` : "Blocked (Zaptly)",
      start: { dateTime: blockedSlot.start_time },
      end: { dateTime: blockedSlot.end_time },
    }),
  });

  if (!createResponse.ok) {
    // Don't fail the block over a Calendar-side hiccup — it still works
    // within Zaptly's own availability computation either way.
    return jsonResponse({ success: true, synced: false });
  }

  const created = await createResponse.json();
  await callerClient.from("blocked_slots").update({ google_event_id: created.id }).eq("id", blocked_slot_id);

  return jsonResponse({ success: true, synced: true });
});
