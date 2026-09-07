import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_COLUMNS } from "@/lib/api/adminColumns";
import type { Admin } from "@/types/models";

/** Returns the logged-in user's `admins` row, or null if not signed in / not
 * yet provisioned.
 *
 * Wrapped in React's `cache()` because every gated route calls this TWICE
 * for the same navigation — once in its layout (e.g. `dashboard/layout.tsx`)
 * to gate access, and again in the page itself to read the admin's data.
 * Without this, that's two separate `auth.getUser()` round trips to
 * Supabase PLUS two identical `admins` table queries, per page view.
 * `cache()` dedupes calls within a single request's render pass — it does
 * NOT persist across requests, so a fresh navigation still re-checks auth
 * properly; it only collapses the layout+page duplication within one. */
export const getCurrentAdmin = cache(async (): Promise<Admin | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("admins")
    .select(`${ADMIN_COLUMNS}, weekly_availability`)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Surfaced, not swallowed. This query failing returns null, which every
  // gated layout reads as "not signed in" and bounces to /login — so a
  // schema drift (e.g. ADMIN_COLUMNS naming a column a migration hasn't
  // added yet) shows up as an unexplained login loop rather than an error.
  // Logging it makes that five seconds to diagnose instead of an hour.
  if (error) {
    console.error("getCurrentAdmin: failed to load the admin row —", error.message);
    return null;
  }

  return data as Admin | null;
});
