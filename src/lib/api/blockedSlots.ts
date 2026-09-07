import { createClient } from "@/lib/supabase/client";
import { expandOccurrenceDates, type BlockedSlotFormValues } from "@/lib/validations/blockedSlot";
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

/** Best-effort sync to the admin's real Google Calendar — never blocks or
 * fails the block/unblock action itself over a Calendar-side hiccup. */
async function syncToCalendar(action: "create" | "delete", blockedSlotId: string): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.functions.invoke("sync-blocked-slot-calendar", { body: { action, blocked_slot_id: blockedSlotId } });
  } catch {
    // Ignore — the block still works within Zaptly regardless.
  }
}

/** Creates one block, or a whole repeating series sharing a
 * `recurrence_group_id`. Returns every row created, earliest first. */
export async function createBlockedSlot(adminId: string, input: BlockedSlotFormValues): Promise<BlockedSlot[]> {
  const startTime = input.allDay ? "00:00" : input.startTime;
  const endTime = input.allDay ? "23:59" : input.endTime;

  const dates = expandOccurrenceDates(input);
  const isSeries = dates.length > 1;
  const groupId = isSeries ? crypto.randomUUID() : null;

  const rows = dates.map((date) => ({
    admin_id: adminId,
    start_time: istDateTimeToIso(date, startTime),
    end_time: istDateTimeToIso(date, endTime),
    reason: input.reason || null,
    recurrence_group_id: groupId,
  }));

  const supabase = createClient();
  const { data, error } = await supabase.from("blocked_slots").insert(rows).select();

  if (error) {
    // 23P01 = exclusion-constraint violation, i.e. this range overlaps a
    // block that already exists (migration 0016). Far more useful than the
    // raw Postgres text, and the single most likely thing to go wrong here
    // now that repeats can generate dozens of rows at once.
    if (error.code === "23P01") {
      throw new Error(
        isSeries
          ? "One or more dates in that series overlap time you've already blocked. Nothing was saved — adjust the dates or remove the existing block first."
          : "That overlaps time you've already blocked."
      );
    }
    throw error;
  }

  const created = (data ?? []) as BlockedSlot[];

  // In parallel: a 20-occurrence series shouldn't take 20× as long to save.
  // allSettled because Calendar sync is best-effort — a failure there must
  // never make the block itself look like it failed.
  await Promise.allSettled(created.map((slot) => syncToCalendar("create", slot.id)));

  return created.sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export async function deleteBlockedSlot(id: string): Promise<void> {
  // Must happen BEFORE the row is deleted — the sync function needs to read
  // this row to find its google_event_id.
  await syncToCalendar("delete", id);

  const supabase = createClient();
  const { error } = await supabase.from("blocked_slots").delete().eq("id", id);
  if (error) throw error;
}

/** Removes an entire repeating series in one go — deleting 30 occurrences
 * one row at a time from the UI would be miserable. */
export async function deleteBlockedSlotSeries(recurrenceGroupId: string): Promise<void> {
  const supabase = createClient();
  const { data, error: fetchError } = await supabase
    .from("blocked_slots")
    .select("id")
    .eq("recurrence_group_id", recurrenceGroupId);
  if (fetchError) throw fetchError;

  await Promise.allSettled(((data ?? []) as { id: string }[]).map((row) => syncToCalendar("delete", row.id)));

  const { error } = await supabase.from("blocked_slots").delete().eq("recurrence_group_id", recurrenceGroupId);
  if (error) throw error;
}
