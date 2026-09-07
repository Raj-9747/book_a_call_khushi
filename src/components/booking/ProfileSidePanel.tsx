import { Globe } from "lucide-react";
import { ZaptlyMark } from "@/components/brand/ZaptlyMark";
import type { PublicAdmin } from "@/lib/api/publicBooking";
import { InstagramIcon, LinkedInIcon, XIcon } from "./social-icons";

/** The identity panel on an admin's public profile page.
 *
 * Uses raw `indigo-*` rather than the themed `brand-*` tokens on purpose:
 * this panel is always a saturated colour field with white text, so it must
 * NOT invert when the viewer is in dark mode — same reasoning as the
 * sign-in brand panel (see globals.css). */
export function ProfileSidePanel({ admin }: { admin: PublicAdmin }) {
  const socials = [
    { href: admin.linkedin_url, icon: LinkedInIcon, label: "LinkedIn" },
    { href: admin.x_url, icon: XIcon, label: "X" },
    { href: admin.instagram_url, icon: InstagramIcon, label: "Instagram" },
    { href: admin.website_url, icon: Globe, label: "Website" },
  ].filter((s): s is { href: string; icon: typeof LinkedInIcon; label: string } => !!s.href);

  return (
    // lg:overflow-y-auto matters: the panel is a fixed-height sticky column,
    // so without it a long bio is silently clipped at the top and bottom
    // rather than scrolling.
    <aside className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 px-6 py-10 text-white sm:px-10 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[38%] lg:max-w-lg lg:shrink-0 lg:flex-col lg:justify-between lg:overflow-y-auto lg:px-12 lg:py-14">
      {/* Soft light source, so the flat colour field has some depth. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_20%_0%,rgba(255,255,255,0.18)_0%,transparent_70%)]"
      />

      <div className="relative">
        {admin.photo_url ? (
          // Plain <img>: the source is a Supabase Storage public URL that
          // can't be known at build time, so next/image's loader adds
          // nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={admin.photo_url}
            alt={admin.name}
            className="h-24 w-24 rounded-full object-cover ring-4 ring-white/20 sm:h-28 sm:w-28"
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/15 text-2xl font-semibold ring-4 ring-white/20 sm:h-28 sm:w-28">
            {admin.name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase())
              .join("")}
          </div>
        )}

        <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">{admin.name}</h1>

        {admin.headline && (
          <p className="mt-3 text-[15px] font-medium leading-relaxed text-white/90 sm:text-base">{admin.headline}</p>
        )}

        {admin.about && (
          // whitespace-pre-line so the admin's own paragraph breaks survive.
          // Generous line-height and near-full-opacity white: at text-sm and
          // 75% this read as fine print rather than the bio it is.
          <p className="mt-6 whitespace-pre-line text-[15px] leading-7 text-white/85">{admin.about}</p>
        )}

        {socials.length > 0 && (
          <div className="mt-7 flex flex-wrap items-center gap-2">
            {socials.map(({ href, icon: Icon, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="relative mt-10 hidden items-center gap-2 text-xs text-white/60 lg:flex">
        <ZaptlyMark className="h-6 w-6 rounded-md" />
        Powered by Zaptly
      </div>
    </aside>
  );
}
