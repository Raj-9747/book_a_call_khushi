import type { SVGProps } from "react";

// Hand-drawn-feeling marks for the booking theme. Stroked in currentColor on
// the same 24-unit grid as Lucide so they size and colour like the icons.

/** Round glasses — the "chashmish" in @chashmishkhushi. */
export function GlassesDoodle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" {...props}>
      <circle cx="10" cy="11" r="7" />
      <circle cx="30" cy="11" r="7" />
      <path d="M17 10c1.8-1.6 4.2-1.6 6 0" />
      <path d="M3 9 1 5M37 9l2-4" />
    </svg>
  );
}

export function SparkleDoodle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 1.5c.5 4.6 2.4 7.9 7 9.2.5.2.5.9 0 1.1-4.6 1.3-6.5 4.6-7 9.2-.1.6-1 .6-1 0-.5-4.6-2.4-7.9-7-9.2-.5-.2-.5-.9 0-1.1 4.6-1.3 6.5-4.6 7-9.2.1-.6 1-.6 1 0Z" />
    </svg>
  );
}
