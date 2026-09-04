// Supabase Edge Function: create-admin
//
// Called by the super-admin's "Add Admin" UI. Runs with the service_role
// key (never exposed to the browser) so it can create a Supabase Auth user
// directly — the super-admin sets the admin's email and initial password
// themselves (no invite email involved).
//
// Deploy:
//   supabase functions deploy create-admin
// Required secrets (set via `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { ADMIN_COLUMNS } from "../_shared/adminColumns.ts";
import { normalizeIndianPhone } from "../_shared/phone.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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

  // Client scoped to the caller's own JWT — used only to verify identity/role.
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
    return jsonResponse({ error: "Only an active super_admin can add admins" }, 403);
  }

  const { name, email, phone, password } = await req.json();
  if (!name || !email || !phone || !password) {
    return jsonResponse({ error: "name, email, phone and password are required" }, 400);
  }
  if (password.length < 8) {
    return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
  }
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) {
    return jsonResponse({ error: "Enter a valid 10-digit mobile number" }, 400);
  }

  // Admin client with the service role — bypasses RLS, can manage auth users.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Check for an existing admin with this email up front, so we can give a
  // clean error instead of surfacing Supabase Auth's raw duplicate-user message.
  const { data: existingAdminEmail } = await adminClient
    .from("admins")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (existingAdminEmail) {
    return jsonResponse({ error: "An admin with this email already exists." }, 409);
  }

  // Ensure a unique slug.
  const baseSlug = slugify(name) || "admin";
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const { data: existing } = await adminClient.from("admins").select("id").eq("slug", slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    const isDuplicate = /already.*(registered|exists)/i.test(createError?.message ?? "");
    return jsonResponse(
      { error: isDuplicate ? "An account with this email already exists." : createError?.message ?? "Failed to create user" },
      400
    );
  }

  const { data: admin, error: insertError } = await adminClient
    .from("admins")
    .insert({
      auth_user_id: created.user.id,
      name,
      email,
      phone: normalizedPhone,
      slug,
      role: "admin",
    })
    .select(ADMIN_COLUMNS)
    .single();

  if (insertError) {
    // Roll back the auth user if we couldn't create the admins row.
    await adminClient.auth.admin.deleteUser(created.user.id);
    return jsonResponse({ error: insertError.message }, 400);
  }

  return jsonResponse({ admin });
});
