import { CalendarDays, Clock, Video } from "lucide-react";

const SLOTS = ["10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "2:00 PM"];
const DAYS = [
  { label: "Mon", date: "8" },
  { label: "Tue", date: "9" },
  { label: "Wed", date: "10" },
  { label: "Thu", date: "11" },
];

/** A static mock of the real booking page, used as the hero visual.
 * Decorative only — `aria-hidden`, no links or inputs, so screen readers
 * and keyboard users skip straight past it to the actual content. */
export function BookingPreview() {
  return (
    <div aria-hidden="true" className="select-none">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-lg sm:p-6">
        {/* Admin header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            HN
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-900">Harshal Nelge</p>
            <p className="truncate text-xs text-neutral-500">AI Automation Engineer</p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-base font-semibold text-neutral-900">Discovery call</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5 text-neutral-500">
              <Clock className="h-3.5 w-3.5" />
              30 min
            </span>
            <span className="font-semibold text-neutral-900">₹499</span>
          </div>
        </div>

        {/* Day strip */}
        <div className="mt-5 border-t border-border pt-5">
          <p className="mb-3 text-sm font-medium text-neutral-900">Pick a time</p>
          <div className="flex gap-2">
            {DAYS.map((day, index) => (
              <div
                key={day.date}
                className={
                  index === 1
                    ? "flex-1 rounded-md border border-brand-600 bg-brand-50 px-2 py-2 text-center"
                    : "flex-1 rounded-md border border-border-strong px-2 py-2 text-center"
                }
              >
                <p className={index === 1 ? "text-xs font-medium text-brand-700" : "text-xs text-neutral-500"}>
                  {day.label}
                </p>
                <p className={index === 1 ? "text-sm font-semibold text-brand-700" : "text-sm font-medium text-neutral-700"}>
                  {day.date}
                </p>
              </div>
            ))}
          </div>

          {/* Slot grid */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {SLOTS.map((slot, index) => (
              <div
                key={slot}
                className={
                  index === 2
                    ? "rounded-md bg-brand-600 px-2 py-2 text-center text-xs font-medium text-white shadow-sm"
                    : "rounded-md border border-border-strong px-2 py-2 text-center text-xs font-medium text-neutral-700"
                }
              >
                {slot}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm text-neutral-600">
            <CalendarDays className="h-4 w-4 shrink-0 text-neutral-400" />
            Tuesday, September 9 at 11:00 AM
          </p>
          <div className="rounded-md bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white shadow-sm">
            Continue
          </div>
        </div>
      </div>

      {/* Floating confirmation chip — hints at what happens after booking */}
      <div className="absolute -bottom-5 -left-4 hidden w-60 rounded-xl border border-border bg-surface p-3 shadow-lg sm:block lg:-left-10">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-100">
            <Video className="h-3.5 w-3.5 text-emerald-600" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-neutral-900">Google Meet created</p>
            <p className="mt-0.5 text-xs text-neutral-500">Invite sent to both calendars</p>
          </div>
        </div>
      </div>
    </div>
  );
}
