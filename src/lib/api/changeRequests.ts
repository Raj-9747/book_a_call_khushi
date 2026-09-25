import { createClient } from "@/lib/supabase/client";
import { moveBooking } from "@/lib/api/bookings";

export type ChangeRequestType = "reschedule" | "cancel";
export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface ChangeRequestWithBooking {
  id: string;
  type: ChangeRequestType;
  status: ChangeRequestStatus;
  client_message: string | null;
  preferred_start_time: string | null;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  booking: {
    id: string;
    admin_id: string;
    client_name: string;
    client_email: string;
    start_time: string;
    end_time: string;
    status: string;
    amount_paid: number | null;
    refund_amount: number | null;
    razorpay_payment_id: string | null;
    event_type_id: string;
    event_types: { name: string; duration_minutes: number } | null;
  };
}

const SELECT = `
  id, type, status, client_message, preferred_start_time, admin_note, created_at, resolved_at,
  booking:bookings!inner (
    id, admin_id, client_name, client_email, start_time, end_time, status,
    amount_paid, refund_amount, razorpay_payment_id, event_type_id,
    event_types (name, duration_minutes)
  )
`;

function normalize(row: Record<string, unknown>): ChangeRequestWithBooking {
  const booking = row.booking as ChangeRequestWithBooking["booking"] & { amount_paid: unknown; refund_amount: unknown };
  return {
    ...row,
    booking: {
      ...booking,
      amount_paid: booking.amount_paid === null ? null : Number(booking.amount_paid),
      refund_amount: booking.refund_amount === null ? null : Number(booking.refund_amount),
    },
  } as ChangeRequestWithBooking;
}

export async function listChangeRequests(adminId: string): Promise<ChangeRequestWithBooking[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("booking_change_requests")
    .select(SELECT)
    .eq("booking.admin_id", adminId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => normalize(row as unknown as Record<string, unknown>));
}

/** Lightweight lookup for the Bookings table's status badge — just enough
 * to show "reschedule requested" / "cancellation requested" inline,
 * without pulling the full nested booking+event payload `listChangeRequests`
 * returns. */
export async function listPendingRequestTypesByBooking(
  adminId: string
): Promise<Map<string, ChangeRequestType>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("booking_change_requests")
    .select("type, booking:bookings!inner(id, admin_id)")
    .eq("status", "pending")
    .eq("booking.admin_id", adminId);

  if (error) throw error;
  const map = new Map<string, ChangeRequestType>();
  for (const row of (data ?? []) as unknown as { type: ChangeRequestType; booking: { id: string } }[]) {
    map.set(row.booking.id, row.type);
  }
  return map;
}

export async function rejectChangeRequest(requestId: string, adminNote: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("booking_change_requests")
    .update({ status: "rejected", admin_note: adminNote, resolved_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw error;
}

/** Approves a reschedule request: moves the booking (see `moveBooking` for
 * the validation and notification pipeline), then closes the request. */
export async function approveReschedule(
  request: ChangeRequestWithBooking,
  newStart: Date
): Promise<void> {
  const supabase = createClient();
  await moveBooking({
    bookingId: request.booking.id,
    currentStart: request.booking.start_time,
    durationMinutes: request.booking.event_types?.duration_minutes ?? 30,
    newStart,
  });

  const { error: requestError } = await supabase
    .from("booking_change_requests")
    .update({ status: "approved", resolved_at: new Date().toISOString() })
    .eq("id", request.id);
  if (requestError) throw requestError;
}

/** Approves a cancellation. `refundAmount` of 0 skips Razorpay entirely —
 * the refund decision is the admin's alone, and "none" is a valid answer.
 * A refund goes first: if Razorpay refuses, nothing is cancelled. */
export async function approveCancellation(
  request: ChangeRequestWithBooking,
  refundAmount: number
): Promise<void> {
  const supabase = createClient();

  if (refundAmount > 0) {
    const { data, error } = await supabase.functions.invoke("refund-razorpay-payment", {
      body: { booking_id: request.booking.id, amount: refundAmount, request_id: request.id, reason: "Client cancellation request" },
    });
    if (error) {
      const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
      throw new Error(body?.error ?? error.message);
    }
    if (data?.error) throw new Error(data.error);
  } else {
    const { error: requestError } = await supabase
      .from("booking_change_requests")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", request.id);
    if (requestError) throw requestError;
  }

  try {
    await supabase.functions.invoke("delete-booking-calendar-event", { body: { booking_id: request.booking.id } });
  } catch {
    /* best-effort */
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_by: "client_request" })
    .eq("id", request.booking.id);
  if (error) throw error;
}
