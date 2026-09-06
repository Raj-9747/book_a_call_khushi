"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarClock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Modal, Spinner, Textarea } from "@/components/ui";
import { computeAvailableSlots } from "@/lib/availability/computeSlots";
import { getBusyRanges, getGoogleBusyRanges } from "@/lib/api/publicBooking";
import { createChangeRequest, type ManagedBooking } from "@/lib/api/manageBooking";
import { DateSlotPicker } from "./DateSlotPicker";

type ActionType = "reschedule" | "cancel";

const MAX_MESSAGE = 500;

/** The "Need help?" corner of the magic-link page. Deliberately narrow:
 * this never changes the booking itself — it only ever files a REQUEST,
 * which the admin reviews from their Requests page. Copy throughout makes
 * that explicit, including that any refund is at the admin's discretion. */
export function ManageBookingActions({ booking, token }: { booking: ManagedBooking; token: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<ActionType | null>(null);
  const [message, setMessage] = useState("");
  const [preferredSlot, setPreferredSlot] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Date[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const visitorTimeZone = booking.client_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (open !== "reschedule") return;
    let cancelled = false;

    async function loadSlots() {
      setSlots(null);
      const from = new Date();
      const to = new Date(from.getTime() + booking.admin_booking_window_days * 86_400_000);
      try {
        const [zaptlyBusy, googleBusy] = await Promise.all([
          getBusyRanges(booking.admin_id, from, to),
          booking.admin_google_calendar_connected
            ? getGoogleBusyRanges(booking.admin_id, from, to)
            : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setSlots(
          computeAvailableSlots({
            weeklyAvailability: booking.admin_weekly_availability,
            durationMinutes: booking.duration_minutes,
            busyRanges: [...zaptlyBusy, ...googleBusy],
            daysAhead: booking.admin_booking_window_days,
            minNoticeMinutes: booking.admin_min_notice_minutes,
          })
        );
      } catch {
        if (!cancelled) setSlots([]);
      }
    }

    loadSlots();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    booking.admin_id,
    booking.admin_weekly_availability,
    booking.admin_google_calendar_connected,
    booking.duration_minutes,
    booking.admin_booking_window_days,
    booking.admin_min_notice_minutes,
  ]);

  function closeModal() {
    if (submitting) return;
    setOpen(null);
    setMessage("");
    setPreferredSlot(null);
  }

  async function handleSubmit(type: ActionType) {
    setSubmitting(true);
    try {
      await createChangeRequest({
        token,
        type,
        message: message.trim() || null,
        preferredStart: type === "reschedule" ? preferredSlot : null,
      });
      toast.success("Your request has been sent to " + booking.admin_name);
      closeModal();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send your request");
    } finally {
      setSubmitting(false);
    }
  }

  // Already has a decided or pending request — show its state instead of
  // offering the buttons again (the RPC also enforces "one pending at a
  // time", this is just the friendlier front end for it).
  if (booking.request_id && booking.request_status) {
    const label =
      booking.request_status === "pending"
        ? `Your ${booking.request_type} request has been sent — ${booking.admin_name} is reviewing it.`
        : booking.request_status === "approved"
          ? `Your ${booking.request_type} request was approved.`
          : `Your ${booking.request_type} request was not approved. Reply to your confirmation email if you still need help.`;
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        <Badge tone={booking.request_status === "approved" ? "success" : booking.request_status === "rejected" ? "danger" : "brand"}>
          {booking.request_status}
        </Badge>
        <span>{label}</span>
      </div>
    );
  }

  const isPast = new Date(booking.end_time) < new Date();
  if (isPast || booking.status !== "confirmed") return null;

  return (
    <>
      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
        <Button variant="outline" size="sm" onClick={() => setOpen("reschedule")}>
          <CalendarClock className="h-4 w-4" />
          Request reschedule
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOpen("cancel")}>
          <XCircle className="h-4 w-4" />
          Request cancellation
        </Button>
      </div>

      <Modal
        open={open === "reschedule"}
        onClose={closeModal}
        title="Request a reschedule"
        description="This only sends a request — nothing changes until it's approved."
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-neutral-800">Propose a new time (optional)</p>
            {slots === null ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-5 w-5 text-neutral-400" />
              </div>
            ) : (
              <DateSlotPicker
                slots={slots}
                visitorTimeZone={visitorTimeZone}
                selectedSlot={preferredSlot}
                onSelect={setPreferredSlot}
              />
            )}
          </div>
          <Textarea
            rows={3}
            maxLength={MAX_MESSAGE}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Anything you'd like to add? (optional)"
          />
          <p className="text-xs text-neutral-400">
            Sent as a request to {booking.admin_name} — they&apos;ll confirm the new time with you.
          </p>
          <Button className="w-full" isLoading={submitting} onClick={() => handleSubmit("reschedule")}>
            Send request
          </Button>
        </div>
      </Modal>

      <Modal
        open={open === "cancel"}
        onClose={closeModal}
        title="Request a cancellation"
        description="This only sends a request — your booking stays as-is until it's approved."
      >
        <div className="space-y-4">
          <Textarea
            rows={3}
            maxLength={MAX_MESSAGE}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Let them know why, if you'd like (optional)"
          />
          <p className="text-xs text-neutral-500">
            {booking.amount_paid && booking.amount_paid > 0
              ? `A refund, if any, is decided by ${booking.admin_name} and isn't guaranteed.`
              : "Cancellation is decided by " + booking.admin_name + "."}
          </p>
          <p className="text-xs text-neutral-400">
            Scheduled for {formatInTimeZone(new Date(booking.start_time), visitorTimeZone, "EEEE, MMMM d 'at' h:mm a")}
          </p>
          <Button className="w-full" variant="danger" isLoading={submitting} onClick={() => handleSubmit("cancel")}>
            Send cancellation request
          </Button>
        </div>
      </Modal>
    </>
  );
}
