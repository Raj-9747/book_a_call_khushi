"use client";

import { useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarClock, CheckCircle2, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { ActionsMenu, Badge, Input, Pagination, Select, Spinner } from "@/components/ui";
import {
  listBookings,
  markBookingCompleted,
  type BookingSortField,
  type BookingWithEventType,
} from "@/lib/api/bookings";
import { listEventTypes } from "@/lib/api/eventTypes";
import { listPendingRequestTypesByBooking, type ChangeRequestType } from "@/lib/api/changeRequests";
import { cn, sentenceCase } from "@/lib/utils";
import type { EventType } from "@/types/models";
import { CancelBookingModal, RescheduleBookingModal } from "./BookingActionModals";
import { EnquiriesTable } from "./EnquiriesTable";
import { LeadDetailModal } from "./LeadDetailModal";

type Tab = "bookings" | "enquiries";

const IST = "Asia/Kolkata";
const PAGE_SIZE = 20;
// Debounces the search box so every keystroke doesn't fire its own query —
// only the pause after typing does.
const SEARCH_DEBOUNCE_MS = 350;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "pending_payment", label: "Awaiting payment" },
  { value: "expired", label: "Expired" },
];

const SORT_OPTIONS: { value: string; label: string; field: BookingSortField; ascending: boolean }[] = [
  { value: "event_desc", label: "Event date (newest first)", field: "start_time", ascending: false },
  { value: "event_asc", label: "Event date (oldest first)", field: "start_time", ascending: true },
  { value: "created_desc", label: "Booked on (newest first)", field: "created_at", ascending: false },
  { value: "created_asc", label: "Booked on (oldest first)", field: "created_at", ascending: true },
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
  if (status === "pending_payment") return "Awaiting payment";
  return sentenceCase(status);
}

export function BookingsManager({ adminId }: { adminId: string }) {
  const [bookings, setBookings] = useState<BookingWithEventType[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [selected, setSelected] = useState<BookingWithEventType | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingWithEventType | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingWithEventType | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState(""); // debounced value actually sent to the query
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [sortValue, setSortValue] = useState(SORT_OPTIONS[0].value);
  const [page, setPage] = useState(1);

  const [tab, setTab] = useState<Tab>("bookings");
  const [pendingRequests, setPendingRequests] = useState<Map<string, ChangeRequestType>>(new Map());

  // Debounce the search box — only the pause after typing triggers a query.
  // Resets to page 1 in the same beat: staying on, say, page 4 of a
  // now-much-shorter result set would just show an empty page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // The other filters/sort aren't debounced, so their own onChange handlers
  // reset the page directly — see handleStatusFilterChange etc. below.
  function handleStatusFilterChange(value: string) {
    setStatusFilter(value);
    setPage(1);
  }
  function handleEventTypeFilterChange(value: string) {
    setEventTypeFilter(value);
    setPage(1);
  }
  function handleSortChange(value: string) {
    setSortValue(value);
    setPage(1);
  }

  useEffect(() => {
    listEventTypes(adminId)
      .then(setEventTypes)
      .catch(() => {
        /* Non-fatal — the filter dropdown just falls back to "All event types" only. */
      });
    listPendingRequestTypesByBooking(adminId)
      .then(setPendingRequests)
      .catch(() => {
        /* Non-fatal — the badge is a convenience, not the source of truth
         * (that's the Requests page itself). */
      });
  }, [adminId]);

  useEffect(() => {
    const sort = SORT_OPTIONS.find((o) => o.value === sortValue) ?? SORT_OPTIONS[0];
    let cancelled = false;

    listBookings(adminId, {
      page,
      pageSize: PAGE_SIZE,
      sortField: sort.field,
      sortAscending: sort.ascending,
      search,
      status: statusFilter,
      eventTypeId: eventTypeFilter,
    })
      .then((result) => {
        if (cancelled) return;
        setBookings(result.bookings);
        setTotalCount(result.totalCount);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load bookings");
      });

    return () => {
      cancelled = true;
    };
  }, [adminId, page, sortValue, search, statusFilter, eventTypeFilter]);

  const eventTypeOptions = [
    { value: "all", label: "All event types" },
    ...eventTypes.map((et) => ({ value: et.id, label: et.name })),
  ];

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all" || eventTypeFilter !== "all";

  function handleReschedule(booking: BookingWithEventType) {
    if (pendingRequests.has(booking.id)) {
      toast.error("This booking has a pending client request — resolve it from Requests first.");
      return;
    }
    setRescheduleTarget(booking);
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
        ) : totalCount === 0 && !hasActiveFilters ? (
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
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <Select className="sm:w-44" value={statusFilter} onChange={handleStatusFilterChange} options={STATUS_OPTIONS} />
              <Select className="sm:w-48" value={eventTypeFilter} onChange={handleEventTypeFilterChange} options={eventTypeOptions} />
              <Select className="sm:w-56" value={sortValue} onChange={handleSortChange} options={SORT_OPTIONS} />
            </div>

            {bookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface py-16 text-center">
                <p className="text-sm font-medium text-neutral-900">No bookings match your filters</p>
                <p className="mt-1 text-sm text-neutral-500">Try clearing the search or filters above.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                        <th className="w-12 px-4 py-3">#</th>
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
                      {bookings.map((booking, index) => (
                        <tr key={booking.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-neutral-50">
                          <td className="px-4 py-3.5 text-neutral-400" onClick={() => setSelected(booking)}>
                            {(page - 1) * PAGE_SIZE + index + 1}
                          </td>
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
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge tone={statusTone(booking.status)}>{statusLabel(booking.status)}</Badge>
                              {pendingRequests.has(booking.id) && (
                                <Badge tone="warning">
                                  {pendingRequests.get(booking.id) === "reschedule"
                                    ? "Reschedule requested"
                                    : "Cancellation requested"}
                                </Badge>
                              )}
                            </div>
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
                                  <span className="ml-1.5 text-xs text-success-700">
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
                                  ...(booking.status === "confirmed"
                                    ? [{ label: "Reschedule", icon: CalendarClock, onClick: () => handleReschedule(booking) }]
                                    : []),
                                  { label: "Cancel booking", icon: XCircle, tone: "danger", onClick: () => setCancelTarget(booking) },
                                ]}
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>

      <CancelBookingModal
        key={`cancel-${cancelTarget?.id ?? "none"}`}
        booking={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={(id) =>
          setBookings((prev) => (prev ? prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)) : prev))
        }
      />
      <RescheduleBookingModal
        key={`resched-${rescheduleTarget?.id ?? "none"}`}
        booking={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onRescheduled={(id, start, end) =>
          setBookings((prev) =>
            prev ? prev.map((b) => (b.id === id ? { ...b, start_time: start, end_time: end } : b)) : prev
          )
        }
      />

      <LeadDetailModal
        // Remount per booking. The modal seeds its notes/tag state from
        // props with useState, which only runs on mount — without a
        // changing key the component instance is reused across selections
        // and one booking's unsaved notes bleed into the next one.
        key={selected?.id ?? "none"}
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
