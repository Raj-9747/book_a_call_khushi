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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
  }

  const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: caller },
  } = await callerClient.auth.getUser();
  if (!caller) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  const { data: callerAdmin } = await callerClient
    .from("admins")
    .select("role, is_active")
    .eq("auth_user_id", caller.id)
    .maybeSingle();

  if (!callerAdmin || callerAdmin.role !== "super_admin" || !callerAdmin.is_active) {
    return new Response(JSON.stringify({ error: "Only an active super_admin can remove admins" }), {
      status: 403,
    });
  }

  const { admin_id } = await req.json();
  if (!admin_id) {
    return new Response(JSON.stringify({ error: "admin_id is required" }), { status: 400 });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: target } = await adminClient
    .from("admins")
    .select("auth_user_id, role")
    .eq("id", admin_id)
    .maybeSingle();

  if (!target) {
    return new Response(JSON.stringify({ error: "Admin not found" }), { status: 404 });
  }
  if (target.role === "super_admin") {
    return new Response(JSON.stringify({ error: "Cannot remove a super_admin account" }), { status: 400 });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(target.auth_user_id);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
