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
  admin_id: string;
  admin_name: string;
  admin_slug: string;
  admin_photo_url: string | null;
  admin_headline: string | null;
  admin_weekly_availability: Record<string, { enabled: boolean; start: string; end: string }>;
  admin_google_calendar_connected: boolean;
  admin_min_notice_minutes: number;
  admin_booking_window_days: number;
  event_type_id: string;
  event_name: string;
  event_description: string | null;
  duration_minutes: number;
  request_id: string | null;
  request_type: "reschedule" | "cancel" | null;
  request_status: "pending" | "approved" | "rejected" | null;
  request_preferred_start: string | null;
}

function normalize(row: ManagedBooking): ManagedBooking {
  return {
    ...row,
    amount_paid: row.amount_paid === null ? null : Number(row.amount_paid),
    amount_due: row.amount_due === null ? null : Number(row.amount_due),
    admin_weekly_availability: row.admin_weekly_availability ?? {},
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

/** Submits a reschedule or cancellation REQUEST — never changes the booking
 * itself. The admin reviews it from their Requests page and decides. */
export async function createChangeRequest(input: {
  token: string;
  type: "reschedule" | "cancel";
  message: string | null;
  preferredStart: Date | null;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("create_change_request", {
    p_token: input.token,
    p_type: input.type,
    p_message: input.message,
    p_preferred_start: input.preferredStart?.toISOString() ?? null,
  });
  if (error) throw error;
}
