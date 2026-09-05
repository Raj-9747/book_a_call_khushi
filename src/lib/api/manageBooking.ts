import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/** What the magic-link page can see. Deliberately narrow: the token is a
 * bearer credential sitting in an email, so it resolves to this one
 * booking's own details and the public bits of the admin's profile —
 * nothing else. */
export interface ManagedBooking {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  amount_paid: number | null;
  amount_due: number | null;
  client_name: string;
  client_email: string;
  client_timezone: string | null;
  meet_link: string | null;
  admin_name: string;
  admin_slug: string;
  admin_photo_url: string | null;
  admin_headline: string | null;
  event_name: string;
  event_description: string | null;
  duration_minutes: number;
}

function normalize(row: ManagedBooking): ManagedBooking {
  return {
    ...row,
    amount_paid: row.amount_paid === null ? null : Number(row.amount_paid),
    amount_due: row.amount_due === null ? null : Number(row.amount_due),
  };
}

/** Server-side variant, for rendering the page. */
export async function getBookingByToken(
  supabase: SupabaseClient,
  token: string
): Promise<ManagedBooking | null> {
  const { data, error } = await supabase.rpc("get_booking_by_token", { p_token: token });
  if (error) return null;
  const row = (data as ManagedBooking[] | null)?.[0];
  return row ? normalize(row) : null;
}

/** Client-side variant, for refreshing after an action. */
export async function fetchBookingByToken(token: string): Promise<ManagedBooking | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_booking_by_token", { p_token: token });
  if (error) throw error;
  const row = (data as ManagedBooking[] | null)?.[0];
  return row ? normalize(row) : null;
}
