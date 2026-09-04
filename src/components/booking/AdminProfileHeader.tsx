import { Avatar } from "@/components/ui";
import type { PublicAdmin } from "@/lib/api/publicBooking";
import { InstagramIcon, LinkedInIcon } from "./social-icons";

/** The identity block at the top of an admin's public pages. Each optional
 * field is skipped entirely when unset, so a bare profile (name only) still
 * reads as finished rather than half-filled. */
export function AdminProfileHeader({ admin, compact }: { admin: PublicAdmin; compact?: boolean }) {
  const socials = [
    { href: admin.linkedin_url, icon: LinkedInIcon, label: "LinkedIn" },
    { href: admin.instagram_url, icon: InstagramIcon, label: "Instagram" },
  ].filter((s): s is { href: string; icon: typeof LinkedInIcon; label: string } => !!s.href);

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <Avatar name={admin.name} src={admin.photo_url} className="h-11 w-11 text-sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">{admin.name}</p>
          {admin.headline && <p className="truncate text-xs text-neutral-500">{admin.headline}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <Avatar name={admin.name} src={admin.photo_url} className="h-24 w-24 text-2xl" />
      <h1 className="mt-4 text-xl font-semibold text-neutral-900 sm:text-2xl">{admin.name}</h1>
      {admin.headline && <p className="mt-1 text-sm text-neutral-500 sm:text-base">{admin.headline}</p>}

      {socials.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          {socials.map(({ href, icon: Icon, label }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={label}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-neutral-500 transition-colors hover:border-border-strong hover:bg-neutral-50 hover:text-neutral-900"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      )}

      {admin.about && (
        // whitespace-pre-line so the admin's own paragraph breaks survive.
        <p className="mt-5 max-w-prose whitespace-pre-line text-left text-sm leading-relaxed text-neutral-600">
          {admin.about}
        </p>
      )}
    </div>
  );
}
