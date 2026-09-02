import { z } from "zod";

export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const dayScheduleSchema = z
  .object({
    enabled: z.boolean(),
    start: z.string().regex(timeRegex, "Invalid time"),
    end: z.string().regex(timeRegex, "Invalid time"),
  })
  .superRefine((day, ctx) => {
    if (day.enabled && day.start >= day.end) {
      ctx.addIssue({ code: "custom", message: "End time must be after start time", path: ["end"] });
    }
  });

export const availabilityFormSchema = z.object({
  monday: dayScheduleSchema,
  tuesday: dayScheduleSchema,
  wednesday: dayScheduleSchema,
  thursday: dayScheduleSchema,
  friday: dayScheduleSchema,
  saturday: dayScheduleSchema,
  sunday: dayScheduleSchema,
});

export type AvailabilityFormValues = z.infer<typeof availabilityFormSchema>;

export const DEFAULT_AVAILABILITY: AvailabilityFormValues = {
  monday: { enabled: true, start: "10:00", end: "18:00" },
  tuesday: { enabled: true, start: "10:00", end: "18:00" },
  wednesday: { enabled: true, start: "10:00", end: "18:00" },
  thursday: { enabled: true, start: "10:00", end: "18:00" },
  friday: { enabled: true, start: "10:00", end: "18:00" },
  saturday: { enabled: false, start: "10:00", end: "18:00" },
  sunday: { enabled: false, start: "10:00", end: "18:00" },
};

/** Merges whatever is stored in `admins.weekly_availability` (which may be
 * `{}` for a brand-new admin, or missing days from an older shape) with
 * sensible defaults, so the form never crashes on partial/empty data. */
export function normalizeAvailability(stored: unknown): AvailabilityFormValues {
  const record = (stored ?? {}) as Partial<Record<Weekday, Partial<AvailabilityFormValues["monday"]>>>;
  const result = {} as AvailabilityFormValues;
  for (const day of WEEKDAYS) {
    const fallback = DEFAULT_AVAILABILITY[day];
    const value = record[day];
    result[day] = {
      enabled: typeof value?.enabled === "boolean" ? value.enabled : fallback.enabled,
      start: typeof value?.start === "string" && timeRegex.test(value.start) ? value.start : fallback.start,
      end: typeof value?.end === "string" && timeRegex.test(value.end) ? value.end : fallback.end,
    };
  }
  return result;
}
