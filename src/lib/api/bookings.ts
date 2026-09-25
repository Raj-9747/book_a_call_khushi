import { createClient } from "@/lib/supabase/client";
import type { Booking, CustomQuestion, LeadTag } from "@/types/models";

export interface BookingWithEventType extends Booking {
  event_types: { name: string; duration_minutes: number; custom_questions: CustomQuestion[]; record_meeting: boolean } | null;
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
    amount_paid: row.amount_paid == null ? null : Number(row.amount_paid as string),
    refund_amount: row.refund_amount == null ? null : Number(row.refund_amount as string),
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
    .select("*, event_types(name, duration_minutes, custom_questions, record_meeting)", { count: "exact" })
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

export async function updateBookingLeadInfo(
  id: string,
  input: { notes?: string | null; tag?: LeadTag | null }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("bookings").update(input).eq("id", id);
  if (error) throw error;
}

/** Admin-initiated cancellation. `refundAmount` > 0 refunds through Razorpay
 * FIRST — if Razorpay refuses, the booking stays as it was rather than
 * ending up cancelled with the client's money still taken. */
export async function cancelBooking(id: string, refundAmount = 0): Promise<void> {
  const supabase = createClient();

  if (refundAmount > 0) {
    const { data, error } = await supabase.functions.invoke("refund-razorpay-payment", {
      body: { booking_id: id, amount: refundAmount, reason: "Cancelled by admin" },
    });
    if (error) {
      // FunctionsHttpError hides Razorpay's message in the response body.
      const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
      throw new Error(body?.error ?? error.message);
    }
    if (data?.error) throw new Error(data.error);
  }

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

/** Moves a booking to a new time. Shared by the client-request approval and
 * the admin's direct reschedule. Re-validates the slot for real — including
 * unexpired payment holds, which also occupy a slot — then reuses the
 * confirmation pipeline: `confirmation_sent=false` makes the DB webhook fire
 * again, creating a fresh Calendar event and sending the "rescheduled"
 * message. */
export async function moveBooking(params: {
  bookingId: string;
  currentStart: string;
  durationMinutes: number;
  newStart: Date;
}): Promise<void> {
  const supabase = createClient();
  const { bookingId, newStart } = params;
  const newEnd = new Date(newStart.getTime() + params.durationMinutes * 60_000);

  if (newStart.toISOString() === new Date(params.currentStart).toISOString()) {
    throw new Error("That's the current time — pick a different one.");
  }
  if (newStart.getTime() <= Date.now()) {
    throw new Error("Pick a time in the future.");
  }

  // RLS scopes both tables to the caller's own admin_id.
  const [{ data: conflictingBookings }, { data: conflictingBlocks }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id")
      .neq("id", bookingId)
      .or(`status.in.(confirmed,pending_confirmation),and(status.eq.pending_payment,hold_expires_at.gt.${new Date().toISOString()})`)
      .lt("start_time", newEnd.toISOString())
      .gt("end_time", newStart.toISOString()),
    supabase
      .from("blocked_slots")
      .select("id")
      .lt("start_time", newEnd.toISOString())
      .gt("end_time", newStart.toISOString()),
  ]);

  if ((conflictingBookings?.length ?? 0) > 0 || (conflictingBlocks?.length ?? 0) > 0) {
    throw new Error("That time is no longer free — pick a different slot.");
  }

  // Best-effort — remove the stale Calendar event for the OLD time.
  try {
    await supabase.functions.invoke("delete-booking-calendar-event", { body: { booking_id: bookingId } });
  } catch {
    /* best-effort */
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
      google_event_id: null,
      meet_link: null,
      // Marks this as a MOVE, not a first booking — written in the same
      // UPDATE so it's on the DB-webhook record when the relay runs.
      rescheduled_at: new Date().toISOString(),
      previous_start_time: params.currentStart,
      confirmation_sent: false,
      // The reminders must fire again for the new time.
      reminder_sent: false,
    })
    .eq("id", bookingId);
  if (error) throw error;
}

export async function markBookingCompleted(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("bookings").update({ status: "completed" }).eq("id", id);
  if (error) throw error;
}
