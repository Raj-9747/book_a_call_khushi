import { DM_Sans, Young_Serif } from "next/font/google";

/** Fonts for the public booking pages only — the dashboard stays on Geist.
 *
 * Straight from the "Chai Menu" design: Young Serif for display type (a
 * warm, chunky serif that reads like a café menu board) and DM Sans for
 * body copy and form UI. Young Serif ships in one weight only, so display
 * text is never bolded — see `.theme-khushi .font-display` in globals.css. */
const display = Young_Serif({
  variable: "--font-khushi-display",
  subsets: ["latin"],
  weight: "400",
});

const sans = DM_Sans({
  variable: "--font-khushi-sans",
  subsets: ["latin"],
});

/** Everything a subtree needs to render in the booking theme: the token
 * overrides (globals.css `.theme-khushi`) plus both font variables. */
export const BOOK_THEME_CLASSES = ["theme-khushi", display.variable, sans.variable];
