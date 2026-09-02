import { createClient } from "@/lib/supabase/client";
import type { AvailabilityFormValues } from "@/lib/validations/availability";

export async function updateAvailability(adminId: string, availability: AvailabilityFormValues): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("admins")
    .update({ weekly_availability: availability })
    .eq("id", adminId);
  if (error) throw error;
}
