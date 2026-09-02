import { z } from "zod";

export const bookingDetailsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  phone: z.string().min(1, "Phone number is required"),
});

export type BookingDetailsValues = z.infer<typeof bookingDetailsSchema>;
