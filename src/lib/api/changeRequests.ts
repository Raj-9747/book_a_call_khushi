import { createClient } from "@/lib/supabase/client";

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

/** Approves a reschedule request. Re-validates the proposed slot for real
 * (it was only a proposal when the client submitted it — availability,
 * notice and the booking window may all have shifted since), then:
 * removes the old Google Calendar event, updates the booking to the new
 * time, and clears `confirmation_sent` so the same DB-webhook pipeline
 * that fired on the original booking fires again — creating a fresh
 * Calendar event and re-sending the confirmation email with the new time.
 * No new n8n workflow needed; this reuses the existing one. */
export async function approveReschedule(
  request: ChangeRequestWithBooking,
  newStart: Date
): Promise<void> {
  const supabase = createClient();
  const durationMinutes = request.booking.event_types?.duration_minutes ?? 30;
  const newEnd = new Date(newStart.getTime() + durationMinutes * 60_000);

  // Conflict check against the admin's OWN other bookings/blocks. RLS
  // already scopes both tables to the caller's own admin_id, so this can
  // run as a plain authenticated read — no service role needed.
  const [{ data: conflictingBookings }, { data: conflictingBlocks }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id")
      .neq("id", request.booking.id)
      .in("status", ["confirmed", "pending_confirmation"])
      .lt("start_time", newEnd.toISOString())
      .gt("end_time", newStart.toISOString()),
    supabase
      .from("blocked_slots")
      .select("id")
      .lt("start_time", newEnd.toISOString())
      .gt("end_time", newStart.toISOString()),
  ]);

  if ((conflictingBookings?.length ?? 0) > 0 || (conflictingBlocks?.length ?? 0) > 0) {
    throw new Error("That time is no longer free — pick a different slot before approving.");
  }

  // Best-effort — remove the stale Calendar event for the OLD time before
  // the booking moves. Never blocks the reschedule itself.
  try {
    await supabase.functions.invoke("delete-booking-calendar-event", { body: { booking_id: request.booking.id } });
  } catch {
    /* best-effort */
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
      google_event_id: null,
      meet_link: null,
      // Marks this as a MOVE, not a first booking. Written in the same
      // UPDATE as the new time so it's already on the DB-webhook record when
      // the relay runs — that's what lets the emails/WhatsApp say "your
      // meeting has been rescheduled to …" instead of "your booking is
      // accepted". previous_start_time is the time it moved FROM.
      rescheduled_at: new Date().toISOString(),
      previous_start_time: request.booking.start_time,
      // Reopens the confirmation-email gate so the existing "new booking"
      // pipeline fires again for the new time — see function doc above.
      confirmation_sent: false,
    })
    .eq("id", request.booking.id);
  if (error) throw error;

  const { error: requestError } = await supabase
    .from("booking_change_requests")
    .update({ status: "approved", resolved_at: new Date().toISOString() })
    .eq("id", request.id);
  if (requestError) throw requestError;
}

/** Approves a cancellation. `refundAmount` of 0 skips Razorpay entirely —
 * the refund decision is the admin's alone, and "none" is a valid answer. */
export async function approveCancellation(
  request: ChangeRequestWithBooking,
  refundAmount: number
): Promise<void> {
  const supabase = createClient();

  try {
    await supabase.functions.invoke("delete-booking-calendar-event", { body: { booking_id: request.booking.id } });
  } catch {
    /* best-effort */
  }

  if (refundAmount > 0) {
    // Needs the Razorpay secret — the one part of this flow that can't be
    // a plain RLS-guarded table write.
    const { data, error } = await supabase.functions.invoke("refund-razorpay-payment", {
      body: { booking_id: request.booking.id, amount: refundAmount, request_id: request.id },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  } else {
    const { error: requestError } = await supabase
      .from("booking_change_requests")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", request.id);
    if (requestError) throw requestError;
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_by: "client_request" })
    .eq("id", request.booking.id);
  if (error) throw error;
}
