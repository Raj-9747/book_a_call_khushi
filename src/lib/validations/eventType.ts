import { z } from "zod";

export const questionTypeSchema = z.enum(["text", "textarea", "select"]);

// Form-level shape: `optionsText` is a comma-separated string in the UI and
// gets split into the `options: string[]` the DB expects on submit.
export const eventTypeFormSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100, "Keep it under 100 characters"),
    duration_minutes: z.coerce
      .number({ error: "Enter a duration" })
      .int("Whole minutes only")
      .min(5, "Minimum 5 minutes")
      .max(480, "Maximum 8 hours"),
    price: z.coerce.number({ error: "Enter a price" }).min(0, "Price can't be negative"),
    description: z.string().max(500, "Keep it under 500 characters").optional(),
    record_meeting: z.boolean(),
    custom_questions: z
      .array(
        z.object({
          id: z.string(),
          label: z.string().min(1, "Question text is required"),
          type: questionTypeSchema,
          required: z.boolean(),
          optionsText: z.string().optional(),
        })
      )
      .max(10, "You can add up to 10 custom questions"),
  })
  .superRefine((data, ctx) => {
    data.custom_questions.forEach((q, i) => {
      if (q.type === "select") {
        const opts = (q.optionsText ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (opts.length < 2) {
          ctx.addIssue({
            code: "custom",
            message: "Add at least 2 options, separated by commas",
            path: ["custom_questions", i, "optionsText"],
          });
        }
      }
    });
  });

// `duration_minutes`/`price` use z.coerce, so the raw form state (before
// zodResolver runs) holds whatever the <input> gives it — string | number —
// while the validated/submitted value is always a number. RHF needs both:
// the raw shape for `useForm`/`register`, the coerced shape for `onSubmit`.
export type EventTypeFormInput = z.input<typeof eventTypeFormSchema>;
export type EventTypeFormValues = z.output<typeof eventTypeFormSchema>;
