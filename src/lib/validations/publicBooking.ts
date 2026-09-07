import { z } from "zod";
import { DEFAULT_COUNTRY_CODE, normalizeNationalNumber } from "./countryCodes";

export const bookingDetailsSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120, "That name is too long"),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      // Belt and braces over zod's own .email(): that accepts some shapes
      // people rarely mean (no dot in the domain, for instance), and a typo
      // here means the confirmation and the Meet link go nowhere.
      .email("Enter a valid email address")
      .regex(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i, "Enter a valid email address"),
    countryCode: z.string().min(1, "Select a country code").default(DEFAULT_COUNTRY_CODE),
    phone: z.string().trim().min(1, "Phone number is required"),
  })
  .superRefine((values, ctx) => {
    if (!normalizeNationalNumber(values.countryCode, values.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message:
          values.countryCode === DEFAULT_COUNTRY_CODE
            ? "Enter a valid 10-digit mobile number"
            : "Enter a valid phone number for the selected country",
      });
    }
  });

export type BookingDetailsInput = z.input<typeof bookingDetailsSchema>;
export type BookingDetailsValues = z.output<typeof bookingDetailsSchema>;

/** The single string stored on the booking and handed to notifications —
 * dial code plus the national digits, e.g. "+919876543210". */
export function toE164(countryCode: string, phone: string): string {
  const national = normalizeNationalNumber(countryCode, phone);
  return national ? `${countryCode}${national}` : `${countryCode}${phone.replace(/\D/g, "")}`;
}
