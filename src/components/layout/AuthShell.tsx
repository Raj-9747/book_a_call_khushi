import { type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BellRing, CalendarCheck, CreditCard } from "lucide-react";
import { ZaptlyLogo } from "@/components/brand/ZaptlyLogo";
import { ZaptlyMark } from "@/components/brand/ZaptlyMark";

const PANEL_POINTS = [
  { icon: CalendarCheck, text: "Availability that already accounts for your real calendar" },
  { icon: CreditCard, text: "Sessions paid for at the moment they are booked" },
  { icon: BellRing, text: "Confirmations, invites and reminders sent for you" },
];

/** Split sign-in layout: the form on the left, a brand panel on the right
 * that collapses away below `lg`. There is no sign-up counterpart by
 * design — accounts are provisioned by a super-admin — so the copy points
 * people at that instead of leaving them hunting for a missing link. */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-surface">
      {/* Form side */}
      <div className="flex w-full flex-col px-6 py-8 sm:px-10 lg:w-[46%] lg:px-14 xl:px-20">
        <div className="flex items-center justify-between gap-4">
          <Link href="/">
            <ZaptlyLogo />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>

        <div className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
            {description && <p className="mt-2 text-sm text-neutral-500">{description}</p>}

            <div className="mt-8">{children}</div>

            <p className="mt-8 rounded-lg border border-border bg-surface-muted px-4 py-3 text-xs leading-relaxed text-neutral-500">
              Zaptly accounts are created by your organisation&apos;s super-admin, so there is no sign-up here. If you
              do not have one yet, or you have been locked out, ask them to set you up.
            </p>
          </div>
        </div>

        <p className="text-xs text-neutral-400">&copy; {new Date().getFullYear()} Zaptly</p>
      </div>

      {/* Brand panel — decorative, so it simply disappears on smaller screens
          rather than pushing the form down the page. */}
      <div className="relative hidden overflow-hidden bg-neutral-900 lg:flex lg:w-[54%] lg:flex-col lg:justify-center lg:px-16 xl:px-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_30%_0%,rgba(99,102,241,0.38)_0%,transparent_70%)]"
        />
        <div className="relative max-w-md">
          <ZaptlyMark className="h-12 w-12 rounded-xl" />
          <h2 className="mt-8 text-3xl font-semibold leading-tight tracking-tight text-white">
            Scheduling, payments and reminders in one link.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-neutral-300">
            Sign in to manage your booking page, your availability and everyone who has booked time with you.
          </p>

          <ul className="mt-10 space-y-4">
            {PANEL_POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-200">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm leading-relaxed text-neutral-300">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
