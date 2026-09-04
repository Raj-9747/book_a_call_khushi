import { createClient } from "@/lib/supabase/client";
import type { DiscountCodeWithEvents } from "@/types/models";

export interface DiscountCodeInput {
  code: string;
  percent: number;
  expires_at: string | null;
  max_uses: number | null;
  applies_to_all: boolean;
  event_type_ids: string[];
}

interface DiscountRow {
  discount_code_event_types: { event_type_id: string }[] | null;
  [key: string]: unknown;
}

function normalize(row: DiscountRow): DiscountCodeWithEvents {
  const { discount_code_event_types, ...rest } = row;
  return {
    ...rest,
    event_type_ids: (discount_code_event_types ?? []).map((r) => r.event_type_id),
  } as DiscountCodeWithEvents;
}

export async function listDiscountCodes(adminId: string): Promise<DiscountCodeWithEvents[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .select("*, discount_code_event_types(event_type_id)")
    .eq("admin_id", adminId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => normalize(row as DiscountRow));
}

/** Replaces the code's event-type scope. Deleting then inserting is fine
 * here: the join table is tiny and only the owning admin can touch it. */
async function setScope(codeId: string, appliesToAll: boolean, eventTypeIds: string[]) {
  const supabase = createClient();
  const { error: deleteError } = await supabase
    .from("discount_code_event_types")
    .delete()
    .eq("discount_code_id", codeId);
  if (deleteError) throw deleteError;

  if (appliesToAll || eventTypeIds.length === 0) return;

  const { error: insertError } = await supabase
    .from("discount_code_event_types")
    .insert(eventTypeIds.map((id) => ({ discount_code_id: codeId, event_type_id: id })));
  if (insertError) throw insertError;
}

function duplicateCodeError(error: { code?: string }) {
  // 23505 = unique violation on (admin_id, upper(code))
  return error.code === "23505" ? new Error("You already have a code with that name.") : null;
}

export async function createDiscountCode(adminId: string, input: DiscountCodeInput): Promise<DiscountCodeWithEvents> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .insert({
      admin_id: adminId,
      code: input.code,
      percent: input.percent,
      expires_at: input.expires_at,
      max_uses: input.max_uses,
      applies_to_all: input.applies_to_all,
    })
    .select()
    .single();

  if (error) throw duplicateCodeError(error) ?? error;

  await setScope(data.id, input.applies_to_all, input.event_type_ids);
  return { ...data, event_type_ids: input.applies_to_all ? [] : input.event_type_ids } as DiscountCodeWithEvents;
}

export async function updateDiscountCode(id: string, input: DiscountCodeInput): Promise<DiscountCodeWithEvents> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .update({
      code: input.code,
      percent: input.percent,
      expires_at: input.expires_at,
      max_uses: input.max_uses,
      applies_to_all: input.applies_to_all,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw duplicateCodeError(error) ?? error;

  await setScope(id, input.applies_to_all, input.event_type_ids);
  return { ...data, event_type_ids: input.applies_to_all ? [] : input.event_type_ids } as DiscountCodeWithEvents;
}

export async function setDiscountCodeActive(id: string, isActive: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("discount_codes").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function deleteDiscountCode(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("discount_codes").delete().eq("id", id);
  if (error) throw error;
}
