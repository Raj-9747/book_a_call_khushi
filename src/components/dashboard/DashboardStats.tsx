import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CreditCard,
  Inbox,
  MessageSquare,
  Video,
} from "lucide-react";
import { Badge, Card, CardContent } from "@/components/ui";
import type { DashboardOverview } from "@/lib/api/dashboardStats";

const IST = "Asia/Kolkata";

function money(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/** Month-over-month change. Returns null when last month was zero — "up
 * ∞%" from nothing is noise, not a signal. */
function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function DashboardStats({ overview }: { overview: DashboardOverview }) {
  const { earnings, today, actions, top_event_types: topEventTypes, counts } = overview;
  const change = percentChange(earnings.this_month, earnings.last_month);
  const actionTotal = actions.pending_requests + actions.new_enquiries + actions.awaiting_payment;

  return (
    <div className="space-y-4">
      {/* Needs attention — only rendered when something actually does. An
          always-present "0 pending" row trains people to ignore it. */}
      {actionTotal > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {actions.pending_requests > 0 && (
            <ActionCard
              href="/dashboard/requests"
              icon={Inbox}
              count={actions.pending_requests}
              label={actions.pending_requests === 1 ? "request to review" : "requests to review"}
            />
          )}
          {actions.new_enquiries > 0 && (
            <ActionCard
              href="/dashboard/bookings"
              icon={MessageSquare}
              count={actions.new_enquiries}
              label={actions.new_enquiries === 1 ? "new enquiry" : "new enquiries"}
            />
          )}
          {actions.awaiting_payment > 0 && (
            <ActionCard
              href="/dashboard/bookings"
              icon={CreditCard}
              count={actions.awaiting_payment}
              label="awaiting payment"
              muted
            />
          )}
        </div>
      )}

      {/* Earnings */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">This month</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <p className="text-2xl font-semibold text-neutral-900">{money(earnings.this_month)}</p>
              {change !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                    change >= 0 ? "text-success-600" : "text-danger-600"
                  }`}
                >
                  {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(change)}%
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-500">vs {money(earnings.last_month)} last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">All-time earnings</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{money(earnings.all_time)}</p>
            {/* Stated plainly so the number is never mistaken for gross. */}
            <p className="mt-1 text-xs text-neutral-500">Net of refunds</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Bookings</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{counts.upcoming}</p>
            <p className="mt-1 text-xs text-neutral-500">upcoming · {counts.total} all-time</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Today's schedule */}
        <Card className="lg:col-span-3">
          <CardContent className="py-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-neutral-900">Today</h2>
              <Link
                href="/dashboard/bookings"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
              >
                All bookings <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {today.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CalendarClock className="h-7 w-7 text-neutral-300" />
                <p className="mt-2 text-sm text-neutral-500">Nothing scheduled today.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {today.map((booking) => {
                  const isOver = new Date(booking.end_time) < new Date();
                  return (
                    <li key={booking.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="w-20 shrink-0">
                        <p className="text-sm font-semibold text-neutral-900">
                          {formatInTimeZone(new Date(booking.start_time), IST, "h:mm a")}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">{booking.client_name}</p>
                        <p className="truncate text-xs text-neutral-500">{booking.event_name}</p>
                      </div>
                      {isOver ? (
                        <Badge tone="neutral">Done</Badge>
                      ) : (
                        booking.meet_link && (
                          <a
                            href={booking.meet_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700"
                          >
                            <Video className="h-3.5 w-3.5" />
                            Join
                          </a>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Top event types */}
        <Card className="lg:col-span-2">
          <CardContent className="py-5">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">Top sessions</h2>

            {topEventTypes.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">
                No bookings yet — this fills in once clients start booking.
              </p>
            ) : (
              <ul className="space-y-3">
                {topEventTypes.map((eventType) => (
                  <li key={eventType.name} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">{eventType.name}</p>
                      <p className="text-xs text-neutral-500">
                        {eventType.bookings} {eventType.bookings === 1 ? "booking" : "bookings"}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-neutral-900">{money(eventType.revenue)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ActionCard({
  href,
  icon: Icon,
  count,
  label,
  muted,
}: {
  href: string;
  icon: typeof Inbox;
  count: number;
  label: string;
  muted?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className={muted ? "transition-colors hover:border-border-strong" : "border-brand-200 bg-brand-50"}>
        <CardContent className="flex items-center gap-3 py-4">
          <Icon className={`h-5 w-5 shrink-0 ${muted ? "text-neutral-400" : "text-brand-600"}`} />
          <p className={`text-sm ${muted ? "text-neutral-600" : "text-brand-900"}`}>
            <span className="font-semibold">{count}</span> {label}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
