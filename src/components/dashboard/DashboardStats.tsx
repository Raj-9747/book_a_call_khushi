import { formatInTimeZone } from "date-fns-tz";
import { CalendarClock, CalendarDays, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import type { DashboardStats as Stats } from "@/lib/api/dashboardStats";

const IST = "Asia/Kolkata";

const STAT_CARDS = [
  { key: "upcomingCount" as const, label: "Upcoming calls", icon: CalendarClock },
  { key: "todayCount" as const, label: "Today", icon: CalendarDays },
  { key: "totalBookings" as const, label: "Total bookings", icon: ListChecks },
];

/** Purely presentational now — the page fetches the stats server-side and
 * passes them in, so there's no client round trip and no spinner on the
 * first screen after login. */
export function DashboardStats({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STAT_CARDS.map(({ key, label, icon: Icon }) => (
          <Card key={key}>
            <CardContent className="flex items-center gap-3 py-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-semibold text-neutral-900">{stats[key]}</p>
                <p className="text-xs text-neutral-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="py-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Next up</p>
          {stats.nextBooking ? (
            <p className="text-sm text-neutral-900">
              <span className="font-medium">{stats.nextBooking.eventName}</span> with {stats.nextBooking.clientName} —{" "}
              {formatInTimeZone(new Date(stats.nextBooking.startTime), IST, "EEE, MMM d 'at' h:mm a")}
            </p>
          ) : (
            <p className="text-sm text-neutral-400">No upcoming calls scheduled.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
