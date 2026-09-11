// Splits an E.164 phone number (e.g. "+919876543210") into the two fields
// Zaple's WhatsApp API wants separately: a bare dial code with no "+"
// ("91") and the national number ("9876543210") — mirrors the shape the
// existing admin-notify node already sends.
//
// Dial codes are NOT fixed-length (+1, +91, +971, +1264 all exist), so this
// can't be a slice — it has to try the longest possible prefix first, or
// e.g. "+1264..." would wrongly split as country "1" + national "264...".
//
// Deliberately a plain list of digit-only codes here, not an import of
// src/lib/validations/countryCodes.ts — Edge Functions run in a separate
// Deno runtime from the Next.js app and can't share code across that
// boundary (same reasoning as _shared/phone.ts). Keep in sync with
// COUNTRY_CODES there if that list ever changes.
const DIAL_CODES = [
  "91", "1", "44", "61", "65", "971", "966", "49", "33", "31", "353", "64",
  "27", "60", "62", "63", "81", "82", "86", "852", "55", "52", "34", "39",
  "41", "46", "47", "45", "48", "90", "20", "234", "254", "880", "94", "977",
].sort((a, b) => b.length - a.length); // longest first, for correct prefix matching

export interface SplitPhone {
  countryCode: string; // digits only, no "+" — e.g. "91"
  national: string;
}

/** Returns null if the number isn't a recognized E.164 value — callers
 * should skip the WhatsApp send (and let email carry it) rather than fail
 * the whole request over one unparsable number. */
export function splitE164Phone(phone: string | null | undefined): SplitPhone | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) return null;
  const withoutPlus = digits.slice(1);

  for (const code of DIAL_CODES) {
    if (withoutPlus.startsWith(code) && withoutPlus.length > code.length) {
      return { countryCode: code, national: withoutPlus.slice(code.length) };
    }
  }
  return null;
}
