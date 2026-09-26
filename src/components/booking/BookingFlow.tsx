"use client";

import { useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowRight, CalendarDays, CheckCircle2, Clock, Video } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Modal, Spinner } from "@/components/ui";
import { computeAvailableSlots } from "@/lib/availability/computeSlots";
import {
  getBusyRanges,
  getGoogleBusyRanges,
  createBooking,
  verifyPayment,
  type PublicAdmin,
  type PublicEventType,
} from "@/lib/api/publicBooking";
import { openRazorpayCheckout } from "@/lib/payments/razorpay";
import { toE164, type BookingDetailsValues } from "@/lib/validations/publicBooking";
import { CalendarSlotPicker } from "./CalendarSlotPicker";
import { BookingDetailsForm } from "./BookingDetailsForm";
import { DiscountBox, type AppliedDiscount } from "./DiscountBox";
import { ConfirmationCard } from "./ConfirmationCard";

function formatAmount(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function BookingFlow({ admin, eventType }: { admin: PublicAdmin; eventType: PublicEventType }) {
  const [slots, setSlots] = useState<Date[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [details, setDetails] = useState<BookingDetailsValues | null>(null);
  // Separate from `details` on purpose: "Back to your details" used to
  // null out `details` itself to switch views, which also wiped the exact
  // values the form needed to pre-fill with. This just toggles which half
  // of the modal shows — `details` stays intact as the form's defaults.
  const [showPaymentStep, setShowPaymentStep] = useState(false);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<{ startTime: Date; amountPaid: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const visitorTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const windowDays = admin.booking_window_days ?? 14;
  const minNoticeMinutes = admin.min_notice_minutes ?? 0;
  const isPaid = eventType.price > 0;

  // Displayed total only. The authoritative amount is recomputed inside
  // `create_public_booking` from the event type's own price — nothing here
  // is trusted by the server.
  const total = useMemo(() => {
    if (!isPaid) return 0;
    if (!discount) return eventType.price;
    return Math.round((eventType.price * (100 - discount.percent)) / 100);
  }, [isPaid, eventType.price, discount]);

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
      // Creates the booking and, when there's something to charge, the
      // matching Razorpay order. The amount comes back from the server —
      // it's never sent up.
      const result = await createBooking({
        adminSlug: admin.slug,
        eventSlug: eventType.slug,
        clientName: finalDetails.name,
        clientEmail: finalDetails.email,
        clientPhone: toE164(finalDetails.countryCode, finalDetails.phone),
        customAnswers,
        startTime: selectedSlot,
        clientTimezone: visitorTimeZone,
        discountCode: discount?.code ?? null,
      });

      if (result.free) {
        setModalOpen(false);
        setConfirmed({ startTime: new Date(result.start_time), amountPaid: 0 });
        return;
      }

      // From here the slot is held for a few minutes. If the client
      // abandons Checkout the hold lapses on its own and the slot frees.
      const checkout = await openRazorpayCheckout({
        keyId: result.key_id,
        orderId: result.order_id,
        amountInPaise: result.amount_in_paise,
        currency: result.currency,
        name: admin.name,
        description: eventType.name,
        prefill: { name: finalDetails.name, email: finalDetails.email, contact: toE164(finalDetails.countryCode, finalDetails.phone) },
      });

      const verified = await verifyPayment({
        bookingId: result.booking_id,
        orderId: checkout.razorpay_order_id,
        paymentId: checkout.razorpay_payment_id,
        signature: checkout.razorpay_signature,
      });

      setModalOpen(false);
      setConfirmed({ startTime: new Date(result.start_time), amountPaid: result.amount_due });

      // Rare, but it can happen: the hold lapsed while the payment was
      // being captured and someone else took the slot. Say so plainly
      // rather than letting them find out at call time.
      if (verified.slot_conflict) {
        toast.error(
          `${admin.name} will get in touch — that slot was taken while your payment went through, so it needs rescheduling.`,
          { duration: 12000 }
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to complete booking";

      // Dismissing the Checkout modal isn't an error worth shouting about;
      // the hold is still live, so they can just press pay again.
      if (message === "Payment cancelled.") {
        toast.info("Payment cancelled — your slot is held for a few more minutes.");
        return;
      }

      toast.error(message);

      // The slot may have just been taken by someone else — send them back
      // to the picker so they're choosing from a fresh list.
      if (message.includes("just booked") || message.includes("too soon") || message.includes("too far")) {
        setModalOpen(false);
        setSelectedSlot(null);
        setDetails(null);
      }
      // A code that passed the advisory pre-check can still be rejected at
      // booking time (it expired, or someone else took the last use).
      if (message.includes("discount code")) {
        setDiscount(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <ConfirmationCard
        admin={admin}
        eventType={eventType}
        startTime={confirmed.startTime}
        amountPaid={confirmed.amountPaid}
        visitorTimeZone={visitorTimeZone}
      />
    );
  }

  return (
    <>
      {/* Two panes on desktop, Calendly-style: what you're booking on the
          left, when on the right. Stacks on mobile, summary first.
          overflow-clip (not -hidden) rounds the corners without creating a
          scroll container, which would break the sticky Continue bar. */}
      <div className="overflow-clip rounded-[28px] border-[1.5px] border-border bg-surface shadow-md lg:grid lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* The summary is a slice of the profile's maroon "Today's menu"
            card, so the booking step reads as the same menu, one item
            opened up. */}
        <section className="bg-brand-700 p-6 text-surface-muted sm:p-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Avatar name={admin.name} src={admin.photo_url} className="h-11 w-11 ring-2 ring-marigold-400" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{admin.name}</p>
                {admin.headline && <p className="truncate text-xs text-parchment">{admin.headline}</p>}
              </div>
            </div>

            <div>
              <h1 className="font-display text-[32px] leading-tight sm:text-[36px]">{eventType.name}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-surface-muted/40 px-3 py-1 text-parchment">
                  <Clock className="h-3.5 w-3.5" />
                  {eventType.duration_minutes} min
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-surface-muted/40 px-3 py-1 text-parchment">
                  <Video className="h-3.5 w-3.5" />
                  Google Meet
                </span>
              </div>
              <p className="mt-5 flex items-baseline gap-2.5">
                {isPaid && discount && (
                  <span className="font-display text-xl text-parchment/70 line-through">{formatAmount(eventType.price)}</span>
                )}
                <span className="font-display text-[34px] leading-none text-sun">{isPaid ? formatAmount(total) : "Free"}</span>
              </p>
            </div>

            {eventType.description && (
              <div className="border-t-[1.5px] border-dashed border-surface-muted/35 pt-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-sun">About this session</p>
                {/* whitespace-pre-line so the admin's own line breaks survive. */}
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-parchment">
                  {eventType.description}
                </p>
              </div>
            )}

            {/* Stated before booking, not discovered when a bot joins the
                call — see PLAN.md §11.2 "Client consent". */}
            {eventType.record_meeting && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-surface-muted/10 px-4 py-3 text-sm text-surface-muted">
                <Video className="mt-0.5 h-4 w-4 shrink-0 text-sun" />
                <p>This session is recorded and you&apos;ll get a summary of what was discussed afterwards.</p>
              </div>
            )}

            <ul className="space-y-2.5 border-t-[1.5px] border-dashed border-surface-muted/35 pt-5 text-sm text-parchment">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sun" />
                Instant confirmation with your Meet link
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sun" />
                A reminder an hour before the call
              </li>
              {isPaid && (
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sun" />
                  Secure payment by UPI, card or netbanking
                </li>
              )}
            </ul>
          </div>
        </section>

        <section className="flex flex-col p-6 sm:p-8">
          <h2 className="font-display text-[30px] leading-tight text-brand-700">Pick a time</h2>
          <p className="mt-1 text-[15px] text-neutral-700">Choose a date, then a slot that suits you.</p>

          <div className="mt-6 flex-1">
            {slots === null ? (
              <div className="flex justify-center py-16">
                <Spinner className="h-6 w-6 text-neutral-400" />
              </div>
            ) : (
              <CalendarSlotPicker
                slots={slots}
                visitorTimeZone={visitorTimeZone}
                selectedSlot={selectedSlot}
                onSelect={setSelectedSlot}
              />
            )}
          </div>

          {isPaid && (
            <div className="mt-6 border-t border-border pt-5">
              <DiscountBox
                adminSlug={admin.slug}
                eventSlug={eventType.slug}
                applied={discount}
                onApply={setDiscount}
                onRemove={() => setDiscount(null)}
              />
            </div>
          )}

          {/* Pinned to the bottom of the screen on phones, where the slot
              grid can push the button well below the fold. */}
          <div className="sticky bottom-0 -mx-6 mt-6 border-t border-border bg-surface/95 px-6 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:backdrop-blur-none">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex min-h-5 items-center gap-1.5 text-sm text-neutral-600">
                <CalendarDays className="h-4 w-4 shrink-0 text-brand-500" />
                {selectedSlot
                  ? formatInTimeZone(selectedSlot, visitorTimeZone, "EEE, MMM d 'at' h:mm a")
                  : "No time selected yet"}
              </p>
              <Button
                className="min-h-[52px] w-full rounded-full font-bold sm:w-auto sm:min-w-44"
                size="lg"
                disabled={!selectedSlot}
                onClick={() => setModalOpen(true)}
              >
                {selectedSlot ? "Continue" : "Select a time"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        title="Your details"
        description={
          selectedSlot
            ? formatInTimeZone(selectedSlot, visitorTimeZone, "EEEE, MMMM d 'at' h:mm a")
            : undefined
        }
        // A misclick outside must not discard a client's typed details
        // mid-booking — they'd have to retype everything, or worse, give up.
        dismissible={false}
      >
        {showPaymentStep && details && total > 0 ? (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg bg-neutral-50 px-4 py-3 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>{eventType.name}</span>
                <span>{formatAmount(eventType.price)}</span>
              </div>
              {discount && (
                <div className="flex justify-between text-success-700">
                  <span>{discount.code}</span>
                  <span>−{formatAmount(eventType.price - total)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 font-semibold text-neutral-900">
                <span>Total</span>
                <span>{formatAmount(total)}</span>
              </div>
            </div>
            <Button className="w-full" size="lg" isLoading={submitting} onClick={() => submitBooking(details)}>
              Pay {formatAmount(total)}
            </Button>
            <p className="text-center text-xs text-neutral-400">
              Pay securely by UPI, card, netbanking or wallet via Razorpay.
            </p>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setShowPaymentStep(false)}
              className="w-full text-sm text-neutral-500 transition-colors hover:text-neutral-900 disabled:opacity-50"
            >
              Back to your details
            </button>
          </div>
        ) : (
          <BookingDetailsForm
            eventType={eventType}
            submitLabel={total > 0 ? `Continue to payment · ${formatAmount(total)}` : "Confirm booking"}
            defaultValues={details ?? undefined}
            defaultCustomAnswers={customAnswers}
            onSubmit={(values, answers) => {
              setDetails(values);
              setCustomAnswers(answers);
              if (total === 0) submitBooking(values);
              else setShowPaymentStep(true);
            }}
          />
        )}

        {submitting && (
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-neutral-500">
            <Spinner className="h-4 w-4" /> Booking your slot…
          </div>
        )}
      </Modal>
    </>
  );
}
