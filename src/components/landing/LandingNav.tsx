"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { ZaptlyLogo } from "@/components/brand/ZaptlyLogo";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Payments", href: "#payments" },
  { label: "FAQ", href: "#faq" },
];

/** Marketing nav. The only auth entry point is "Sign in" — Zaptly accounts
 * are provisioned by a super-admin, so there is deliberately no sign-up. */
export function LandingNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  const ctaHref = signedIn ? "/dashboard" : "/login";
  const ctaLabel = signedIn ? "Go to dashboard" : "Sign in";

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/">
          <ZaptlyLogo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={ctaHref}
            className="hidden rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 md:inline-flex"
          >
            {ctaLabel}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="rounded-md p-2 text-neutral-600 transition-colors hover:bg-neutral-100 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet — plain conditional render rather than a portal, since
          it sits directly under the sticky header and never needs to escape
          an overflow container. */}
      <div className={cn("border-t border-border bg-surface md:hidden", open ? "block" : "hidden")}>
        <nav className="space-y-1 px-4 py-3">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
            >
              {section.label}
            </a>
          ))}
          <Link
            href={ctaHref}
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-md bg-brand-600 px-3 py-2.5 text-center text-sm font-medium text-white"
          >
            {ctaLabel}
          </Link>
        </nav>
      </div>
    </header>
  );
}
