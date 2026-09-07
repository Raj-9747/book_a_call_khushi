import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileSidePanel } from "@/components/booking/ProfileSidePanel";
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
    // Two-pane on desktop: a fixed identity panel that stays put while the
    // session list scrolls beside it. Stacks on mobile, panel first.
    <div className="min-h-screen bg-surface-muted lg:flex lg:items-start">
      <ProfileSidePanel admin={admin} />

      <main className="flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <div className="mx-auto max-w-3xl">
          {admin.accepting_bookings ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Book a session</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Pick what you need and choose a time that works for you.
                </p>
              </div>
              <EventTypeList adminSlug={admin.slug} eventTypes={eventTypes} />
            </>
          ) : (
            <EnquiryForm
              adminSlug={admin.slug}
              adminName={admin.name}
              unavailableMessage={admin.unavailable_message}
            />
          )}

          <p className="mt-10 flex items-center justify-center gap-1.5 text-xs text-neutral-400 lg:hidden">
            Powered by Zaptly
          </p>
        </div>
      </main>
    </div>
  );
}
