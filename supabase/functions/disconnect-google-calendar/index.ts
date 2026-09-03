// Supabase Edge Function: disconnect-google-calendar
//
// Lets an admin revoke Zaptly's access to their Google Calendar. Revokes
// the token with Google (best-effort — proceeds even if that call fails,
// e.g. token already invalid) and always clears our own stored copy.
//
// Deploy:
//   supabase functions deploy disconnect-google-calendar
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

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

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: row } = await adminClient
    .from("admins")
    .select("google_refresh_token")
    .eq("id", callerAdmin.id)
    .maybeSingle();

  if (row?.google_refresh_token) {
    try {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: row.google_refresh_token }),
      });
    } catch {
      // Best-effort — still clear our own copy below even if Google's
      // revoke endpoint is unreachable or the token was already invalid.
    }
  }

  const { error: updateError } = await adminClient
    .from("admins")
    .update({ google_refresh_token: null, google_calendar_connected: false })
    .eq("id", callerAdmin.id);

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 400);
  }

  return jsonResponse({ success: true });
});
