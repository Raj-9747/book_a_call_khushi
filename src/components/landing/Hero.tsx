import Link from "next/link";
import { ArrowRight, CalendarCheck, CreditCard, Video } from "lucide-react";
import { BookingPreview } from "./BookingPreview";

const HIGHLIGHTS = [
  { icon: CalendarCheck, label: "Real-time availability" },
  { icon: Video, label: "Auto Google Meet links" },
  { icon: CreditCard, label: "Paid bookings via UPI & cards" },
];

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden bg-surface">
      {/* Soft brand glow behind the hero — pure CSS, no image asset. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 h-[500px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--brand-100)_0%,transparent_70%)]"
      />

      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              Scheduling, payments and reminders in one link
            </span>

            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl lg:text-[3.25rem]">
              Your calendar,
              <br />
              <span className="text-brand-600">booked and paid for.</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-neutral-600 sm:text-lg">
              Zaptly gives every person on your team their own booking page. Clients pick a slot that is genuinely
              free, pay for it, and get a Google Meet invite — without a single back-and-forth email.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={signedIn ? "/dashboard" : "/login"}
                className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
              >
                {signedIn ? "Go to dashboard" : "Sign in"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center rounded-md border border-border-strong bg-surface px-5 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50"
              >
                See how it works
              </a>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {HIGHLIGHTS.map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-2 text-sm text-neutral-600">
                  <Icon className="h-4 w-4 text-brand-600" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative lg:pl-6">
            <BookingPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
