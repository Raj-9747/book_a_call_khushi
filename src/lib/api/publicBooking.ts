import { createClient } from "@/lib/supabase/client";

export interface PublicAdmin {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  weekly_availability: Record<string, { enabled: boolean; start: string; end: string }>;
  google_calendar_connected: boolean;
  photo_url: string | null;
  headline: string | null;
  about: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  accepting_bookings: boolean;
  unavailable_message: string | null;
  min_notice_minutes: number;
  booking_window_days: number;
}

/** One row of the "pick a session" list on an admin's public profile. */
export interface PublicAdminEventType {
  id: string;
  slug: string;
  name: string;
  duration_minutes: number;
  price: number;
  description: string | null;
}

export interface PublicEventType {
  id: string;
  admin_id: string;
  slug: string;
  name: string;
  duration_minutes: number;
  price: number;
  description: string | null;
  custom_questions: {
    id: string;
    label: string;
    type: "text" | "textarea" | "select";
    required: boolean;
    options?: string[];
  }[];
}

export interface BusyRange {
  start_time: string;
  end_time: string;
}

export async function getPublicAdmin(slug: string): Promise<PublicAdmin | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_public_admin", { p_slug: slug });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return { ...row, weekly_availability: (row.weekly_availability ?? {}) as PublicAdmin["weekly_availability"] };
}

export async function getPublicAdminEventTypes(adminId: string): Promise<PublicAdminEventType[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_public_admin_event_types", { p_admin_id: adminId });
  if (error) throw error;
  // `price` is Postgres `numeric`, which comes back over PostgREST as a
  // string — normalize here so no caller has to remember.
  return (data ?? []).map((row: PublicAdminEventType) => ({ ...row, price: Number(row.price) }));
}

/** Submitted from the public pages when an admin has bookings turned off. */
export async function createBookingEnquiry(input: {
  adminSlug: string;
  eventSlug?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  message?: string | null;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("create_booking_enquiry", {
    p_admin_slug: input.adminSlug,
    p_event_slug: input.eventSlug ?? null,
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone ?? null,
    p_message: input.message ?? null,
  });
  if (error) throw error;
}

export async function getPublicEventType(adminId: string, slug: string): Promise<PublicEventType | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_public_event_type", { p_admin_id: adminId, p_slug: slug });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return { ...row, price: Number(row.price), custom_questions: row.custom_questions ?? [] };
}

export async function getBusyRanges(adminId: string, from: Date, to: Date): Promise<BusyRange[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_busy_ranges", {
    p_admin_id: adminId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw error;
  return data ?? [];
}

/** Checks the admin's actual Google Calendar for conflicts (e.g. a meeting
 * they created directly in Google, not through Zaptly). Fails open — an
 * expired token or any Calendar-side error just means no extra busy times
 * come back, not that the whole page breaks. */
export async function getGoogleBusyRanges(adminId: string, from: Date, to: Date): Promise<BusyRange[]> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("get-google-busy-times", {
    body: { admin_id: adminId, from: from.toISOString(), to: to.toISOString() },
  });
  if (error) return [];
  const busy = (data?.busy ?? []) as { start: string; end: string }[];
  return busy.map((b) => ({ start_time: b.start, end_time: b.end }));
}

export interface CreateBookingInput {
  adminId: string;
  eventTypeId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  customAnswers: Record<string, string>;
  startTime: Date;
  clientTimezone: string;
}

export interface CreatedBooking {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
}

export async function createPublicBooking(input: CreateBookingInput): Promise<CreatedBooking> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_public_booking", {
    p_admin_id: input.adminId,
    p_event_type_id: input.eventTypeId,
    p_client_name: input.clientName,
    p_client_email: input.clientEmail,
    p_client_phone: input.clientPhone || null,
    p_custom_answers: input.customAnswers,
    p_start_time: input.startTime.toISOString(),
    p_client_timezone: input.clientTimezone,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("Booking failed — please try again.");
  return row;
}
