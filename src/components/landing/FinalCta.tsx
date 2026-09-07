import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="border-t border-border bg-surface-muted py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 px-6 py-14 text-center sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(50%_100%_at_50%_0%,rgba(99,102,241,0.35)_0%,transparent_70%)]"
          />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Stop trading emails to find a time
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-300">
              Share one link. Zaptly handles the availability, the payment, the calendar invite and the reminders.
            </p>
            <Link
              href={signedIn ? "/dashboard" : "/login"}
              className="mt-8 inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-100"
            >
              {signedIn ? "Go to dashboard" : "Sign in to Zaptly"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
