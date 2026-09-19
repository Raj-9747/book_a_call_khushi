import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck, Clock, ListChecks } from "lucide-react";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getDashboardOverview } from "@/lib/api/dashboardStats";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui";
import { OnboardingGuide } from "@/components/dashboard/OnboardingGuide";
import { DashboardStats } from "@/components/dashboard/DashboardStats";

const QUICK_LINKS = [
  { label: "Bookings", href: "/dashboard/bookings", icon: CalendarCheck },
  { label: "Event types", href: "/dashboard/event-types", icon: ListChecks },
  { label: "Availability", href: "/dashboard/availability", icon: Clock },
];

export default async function DashboardOverviewPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  const supabase = await createClient();
  const [overview, { count: eventTypeCount }] = await Promise.all([
    getDashboardOverview(supabase),
    // RLS scopes this to the caller's own event types.
    supabase.from("event_types").select("id", { count: "exact", head: true }),
  ]);

  // Every onboarding step is read from real state, never from "they clicked
  // through it". weekly_availability is `{}` until an admin saves the
  // availability form, so "any day enabled" means they genuinely set it.
  const weekly = (admin.weekly_availability ?? {}) as Record<string, { enabled?: boolean } | undefined>;
  const onboardingSteps = {
    calendarConnected: admin.google_calendar_connected,
    profileDone: Boolean(admin.headline?.trim() || admin.about?.trim() || admin.photo_url),
    availabilityDone: Object.values(weekly).some((day) => day?.enabled),
    eventTypeDone: (eventTypeCount ?? 0) > 0,
  };

  return (
    <>
      <PageHeader title={`Welcome, ${admin.name.split(" ")[0]}`} description="Here's your Zaptly overview" />
      <div className="space-y-4 p-4 sm:p-8">
        <OnboardingGuide
          adminId={admin.id}
          firstName={admin.name.split(" ")[0]}
          steps={onboardingSteps}
          dismissed={Boolean(admin.onboarding_dismissed_at)}
        />

        <DashboardStats overview={overview} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Card className="transition-colors hover:border-brand-300">
                  <CardContent className="flex items-center gap-3 py-5">
                    <Icon className="h-5 w-5 text-brand-600" />
                    <span className="text-sm font-medium text-neutral-900">{link.label}</span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
