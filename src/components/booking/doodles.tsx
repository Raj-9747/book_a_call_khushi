import type { SVGProps } from "react";

// Marks from the "Chai Menu" design. Stroked/filled in currentColor where
// they're monochrome, so they colour like the rest of the icon set.

/** Round glasses — the "chashmish" in @chashmishkhushi. The wordmark logo. */
export function GlassesDoodle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="7" cy="14" r="4" />
      <circle cx="17" cy="14" r="4" />
      <path d="M11 14h2M3 14l-1-4M21 14l1-4" />
    </svg>
  );
}

/** The marigold badge tucked against the hero photo — twelve marigold petals
 * around a maroon centre. Two-tone, so it takes its colours from tokens. */
export function MarigoldFlower(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <g fill="var(--marigold-400)">
        {Array.from({ length: 12 }, (_, i) => (
          <ellipse key={i} cx="50" cy="20" rx="9" ry="18" transform={`rotate(${i * 30} 50 50)`} />
        ))}
      </g>
      <circle cx="50" cy="50" r="17" fill="var(--brand-700)" />
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
