"use client";

import { useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { CheckCircle2, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { ActionsMenu, Badge, Input, Select, Spinner } from "@/components/ui";
import { cancelBooking, listBookings, markBookingCompleted, type BookingWithEventType } from "@/lib/api/bookings";
import { cn } from "@/lib/utils";
import { EnquiriesTable } from "./EnquiriesTable";
import { LeadDetailModal } from "./LeadDetailModal";

type Tab = "bookings" | "enquiries";

const IST = "Asia/Kolkata";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "pending_payment", label: "Awaiting payment" },
  { value: "expired", label: "Expired" },
];

function statusTone(status: string): "brand" | "success" | "warning" | "danger" | "neutral" {
  if (status === "confirmed" || status === "pending_confirmation") return "brand";
  if (status === "completed") return "success";
  if (status === "pending_payment") return "warning";
  if (status === "cancelled") return "danger";
  return "neutral";
}

/** `pending_payment` is a live hold, not a booking the admin should act on
 * — and `expired` is one that lapsed. Neither reads well as the raw enum. */
function statusLabel(status: string): string {
  if (status === "pending_payment") return "awaiting payment";
  return status.replace("_", " ");
}

export function BookingsManager({ adminId }: { adminId: string }) {
  const [bookings, setBookings] = useState<BookingWithEventType[] | null>(null);
  const [selected, setSelected] = useState<BookingWithEventType | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [tab, setTab] = useState<Tab>("bookings");

  useEffect(() => {
    listBookings(adminId)
      .then(setBookings)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load bookings"));
  }, [adminId]);

  const eventTypeOptions = useMemo(() => {
    const names = new Set((bookings ?? []).map((b) => b.event_types?.name).filter((n): n is string => !!n));
    return [{ value: "all", label: "All event types" }, ...Array.from(names).map((name) => ({ value: name, label: name }))];
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (!bookings) return null;
    const query = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (eventTypeFilter !== "all" && b.event_types?.name !== eventTypeFilter) return false;
      if (query && !b.client_name.toLowerCase().includes(query) && !b.client_email.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [bookings, search, statusFilter, eventTypeFilter]);

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
      <div className="space-y-4 p-4 sm:p-8">
        <div className="flex gap-1 border-b border-border" role="tablist">
          {([
            { id: "bookings", label: "Bookings" },
            { id: "enquiries", label: "Enquiries" },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === id
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-neutral-500 hover:text-neutral-900"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "enquiries" ? (
          <EnquiriesTable adminId={adminId} />
        ) : bookings === null ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-neutral-400" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface py-16 text-center">
            <p className="text-sm font-medium text-neutral-900">No bookings yet</p>
            <p className="mt-1 text-sm text-neutral-500">Once clients book a call, they&apos;ll show up here.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  placeholder="Search by name or email..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select className="sm:w-44" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
              <Select className="sm:w-48" value={eventTypeFilter} onChange={setEventTypeFilter} options={eventTypeOptions} />
            </div>

            {filteredBookings && filteredBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface py-16 text-center">
                <p className="text-sm font-medium text-neutral-900">No bookings match your filters</p>
                <p className="mt-1 text-sm text-neutral-500">Try clearing the search or filters above.</p>
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
                        <th className="px-6 py-3">Amount</th>
                        <th className="px-6 py-3">Tag</th>
                        <th className="px-6 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBookings?.map((booking) => (
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
                            <Badge tone={statusTone(booking.status)}>{statusLabel(booking.status)}</Badge>
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap" onClick={() => setSelected(booking)}>
                            {booking.amount_due === null ? (
                              <span className="text-neutral-300">—</span>
                            ) : booking.amount_due === 0 ? (
                              <span className="text-neutral-500">Free</span>
                            ) : (
                              <>
                                <span className="font-medium text-neutral-900">
                                  ₹{booking.amount_due.toLocaleString("en-IN")}
                                </span>
                                {booking.discount_percent && (
                                  <span className="ml-1.5 text-xs text-emerald-700">
                                    −{booking.discount_percent}%
                                  </span>
                                )}
                              </>
                            )}
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
          </>
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
