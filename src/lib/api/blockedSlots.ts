import { createClient } from "@/lib/supabase/client";
import type { BlockedSlotFormValues } from "@/lib/validations/blockedSlot";
import type { BlockedSlot } from "@/types/models";

export async function listBlockedSlots(adminId: string): Promise<BlockedSlot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("blocked_slots")
    .select("*")
    .eq("admin_id", adminId)
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data as BlockedSlot[];
}

// Admins author times in IST (per product decision), regardless of the
// browser's own local timezone — so the offset must be explicit here rather
// than relying on `new Date(...)`'s implicit browser-local interpretation.
function istDateTimeToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+05:30`).toISOString();
}

export async function createBlockedSlot(adminId: string, input: BlockedSlotFormValues): Promise<BlockedSlot> {
  const startTime = input.allDay ? "00:00" : input.startTime;
  const endTime = input.allDay ? "23:59" : input.endTime;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("blocked_slots")
    .insert({
      admin_id: adminId,
      start_time: istDateTimeToIso(input.date, startTime),
      end_time: istDateTimeToIso(input.date, endTime),
      reason: input.reason || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as BlockedSlot;
}

export async function deleteBlockedSlot(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("blocked_slots").delete().eq("id", id);
  if (error) throw error;
}
