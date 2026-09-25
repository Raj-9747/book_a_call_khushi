import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileSidePanel } from "@/components/booking/ProfileSidePanel";
import { EventTypeList } from "@/components/booking/EventTypeList";
import { EnquiryForm } from "@/components/booking/EnquiryForm";
import { AboutSection, FaqList, HowItWorks, SectionHeading, Testimonials } from "@/components/booking/ProfileSections";
import { ZaptlyMark } from "@/components/brand/ZaptlyMark";
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
  const description = getProfileShowcase(adminSlug).tagline ?? admin.headline ?? admin.about ?? undefined;
  return {
    title: `Book a call with ${admin.name}`,
    description,
    openGraph: {
      title: `Book a call with ${admin.name}`,
      description,
      images: admin.photo_url ? [admin.photo_url] : undefined,
    },
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
    <div className="relative flex-1">
      {/* Soft warm glow at the top of the page — gives the cream background
          some depth without competing with the content. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(50%_60%_at_15%_0%,var(--brand-100)_0%,transparent_100%),radial-gradient(40%_50%_at_90%_10%,var(--marigold-100)_0%,transparent_100%)] opacity-70"
      />

      {/* Two-pane on desktop: the identity card stays put while sessions,
          testimonials and the rest scroll beside it. Stacks on mobile,
          identity first. */}
      <div className="relative mx-auto grid max-w-[1480px] gap-10 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-12 lg:px-8 lg:py-14 xl:grid-cols-[400px_minmax(0,1fr)] xl:px-12 2xl:gap-16">
        {/* The card is capped to the viewport and scrolls on its own: on a
            short laptop screen it's taller than the window, and an uncapped
            sticky card would hide its bottom (the social links) for good. */}
        <div className="lg:sticky lg:top-8 lg:self-start lg:[&>aside]:max-h-[calc(100dvh-7rem)] lg:[&>aside]:overflow-y-auto lg:[&>aside]:[scrollbar-width:thin]">
          <ProfileSidePanel admin={admin} showcase={showcase} />
          <p className="mt-5 hidden items-center justify-center gap-2 text-xs text-neutral-400 lg:flex">
            <ZaptlyMark className="h-5 w-5 rounded-md" />
            Powered by Zaptly
          </p>
        </div>

        <main className="min-w-0 space-y-16">
          <section id="sessions">
            {admin.accepting_bookings ? (
              <>
                <SectionHeading eyebrow="Book a 1:1" title="Let's talk">
                  Pick what you need and choose a time that works for you.
                </SectionHeading>
                <EventTypeList
                  adminSlug={admin.slug}
                  eventTypes={eventTypes}
                  popularSlugs={showcase.popularEventSlugs}
                />
              </>
            ) : (
              <EnquiryForm
                adminSlug={admin.slug}
                adminName={admin.name}
                unavailableMessage={admin.unavailable_message}
              />
            )}
          </section>

          {showcase.testimonials && showcase.testimonials.length > 0 && (
            <Testimonials items={showcase.testimonials} rating={showcase.rating} />
          )}

          {admin.accepting_bookings && <HowItWorks />}

          {/* Side by side on very wide screens, where two stacked
              full-width blocks of prose leave long, hard-to-read lines. */}
          {(admin.about || (showcase.faqs && showcase.faqs.length > 0)) && (
            <div className="grid gap-16 2xl:grid-cols-2 2xl:gap-10">
              {admin.about && <AboutSection name={admin.name} about={admin.about} />}
              {showcase.faqs && showcase.faqs.length > 0 && <FaqList items={showcase.faqs} />}
            </div>
          )}

          <p className="flex items-center justify-center gap-2 pb-4 text-xs text-neutral-400 lg:hidden">
            <ZaptlyMark className="h-5 w-5 rounded-md" />
            Powered by Zaptly
          </p>
        </main>
      </div>
    </div>
  );
}
