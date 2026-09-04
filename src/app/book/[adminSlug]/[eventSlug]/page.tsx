import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { EnquiryForm } from "@/components/booking/EnquiryForm";
import type { PublicAdmin, PublicEventType } from "@/lib/api/publicBooking";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ adminSlug: string; eventSlug: string }>;
}) {
  const { adminSlug, eventSlug } = await params;
  const supabase = await createClient();

  const { data: adminRows } = await supabase.rpc("get_public_admin", { p_slug: adminSlug });
  const admin = adminRows?.[0] as PublicAdmin | undefined;
  if (!admin) notFound();

  const { data: eventTypeRows } = await supabase.rpc("get_public_event_type", {
    p_admin_id: admin.id,
    p_slug: eventSlug,
  });
  const eventType = eventTypeRows?.[0] as PublicEventType | undefined;
  if (!eventType) notFound();

  return (
    <div className="flex min-h-screen justify-center bg-surface-muted px-4 py-10 sm:py-16">
      <div className="w-full max-w-lg">
        <Link
          href={`/book/${admin.slug}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ChevronLeft className="h-4 w-4" />
          {admin.name}
        </Link>

        {/* The toggle is re-checked server-side on every booking attempt too
            — hiding the picker here is presentation, not the guard. */}
        {admin.accepting_bookings ? (
          <BookingFlow
            admin={{ ...admin, weekly_availability: admin.weekly_availability ?? {} }}
            eventType={{ ...eventType, price: Number(eventType.price) }}
          />
        ) : (
          <EnquiryForm
            adminSlug={admin.slug}
            adminName={admin.name}
            eventSlug={eventType.slug}
            unavailableMessage={admin.unavailable_message}
          />
        )}
      </div>
    </div>
  );
}
