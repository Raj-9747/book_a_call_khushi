"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./SectionHeading";

const FAQS = [
  {
    q: "Do clients need an account to book?",
    a: "No. They open your link, pick a time, fill in their details and pay if the session has a price. Nothing to sign up for. Afterwards they get a private link to their booking where they can see the details and request a change.",
  },
  {
    q: "What stops someone booking a slot I am already busy in?",
    a: "Before showing availability, Zaptly checks your weekly hours, your existing bookings, any time you have blocked, and your actual Google Calendar. A meeting you created directly in Google will hide that slot here too. The same check runs again at the moment of booking, so two people cannot take the same slot at once.",
  },
  {
    q: "Can clients reschedule or cancel on their own?",
    a: "They can ask. A reschedule or cancellation goes to you as a request — with a proposed new time if they picked one — and nothing changes on your calendar until you approve it. If money was paid, whether any of it is refunded is entirely your decision.",
  },
  {
    q: "Which payment methods are supported?",
    a: "UPI, cards, netbanking and wallets, through Razorpay. Sessions priced at zero skip payment entirely, and a hundred percent discount code does the same.",
  },
  {
    q: "Can I stop taking bookings for a while?",
    a: "Yes. Turning off bookings replaces the slot picker on your pages with a short form, so people who wanted time with you still leave their details instead of bouncing. Those enquiries wait for you in the dashboard.",
  },
  {
    q: "How do I get an account?",
    a: "Zaptly accounts are created for you by your organisation's super-admin, which is why there is no sign-up button here. Once your account exists you sign in with the email and password you were given, and you can change that password yourself afterwards.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-border bg-surface py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading eyebrow="FAQ" title="Questions people actually ask" />

        <div className="mt-12 divide-y divide-border rounded-xl border border-border bg-surface">
          {FAQS.map((faq, index) => {
            const open = openIndex === index;
            return (
              <div key={faq.q}>
                {/* Custom disclosure rather than <details>/<summary>, whose
                    marker is browser-drawn chrome we cannot style. */}
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenIndex(open ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-neutral-50 sm:px-6"
                >
                  <span className="text-sm font-medium text-neutral-900 sm:text-base">{faq.q}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200",
                      open && "rotate-180"
                    )}
                  />
                </button>
                {open && (
                  <p className="px-5 pb-5 text-sm leading-relaxed text-neutral-600 sm:px-6">{faq.a}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
