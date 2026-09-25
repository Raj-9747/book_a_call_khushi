import { DM_Sans, Fraunces } from "next/font/google";

/** Fonts for the public booking pages only — the dashboard stays on Geist.
 *
 * Fraunces is a soft, slightly quirky serif: editorial enough to feel like
 * a creator's own page rather than a SaaS form, warm enough to match
 * Khushi's voice. DM Sans keeps body copy and form UI crisp. */
const display = Fraunces({
  variable: "--font-khushi-display",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

const sans = DM_Sans({
  variable: "--font-khushi-sans",
  subsets: ["latin"],
});

/** Everything a subtree needs to render in the booking theme: the token
 * overrides (globals.css `.theme-khushi`) plus both font variables. */
export const BOOK_THEME_CLASSES = ["theme-khushi", display.variable, sans.variable];
