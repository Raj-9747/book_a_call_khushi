import { BellRing, CalendarCheck, Mail, MessageSquare } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const TIMELINE = [
  {
    icon: CalendarCheck,
    title: "Booking confirmed",
    body: "Calendar event created with a Google Meet link, invite sent to both sides",
    tone: "brand" as const,
  },
  {
    icon: Mail,
    title: "Confirmation email",
    body: "Time, duration, Meet link and a link to manage the booking",
    tone: "brand" as const,
  },
  {
    icon: MessageSquare,
    title: "WhatsApp to you",
    body: "So you know a call landed without refreshing a dashboard",
    tone: "neutral" as const,
  },
  {
    icon: BellRing,
    title: "One hour before",
    body: "Reminder goes out to the client automatically",
    tone: "neutral" as const,
  },
];

export function AutomationSection() {
  return (
    <section className="border-t border-border bg-surface py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Timeline mock — first in DOM on mobile so the visual leads */}
          <div aria-hidden="true" className="order-last select-none lg:order-first">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                After a booking
              </p>
              <ol className="mt-5 space-y-5">
                {TIMELINE.map(({ icon: Icon, title, body, tone }, index) => (
                  <li key={title} className="relative flex gap-4">
                    {index < TIMELINE.length - 1 && (
                      <span className="absolute left-[15px] top-9 h-[calc(100%+0.5rem)] w-px bg-border" />
                    )}
                    <span
                      className={
                        tone === "brand"
                          ? "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"
                          : "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500"
                      }
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm font-medium text-neutral-900">{title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div>
            <SectionHeading
              align="left"
              eyebrow="Automation"
              title="The follow-up nobody remembers to do"
              description="Confirmations, calendar invites, notifications and reminders all fire on their own. You find out a call was booked because your phone told you, not because you were watching."
            />
            <p className="mt-6 text-sm leading-relaxed text-neutral-600">
              Because the reminder goes out an hour before, clients turn up expecting the call — and if they cannot
              make it, they say so from the link in that same email instead of going quiet.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
