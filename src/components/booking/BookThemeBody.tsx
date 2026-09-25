"use client";

import { useEffect } from "react";

/** Mirrors the booking theme onto <body> while a /book page is mounted.
 *
 * The page wrapper already carries the theme for the server render, but
 * Modal and Select portal into document.body — outside that wrapper — so
 * without this the booking-details dialog and the country-code dropdown
 * would render in the dashboard's indigo. Portals only ever open after
 * hydration, so adding the class in an effect causes no flash. */
export function BookThemeBody({ classes }: { classes: string[] }) {
  useEffect(() => {
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [classes]);

  return null;
}
