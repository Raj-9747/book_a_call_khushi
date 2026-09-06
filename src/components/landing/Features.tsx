import {
  BellRing,
  CalendarCheck,
  CalendarOff,
  CreditCard,
  Globe2,
  Inbox,
  ListChecks,
  Tag,
  Video,
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Availability that is actually true",
    body: "Slots are computed from your weekly hours, your existing Zaptly bookings, your manual blocks and your real Google Calendar — so a meeting booked anywhere never gets double-booked here.",
  },
  {
    icon: Video,
    title: "Google Meet, created for you",
    body: "Every confirmed booking lands on your Google Calendar with a Meet link attached, and both you and the client get the invite. Nothing to copy, paste or forward.",
  },
  {
    icon: CreditCard,
    title: "Take payment up front",
    body: "Charge for a session and get paid at the moment of booking through UPI, cards, netbanking or wallets. Free sessions skip payment entirely.",
  },
  {
    icon: Tag,
    title: "Discount codes",
    body: "Percentage-off codes you control — scoped to specific sessions, with an expiry date, a usage cap, or neither. Validated server-side, so they cannot be gamed.",
  },
  {
    icon: BellRing,
    title: "Email and WhatsApp reminders",
    body: "A confirmation the moment it is booked, and a reminder an hour before the call — to the client, with the details already filled in.",
  },
  {
    icon: ListChecks,
    title: "Multiple session types",
    body: "Set up as many as you need, each with its own duration, price, description and custom intake questions.",
  },
  {
    icon: CalendarOff,
    title: "Block time, pause bookings",
    body: "Block a day off and it syncs to your real calendar. Pause bookings entirely and your page collects enquiries instead, so you keep the lead either way.",
  },
  {
    icon: Inbox,
    title: "Reschedule and cancel requests",
    body: "Clients request a change from their booking link; you approve, reject, and decide any refund. No one silently moves a call on your calendar.",
  },
  {
    icon: Globe2,
    title: "Timezone handled properly",
    body: "You set your hours once in IST. Clients see every slot converted to whatever timezone their browser is in.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-t border-border bg-surface-muted py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title="Everything a booking link should do"
          description="Not a calendar widget bolted onto a form. The scheduling, the money and the follow-up all live in one place."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-surface p-6 shadow-xs transition-shadow hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-neutral-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
