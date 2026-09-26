import Link from "next/link";
import type { PublicAdminEventType } from "@/lib/api/publicBooking";

export function formatPrice(price: number): string {
  return price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Free";
}

/** "Today's menu" — the session list on an admin's public profile, laid out
 * like a chai-stall menu board: one dashed-ruled row per session with its
 * length, price and a Book button. Collapses to a stacked row on phones. */
export function EventTypeList({
  adminSlug,
  eventTypes,
}: {
  adminSlug: string;
  eventTypes: PublicAdminEventType[];
}) {
  return (
    <section
      id="sessions"
      aria-labelledby="menu-heading"
      className="flex flex-col rounded-[28px] bg-brand-700 px-6 pb-3 pt-8 text-surface-muted sm:px-10 lg:px-14 lg:pb-5 lg:pt-11"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pb-5">
        <h2 id="menu-heading" className="font-display text-[34px] leading-tight sm:text-[44px]">
          Today&apos;s menu
        </h2>
        <span className="text-base text-parchment">Every session is a 1:1 video call on Google Meet</span>
      </div>

      {eventTypes.length === 0 ? (
        <p className="border-t-[1.5px] border-dashed border-surface-muted/35 py-10 text-center text-[17px] text-parchment">
          Nothing on the menu just yet — check back soon.
        </p>
      ) : (
        <ul>
          {eventTypes.map((eventType) => (
            <li
              key={eventType.id}
              className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3 border-t-[1.5px] border-dashed border-surface-muted/35 py-6 md:grid-cols-[1fr_110px_110px_150px] md:py-7 lg:grid-cols-[1fr_130px_130px_150px]"
            >
              <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
                <span className="font-display text-2xl leading-tight sm:text-[30px]">{eventType.name}</span>
                {eventType.description && (
                  <span className="line-clamp-2 text-base text-parchment sm:text-[17px]">{eventType.description}</span>
                )}
              </div>
              <span className="text-base text-parchment sm:text-[17px]">{eventType.duration_minutes} min</span>
              <span className="text-right font-display text-2xl text-sun sm:text-[30px] md:text-left">
                {formatPrice(eventType.price)}
              </span>
              <Link
                href={`/book/${adminSlug}/${eventType.slug}`}
                aria-label={`Book ${eventType.name}`}
                className="col-span-2 flex min-h-[52px] items-center justify-center rounded-full bg-sun text-[17px] font-bold text-brand-900 transition-colors hover:bg-marigold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun focus-visible:ring-offset-2 focus-visible:ring-offset-brand-700 md:col-span-1"
              >
                Book →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
