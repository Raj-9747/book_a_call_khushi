import { Globe } from "lucide-react";
import type { PublicAdmin } from "@/lib/api/publicBooking";
import type { ProfileShowcase } from "@/lib/branding/profileShowcase";
import { GlassesDoodle, MarigoldFlower } from "./doodles";
import { InstagramOutlineIcon, LinkedInOutlineIcon, XIcon, YouTubeOutlineIcon } from "./social-icons";

// The public profile, built to the "Chai Menu — warm & playful" design:
// wordmark bar → hero with an arch-framed photo → the maroon session menu
// (EventTypeList) → three numbered steps.

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Glasses logo + lower-case wordmark on the left, outlined social pills on
 * the right. Shared by the profile and the booking page so both read as
 * one site. */
export function ProfileTopBar({ admin, showcase }: { admin: PublicAdmin; showcase: ProfileShowcase }) {
  const socials = [
    { href: admin.instagram_url, icon: InstagramOutlineIcon, label: "Instagram" },
    { href: showcase.youtubeUrl, icon: YouTubeOutlineIcon, label: "YouTube" },
    { href: admin.linkedin_url, icon: LinkedInOutlineIcon, label: "LinkedIn" },
    { href: admin.x_url, icon: XIcon, label: "X" },
    { href: admin.website_url, icon: Globe, label: "Website" },
  ].filter((s): s is { href: string; icon: typeof InstagramOutlineIcon; label: string } => !!s.href);

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <a href={`/book/${admin.slug}`} className="flex items-center gap-2.5 text-brand-700">
        <GlassesDoodle className="h-[34px] w-[34px]" />
        <span className="font-display text-2xl leading-none">{showcase.brandName ?? admin.name.toLowerCase()}</span>
      </a>

      {socials.length > 0 && (
        <nav aria-label="Social links" className="flex flex-wrap gap-2.5">
          {socials.map(({ href, icon: Icon, label }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={label}
              className="flex items-center gap-2 rounded-full border-[1.5px] border-brand-600 p-3 text-[15px] font-semibold text-brand-600 transition-colors hover:bg-brand-600/5 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted sm:px-[18px]"
            >
              <Icon className="h-[18px] w-[18px]" />
              {/* Icon-only on phones so the row fits beside the wordmark. */}
              <span className="hidden sm:inline">{label}</span>
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

export function ProfileHero({ admin, showcase }: { admin: PublicAdmin; showcase: ProfileShowcase }) {
  const firstName = admin.name.trim().split(/\s+/)[0];
  const intro = showcase.intro ?? admin.headline ?? admin.about;

  return (
    <section className="grid items-center gap-12 lg:grid-cols-[1.25fr_1fr] lg:gap-[72px]">
      <div className="flex flex-col gap-7">
        <span className="self-start rounded-full bg-brand-600 px-4 py-2 text-[13px] font-bold uppercase tracking-[0.12em] text-surface-muted">
          Book a 1:1
        </span>
        <h1 className="font-display text-[44px] leading-[1.02] text-brand-700 sm:text-6xl lg:text-7xl xl:text-[86px]">
          {showcase.heroTitle ?? `Let's talk with ${firstName}.`}
        </h1>
        {intro && (
          // whitespace-pre-line so an admin's own paragraph breaks survive
          // when the intro falls back to their bio.
          <p className="max-w-[580px] whitespace-pre-line text-lg leading-[1.55] text-neutral-700 sm:text-[21px]">
            {intro}
          </p>
        )}
        {showcase.highlights && showcase.highlights.length > 0 && (
          <ul className="flex flex-wrap gap-2.5">
            {showcase.highlights.map((h) => (
              <li
                key={h}
                className="rounded-full border-[1.5px] border-dashed border-brand-600 px-4 py-[9px] text-[15px] font-medium text-brand-700"
              >
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* The arch: a marigold frame with the photo inset 16px inside it.
          The top corners are half the frame's width (container-query units),
          so the top is a true semicircle at any size, not just at 1440px. */}
      <div className="@container mx-auto w-full max-w-[400px] lg:max-w-none">
        <div className="relative aspect-[13/12]">
          <div className="absolute inset-0 rounded-[50cqw_50cqw_28px_28px] bg-marigold-400" />
          <div className="absolute inset-4 flex items-center justify-center overflow-hidden rounded-[calc(50cqw_-_16px)_calc(50cqw_-_16px)_16px_16px] bg-photo-bg">
            {admin.photo_url ? (
              // Plain <img>: a Supabase Storage URL unknown at build time,
              // so next/image's loader adds nothing.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={admin.photo_url}
                alt={admin.name}
                className="h-full w-full object-cover"
                loading="eager"
                decoding="async"
              />
            ) : (
              <span className="font-display text-7xl text-neutral-500">{initials(admin.name)}</span>
            )}
          </div>
          <div className="absolute -left-3 bottom-7 flex h-24 w-24 items-center justify-center rounded-full bg-surface-muted shadow-lg sm:-left-9 sm:h-[124px] sm:w-[124px]">
            <MarigoldFlower className="h-[77%] w-[77%]" />
          </div>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Pick a session", body: "Choose what you'd like to talk about." },
  { title: "Grab a slot", body: "Times show in your own timezone." },
  { title: "Hop on the call", body: "Your Google Meet link lands on email and WhatsApp." },
];

export function HowItWorks() {
  return (
    <ol aria-label="How booking works" className="grid gap-6 md:grid-cols-3 md:gap-8">
      {STEPS.map(({ title, body }, i) => (
        <li key={title} className="flex items-start gap-[18px]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-marigold-400 font-display text-[22px] text-brand-900">
            {i + 1}
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-[19px] font-bold text-brand-700">{title}</span>
            <span className="text-base text-neutral-700">{body}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
