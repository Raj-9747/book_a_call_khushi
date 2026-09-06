/** Shared slug rules for an admin's public booking link (`/book/<slug>`).
 * Lowercase letters, digits, and single hyphens between them — no leading,
 * trailing, or doubled hyphens, so the resulting URL always reads cleanly.
 * Mirrors `src/lib/validations/slug.ts` on the frontend; keep both in sync. */
export function normalizeSlug(input: string): string | null {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  if (slug.length < 3 || slug.length > 50) return null;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  return slug;
}
