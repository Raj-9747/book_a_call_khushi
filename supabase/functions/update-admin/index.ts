// Supabase Edge Function: update-admin
//
// Called by the super-admin's "Edit Admin" UI to change an admin's name,
// email, phone, password, and/or active status. Email and password changes
// must go through the service role (auth.admin API) so the Supabase Auth
// user and the `admins` row never drift out of sync. Changing the email
// also clears the stored Google Calendar connection, forcing a reconnect.
//
// `is_active` is handled here rather than as a direct client-side table
// write on purpose: `role`/`is_active`/`auth_user_id` are revoked from the
// `authenticated` Postgres role entirely (see migration 0014) after an
// audit found a logged-in admin could otherwise self-promote to
// super_admin via a bare `.update({ role: 'super_admin' })` call, since
// the admins table's self-update RLS policy has no WITH CHECK on column
// values. Routing the one legitimate is_active write through this
// service-role function, gated on the caller actually being an active
// super_admin, closes that off without breaking deactivate/reactivate.
//
// Deploy:
//   supabase functions deploy update-admin
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { ADMIN_COLUMNS } from "../_shared/adminColumns.ts";
import { normalizeIndianPhone } from "../_shared/phone.ts";
import { normalizeSlug } from "../_shared/slug.ts";

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
    .select("id, role, is_active")
    .eq("auth_user_id", caller.id)
    .maybeSingle();

  if (!callerAdmin || callerAdmin.role !== "super_admin" || !callerAdmin.is_active) {
    return jsonResponse({ error: "Only an active super_admin can edit admins" }, 403);
  }

  const { admin_id, name, email, phone, password, slug, is_active } = await req.json();
  if (!admin_id) {
    return jsonResponse({ error: "admin_id is required" }, 400);
  }
  if (password && password.length < 8) {
    return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
  }
  if (!name && !email && !phone && !password && !slug && is_active === undefined) {
    return jsonResponse({ error: "Nothing to update" }, 400);
  }
  if (is_active !== undefined && typeof is_active !== "boolean") {
    return jsonResponse({ error: "is_active must be a boolean" }, 400);
  }
  // A super_admin can deactivate themselves by mistake through no other
  // path than this one — block it explicitly rather than let them lock
  // themselves out with no way back in (every other admin-management
  // action requires an active super_admin session).
  if (is_active === false && admin_id === callerAdmin?.id) {
    return jsonResponse({ error: "You can't deactivate your own account." }, 400);
  }
  let normalizedPhone: string | null = null;
  if (phone) {
    normalizedPhone = normalizeIndianPhone(phone);
    if (!normalizedPhone) {
      return jsonResponse({ error: "Enter a valid 10-digit mobile number" }, 400);
    }
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: target } = await adminClient
    .from("admins")
    .select("auth_user_id, slug")
    .eq("id", admin_id)
    .maybeSingle();

  if (!target) {
    return jsonResponse({ error: "Admin not found" }, 404);
  }

  let normalizedSlug: string | null = null;
  const isSlugChange = !!slug && slug !== target.slug;
  if (isSlugChange) {
    normalizedSlug = normalizeSlug(slug);
    if (!normalizedSlug) {
      return jsonResponse({ error: "Use 3-50 lowercase letters, numbers and hyphens only." }, 400);
    }
    const { data: existingSlug } = await adminClient
      .from("admins")
      .select("id")
      .eq("slug", normalizedSlug)
      .neq("id", admin_id)
      .maybeSingle();
    if (existingSlug) {
      return jsonResponse({ error: "That link is already taken. Try another." }, 409);
    }
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
  if (normalizedPhone) rowUpdate.phone = normalizedPhone;
  if (isSlugChange && normalizedSlug) rowUpdate.slug = normalizedSlug;
  if (is_active !== undefined) rowUpdate.is_active = is_active;

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
      .select(ADMIN_COLUMNS)
      .single();
    if (updateError) {
      // 23505 = unique violation — the pre-check above is best-effort;
      // this is the actual guard against two edits racing for one slug.
      const isDuplicateSlug = updateError.code === "23505" && /slug/i.test(updateError.message);
      return jsonResponse(
        { error: isDuplicateSlug ? "That link is already taken. Try another." : updateError.message },
        400
      );
    }
    admin = data;
  }

  return jsonResponse({ admin });
});
