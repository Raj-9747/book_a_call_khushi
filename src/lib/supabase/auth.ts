import { createClient } from "@/lib/supabase/server";
import { ADMIN_COLUMNS } from "@/lib/api/adminColumns";
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
    .select(`${ADMIN_COLUMNS}, weekly_availability`)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data as Admin | null;
}
