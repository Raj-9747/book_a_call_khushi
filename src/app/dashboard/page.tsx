import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, CalendarCheck, Clock, ListChecks } from "lucide-react";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui";
import { GoogleCalendarConnect } from "@/components/dashboard/GoogleCalendarConnect";
import { DashboardStats } from "@/components/dashboard/DashboardStats";

const QUICK_LINKS = [
  { label: "Bookings", href: "/dashboard/bookings", icon: CalendarCheck },
  { label: "Event types", href: "/dashboard/event-types", icon: ListChecks },
  { label: "Availability", href: "/dashboard/availability", icon: Clock },
];

export default async function DashboardOverviewPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  return (
    <>
      <PageHeader title={`Welcome, ${admin.name.split(" ")[0]}`} description="Here's your Zaptly overview" />
      <div className="space-y-4 p-4 sm:p-8">
        {!admin.google_calendar_connected && (
          <Card className="border-brand-200 bg-brand-50">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                <div>
                  <p className="text-sm font-medium text-brand-900">Connect your Google Calendar</p>
                  <p className="text-sm text-brand-700">
                    Zaptly checks your calendar for conflicts before showing a slot as available to clients.
                  </p>
                </div>
              </div>
              <GoogleCalendarConnect connected={false} />
            </CardContent>
          </Card>
        )}

        <DashboardStats adminId={admin.id} />

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
