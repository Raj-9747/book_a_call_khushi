import { createClient } from "@/lib/supabase/client";
import { ADMIN_COLUMNS } from "@/lib/api/adminColumns";
import { edgeFunctionError } from "@/lib/api/edgeFunctionError";
import type { Admin } from "@/types/models";

export async function listAdmins(): Promise<Admin[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("admins")
    .select(ADMIN_COLUMNS)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as unknown as Admin[];
}

export async function createAdmin(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<Admin> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("create-admin", { body: input });

  if (error) throw await edgeFunctionError(error, "Failed to create admin.");
  if (data?.error) throw new Error(data.error);
  return data.admin as Admin;
}

export async function updateAdmin(input: {
  admin_id: string;
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  slug?: string;
  is_active?: boolean;
}): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("update-admin", { body: input });
  if (error) throw await edgeFunctionError(error, "Failed to update admin.");
  if (data?.error) throw new Error(data.error);
}

/** Goes through the `update-admin` Edge Function rather than a direct table
 * write — `role`/`is_active`/`auth_user_id` are revoked from the
 * `authenticated` Postgres role entirely (migration 0014), after an audit
 * found a logged-in admin could otherwise self-promote to super_admin via
 * a bare `.update({ role: 'super_admin' })` call on their own row (the
 * admins table's self-update RLS policy had no WITH CHECK on values). This
 * is the one legitimate is_active write, so it's routed through the
 * service-role function instead, gated on the caller being an active
 * super_admin. */
export async function setAdminActive(id: string, isActive: boolean): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("update-admin", {
    body: { admin_id: id, is_active: isActive },
  });
  if (error) throw await edgeFunctionError(error, "Failed to update admin.");
  if (data?.error) throw new Error(data.error);
}

export async function removeAdmin(id: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("remove-admin", { body: { admin_id: id } });
  if (error) throw await edgeFunctionError(error, "Failed to remove admin.");
  if (data?.error) throw new Error(data.error);
}

const PHOTO_BUCKET = "admin-photos";
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Public profile fields an admin edits about themselves. Unlike
 * name/email/phone these don't touch the Supabase Auth user, so they go
 * straight to the table under RLS — no Edge Function round-trip. */
export interface ProfileFields {
  headline?: string | null;
  about?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
  accepting_bookings?: boolean;
  unavailable_message?: string | null;
  photo_url?: string | null;
}

export async function updateProfileFields(id: string, fields: ProfileFields): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("admins").update(fields).eq("id", id);
  if (error) throw error;
}

/** Turns the stored public URL back into the object path inside the bucket,
 * so the previous photo can be cleaned up when a new one is uploaded.
 * Returns null for anything that isn't one of our own bucket URLs. */
function photoPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/${PHOTO_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

/** Uploads a new profile photo, points the admin row at it, then removes
 * the old file. Storage RLS confines writes to the `<admin_id>/` folder, so
 * the id in the path is load-bearing, not cosmetic. */
export async function uploadAdminPhoto(adminId: string, file: File, previousUrl: string | null): Promise<string> {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    throw new Error("Please choose a JPG, PNG or WebP image.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("That image is larger than 2 MB. Please choose a smaller one.");
  }

  const supabase = createClient();
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${adminId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);

  const { error: updateError } = await supabase.from("admins").update({ photo_url: publicUrl }).eq("id", adminId);
  if (updateError) {
    // Don't leave an orphaned file behind if the row update failed.
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw updateError;
  }

  // Best-effort cleanup — a leftover old file is harmless, and failing the
  // whole upload over it would be worse.
  const oldPath = photoPathFromUrl(previousUrl);
  if (oldPath && oldPath !== path) {
    await supabase.storage.from(PHOTO_BUCKET).remove([oldPath]);
  }

  return publicUrl;
}

export async function removeAdminPhoto(adminId: string, currentUrl: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("admins").update({ photo_url: null }).eq("id", adminId);
  if (error) throw error;

  const path = photoPathFromUrl(currentUrl);
  if (path) await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

/** An admin editing their OWN name/phone/email/slug. Changing email forces
 * a Google Calendar reconnect (clears the stored token); changing the slug
 * immediately breaks any `/book/<old-slug>` link already shared — the
 * caller is expected to have warned about that before calling this. See
 * the update-own-profile Edge Function for why both go through it rather
 * than a plain table write. */
export async function updateOwnProfile(input: {
  name?: string;
  email?: string;
  phone?: string;
  slug?: string;
}): Promise<Admin> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("update-own-profile", { body: input });
  if (error) throw await edgeFunctionError(error, "Failed to update profile.");
  if (data?.error) throw new Error(data.error);
  return data.admin as Admin;
}
