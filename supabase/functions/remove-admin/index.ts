// Supabase Edge Function: remove-admin
//
// Called by the super-admin's "Remove Admin" UI. Deletes the admin's
// Supabase Auth user, which cascades to delete their `admins` row (and,
// via FK cascade, their event_types/bookings/blocked_slots).
//
// Deploy:
//   supabase functions deploy remove-admin
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
    .select("role, is_active")
    .eq("auth_user_id", caller.id)
    .maybeSingle();

  if (!callerAdmin || callerAdmin.role !== "super_admin" || !callerAdmin.is_active) {
    return jsonResponse({ error: "Only an active super_admin can remove admins" }, 403);
  }

  const { admin_id } = await req.json();
  if (!admin_id) {
    return jsonResponse({ error: "admin_id is required" }, 400);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: target } = await adminClient
    .from("admins")
    .select("auth_user_id, role")
    .eq("id", admin_id)
    .maybeSingle();

  if (!target) {
    return jsonResponse({ error: "Admin not found" }, 404);
  }
  if (target.role === "super_admin") {
    return jsonResponse({ error: "Cannot remove a super_admin account" }, 400);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(target.auth_user_id);
  if (deleteError) {
    return jsonResponse({ error: deleteError.message }, 400);
  }

  return jsonResponse({ success: true });
});
