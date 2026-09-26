/** Extra, hand-curated copy for a public profile page — the parts of the
 * "Chai Menu" design that the admin profile table doesn't model (the
 * wordmark, the hero line, the highlight chips, a YouTube link).
 *
 * Keyed by admin slug. Every field is optional and the page falls back to
 * the admin's own profile fields, so an admin with no entry still gets a
 * complete page. Move this into the database if it ever needs editing from
 * the dashboard. */
export interface ProfileShowcase {
  /** Lower-case wordmark in the top bar, e.g. "chashmish khushi". */
  brandName?: string;
  /** The big hero line. */
  heroTitle?: string;
  /** Hero paragraph under the title. */
  intro?: string;
  /** Dashed chips under the intro: credentials, audience size, … */
  highlights?: string[];
  /** Not an admin profile column, so it lives here. */
  youtubeUrl?: string;
}

const KHUSHI: ProfileShowcase = {
  brandName: "chashmish khushi",
  heroTitle: "Let's talk over a cutting chai.",
  intro:
    "Hi, I'm Khushbu — Gujju girl in Mumbai and the creator behind @chashmishkhushi. Pick what you need and grab a time that works for you.",
  highlights: ["IIM Udaipur", "ex-Amazon", "ex-Media", "181K on Instagram"],
  youtubeUrl: "https://www.youtube.com/@chashmishkhushi",
};

// TODO(before launch): confirm Khushi's admin slug and keep only the real one.
const SHOWCASES: Record<string, ProfileShowcase> = {
  khushi: KHUSHI,
  khushbu: KHUSHI,
  "khushbu-chandarana": KHUSHI,
  chashmishkhushi: KHUSHI,
};

export function getProfileShowcase(adminSlug: string): ProfileShowcase {
  return SHOWCASES[adminSlug] ?? {};
}
