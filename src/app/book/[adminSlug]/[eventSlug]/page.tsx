import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { EnquiryForm } from "@/components/booking/EnquiryForm";
import { ProfileTopBar } from "@/components/booking/ProfileSections";
import { getProfileShowcase } from "@/lib/branding/profileShowcase";
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
    <div className="mx-auto flex w-full max-w-[1536px] flex-col gap-8 px-5 pb-10 pt-6 sm:px-10 sm:pt-10 xl:px-24 xl:pt-11">
      <ProfileTopBar admin={admin} showcase={getProfileShowcase(admin.slug)} />

      <div className="w-full">
        <Link
          href={`/book/${admin.slug}`}
          className="mb-5 inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-brand-600 px-4 py-2 text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-600/5 hover:text-brand-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to the menu
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
