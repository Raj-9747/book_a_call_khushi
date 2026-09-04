"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, Spinner } from "@/components/ui";
import { computeAvailableSlots } from "@/lib/availability/computeSlots";
import {
  getBusyRanges,
  getGoogleBusyRanges,
  createPublicBooking,
  type PublicAdmin,
  type PublicEventType,
} from "@/lib/api/publicBooking";
import type { BookingDetailsValues } from "@/lib/validations/publicBooking";
import { DateSlotPicker } from "./DateSlotPicker";
import { BookingDetailsForm } from "./BookingDetailsForm";
import { DummyPaymentButton } from "./DummyPaymentButton";
import { ConfirmationCard } from "./ConfirmationCard";

type Step = "slot" | "details" | "payment" | "confirmed";

export function BookingFlow({ admin, eventType }: { admin: PublicAdmin; eventType: PublicEventType }) {
  const [step, setStep] = useState<Step>("slot");
  const [slots, setSlots] = useState<Date[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [details, setDetails] = useState<BookingDetailsValues | null>(null);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [confirmedStart, setConfirmedStart] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const visitorTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const windowDays = admin.booking_window_days ?? 14;
  const minNoticeMinutes = admin.min_notice_minutes ?? 0;

  useEffect(() => {
    const from = new Date();
    const to = new Date(from.getTime() + windowDays * 86_400_000);

    Promise.all([
      getBusyRanges(admin.id, from, to),
      // Only bother calling Google if this admin actually has Calendar
      // connected — avoids a wasted request (and network delay) otherwise.
      admin.google_calendar_connected ? getGoogleBusyRanges(admin.id, from, to) : Promise.resolve([]),
    ])
      .then(([zaptlyBusyRanges, googleBusyRanges]) => {
        setSlots(
          computeAvailableSlots({
            weeklyAvailability: admin.weekly_availability,
            durationMinutes: eventType.duration_minutes,
            busyRanges: [...zaptlyBusyRanges, ...googleBusyRanges],
            daysAhead: windowDays,
            minNoticeMinutes,
          })
        );
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load availability"));
  }, [
    admin.id,
    admin.weekly_availability,
    admin.google_calendar_connected,
    eventType.duration_minutes,
    windowDays,
    minNoticeMinutes,
  ]);

  async function submitBooking(finalDetails: BookingDetailsValues) {
    if (!selectedSlot) return;
    setSubmitting(true);
    try {
      const booking = await createPublicBooking({
        adminId: admin.id,
        eventTypeId: eventType.id,
        clientName: finalDetails.name,
        clientEmail: finalDetails.email,
        clientPhone: finalDetails.phone,
        customAnswers,
        startTime: selectedSlot,
        clientTimezone: visitorTimeZone,
      });
      setConfirmedStart(new Date(booking.start_time));
      setStep("confirmed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete booking");
      // The slot may have just been taken by someone else — refresh the list.
      if (err instanceof Error && err.message.includes("just been booked")) {
        setStep("slot");
        setSelectedSlot(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "confirmed" && confirmedStart) {
    return <ConfirmationCard admin={admin} eventType={eventType} startTime={confirmedStart} visitorTimeZone={visitorTimeZone} />;
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">{admin.name}</p>
          <h1 className="mt-1 text-lg font-semibold text-neutral-900">{eventType.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
            <Clock className="h-3.5 w-3.5" />
            {eventType.duration_minutes} min · {eventType.price > 0 ? `₹${eventType.price}` : "Free"}
          </p>
          {eventType.description && <p className="mt-2 text-sm text-neutral-600">{eventType.description}</p>}
        </div>

        {step !== "slot" && (
          <button
            type="button"
            onClick={() => setStep(step === "payment" ? "details" : "slot")}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        )}

        {step === "slot" &&
          (slots === null ? (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6 text-neutral-400" />
            </div>
          ) : (
            <DateSlotPicker
              slots={slots}
              visitorTimeZone={visitorTimeZone}
              onSelect={(slot) => {
                setSelectedSlot(slot);
                setStep("details");
              }}
            />
          ))}

        {step === "details" && (
          <BookingDetailsForm
            eventType={eventType}
            submitLabel={eventType.price > 0 ? "Continue to payment" : "Confirm booking"}
            onSubmit={(values, answers) => {
              setDetails(values);
              setCustomAnswers(answers);
              if (eventType.price > 0) {
                setStep("payment");
              } else {
                submitBooking(values);
              }
            }}
          />
        )}

        {step === "payment" && details && (
          <DummyPaymentButton price={eventType.price} onPaid={() => submitBooking(details)} />
        )}

        {submitting && (
          <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
            <Spinner className="h-4 w-4" /> Booking your slot...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
