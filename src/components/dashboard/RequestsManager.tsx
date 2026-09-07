"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarClock, Inbox, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Pagination, Spinner } from "@/components/ui";
import { usePagination } from "@/lib/usePagination";
import { listChangeRequests, type ChangeRequestWithBooking } from "@/lib/api/changeRequests";
import { ResolveRequestModal } from "./ResolveRequestModal";

const IST = "Asia/Kolkata";

export function RequestsManager({ adminId }: { adminId: string }) {
  const router = useRouter();
  const [requests, setRequests] = useState<ChangeRequestWithBooking[] | null>(null);
  const [selected, setSelected] = useState<ChangeRequestWithBooking | null>(null);

  useEffect(() => {
    listChangeRequests(adminId)
      .then(setRequests)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load requests"));
  }, [adminId]);

  function handleResolved(requestId: string) {
    // Re-fetch rather than patch in place — approving mutates the
    // underlying booking too, and the nav's pending-count badge (fetched
    // server-side in the layout) needs a fresh render to catch up.
    setRequests((prev) => (prev ? prev.filter((r) => r.id !== requestId) : prev));
    router.refresh();
  }

  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  const resolved = requests?.filter((r) => r.status !== "pending") ?? [];

  // Only the resolved history is paginated. Pending is the actual work
  // queue — it should stay short, and hiding half of it behind a pager
  // would be the wrong default for the one list the admin must act on.
  const {
    page: resolvedPage,
    setPage: setResolvedPage,
    pageSize: resolvedPageSize,
    totalCount: resolvedTotal,
    pageItems: resolvedPageItems,
  } = usePagination(resolved);

  return (
    <>
      <PageHeader title="Requests" description="Reschedule and cancellation requests from clients" />
      <div className="space-y-8 p-4 sm:p-8">
        {requests === null ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-neutral-400" />
          </div>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface py-16 text-center">
            <Inbox className="h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-sm font-medium text-neutral-900">No pending requests</p>
            <p className="mt-1 max-w-sm text-sm text-neutral-500">
              When a client requests a reschedule or cancellation from their booking link, it shows up here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((request) => (
              <RequestRow key={request.id} request={request} onClick={() => setSelected(request)} />
            ))}
          </div>
        )}

        {resolved.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-medium text-neutral-500">Resolved</h2>
            <div className="space-y-3 opacity-70">
              {resolvedPageItems.map((request) => (
                <RequestRow key={request.id} request={request} />
              ))}
            </div>
            <div className="mt-2 overflow-hidden rounded-xl border border-border bg-surface">
              <Pagination
                page={resolvedPage}
                pageSize={resolvedPageSize}
                totalCount={resolvedTotal}
                onPageChange={setResolvedPage}
              />
            </div>
          </div>
        )}
      </div>

      <ResolveRequestModal request={selected} onClose={() => setSelected(null)} onResolved={handleResolved} />
    </>
  );
}

function RequestRow({ request, onClick }: { request: ChangeRequestWithBooking; onClick?: () => void }) {
  const Icon = request.type === "reschedule" ? CalendarClock : XCircle;
  const statusTone = request.status === "approved" ? "success" : request.status === "rejected" ? "danger" : "brand";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors enabled:hover:border-border-strong enabled:hover:bg-neutral-50 disabled:cursor-default"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-neutral-900">{request.booking.client_name}</p>
          <Badge tone={statusTone}>{request.status}</Badge>
        </div>
        <p className="mt-0.5 text-sm text-neutral-500">
          {request.type === "reschedule" ? "Reschedule" : "Cancellation"} · {request.booking.event_types?.name ?? "session"}
          {" · "}
          {formatInTimeZone(new Date(request.booking.start_time), IST, "MMM d, h:mm a")}
        </p>
        {request.type === "reschedule" && request.preferred_start_time && (
          <p className="mt-1 text-sm text-neutral-600">
            Proposed: {formatInTimeZone(new Date(request.preferred_start_time), IST, "MMM d, h:mm a")}
          </p>
        )}
        {request.client_message && (
          <p className="mt-1 line-clamp-2 text-sm text-neutral-500 italic">&ldquo;{request.client_message}&rdquo;</p>
        )}
      </div>
    </button>
  );
}
