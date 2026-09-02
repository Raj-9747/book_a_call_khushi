import { z } from "zod";

export const blockedSlotFormSchema = z
  .object({
    date: z.string().min(1, "Date is required"),
    allDay: z.boolean(),
    startTime: z.string(),
    endTime: z.string(),
    reason: z.string().max(200, "Keep it under 200 characters").optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.allDay && data.startTime >= data.endTime) {
      ctx.addIssue({ code: "custom", message: "End time must be after start time", path: ["endTime"] });
    }
  });

export type BlockedSlotFormValues = z.infer<typeof blockedSlotFormSchema>;

export const DEFAULT_BLOCKED_SLOT_FORM: BlockedSlotFormValues = {
  date: "",
  allDay: true,
  startTime: "00:00",
  endTime: "23:59",
  reason: "",
};
