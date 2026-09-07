import { z } from "zod";

export const REPEAT_OPTIONS = [
  { value: "none", label: "Doesn't repeat" },
  { value: "weekly", label: "Every week" },
  { value: "fortnightly", label: "Every 2 weeks" },
  { value: "monthly", label: "Every month (same date)" },
] as const;

export type RepeatFrequency = (typeof REPEAT_OPTIONS)[number]["value"];

/** Hard ceiling on how many rows one repeating block can create. Each
 * occurrence is a real row that also gets synced to Google Calendar, so an
 * unbounded "repeat forever" would be both slow and hard to undo. */
export const MAX_OCCURRENCES = 60;

export const blockedSlotFormSchema = z
  .object({
    date: z.string().min(1, "Date is required"),
    allDay: z.boolean(),
    startTime: z.string(),
    endTime: z.string(),
    reason: z.string().max(200, "Keep it under 200 characters").optional(),
    repeat: z.enum(["none", "weekly", "fortnightly", "monthly"]),
    repeatUntil: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.allDay && data.startTime >= data.endTime) {
      ctx.addIssue({ code: "custom", message: "End time must be after start time", path: ["endTime"] });
    }
    if (data.repeat !== "none") {
      if (!data.repeatUntil) {
        ctx.addIssue({ code: "custom", message: "Pick a date to repeat until", path: ["repeatUntil"] });
      } else if (data.repeatUntil < data.date) {
        ctx.addIssue({ code: "custom", message: "Must be on or after the first date", path: ["repeatUntil"] });
      }
    }
  });

export type BlockedSlotFormValues = z.infer<typeof blockedSlotFormSchema>;

export const DEFAULT_BLOCKED_SLOT_FORM: BlockedSlotFormValues = {
  date: "",
  allDay: true,
  startTime: "00:00",
  endTime: "23:59",
  reason: "",
  repeat: "none",
  repeatUntil: "",
};

/** Expands a repeating block into the concrete calendar dates it covers.
 * Works in plain "yyyy-MM-dd" strings so it never trips over timezone
 * conversion — these are calendar dates in the admin's own IST frame, not
 * instants. */
export function expandOccurrenceDates(values: BlockedSlotFormValues): string[] {
  if (values.repeat === "none") return [values.date];

  const dates: string[] = [];
  const [year, month, day] = values.date.split("-").map(Number);
  const until = values.repeatUntil;

  // Anchored at UTC noon so daylight-saving shifts in other zones can never
  // roll a date backwards or forwards a day.
  const cursor = new Date(Date.UTC(year, month - 1, day, 12));
  const monthlyAnchorDay = day;

  while (dates.length < MAX_OCCURRENCES) {
    const iso = cursor.toISOString().slice(0, 10);
    if (iso > until) break;
    dates.push(iso);

    if (values.repeat === "weekly") {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    } else if (values.repeat === "fortnightly") {
      cursor.setUTCDate(cursor.getUTCDate() + 14);
    } else {
      // Monthly on the same date. Setting the day first to 1 avoids the
      // classic overflow where "Jan 31 + 1 month" lands in March.
      const nextMonth = cursor.getUTCMonth() + 1;
      cursor.setUTCDate(1);
      cursor.setUTCMonth(nextMonth);
      const daysInMonth = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
      cursor.setUTCDate(Math.min(monthlyAnchorDay, daysInMonth));
    }
  }

  return dates;
}
