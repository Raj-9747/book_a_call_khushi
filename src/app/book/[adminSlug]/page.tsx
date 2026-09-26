import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventTypeList } from "@/components/booking/EventTypeList";
import { EnquiryForm } from "@/components/booking/EnquiryForm";
import { HowItWorks, ProfileHero, ProfileTopBar } from "@/components/booking/ProfileSections";
import { getProfileShowcase } from "@/lib/branding/profileShowcase";
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
  const showcase = getProfileShowcase(adminSlug);
  const title = `Book a call with ${admin.name}`;
  const description = showcase.intro ?? admin.headline ?? admin.about ?? undefined;
  return {
    title,
    description,
    openGraph: { title, description, images: admin.photo_url ? [admin.photo_url] : undefined },
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
  const showcase = getProfileShowcase(admin.slug);

  return (
    // The design is a 1440px artboard with 96px side padding; the cap is a
    // little wider so big screens don't sit in a narrow column.
    <div className="mx-auto flex w-full max-w-[1536px] flex-col gap-12 px-5 pb-10 pt-6 sm:px-10 sm:pt-10 lg:gap-14 xl:px-24 xl:pb-12 xl:pt-11">
      <ProfileTopBar admin={admin} showcase={showcase} />
      <ProfileHero admin={admin} showcase={showcase} />

      {admin.accepting_bookings ? (
        <>
          <EventTypeList adminSlug={admin.slug} eventTypes={eventTypes} />
          <HowItWorks />
        </>
      ) : (
        <div className="mx-auto w-full max-w-2xl">
          <EnquiryForm adminSlug={admin.slug} adminName={admin.name} unavailableMessage={admin.unavailable_message} />
        </div>
      )}

      <p className="text-center text-sm text-neutral-500">Powered by Zaptly</p>
    </div>
  );
}
