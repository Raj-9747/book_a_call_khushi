/** Shared by the client `ThemeProvider` and the server-rendered boot script
 * in `app/layout.tsx`.
 *
 * Deliberately its own plain module rather than living in ThemeProvider:
 * that file is `"use client"`, and a constant imported from a client module
 * into a server component arrives as a client *reference proxy*, not the
 * string itself — so interpolating it into the inline boot script emitted
 * `localStorage.getItem('function() { throw new Error("Attempted to call
 * THEME_STORAGE_KEY() from the server...")')` instead of the key. Same
 * server/client boundary trap that bit the nav icons early on. */
export const THEME_STORAGE_KEY = "zaptly-theme";

export type Theme = "light" | "dark";

/** Dark mode is an admin-workspace preference, not a site-wide one.
 *
 * The `dark` class lives on <html> (it has to — portal-rendered modals and
 * dropdowns mount to document.body and would otherwise escape any scoped
 * wrapper). But it's only ever applied on these routes, so the public
 * booking pages, the magic-link page and the marketing site always render
 * light — including when the admin previews their own booking page from
 * the dashboard, which is exactly when the leak was visible. */
export const THEMED_ROUTE_PREFIXES = ["/dashboard", "/admin"];

export function isThemedRoute(pathname: string): boolean {
  return THEMED_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
