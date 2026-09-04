import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
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
      <div className="rounded-xl border border-dashed border-border-strong bg-surface py-12 text-center">
        <p className="text-sm font-medium text-neutral-900">No sessions available yet</p>
        <p className="mt-1 text-sm text-neutral-500">Check back soon.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {eventTypes.map((eventType) => (
        <li key={eventType.id}>
          <Link
            href={`/book/${adminSlug}/${eventType.slug}`}
            className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-neutral-50 sm:p-5"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-neutral-900">{eventType.name}</p>
              {eventType.description && (
                <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{eventType.description}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1.5 text-neutral-500">
                  <Clock className="h-3.5 w-3.5" />
                  {eventType.duration_minutes} min
                </span>
                <span className="font-semibold text-neutral-900">{formatPrice(eventType.price)}</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-500" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
