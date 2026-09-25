import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { EnquiryForm } from "@/components/booking/EnquiryForm";
import type { PublicAdmin, PublicEventType } from "@/lib/api/publicBooking";

type Params = Promise<{ adminSlug: string; eventSlug: string }>;

// cache() so generateMetadata and the page share one pair of RPCs per
// request instead of each fetching their own.
const loadBooking = cache(async (adminSlug: string, eventSlug: string) => {
  const supabase = await createClient();

  const { data: adminRows } = await supabase.rpc("get_public_admin", { p_slug: adminSlug });
  const admin = adminRows?.[0] as PublicAdmin | undefined;
  if (!admin) return null;

  const { data: eventTypeRows } = await supabase.rpc("get_public_event_type", {
    p_admin_id: admin.id,
    p_slug: eventSlug,
  });
  const eventType = eventTypeRows?.[0] as PublicEventType | undefined;
  if (!eventType) return null;

  return { admin, eventType };
});

// Shared on WhatsApp/Instagram a lot, so the link preview should name the
// session and the host rather than just "Zaptly".
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { adminSlug, eventSlug } = await params;
  const loaded = await loadBooking(adminSlug, eventSlug);
  if (!loaded) return { title: "Not found" };
  const { admin, eventType } = loaded;
  const title = `${eventType.name} · ${admin.name}`;
  const description = eventType.description ?? `Book a ${eventType.duration_minutes}-minute call with ${admin.name}.`;
  return {
    title,
    description,
    openGraph: { title, description, images: admin.photo_url ? [admin.photo_url] : undefined },
  };
}

export default async function PublicBookingPage({ params }: { params: Params }) {
  const { adminSlug, eventSlug } = await params;
  const loaded = await loadBooking(adminSlug, eventSlug);
  if (!loaded) notFound();
  const { admin, eventType } = loaded;

  return (
    <div className="relative flex flex-1 justify-center px-4 py-6 sm:px-6 sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(50%_60%_at_20%_0%,var(--brand-100)_0%,transparent_100%),radial-gradient(40%_50%_at_85%_5%,var(--marigold-100)_0%,transparent_100%)] opacity-70"
      />
      <div className="relative w-full max-w-[1240px]">
        <Link
          href={`/book/${admin.slug}`}
          className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-neutral-600 shadow-xs transition-colors hover:border-brand-300 hover:text-brand-700"
        >
          <ChevronLeft className="h-4 w-4" />
          All sessions
        </Link>

        {/* The toggle is re-checked server-side on every booking attempt too
            — hiding the picker here is presentation, not the guard. */}
        {admin.accepting_bookings ? (
          <BookingFlow
            admin={{ ...admin, weekly_availability: admin.weekly_availability ?? {} }}
            eventType={{ ...eventType, price: Number(eventType.price) }}
          />
        ) : (
          <div className="max-w-lg">
            <EnquiryForm
              adminSlug={admin.slug}
              adminName={admin.name}
              eventSlug={eventType.slug}
              unavailableMessage={admin.unavailable_message}
            />
          </div>
        )}
      </div>
    </div>
  );
}
