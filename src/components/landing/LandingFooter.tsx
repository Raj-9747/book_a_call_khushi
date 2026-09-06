import Link from "next/link";
import { ZaptlyLogo } from "@/components/brand/ZaptlyLogo";

const LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Payments", href: "#payments" },
  { label: "FAQ", href: "#faq" },
];

export function LandingFooter({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="border-t border-border bg-surface py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 sm:px-6 md:flex-row md:justify-between">
        <ZaptlyLogo markClassName="h-7 w-7 rounded-md" wordmarkClassName="text-sm" />

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
            >
              {link.label}
            </a>
          ))}
          <Link
            href={signedIn ? "/dashboard" : "/login"}
            className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
          >
            {signedIn ? "Dashboard" : "Sign in"}
          </Link>
        </nav>

        <p className="text-xs text-neutral-400">
          &copy; {new Date().getFullYear()} Zaptly. Scheduling, payments and reminders in one link.
        </p>
      </div>
    </footer>
  );
}
