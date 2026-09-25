"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import { Button, FormField, Input, Modal } from "@/components/ui";
import { AdminSlotPicker } from "./AdminSlotPicker";
import { cancelBooking, moveBooking, type BookingWithEventType } from "@/lib/api/bookings";

const IST = "Asia/Kolkata";

type RefundChoice = "none" | "full" | "partial";

/** Admin cancels a booking themselves — this is where the refund option
 * lives (a client-requested cancellation carries none). Only offered when
 * there's a real Razorpay payment with money left to return. */
export function CancelBookingModal({
  booking,
  onClose,
  onCancelled,
}: {
  booking: BookingWithEventType | null;
  onClose: () => void;
  onCancelled: (bookingId: string) => void;
}) {
  const [choice, setChoice] = useState<RefundChoice>("full");
  const [partialAmount, setPartialAmount] = useState("");
  const [busy, setBusy] = useState(false);

  if (!booking) return null;

  const paid = booking.amount_paid ?? 0;
  const refundable = Math.max(paid - (booking.refund_amount ?? 0), 0);
  const canRefund = !!booking.razorpay_payment_id && refundable > 0;

  async function submit() {
    const amount = !canRefund || choice === "none" ? 0 : choice === "full" ? refundable : Number(partialAmount) || 0;
    if (choice === "partial" && canRefund && (amount <= 0 || amount > refundable)) {
      toast.error(`Enter an amount between ₹1 and ₹${refundable}`);
      return;
    }
    setBusy(true);
    try {
      await cancelBooking(booking!.id, amount);
      toast.success(amount > 0 ? `Cancelled — ₹${amount} refund started on Razorpay` : "Booking cancelled");
      onCancelled(booking!.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel booking");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Cancel booking"
      description={`${booking.client_name} — ${booking.event_types?.name ?? "session"}`}
    >
      <div className="space-y-4">
        {canRefund ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-neutral-800">Refund the client?</p>
            <div className="flex flex-wrap gap-2">
              {(["full", "partial", "none"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChoice(c)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    choice === c
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-border-strong text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {c === "full" ? `Full (₹${refundable})` : c === "partial" ? "Partial" : "No refund"}
                </button>
              ))}
            </div>
            {choice === "partial" && (
              <FormField label="Refund amount (₹)" hint={`Up to ₹${refundable}`}>
                <Input
                  type="number"
                  min={1}
                  max={refundable}
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                />
              </FormField>
            )}
            <p className="text-xs text-neutral-500">Refunds go back to the client&apos;s original payment method.</p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            {paid > 0 ? "There's nothing left to refund on this booking." : "This booking has no payment to refund."}
          </p>
        )}
        <Button className="w-full" variant="danger" isLoading={busy} onClick={submit}>
          {canRefund && choice !== "none" ? "Cancel and refund" : "Cancel booking"}
        </Button>
      </div>
    </Modal>
  );
}

/** Admin moves a booking to a new time. The client is notified through the
 * same pipeline an approved reschedule request uses. */
export function RescheduleBookingModal({
  booking,
  onClose,
  onRescheduled,
}: {
  booking: BookingWithEventType | null;
  onClose: () => void;
  onRescheduled: (bookingId: string, newStart: string, newEnd: string) => void;
}) {
  const [slot, setSlot] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);

  if (!booking) return null;

  async function submit() {
    if (!slot) {
      toast.error("Pick a new time first");
      return;
    }
    const newStart = slot;
    const duration = booking!.event_types?.duration_minutes ?? 30;
    setBusy(true);
    try {
      await moveBooking({
        bookingId: booking!.id,
        currentStart: booking!.start_time,
        durationMinutes: duration,
        newStart,
      });
      toast.success("Rescheduled — the client will get a new confirmation");
      onRescheduled(booking!.id, newStart.toISOString(), new Date(newStart.getTime() + duration * 60_000).toISOString());
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reschedule");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Reschedule booking"
      description={`${booking.client_name} — now ${formatInTimeZone(new Date(booking.start_time), IST, "EEE, MMM d 'at' h:mm a")} (IST)`}
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-neutral-800">Pick a new time</p>
          <AdminSlotPicker
            adminId={booking.admin_id}
            booking={{
              start_time: booking.start_time,
              end_time: booking.end_time,
              duration_minutes: booking.event_types?.duration_minutes ?? 30,
            }}
            selected={slot}
            onSelect={setSlot}
          />
        </div>
        <p className="text-xs text-neutral-500">
          The old calendar event is removed and a new Meet link is created. The client is told about the new time by
          email and WhatsApp.
        </p>
        <Button className="w-full" isLoading={busy} disabled={!slot} onClick={submit}>
          Reschedule
        </Button>
      </div>
    </Modal>
  );
}
