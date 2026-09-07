import Link from "next/link";
import { ArrowRight, CalendarX2, Clock, Video } from "lucide-react";
import type { PublicAdminEventType } from "@/lib/api/publicBooking";

export function formatPrice(price: number): string {
  return price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Free";
}

/** The "pick a session" list on an admin's public profile. */
export function EventTypeList({
  adminSlug,
  eventTypes,
}: {
  adminSlug: string;
  eventTypes: PublicAdminEventType[];
}) {
  if (eventTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-surface py-16 text-center">
        <CalendarX2 className="h-8 w-8 text-neutral-300" />
        <p className="mt-3 text-sm font-medium text-neutral-900">No sessions available yet</p>
        <p className="mt-1 text-sm text-neutral-500">Check back soon.</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {eventTypes.map((eventType) => (
        <li key={eventType.id}>
          <Link
            href={`/book/${adminSlug}/${eventType.slug}`}
            className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
              <Video className="h-3.5 w-3.5" />
              Video meeting
              <span className="text-neutral-300">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {eventType.duration_minutes} mins
              </span>
            </p>

            <h3 className="mt-3 text-base font-semibold leading-snug text-neutral-900">{eventType.name}</h3>

            {eventType.description && (
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-500">{eventType.description}</p>
            )}

            {/* mt-auto pins the price row to the bottom so cards of differing
                description lengths still line up across the grid. */}
            <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
              <span className="text-lg font-semibold text-neutral-900">{formatPrice(eventType.price)}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-surface transition-colors group-hover:bg-brand-600">
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
