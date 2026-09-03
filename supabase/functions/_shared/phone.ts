// Mirrors src/lib/validations/phone.ts's normalizeIndianPhone — duplicated
// here (not imported) because Edge Functions run in a separate Deno
// runtime from the Next.js app and can't share code across that boundary.
// Keep both in sync if this logic ever changes.
export function normalizeIndianPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}
