import { z } from "zod";

/**
 * Normalizes common ways people type an Indian mobile number — with a
 * leading "+91"/"91", a leading "0", spaces, dashes — down to a clean
 * 10-digit string, or returns null if it still isn't a valid mobile number
 * (must start with 6-9, per Indian numbering rules — required since this is
 * what Zaple's WhatsApp API expects passed separately from `country_code`).
 */
export function normalizeIndianPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .transform((val, ctx) => {
    const normalized = normalizeIndianPhone(val);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number (no country code needed)" });
      return z.NEVER;
    }
    return normalized;
  });
