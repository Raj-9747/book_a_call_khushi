import { createClient } from "@/lib/supabase/client";
import type { EventTypeFormValues } from "@/lib/validations/eventType";
import type { EventType } from "@/types/models";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(adminId: string, base: string): Promise<string> {
  const supabase = createClient();
  const baseSlug = base || "event";
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const { data } = await supabase
      .from("event_types")
      .select("id")
      .eq("admin_id", adminId)
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function toCustomQuestions(input: EventTypeFormValues["custom_questions"]) {
  return input.map((q) => ({
    id: q.id,
    label: q.label,
    type: q.type,
    required: q.required,
    ...(q.type === "select"
      ? {
          options: (q.optionsText ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }
      : {}),
  }));
}

// Postgres `numeric` columns (price) come back from postgrest as strings,
// not numbers, to avoid silent precision loss — normalize on the way in.
function normalize(row: Record<string, unknown>): EventType {
  return { ...row, price: Number(row.price) } as EventType;
}

export async function listEventTypes(adminId: string): Promise<EventType[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_types")
    .select("*")
    .eq("admin_id", adminId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function createEventType(adminId: string, input: EventTypeFormValues): Promise<EventType> {
  const slug = await uniqueSlug(adminId, slugify(input.name));
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_types")
    .insert({
      admin_id: adminId,
      slug,
      name: input.name,
      duration_minutes: input.duration_minutes,
      price: input.price,
      description: input.description || null,
      custom_questions: toCustomQuestions(input.custom_questions),
    })
    .select()
    .single();

  if (error) throw error;
  return normalize(data);
}

// Note: the slug is intentionally NOT regenerated when the name changes —
// that would silently break any booking link already shared for this event
// type. Slug stays fixed once created.
export async function updateEventType(id: string, input: EventTypeFormValues): Promise<EventType> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_types")
    .update({
      name: input.name,
      duration_minutes: input.duration_minutes,
      price: input.price,
      description: input.description || null,
      custom_questions: toCustomQuestions(input.custom_questions),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return normalize(data);
}

export async function setEventTypeActive(id: string, isActive: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("event_types").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function deleteEventType(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("event_types").delete().eq("id", id);
  if (error) {
    // Postgres FK violation (23503) — this event type already has bookings,
    // which ON DELETE RESTRICT protects from being silently wiped out.
    if (error.code === "23503") {
      throw new Error("Can't delete an event type that already has bookings — deactivate it instead.");
    }
    throw error;
  }
}
