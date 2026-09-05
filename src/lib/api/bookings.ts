import { createClient } from "@/lib/supabase/client";
import type { Booking, CustomQuestion, LeadTag } from "@/types/models";

export interface BookingWithEventType extends Booking {
  event_types: { name: string; duration_minutes: number; custom_questions: CustomQuestion[] } | null;
}

export async function listBookings(adminId: string): Promise<BookingWithEventType[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, event_types(name, duration_minutes, custom_questions)")
    .eq("admin_id", adminId)
    .order("start_time", { ascending: false });

  if (error) throw error;
  // Postgres `numeric` columns arrive as strings over PostgREST — normalize
  // the money fields so callers can do arithmetic on them safely.
  return (data ?? []).map((row) => ({
    ...row,
    base_amount: row.base_amount === null ? null : Number(row.base_amount),
    amount_due: row.amount_due === null ? null : Number(row.amount_due),
  })) as unknown as BookingWithEventType[];
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
