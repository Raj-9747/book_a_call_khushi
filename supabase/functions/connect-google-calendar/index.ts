// Supabase Edge Function: connect-google-calendar
//
// Called right after Google redirects the admin back to our callback page
// with an authorization `code`. Exchanges that code for a refresh token
// using the service_role key + Google client secret (never exposed to the
// browser), then stores it against the CALLING admin's own row — an admin
// can only ever connect their own calendar, never someone else's.
//
// Deploy:
//   supabase functions deploy connect-google-calendar
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

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

  // Client scoped to the caller's own JWT — used only to identify them.
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

  const { code, redirect_uri } = await req.json();
  if (!code || !redirect_uri) {
    return jsonResponse({ error: "code and redirect_uri are required" }, 400);
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.refresh_token) {
    // Google omits refresh_token if the admin already granted consent before
    // without revoking it — the frontend always requests prompt=consent to
    // avoid this, but surface a clear message if it happens anyway.
    return jsonResponse(
      {
        error:
          tokenData.error_description ??
          "Google didn't return a refresh token. Please try connecting again, or remove Zaptly's access in your Google Account and reconnect.",
      },
      400
    );
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { error: updateError } = await adminClient
    .from("admins")
    .update({ google_refresh_token: tokenData.refresh_token, google_calendar_connected: true })
    .eq("id", callerAdmin.id);

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 400);
  }

  return jsonResponse({ success: true });
});
