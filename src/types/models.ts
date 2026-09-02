export type AdminRole = "super_admin" | "admin";

export interface Admin {
  id: string;
  name: string;
  email: string;
  slug: string;
  role: AdminRole;
  is_active: boolean;
  timezone: string;
  google_calendar_connected: boolean;
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
  created_at: string;
}
