import { Globe, MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicAdmin } from "@/lib/api/publicBooking";
import type { ProfileShowcase } from "@/lib/branding/profileShowcase";
import { InstagramIcon, LinkedInIcon, XIcon } from "./social-icons";
import { GlassesDoodle } from "./doodles";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** The identity card on an admin's public profile — photo, who they are,
 * why you should trust them, and where else to find them. Sticky beside
 * the session list on desktop; the first thing on the page on mobile. */
export function ProfileSidePanel({ admin, showcase }: { admin: PublicAdmin; showcase: ProfileShowcase }) {
  const socials = [
    { href: admin.instagram_url, icon: InstagramIcon, label: "Instagram" },
    { href: admin.linkedin_url, icon: LinkedInIcon, label: "LinkedIn" },
    { href: admin.x_url, icon: XIcon, label: "X" },
    { href: admin.website_url, icon: Globe, label: "Website" },
  ].filter((s): s is { href: string; icon: typeof LinkedInIcon; label: string } => !!s.href);

  return (
    <aside className="relative overflow-hidden rounded-[2rem] border border-border bg-surface p-6 shadow-md sm:p-8">
      {/* Warm wash behind the photo so the card doesn't read as a flat form. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(90%_100%_at_0%_0%,var(--brand-100)_0%,transparent_70%),radial-gradient(60%_90%_at_100%_0%,var(--marigold-100)_0%,transparent_70%)]"
      />

      <div className="relative flex items-end gap-5 lg:block">
        {/* Photo "stack": a tilted coral card behind a tilted photo. */}
        <div className="relative shrink-0 lg:w-fit">
          <div aria-hidden="true" className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-6 rounded-[1.75rem] bg-brand-400" />
          {admin.photo_url ? (
            // Plain <img>: the source is a Supabase Storage public URL that
            // can't be known at build time, so next/image's loader adds
            // nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={admin.photo_url}
              alt={admin.name}
              className="relative h-24 w-24 -rotate-2 rounded-[1.75rem] border-4 border-surface object-cover shadow-md sm:h-28 sm:w-28 lg:h-36 lg:w-36"
              loading="eager"
              decoding="async"
            />
          ) : (
            <div className="relative flex h-24 w-24 -rotate-2 items-center justify-center rounded-[1.75rem] border-4 border-surface bg-brand-100 font-display text-3xl text-brand-700 shadow-md sm:h-28 sm:w-28 lg:h-36 lg:w-36">
              {initials(admin.name)}
            </div>
          )}
          <span className="absolute -bottom-2 -right-3 flex h-10 w-10 rotate-12 items-center justify-center rounded-full border-2 border-surface bg-neutral-900 text-marigold-400 shadow-sm">
            <GlassesDoodle className="h-4 w-7" />
          </span>
        </div>

        <div className="min-w-0 lg:mt-7">
          <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight text-neutral-900 [font-variation-settings:'SOFT'_100] sm:text-4xl">
            {admin.name}
          </h1>
          {showcase.location && (
            <p className="mt-2 flex items-center gap-1 text-sm text-neutral-500">
              <MapPin className="h-3.5 w-3.5" />
              {showcase.location}
            </p>
          )}
        </div>
      </div>

      <div className="relative">
        {showcase.tagline && (
          <p className="mt-6 font-display text-xl italic leading-snug text-brand-700 [font-variation-settings:'SOFT'_100]">
            {showcase.tagline}
          </p>
        )}

        {admin.headline && (
          <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">{admin.headline}</p>
        )}

        {showcase.credentials && showcase.credentials.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-1.5">
            {showcase.credentials.map((c) => (
              <li
                key={c}
                className="rounded-full border border-border bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700"
              >
                {c}
              </li>
            ))}
          </ul>
        )}

        {(showcase.rating || (showcase.stats && showcase.stats.length > 0)) && (
          <div className="mt-6 rounded-2xl bg-neutral-50 p-4">
            {showcase.rating && (
              <div className="flex items-center gap-2">
                <span className="flex text-marigold-400" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </span>
                <span className="text-sm font-semibold text-neutral-900">{showcase.rating.score}</span>
                <span className="text-sm text-neutral-500">from {showcase.rating.count} ratings</span>
              </div>
            )}
            {showcase.stats && showcase.stats.length > 0 && (
              <div
                className={cn("grid divide-x divide-border", showcase.rating && "mt-4 border-t border-border pt-4")}
                style={{ gridTemplateColumns: `repeat(${showcase.stats.length}, minmax(0, 1fr))` }}
              >
                {showcase.stats.map((s) => (
                  <p key={s.label} className="px-2 text-center">
                    <span className="block font-display text-2xl font-semibold text-neutral-900">{s.value}</span>
                    <span className="mt-0.5 block text-xs text-neutral-500">{s.label}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {socials.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {socials.map(({ href, icon: Icon, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                <Icon className="h-4 w-4" />
                {label}
              </a>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
