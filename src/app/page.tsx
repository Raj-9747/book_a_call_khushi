import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { PaymentsSection } from "@/components/landing/PaymentsSection";
import { AutomationSection } from "@/components/landing/AutomationSection";
import { TeamsSection } from "@/components/landing/TeamsSection";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";
import { LandingFooter } from "@/components/landing/LandingFooter";

export const metadata: Metadata = {
  title: "Zaptly — Scheduling, payments and reminders in one link",
  description:
    "Give every person on your team a booking page that shows real availability, takes payment up front, and creates the Google Meet invite automatically.",
};

export default async function LandingPage() {
  // Not a gate — the landing page is public either way. This only decides
  // whether the CTAs say "Sign in" or "Go to dashboard", so someone already
  // logged in is not asked to log in again.
  const admin = await getCurrentAdmin();
  const signedIn = !!admin;

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <LandingNav signedIn={signedIn} />
      <main className="flex-1">
        <Hero signedIn={signedIn} />
        <Features />
        <HowItWorks />
        <PaymentsSection />
        <AutomationSection />
        <TeamsSection />
        <Faq />
        <FinalCta signedIn={signedIn} />
      </main>
      <LandingFooter signedIn={signedIn} />
    </div>
  );
}
