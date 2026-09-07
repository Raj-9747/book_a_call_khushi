/** Dial codes offered on the public booking form's phone field.
 *
 * Deliberately a curated list rather than all ~200 countries: a long list
 * is worse to scroll on a phone, and this covers where clients realistically
 * book from. India leads because it's the default market. Add entries as
 * needed — nothing else depends on the list's length. */
export interface CountryCode {
  code: string; // dial code, including the leading +
  label: string;
  /** Exact digit count when a country has a fixed-length mobile format.
   * Left undefined where lengths vary, in which case the generic 6–14 digit
   * rule applies instead of a false-precision check. */
  digits?: number;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: "+91", label: "India (+91)", digits: 10 },
  { code: "+1", label: "USA / Canada (+1)", digits: 10 },
  { code: "+44", label: "UK (+44)" },
  { code: "+61", label: "Australia (+61)", digits: 9 },
  { code: "+65", label: "Singapore (+65)", digits: 8 },
  { code: "+971", label: "UAE (+971)", digits: 9 },
  { code: "+966", label: "Saudi Arabia (+966)", digits: 9 },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)", digits: 9 },
  { code: "+31", label: "Netherlands (+31)", digits: 9 },
  { code: "+353", label: "Ireland (+353)" },
  { code: "+64", label: "New Zealand (+64)" },
  { code: "+27", label: "South Africa (+27)", digits: 9 },
  { code: "+60", label: "Malaysia (+60)" },
  { code: "+62", label: "Indonesia (+62)" },
  { code: "+63", label: "Philippines (+63)", digits: 10 },
  { code: "+81", label: "Japan (+81)" },
  { code: "+82", label: "South Korea (+82)" },
  { code: "+86", label: "China (+86)", digits: 11 },
  { code: "+852", label: "Hong Kong (+852)", digits: 8 },
  { code: "+55", label: "Brazil (+55)" },
  { code: "+52", label: "Mexico (+52)", digits: 10 },
  { code: "+34", label: "Spain (+34)", digits: 9 },
  { code: "+39", label: "Italy (+39)" },
  { code: "+41", label: "Switzerland (+41)", digits: 9 },
  { code: "+46", label: "Sweden (+46)" },
  { code: "+47", label: "Norway (+47)", digits: 8 },
  { code: "+45", label: "Denmark (+45)", digits: 8 },
  { code: "+48", label: "Poland (+48)", digits: 9 },
  { code: "+90", label: "Turkey (+90)", digits: 10 },
  { code: "+20", label: "Egypt (+20)" },
  { code: "+234", label: "Nigeria (+234)" },
  { code: "+254", label: "Kenya (+254)" },
  { code: "+880", label: "Bangladesh (+880)" },
  { code: "+94", label: "Sri Lanka (+94)", digits: 9 },
  { code: "+977", label: "Nepal (+977)" },
];

export const DEFAULT_COUNTRY_CODE = "+91";

export const COUNTRY_CODE_OPTIONS = COUNTRY_CODES.map((c) => ({ value: c.code, label: c.label }));

/** Validates the national part of a number for the given dial code, and
 * returns it stripped to digits. `null` means invalid. */
export function normalizeNationalNumber(dialCode: string, input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;

  const country = COUNTRY_CODES.find((c) => c.code === dialCode);

  // India additionally has a well-defined mobile prefix rule (6-9), which
  // catches the common mistake of typing a landline or a leading 0.
  if (dialCode === "+91") {
    return /^[6-9]\d{9}$/.test(digits) ? digits : null;
  }

  if (country?.digits) {
    return digits.length === country.digits ? digits : null;
  }

  return digits.length >= 6 && digits.length <= 14 ? digits : null;
}
