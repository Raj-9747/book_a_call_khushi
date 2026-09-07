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
