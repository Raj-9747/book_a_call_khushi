import { CalendarClock } from "lucide-react";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui";

export default async function DashboardOverviewPage() {
  const admin = await getCurrentAdmin();

  return (
    <>
      <PageHeader title={`Welcome, ${admin?.name.split(" ")[0]}`} description="Here's your Zaptly overview" />
      <div className="space-y-4 p-8">
        {!admin?.google_calendar_connected && (
          <Card className="border-brand-200 bg-brand-50">
            <CardContent className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 shrink-0 text-brand-600" />
              <div>
                <p className="text-sm font-medium text-brand-900">Connect your Google Calendar</p>
                <p className="text-sm text-brand-700">
                  You need this before clients can book real, conflict-free slots with you. This step is coming
                  next.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="py-10 text-center text-sm text-neutral-500">
            Event types, availability, and bookings will show up here as we build them out.
          </CardContent>
        </Card>
      </div>
    </>
  );
}
