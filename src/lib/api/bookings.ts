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
  return (data ?? []) as unknown as BookingWithEventType[];
}

export async function updateBookingLeadInfo(id: string, input: { notes?: string; tag?: LeadTag | null }): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("bookings").update(input).eq("id", id);
  if (error) throw error;
}

export async function cancelBooking(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
  if (error) throw error;
}

export async function markBookingCompleted(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("bookings").update({ status: "completed" }).eq("id", id);
  if (error) throw error;
}
