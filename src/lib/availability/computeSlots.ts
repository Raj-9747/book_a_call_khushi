import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { addMinutes, isBefore } from "date-fns";

const IST = "Asia/Kolkata";
const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}
type WeeklyAvailability = Record<string, DaySchedule>;

interface BusyRange {
  start_time: string;
  end_time: string;
}

/**
 * Computes bookable slot start times as real UTC Date instants.
 *
 * The admin's weekly_availability is authored in IST, so "what weekday/date
 * is this" must be resolved in IST terms, not the server/browser's local
 * timezone. This anchors every calendar day to a UTC-midnight instant
 * derived from the IST calendar date string, then uses `getUTCDay()` /
 * `toISOString()` (never local Date getters) to read it back — that keeps
 * the whole computation correct regardless of what timezone this code
 * happens to run in.
 */
export function computeAvailableSlots({
  weeklyAvailability,
  durationMinutes,
  busyRanges,
  daysAhead = 14,
  now = new Date(),
}: {
  weeklyAvailability: WeeklyAvailability;
  durationMinutes: number;
  busyRanges: BusyRange[];
  daysAhead?: number;
  now?: Date;
}): Date[] {
  const slots: Date[] = [];
  const busy = busyRanges.map((b) => ({ start: new Date(b.start_time), end: new Date(b.end_time) }));

  const todayIstStr = formatInTimeZone(now, IST, "yyyy-MM-dd");
  const anchor = new Date(`${todayIstStr}T00:00:00Z`);

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const dayAnchor = new Date(anchor.getTime() + dayOffset * 86_400_000);
    const dateStr = dayAnchor.toISOString().slice(0, 10);
    const weekdayKey = WEEKDAY_KEYS[dayAnchor.getUTCDay()];
    const schedule = weeklyAvailability[weekdayKey];
    if (!schedule?.enabled) continue;

    const dayStartUtc = fromZonedTime(`${dateStr}T${schedule.start}:00`, IST);
    const dayEndUtc = fromZonedTime(`${dateStr}T${schedule.end}:00`, IST);

    let cursor = dayStartUtc;
    while (!isBefore(dayEndUtc, addMinutes(cursor, durationMinutes))) {
      const slotEnd = addMinutes(cursor, durationMinutes);
      const isPast = isBefore(cursor, now);
      const overlapsBusy = busy.some((b) => cursor < b.end && slotEnd > b.start);
      if (!isPast && !overlapsBusy) slots.push(cursor);
      cursor = addMinutes(cursor, durationMinutes);
    }
  }

  return slots;
}

/** Groups slot Date instants by calendar date in the given display timezone. */
export function groupSlotsByDay(slots: Date[], timeZone: string): Map<string, Date[]> {
  const grouped = new Map<string, Date[]>();
  for (const slot of slots) {
    const key = formatInTimeZone(slot, timeZone, "yyyy-MM-dd");
    const existing = grouped.get(key);
    if (existing) existing.push(slot);
    else grouped.set(key, [slot]);
  }
  return grouped;
}
