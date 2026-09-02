import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookingFlow } from "@/components/booking/BookingFlow";
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
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4 py-12">
      <div className="w-full max-w-lg">
        <BookingFlow admin={{ ...admin, weekly_availability: admin.weekly_availability ?? {} }} eventType={{ ...eventType, price: Number(eventType.price) }} />
      </div>
    </div>
  );
}
