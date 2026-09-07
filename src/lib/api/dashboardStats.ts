import type { SupabaseClient } from "@supabase/supabase-js";

export interface TodayBooking {
  id: string;
  client_name: string;
  event_name: string;
  start_time: string;
  end_time: string;
  meet_link: string | null;
}

export interface TopEventType {
  name: string;
  bookings: number;
  revenue: number;
}

export interface DashboardOverview {
  earnings: { this_month: number; last_month: number; all_time: number };
  today: TodayBooking[];
  actions: { pending_requests: number; new_enquiries: number; awaiting_payment: number };
  top_event_types: TopEventType[];
  counts: { upcoming: number; today: number; total: number };
}

const EMPTY: DashboardOverview = {
  earnings: { this_month: 0, last_month: 0, all_time: 0 },
  today: [],
  actions: { pending_requests: 0, new_enquiries: 0, awaiting_payment: 0 },
  top_event_types: [],
  counts: { upcoming: 0, today: 0, total: 0 },
};

/** Everything the overview page shows, in one round trip.
 *
 * Takes the Supabase client rather than creating one, so the page can run
 * this during its own server render — colocated with the database instead
 * of firing from the visitor's browser after hydration.
 *
 * The RPC derives the admin from the session rather than accepting an id,
 * so there's no way to ask it for someone else's revenue. */
export async function getDashboardOverview(supabase: SupabaseClient): Promise<DashboardOverview> {
  const { data, error } = await supabase.rpc("get_dashboard_overview");

  if (error) {
    // The overview is a convenience surface — a failure here shouldn't take
    // the whole page down, so it degrades to zeros and logs the reason.
    console.error("getDashboardOverview: failed —", error.message);
    return EMPTY;
  }

  const overview = data as DashboardOverview | null;
  if (!overview) return EMPTY;

  // Postgres `numeric` arrives as a string over PostgREST; normalise the
  // money fields so the UI can format them without re-checking types.
  return {
    ...overview,
    earnings: {
      this_month: Number(overview.earnings?.this_month ?? 0),
      last_month: Number(overview.earnings?.last_month ?? 0),
      all_time: Number(overview.earnings?.all_time ?? 0),
    },
    top_event_types: (overview.top_event_types ?? []).map((row) => ({
      ...row,
      bookings: Number(row.bookings),
      revenue: Number(row.revenue),
    })),
  };
}
