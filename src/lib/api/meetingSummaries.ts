import { createClient } from "@/lib/supabase/client";

/** The admin's fuller view of a meeting summary — includes overview,
 * keywords and the transcript link, unlike the client's copy on
 * /booking/[token] which is deliberately limited to short_summary +
 * action_items (see PLAN.md §11.2 "MoM content split"). */
export interface MeetingSummary {
  id: string;
  booking_id: string;
  title: string | null;
  short_summary: string | null;
  overview: string | null;
  action_items: string[];
  keywords: string[];
  transcript_url: string | null;
  mom_pdf_url: string | null;
  duration_minutes: number | null;
  mom_sent_at: string | null;
  created_at: string;
}

export async function getMeetingSummary(bookingId: string): Promise<MeetingSummary | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("meeting_summaries")
    .select("id, booking_id, title, short_summary, overview, action_items, keywords, transcript_url, mom_pdf_url, duration_minutes, mom_sent_at, created_at")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    action_items: (data.action_items ?? []) as string[],
    keywords: (data.keywords ?? []) as string[],
  };
}
