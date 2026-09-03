// Supabase Edge Function: update-admin
//
// Called by the super-admin's "Edit Admin" UI to change an admin's name,
// email, phone, and/or password. Email and password changes must go through
// the service role (auth.admin API) so the Supabase Auth user and the
// `admins` row never drift out of sync. Changing the email also clears the
// stored Google Calendar connection, forcing a reconnect.
//
// Deploy:
//   supabase functions deploy update-admin
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
    return jsonResponse({ error: "Only an active super_admin can edit admins" }, 403);
  }

  const { admin_id, name, email, phone, password } = await req.json();
  if (!admin_id) {
    return jsonResponse({ error: "admin_id is required" }, 400);
  }
  if (password && password.length < 8) {
    return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
  }
  if (!name && !email && !phone && !password) {
    return jsonResponse({ error: "Nothing to update" }, 400);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: target } = await adminClient
    .from("admins")
    .select("auth_user_id")
    .eq("id", admin_id)
    .maybeSingle();

  if (!target) {
    return jsonResponse({ error: "Admin not found" }, 404);
  }

  if (email) {
    const { data: existingAdminEmail } = await adminClient
      .from("admins")
      .select("id")
      .ilike("email", email)
      .neq("id", admin_id)
      .maybeSingle();
    if (existingAdminEmail) {
      return jsonResponse({ error: "An admin with this email already exists." }, 409);
    }
  }

  // Keep the Supabase Auth user (email/password) in sync first.
  if (email || password) {
    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(target.auth_user_id, {
      ...(email ? { email, email_confirm: true } : {}),
      ...(password ? { password } : {}),
    });
    if (authUpdateError) {
      const isDuplicate = /already.*(registered|exists)/i.test(authUpdateError.message);
      return jsonResponse(
        { error: isDuplicate ? "An account with this email already exists." : authUpdateError.message },
        400
      );
    }
  }

  const rowUpdate: Record<string, string | boolean | null> = {};
  if (name) rowUpdate.name = name;
  if (email) rowUpdate.email = email;
  if (phone) rowUpdate.phone = phone;

  // Changing the login email forces a Google Calendar reconnect — the
  // admin's identity changed, so re-verifying via a fresh OAuth grant is
  // the safer default rather than silently keeping the old token attached.
  if (email) {
    rowUpdate.google_calendar_connected = false;
    rowUpdate.google_refresh_token = null;
  }

  let admin = null;
  if (Object.keys(rowUpdate).length > 0) {
    const { data, error: updateError } = await adminClient
      .from("admins")
      .update(rowUpdate)
      .eq("id", admin_id)
      .select()
      .single();
    if (updateError) {
      return jsonResponse({ error: updateError.message }, 400);
    }
    admin = data;
  }

  return jsonResponse({ admin });
});
