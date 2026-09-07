import type { Metadata } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays, Clock, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar, Badge } from "@/components/ui";
import { getBookingByToken } from "@/lib/api/manageBooking";
import { ManageBookingActions } from "@/components/booking/ManageBookingActions";

export const metadata: Metadata = {
  title: "Your booking",
  // The page is reachable by anyone holding the link, so keep it out of
  // search results even though the token itself is unguessable.
  robots: { index: false, follow: false },
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function statusTone(status: string): "brand" | "success" | "danger" | "neutral" {
  if (status === "confirmed") return "brand";
  if (status === "completed") return "success";
  if (status === "cancelled" || status === "expired") return "danger";
  return "neutral";
}

/** One shared "we can't show you this" screen for every failure mode —
 * a malformed token, an unknown one, a cancelled booking that's aged out,
 * a link opened a week later. Distinguishing them would let someone probe
 * which tokens exist. */
function NotAvailable() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface px-6 py-12 text-center shadow-xs">
        <h1 className="text-base font-semibold text-neutral-900">This booking link isn&apos;t available</h1>
        <p className="mt-2 text-sm text-neutral-500">
          It may have expired, or the booking may have already passed. If you need help, reply to your confirmation
          email.
        </p>
      </div>
    </div>
  );
}

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Check the shape before hitting the database — Postgres raises on a
  // malformed uuid, which would surface as a 500 rather than this page.
  if (!UUID_PATTERN.test(token)) return <NotAvailable />;

  const supabase = await createClient();
  const booking = await getBookingByToken(supabase, token);
  if (!booking) return <NotAvailable />;

  const timeZone = booking.client_timezone || "Asia/Kolkata";
  const isCancelled = booking.status === "cancelled";
  const isPast = new Date(booking.end_time) < new Date();

  return (
    <div className="min-h-screen bg-surface-muted px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <div className="rounded-2xl border border-border bg-surface shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={booking.admin_name} src={booking.admin_photo_url} className="h-11 w-11 text-sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900">{booking.admin_name}</p>
                {booking.admin_headline && (
                  <p className="truncate text-xs text-neutral-500">{booking.admin_headline}</p>
                )}
              </div>
            </div>
            <Badge tone={statusTone(booking.status)} className="capitalize">
              {booking.status.replace("_", " ")}
            </Badge>
          </div>

          <div className="space-y-5 px-5 py-6 sm:px-6">
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">{booking.event_name}</h1>
              <p className="mt-1 text-sm text-neutral-500">Booked by {booking.client_name}</p>
            </div>

            <div className="space-y-2.5 rounded-lg bg-neutral-50 px-4 py-3.5 text-sm">
              <p className="flex items-center gap-2 text-neutral-800">
                <CalendarDays className="h-4 w-4 shrink-0 text-neutral-400" />
                <span className={isCancelled ? "line-through" : undefined}>
                  {formatInTimeZone(new Date(booking.start_time), timeZone, "EEEE, MMMM d 'at' h:mm a")}
                </span>
              </p>
              <p className="flex items-center gap-2 text-neutral-600">
                <Clock className="h-4 w-4 shrink-0 text-neutral-400" />
                {booking.duration_minutes} min
                <span className="text-neutral-400">· {timeZone.replace("_", " ")}</span>
              </p>
              {booking.amount_paid !== null && booking.amount_paid > 0 && (
                <p className="text-neutral-600">
                  Paid{" "}
                  <span className="font-semibold text-neutral-900">
                    ₹{booking.amount_paid.toLocaleString("en-IN")}
                  </span>
                </p>
              )}
            </div>

            {booking.meet_link && !isCancelled && !isPast && (
              <a
                href={booking.meet_link}
                target="_blank"
                rel="noreferrer noopener"
                className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
              >
                <Video className="h-4 w-4" />
                Join Google Meet
              </a>
            )}

            {booking.event_description && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">About this session</p>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-neutral-700">
                  {booking.event_description}
                </p>
              </div>
            )}

            {isCancelled && (
              <p className="rounded-lg border border-danger-500/20 bg-danger-100/50 px-4 py-3 text-sm text-danger-700">
                This booking was cancelled. If that wasn&apos;t expected, reply to your confirmation email.
              </p>
            )}

            <ManageBookingActions booking={booking} token={token} />
          </div>
        </div>

        <p className="text-center text-xs text-neutral-400">
          Booked with {booking.admin_name} via Zaptly
        </p>
      </div>
    </div>
  );
}
