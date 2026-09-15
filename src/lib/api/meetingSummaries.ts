import { createClient } from "@/lib/supabase/client";

/** One bullet of the structured overview — {heading: null} for a plain
 * bullet with no "**bold:**" prefix in Fireflies' source text. Parsed once
 * in the n8n pipeline (see fireflies-mom-pipeline.json's "Prepare MoM
 * Data" node) so this shape is shared by the PDF, this admin view, and the
 * client's copy on /booking/[token] — nobody re-parses markdown locally. */
export interface OverviewPoint {
  heading: string | null;
  text: string;
}

/** The admin's fuller view of a meeting summary — includes overview,
 * keywords and the transcript link, unlike the client's copy on
 * /booking/[token] which is deliberately limited to gist + overview_points
 * + action_items (see PLAN.md §11.2 "MoM content split"). */
export interface MeetingSummary {
  id: string;
  booking_id: string;
  title: string | null;
  gist: string | null;
  short_summary: string | null;
  overview: string | null;
  overview_points: OverviewPoint[];
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
    .select("id, booking_id, title, gist, short_summary, overview, overview_points, action_items, keywords, transcript_url, mom_pdf_url, duration_minutes, mom_sent_at, created_at")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    overview_points: (data.overview_points ?? []) as OverviewPoint[],
    action_items: (data.action_items ?? []) as string[],
    keywords: (data.keywords ?? []) as string[],
  };
}
