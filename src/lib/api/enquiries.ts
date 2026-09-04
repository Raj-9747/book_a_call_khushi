import { createClient } from "@/lib/supabase/client";
import type { BookingEnquiry, EnquiryStatus } from "@/types/models";

export interface EnquiryWithEventType extends BookingEnquiry {
  event_types: { name: string } | null;
}

export async function listEnquiries(adminId: string): Promise<EnquiryWithEventType[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("booking_enquiries")
    .select("*, event_types(name)")
    .eq("admin_id", adminId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as EnquiryWithEventType[];
}

export async function setEnquiryStatus(id: string, status: EnquiryStatus): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("booking_enquiries").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteEnquiry(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("booking_enquiries").delete().eq("id", id);
  if (error) throw error;
}
