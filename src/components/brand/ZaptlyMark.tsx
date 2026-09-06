import { cn } from "@/lib/utils";

/** The Zaptly icon mark — a lightning bolt in a gradient tile. The bolt
 * doubles as the "Z" of the name and carries the product's actual promise
 * (a booking that fires off its own calendar invite, payment and
 * reminders) rather than being a decorative letterform.
 *
 * The gradient lives on the wrapper as a Tailwind background rather than an
 * SVG `<linearGradient>` on purpose: an SVG gradient needs an `id`, and this
 * mark renders several times per page (nav, footer, sidebar), which would
 * mean duplicate ids in the document. This way it stays a pure server
 * component with no id collisions.
 *
 * Size it by passing height/width classes — the bolt scales with the tile. */
export function ZaptlyMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        "bg-gradient-to-br from-brand-400 via-brand-600 to-brand-700 shadow-sm",
        className
      )}
    >
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
        <path d="M13.8 2 4.5 13.6h6.1L9.4 22l10.1-11.8h-6.3z" fill="currentColor" className="text-white" />
      </svg>
    </span>
  );
}
