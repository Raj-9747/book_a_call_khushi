export type AdminRole = "super_admin" | "admin";

export interface Admin {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  slug: string;
  role: AdminRole;
  is_active: boolean;
  timezone: string;
  google_calendar_connected: boolean;
  weekly_availability?: unknown;
  created_at: string;

  // Public profile — every field optional, each renders on /book/<slug>
  // only when the admin has actually filled it in.
  photo_url: string | null;
  headline: string | null;
  about: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  /** Column is `x_url`, not `twitter_url` — the platform renamed in 2023.
   * The admin-facing label still says "X (Twitter)" for recognisability. */
  x_url: string | null;
  website_url: string | null;

  // Booking configuration
  accepting_bookings: boolean;
  unavailable_message: string | null;
  min_notice_minutes: number;
  booking_window_days: number;
}

export interface DiscountCode {
  id: string;
  admin_id: string;
  code: string;
  percent: number;
  /** null = never expires */
  expires_at: string | null;
  /** null = unlimited */
  max_uses: number | null;
  times_used: number;
  /** When true the code covers every event type this admin owns, and
   * `event_type_ids` is ignored. */
  applies_to_all: boolean;
  is_active: boolean;
  created_at: string;
}

export interface DiscountCodeWithEvents extends DiscountCode {
  event_type_ids: string[];
}

export type EnquiryStatus = "new" | "contacted" | "closed";

export interface BookingEnquiry {
  id: string;
  admin_id: string;
  event_type_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: EnquiryStatus;
  created_at: string;
}

export interface EventType {
  id: string;
  admin_id: string;
  slug: string;
  name: string;
  duration_minutes: number;
  price: number;
  description: string | null;
  custom_questions: CustomQuestion[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomQuestion {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  options?: string[];
}

export type BookingStatus = "pending_confirmation" | "confirmed" | "cancelled" | "completed";
export type PaymentStatus = "free" | "paid_dummy";
export type LeadTag = "Lead" | "Client" | "Follow-up" | "Closed";

export interface Booking {
  id: string;
  admin_id: string;
  event_type_id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  custom_answers: Record<string, string>;
  start_time: string;
  end_time: string;
  client_timezone: string | null;
  status: BookingStatus;
  payment_status: PaymentStatus;
  /** Pricing, as computed server-side at booking time. `base_amount` is the
   * event type's list price; `amount_due` is what was actually charged
   * after any discount. */
  base_amount: number | null;
  discount_code_id: string | null;
  discount_percent: number | null;
  amount_due: number | null;
  currency: string;
  google_event_id: string | null;
  meet_link: string | null;
  reminder_sent: boolean;
  notes: string | null;
  tag: LeadTag | null;
  created_at: string;
  updated_at: string;
}

export interface BlockedSlot {
  id: string;
  admin_id: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  google_event_id?: string | null;
  created_at: string;
}
