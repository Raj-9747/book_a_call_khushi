import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminProfileHeader } from "@/components/booking/AdminProfileHeader";
import { EventTypeList } from "@/components/booking/EventTypeList";
import { EnquiryForm } from "@/components/booking/EnquiryForm";
import type { PublicAdmin, PublicAdminEventType } from "@/lib/api/publicBooking";

async function loadAdmin(adminSlug: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_admin", { p_slug: adminSlug });
  return data?.[0] as PublicAdmin | undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}): Promise<Metadata> {
  const { adminSlug } = await params;
  const admin = await loadAdmin(adminSlug);
  if (!admin) return { title: "Not found" };
  return {
    title: `Book a call with ${admin.name}`,
    description: admin.headline ?? admin.about ?? undefined,
  };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ adminSlug: string }> }) {
  const { adminSlug } = await params;

  // `get_public_admin` only returns active admins, so a deactivated one
  // 404s here rather than showing an empty profile.
  const admin = await loadAdmin(adminSlug);
  if (!admin) notFound();

  const supabase = await createClient();
  const { data: eventTypeRows } = await supabase.rpc("get_public_admin_event_types", { p_admin_id: admin.id });
  const eventTypes = ((eventTypeRows ?? []) as PublicAdminEventType[]).map((row) => ({
    ...row,
    price: Number(row.price),
  }));

  return (
    <div className="min-h-screen bg-surface-muted px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-2xl border border-border bg-surface px-5 py-8 shadow-xs sm:px-8 sm:py-10">
          <AdminProfileHeader admin={admin} />
        </div>

        <div className="mt-6">
          {admin.accepting_bookings ? (
            <>
              <h2 className="mb-3 px-1 text-sm font-semibold text-neutral-900">Book a session</h2>
              <EventTypeList adminSlug={admin.slug} eventTypes={eventTypes} />
            </>
          ) : (
            <EnquiryForm
              adminSlug={admin.slug}
              adminName={admin.name}
              unavailableMessage={admin.unavailable_message}
            />
          )}
        </div>
      </div>
    </div>
  );
}
