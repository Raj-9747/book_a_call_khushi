import Link from "next/link";
import { ArrowRight, CalendarX2, Clock, Flame, Video } from "lucide-react";
import type { PublicAdminEventType } from "@/lib/api/publicBooking";

export function formatPrice(price: number): string {
  return price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Free";
}

/** The "pick a session" list on an admin's public profile. */
export function EventTypeList({
  adminSlug,
  eventTypes,
  popularSlugs = [],
}: {
  adminSlug: string;
  eventTypes: PublicAdminEventType[];
  popularSlugs?: string[];
}) {
  if (eventTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border-strong bg-surface py-16 text-center">
        <CalendarX2 className="h-8 w-8 text-neutral-300" />
        <p className="mt-3 text-sm font-medium text-neutral-900">No sessions available yet</p>
        <p className="mt-1 text-sm text-neutral-500">Check back soon.</p>
      </div>
    );
  }

  return (
    // One column at lg, where the sticky profile card eats half the width
    // and two columns would squeeze titles onto three lines.
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {eventTypes.map((eventType) => {
        const popular = popularSlugs.includes(eventType.slug);
        return (
          <li key={eventType.id}>
            <Link
              href={`/book/${adminSlug}/${eventType.slug}`}
              className="group relative flex h-full flex-col rounded-3xl border border-border bg-surface p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted"
            >
              {/* A tilted "sticker" on the card's edge, so it never competes
                  with the meta chips for space. */}
              {popular && (
                <span className="absolute -top-3 right-5 inline-flex rotate-3 items-center gap-1 rounded-full border-2 border-surface bg-marigold-400 px-3 py-1 text-xs font-bold text-neutral-900 shadow-sm">
                  <Flame className="h-3.5 w-3.5" />
                  Popular
                </span>
              )}
              <div>
                <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-neutral-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1">
                    <Video className="h-3.5 w-3.5" />
                    1:1 video call
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1">
                    <Clock className="h-3.5 w-3.5" />
                    {eventType.duration_minutes} min
                  </span>
                </p>
              </div>

              <h3 className="mt-4 font-display text-[1.4rem] font-semibold leading-tight tracking-tight text-neutral-900 [font-variation-settings:'SOFT'_100]">
                {eventType.name}
              </h3>

              {eventType.description && (
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-500">{eventType.description}</p>
              )}

              {/* mt-auto pins the price row to the bottom so cards of differing
                  description lengths still line up across the grid. */}
              <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                <span className="text-xl font-semibold tracking-tight text-neutral-900">
                  {formatPrice(eventType.price)}
                </span>
                <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-neutral-900 pl-4 pr-3 text-sm font-medium text-surface transition-colors group-hover:bg-brand-600">
                  Book
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
