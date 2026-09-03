import { createClient } from "@/lib/supabase/server";
import type { Admin } from "@/types/models";

/** Returns the logged-in user's `admins` row, or null if not signed in / not yet provisioned. */
export async function getCurrentAdmin(): Promise<Admin | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("admins")
    .select("id, name, email, phone, slug, role, is_active, timezone, google_calendar_connected, weekly_availability, created_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data as Admin | null;
}
