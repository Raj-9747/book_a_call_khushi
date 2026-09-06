import { createClient } from "@/lib/supabase/client";
import type { Booking, CustomQuestion, LeadTag } from "@/types/models";

export interface BookingWithEventType extends Booking {
  event_types: { name: string; duration_minutes: number; custom_questions: CustomQuestion[] } | null;
}

export type BookingSortField = "start_time" | "created_at";

export interface ListBookingsParams {
  page: number; // 1-indexed
  pageSize: number;
  sortField: BookingSortField;
  sortAscending: boolean;
  search?: string;
  status?: string; // "all" or a real status value
  eventTypeId?: string; // "all" or a real event_type id
}

export interface ListBookingsResult {
  bookings: BookingWithEventType[];
  totalCount: number;
}

function normalizeBooking(row: Record<string, unknown>): BookingWithEventType {
  // Postgres `numeric` columns arrive as strings over PostgREST — normalize
  // the money fields so callers can do arithmetic on them safely.
  return {
    ...row,
    base_amount: row.base_amount === null ? null : Number(row.base_amount as string),
    amount_due: row.amount_due === null ? null : Number(row.amount_due as string),
  } as unknown as BookingWithEventType;
}

/** Server-side filtered, sorted, paginated — not a client-side slice of a
 * fully-fetched list. That distinction matters once an admin has years of
 * booking history: this stays a fixed-size query regardless of how many
 * rows exist, instead of one that grows (and gets slower) forever. */
export async function listBookings(adminId: string, params: ListBookingsParams): Promise<ListBookingsResult> {
  const supabase = createClient();
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  let query = supabase
    .from("bookings")
    .select("*, event_types(name, duration_minutes, custom_questions)", { count: "exact" })
    .eq("admin_id", adminId);

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }
  if (params.eventTypeId && params.eventTypeId !== "all") {
    query = query.eq("event_type_id", params.eventTypeId);
  }
  const trimmedSearch = params.search?.trim();
  if (trimmedSearch) {
    // Escape PostgREST's own special characters in an ilike pattern so a
    // client typing "%" or "," doesn't get treated as query syntax.
    const escaped = trimmedSearch.replace(/[%,]/g, "\\$&");
    query = query.or(`client_name.ilike.%${escaped}%,client_email.ilike.%${escaped}%`);
  }

  query = query.order(params.sortField, { ascending: params.sortAscending }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return { bookings: (data ?? []).map(normalizeBooking), totalCount: count ?? 0 };
}

export async function updateBookingLeadInfo(id: string, input: { notes?: string; tag?: LeadTag | null }): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("bookings").update(input).eq("id", id);
  if (error) throw error;
}

export async function cancelBooking(id: string): Promise<void> {
  const supabase = createClient();

  // Best-effort — remove the corresponding Google Calendar event too, if
  // one exists. Never blocks the cancellation itself over a Calendar-side
  // hiccup (e.g. an expired token).
  try {
    await supabase.functions.invoke("delete-booking-calendar-event", { body: { booking_id: id } });
  } catch {
    // Ignore — cancellation still proceeds below regardless.
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_by: "admin" })
    .eq("id", id);
  if (error) throw error;
}

export async function markBookingCompleted(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("bookings").update({ status: "completed" }).eq("id", id);
  if (error) throw error;
}
