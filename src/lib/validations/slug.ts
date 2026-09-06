import { z } from "zod";

/** Same rules as `supabase/functions/_shared/slug.ts` — lowercase letters,
 * digits, and single hyphens between them. Keep both in sync. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters")
  .max(50, "Keep it under 50 characters")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and single hyphens only — no spaces or symbols");
