import { z } from "zod";

export const discountCodeSchema = z
  .object({
    // Codes are shown and matched in caps — normalized here so the admin
    // can type however they like and the DB's case-insensitive unique
    // index still lines up with what clients see.
    code: z
      .string()
      .trim()
      .min(3, "Use at least 3 characters")
      .max(32, "Keep it under 32 characters")
      .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, hyphens and underscores only")
      .transform((value) => value.toUpperCase()),
    percent: z.coerce
      .number()
      .int("Use a whole number")
      .min(1, "Must be at least 1%")
      .max(100, "Can't be more than 100%"),
    neverExpires: z.boolean(),
    expiresOn: z.string(),
    unlimitedUses: z.boolean(),
    maxUses: z.string(),
    appliesToAll: z.boolean(),
    eventTypeIds: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    if (!values.neverExpires && !values.expiresOn) {
      ctx.addIssue({ code: "custom", path: ["expiresOn"], message: "Pick an expiry date" });
    }
    if (!values.unlimitedUses) {
      const parsed = Number(values.maxUses);
      if (!values.maxUses || !Number.isInteger(parsed) || parsed < 1) {
        ctx.addIssue({ code: "custom", path: ["maxUses"], message: "Enter a whole number of uses" });
      }
    }
    if (!values.appliesToAll && values.eventTypeIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["eventTypeIds"], message: "Pick at least one session" });
    }
  });

export type DiscountCodeFormInput = z.input<typeof discountCodeSchema>;
export type DiscountCodeFormValues = z.output<typeof discountCodeSchema>;
