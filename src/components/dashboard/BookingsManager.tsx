"use client";

import { useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { ActionsMenu, Badge, Spinner } from "@/components/ui";
import { cancelBooking, listBookings, markBookingCompleted, type BookingWithEventType } from "@/lib/api/bookings";
import { LeadDetailModal } from "./LeadDetailModal";

const IST = "Asia/Kolkata";

function statusTone(status: string): "brand" | "success" | "danger" | "neutral" {
  if (status === "confirmed" || status === "pending_confirmation") return "brand";
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  return "neutral";
}

export function BookingsManager({ adminId }: { adminId: string }) {
  const [bookings, setBookings] = useState<BookingWithEventType[] | null>(null);
  const [selected, setSelected] = useState<BookingWithEventType | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    listBookings(adminId)
      .then(setBookings)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load bookings"));
  }, [adminId]);

  async function handleCancel(booking: BookingWithEventType) {
    if (!confirm(`Cancel the booking with ${booking.client_name}?`)) return;
    setBusyId(booking.id);
    try {
      await cancelBooking(booking.id);
      setBookings((prev) => (prev ? prev.map((b) => (b.id === booking.id ? { ...b, status: "cancelled" } : b)) : prev));
      toast.success("Booking cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel booking");
    } finally {
      setBusyId(null);
    }
  }

  async function handleComplete(booking: BookingWithEventType) {
    setBusyId(booking.id);
    try {
      await markBookingCompleted(booking.id);
      setBookings((prev) => (prev ? prev.map((b) => (b.id === booking.id ? { ...b, status: "completed" } : b)) : prev));
      toast.success("Marked as completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update booking");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Bookings" description="Everyone who's booked time with you" />
      <div className="p-4 sm:p-8">
        {bookings === null ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-neutral-400" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface py-16 text-center">
            <p className="text-sm font-medium text-neutral-900">No bookings yet</p>
            <p className="mt-1 text-sm text-neutral-500">Once clients book a call, they&apos;ll show up here.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    <th className="px-6 py-3">Client</th>
                    <th className="px-6 py-3">Event</th>
                    <th className="px-6 py-3">When</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Tag</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-neutral-50">
                      <td className="px-6 py-3.5" onClick={() => setSelected(booking)}>
                        <p className="font-medium text-neutral-900">{booking.client_name}</p>
                        <p className="text-xs text-neutral-500">{booking.client_email}</p>
                      </td>
                      <td className="px-6 py-3.5 text-neutral-600" onClick={() => setSelected(booking)}>
                        {booking.event_types?.name ?? "—"}
                      </td>
                      <td className="px-6 py-3.5 text-neutral-600" onClick={() => setSelected(booking)}>
                        {formatInTimeZone(new Date(booking.start_time), IST, "MMM d, h:mm a")}
                      </td>
                      <td className="px-6 py-3.5" onClick={() => setSelected(booking)}>
                        <Badge tone={statusTone(booking.status)}>{booking.status.replace("_", " ")}</Badge>
                      </td>
                      <td className="px-6 py-3.5" onClick={() => setSelected(booking)}>
                        {booking.tag ? <Badge tone="neutral">{booking.tag}</Badge> : <span className="text-neutral-300">—</span>}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {booking.status !== "cancelled" && booking.status !== "completed" && (
                          <ActionsMenu
                            disabled={busyId === booking.id}
                            items={[
                              { label: "Mark completed", icon: CheckCircle2, onClick: () => handleComplete(booking) },
                              { label: "Cancel booking", icon: XCircle, tone: "danger", onClick: () => handleCancel(booking) },
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <LeadDetailModal
        booking={selected}
        onClose={() => setSelected(null)}
        onUpdated={(updated) => {
          setBookings((prev) => (prev ? prev.map((b) => (b.id === updated.id ? updated : b)) : prev));
          setSelected(null);
        }}
      />
    </>
  );
}
