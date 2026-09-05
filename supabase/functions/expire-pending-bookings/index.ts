// Supabase Edge Function: expire-pending-bookings
//
// Sweeps up abandoned checkouts: bookings still 'pending_payment' whose
// hold window has lapsed become 'expired', and any discount-code use they
// consumed is handed back.
//
// Called on a schedule by n8n (see n8n/workflows/expire-holds-cron.json),
// not by a user — so it's deployed without JWT verification and authorized
// by the same shared-secret header pattern as relay-booking-to-n8n.
//
// Note the slot itself is freed the moment the hold lapses, not when this
// runs: every conflict check ignores a hold whose hold_expires_at has
// passed. This sweep is about tidying status and refunding code uses.
//
// Deploy:
//   supabase functions deploy expire-pending-bookings --no-verify-jwt
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//                   BOOKING_WEBHOOK_SECRET

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("BOOKING_WEBHOOK_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await admin.rpc("expire_pending_bookings");

  if (error) {
    console.error("expire-pending-bookings: sweep failed", error);
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ expired: data ?? 0 });
});
