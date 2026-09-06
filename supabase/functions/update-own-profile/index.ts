// Supabase Edge Function: update-own-profile
//
// Lets a logged-in admin (any role) edit their OWN name, phone, email,
// and/or slug (their public booking link — `/book/<slug>`). Email changes
// go through the service role so the Supabase Auth user and the `admins`
// row stay in sync (and skip Supabase's default email-confirmation flow,
// matching how the super-admin's update-admin function already works) —
// and also clear the stored Google Calendar connection, forcing a
// reconnect after an identity change.
//
// Deploy:
//   supabase functions deploy update-own-profile
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
    .select("id, email, slug, is_active")
    .eq("auth_user_id", caller.id)
    .maybeSingle();
  if (!callerAdmin || !callerAdmin.is_active) {
    return jsonResponse({ error: "No active admin account linked to this login" }, 403);
  }

  const { name, email, phone, slug } = await req.json();
  if (!name && !email && !phone && !slug) {
    return jsonResponse({ error: "Nothing to update" }, 400);
  }
  let normalizedPhone: string | null = null;
  if (phone) {
    normalizedPhone = normalizeIndianPhone(phone);
    if (!normalizedPhone) {
      return jsonResponse({ error: "Enter a valid 10-digit mobile number" }, 400);
    }
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const isEmailChange = !!email && email !== callerAdmin.email;

  let normalizedSlug: string | null = null;
  const isSlugChange = !!slug && slug !== callerAdmin.slug;
  if (isSlugChange) {
    normalizedSlug = normalizeSlug(slug);
    if (!normalizedSlug) {
      return jsonResponse({ error: "Use 3-50 lowercase letters, numbers and hyphens only." }, 400);
    }
    const { data: existingSlug } = await adminClient
      .from("admins")
      .select("id")
      .eq("slug", normalizedSlug)
      .neq("id", callerAdmin.id)
      .maybeSingle();
    if (existingSlug) {
      return jsonResponse({ error: "That link is already taken. Try another." }, 409);
    }
  }

  if (isEmailChange) {
    const { data: existingAdminEmail } = await adminClient
      .from("admins")
      .select("id")
      .ilike("email", email)
      .neq("id", callerAdmin.id)
      .maybeSingle();
    if (existingAdminEmail) {
      return jsonResponse({ error: "An admin with this email already exists." }, 409);
    }

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(caller.id, {
      email,
      email_confirm: true,
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
  if (normalizedPhone) rowUpdate.phone = normalizedPhone;
  if (isSlugChange && normalizedSlug) rowUpdate.slug = normalizedSlug;
  if (isEmailChange) {
    rowUpdate.email = email;
    rowUpdate.google_calendar_connected = false;
    rowUpdate.google_refresh_token = null;
  }

  const { data: admin, error: updateError } = await adminClient
    .from("admins")
    .update(rowUpdate)
    .eq("id", callerAdmin.id)
    .select(ADMIN_COLUMNS)
    .single();

  if (updateError) {
    // 23505 = unique violation — the pre-check above is best-effort; this
    // is the actual guard against two people racing for the same slug.
    const isDuplicateSlug = updateError.code === "23505" && /slug/i.test(updateError.message);
    return jsonResponse({ error: isDuplicateSlug ? "That link is already taken. Try another." : updateError.message }, 400);
  }

  return jsonResponse({ admin });
});
