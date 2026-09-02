// Supabase Edge Function: invite-admin
//
// Called by the super-admin's "Add Admin" UI. Runs with the service_role
// key (never exposed to the browser) so it can create a Supabase Auth user
// and send them an invite email in one step.
//
// Deploy:
//   supabase functions deploy invite-admin
// Required secrets (set via `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL")!;

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
    return jsonResponse({ error: "Only an active super_admin can invite admins" }, 403);
  }

  const { name, email } = await req.json();
  if (!name || !email) {
    return jsonResponse({ error: "name and email are required" }, 400);
  }

  // Admin client with the service role — bypasses RLS, can manage auth users.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${SITE_URL}/auth/callback`,
  });

  if (inviteError || !invited.user) {
    return jsonResponse({ error: inviteError?.message ?? "Failed to invite user" }, 400);
  }

  const { data: admin, error: insertError } = await adminClient
    .from("admins")
    .insert({
      auth_user_id: invited.user.id,
      name,
      email,
      slug,
      role: "admin",
    })
    .select()
    .single();

  if (insertError) {
    // Roll back the auth user if we couldn't create the admins row.
    await adminClient.auth.admin.deleteUser(invited.user.id);
    return jsonResponse({ error: insertError.message }, 400);
  }

  return jsonResponse({ admin });
});
