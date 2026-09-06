import { Check, Lock, Tag } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const POINTS = [
  "UPI, cards, netbanking and wallets through Razorpay",
  "Prices are calculated on the server — the browser never sets the amount",
  "The slot is held while the client pays, and released automatically if they walk away",
  "Refunds are issued from your dashboard, in full or in part, only when you approve them",
];

export function PaymentsSection() {
  return (
    <section id="payments" className="border-t border-border bg-surface-muted py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Payments"
              title="Get paid when they book, not after"
              description="Attach a price to any session and the payment happens as part of booking it. No invoices to chase, no unpaid no-shows to write off."
            />

            <ul className="mt-8 space-y-3">
              {POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-100">
                    <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
                  </span>
                  <span className="text-sm leading-relaxed text-neutral-600">{point}</span>
                </li>
              ))}
            </ul>

            <p className="mt-6 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-neutral-500">
              <Lock className="h-3.5 w-3.5 text-neutral-400" />
              Card details are handled by Razorpay and never touch Zaptly
            </p>
          </div>

          {/* Checkout mock */}
          <div aria-hidden="true" className="select-none">
            <div className="mx-auto max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-lg">
              <p className="text-sm font-semibold text-neutral-900">Your details</p>
              <p className="mt-0.5 text-xs text-neutral-500">Tuesday, September 9 at 11:00 AM</p>

              <div className="mt-5 space-y-2 rounded-lg bg-neutral-50 px-4 py-3 text-sm">
                <div className="flex justify-between text-neutral-600">
                  <span>Discovery call</span>
                  <span>₹499</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span className="inline-flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    LAUNCH20
                  </span>
                  <span>−₹100</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-semibold text-neutral-900">
                  <span>Total</span>
                  <span>₹399</span>
                </div>
              </div>

              <div className="mt-4 rounded-md bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white shadow-sm">
                Pay ₹399
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                {["UPI", "Cards", "Netbanking", "Wallets"].map((method) => (
                  <span
                    key={method}
                    className="rounded border border-border bg-surface px-2 py-1 text-[11px] font-medium text-neutral-500"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
