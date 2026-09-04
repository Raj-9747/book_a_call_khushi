// Supabase Edge Function: get-google-busy-times
//
// Called by the public booking page (anonymous visitors) to check the
// admin's actual Google Calendar for conflicts — a meeting the admin
// created directly in Google Calendar (not through Zaptly) would otherwise
// be invisible to the slot-availability computation, which only knows
// about Zaptly's own bookings/blocked_slots without this.
//
// No user identity is involved here (the visitor isn't logged in), so this
// is authorized purely by being a public, read-only, non-sensitive lookup —
// same trust model as the other public RPCs (get_public_admin etc). Fails
// OPEN (returns no busy times) on any error — e.g. an expired/revoked
// Google token — rather than breaking the booking page entirely over an
// unrelated Calendar hiccup.
//
// Deploy:
//   supabase functions deploy get-google-busy-times --no-verify-jwt
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
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

  try {
    const { admin_id, from, to } = await req.json();
    if (!admin_id || !from || !to) {
      return jsonResponse({ busy: [] });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: admin } = await supabase
      .from("admins")
      .select("google_calendar_connected, google_refresh_token")
      .eq("id", admin_id)
      .maybeSingle();

    if (!admin?.google_calendar_connected || !admin.google_refresh_token) {
      return jsonResponse({ busy: [] });
    }

    const accessToken = await refreshGoogleAccessToken(admin.google_refresh_token);
    if (!accessToken) {
      // Expired/revoked token (e.g. the 7-day Testing-mode limit) — fail
      // open rather than blocking every slot on the booking page.
      return jsonResponse({ busy: [] });
    }

    const freeBusyResponse = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ timeMin: from, timeMax: to, items: [{ id: "primary" }] }),
    });

    if (!freeBusyResponse.ok) {
      return jsonResponse({ busy: [] });
    }

    const freeBusyData = await freeBusyResponse.json();
    const busy = freeBusyData?.calendars?.primary?.busy ?? [];

    return jsonResponse({ busy });
  } catch {
    // Never let a Calendar-side failure take down the booking page.
    return jsonResponse({ busy: [] });
  }
});
