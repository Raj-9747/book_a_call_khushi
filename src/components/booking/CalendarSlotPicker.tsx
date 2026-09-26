"use client";

import { type ReactNode, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { groupSlotsByDay } from "@/lib/availability/computeSlots";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-09" → midday UTC on the 1st. Calendar arithmetic stays in UTC so
 * the viewer's own clock can't shift a date across midnight — the day keys
 * are already resolved in the visitor's timezone by `groupSlotsByDay`. */
function monthStart(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 12));
}

function shiftMonth(monthKey: string, delta: number) {
  const d = monthStart(monthKey);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

function dayDate(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** Month-grid date picker plus the chosen day's time slots — the public
 * booking page's version of `DateSlotPicker`. Days with no openings are
 * shown but disabled, so the visitor sees the shape of the schedule at a
 * glance instead of scrolling a strip of dates.
 *
 * Uses a container query rather than a viewport breakpoint: the calendar
 * and slot list sit side by side only when *this* component has the room,
 * which depends on the surrounding layout, not the screen. */
export function CalendarSlotPicker({
  slots,
  visitorTimeZone,
  selectedSlot,
  onSelect,
}: {
  slots: Date[];
  visitorTimeZone: string;
  selectedSlot: Date | null;
  onSelect: (slot: Date) => void;
}) {
  const grouped = useMemo(() => groupSlotsByDay(slots, visitorTimeZone), [slots, visitorTimeZone]);
  const days = useMemo(() => Array.from(grouped.keys()).sort(), [grouped]);
  const [selectedDay, setSelectedDay] = useState<string | undefined>(days[0]);
  const [viewMonth, setViewMonth] = useState<string | undefined>(days[0]?.slice(0, 7));

  if (days.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border-strong px-4 py-12 text-center text-sm text-neutral-500">
        No upcoming availability right now — please check back soon.
      </p>
    );
  }

  const activeDay = selectedDay && grouped.has(selectedDay) ? selectedDay : days[0];
  const month = viewMonth ?? activeDay.slice(0, 7);
  const firstMonth = days[0].slice(0, 7);
  const lastMonth = days[days.length - 1].slice(0, 7);
  const daySlots = grouped.get(activeDay) ?? [];
  const todayKey = formatInTimeZone(new Date(), visitorTimeZone, "yyyy-MM-dd");

  const start = monthStart(month);
  const leadingBlanks = start.getUTCDay();
  const daysInMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];

  function goToMonth(next: string) {
    setViewMonth(next);
    // Land on that month's first open day so the slot list never shows a
    // day from a month that's no longer on screen.
    const firstOpen = days.find((d) => d.startsWith(next));
    if (firstOpen) setSelectedDay(firstOpen);
  }

  return (
    <div className="@container">
      <div className="grid gap-6 @xl:grid-cols-[minmax(0,1fr)_11.5rem] @xl:gap-8 @3xl:grid-cols-[minmax(0,1fr)_15rem] @3xl:gap-12">
        {/* Calendar */}
        <div>
          <div className="flex items-center justify-between">
            <p className="font-display text-xl text-brand-700">
              {formatInTimeZone(start, "UTC", "MMMM yyyy")}
            </p>
            <div className="flex gap-1">
              <MonthButton label="Previous month" disabled={month <= firstMonth} onClick={() => goToMonth(shiftMonth(month, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </MonthButton>
              <MonthButton label="Next month" disabled={month >= lastMonth} onClick={() => goToMonth(shiftMonth(month, 1))}>
                <ChevronRight className="h-4 w-4" />
              </MonthButton>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((d) => (
              <span key={d} className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {d}
              </span>
            ))}
            {cells.map((key, i) => {
              if (!key) return <span key={`blank-${i}`} />;
              const open = grouped.has(key);
              const selected = key === activeDay;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!open}
                  aria-pressed={selected}
                  aria-label={formatInTimeZone(dayDate(key), "UTC", "EEEE, MMMM d") + (open ? "" : " — unavailable")}
                  onClick={() => setSelectedDay(key)}
                  className={cn(
                    "relative mx-auto flex aspect-square w-full max-w-11 @3xl:max-w-12 items-center justify-center rounded-full text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
                    selected
                      ? "bg-brand-600 font-semibold text-white shadow-sm"
                      : open
                        ? "bg-brand-50 font-semibold text-brand-700 hover:bg-brand-100"
                        : "cursor-default text-neutral-300"
                  )}
                >
                  {Number(key.slice(8))}
                  {key === todayKey && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute bottom-1 h-1 w-1 rounded-full",
                        selected ? "bg-white" : "bg-neutral-400"
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slots for the chosen day */}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">
            {formatInTimeZone(dayDate(activeDay), "UTC", "EEEE, MMM d")}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {daySlots.length} {daySlots.length === 1 ? "slot" : "slots"} available
          </p>
          {/* grid-cols-2 on narrow phones so "10:00 AM" always fits on one
              line; a single scrolling column when sat beside the calendar. */}
          <div className="mt-3 grid grid-cols-2 gap-2 @sm:grid-cols-3 @xl:max-h-[19rem] @xl:grid-cols-1 @xl:overflow-y-auto @xl:overscroll-contain @xl:pr-1">
            {daySlots.map((slot) => {
              const isSelected = selectedSlot?.getTime() === slot.getTime();
              return (
                <button
                  key={slot.toISOString()}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(slot)}
                  className={cn(
                    "h-11 shrink-0 whitespace-nowrap rounded-xl border text-sm font-semibold transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
                    isSelected
                      ? "border-neutral-900 bg-neutral-900 text-surface"
                      : "border-brand-200 bg-surface text-brand-700 hover:border-brand-500 hover:bg-brand-50"
                  )}
                >
                  {formatInTimeZone(slot, visitorTimeZone, "h:mm a")}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-5 flex items-center gap-1.5 text-xs text-neutral-500">
        <Globe className="h-3.5 w-3.5" />
        Times shown in your timezone · {visitorTimeZone.replace(/_/g, " ")}
      </p>
    </div>
  );
}

function MonthButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
