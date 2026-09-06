"use client";

import { useState } from "react";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import { Button, DatePicker, FormField, Input, Modal, TimeInput } from "@/components/ui";
import {
  approveCancellation,
  approveReschedule,
  rejectChangeRequest,
  type ChangeRequestWithBooking,
} from "@/lib/api/changeRequests";

const IST = "Asia/Kolkata";

type RefundChoice = "none" | "full" | "partial";

/** The single place a pending request actually gets resolved. Branches on
 * `request.type` for which controls to show, but both share the same
 * reject path — a request is either approved on its own terms or turned
 * down, there's no third outcome. */
export function ResolveRequestModal({
  request,
  onClose,
  onResolved,
}: {
  request: ChangeRequestWithBooking | null;
  onClose: () => void;
  onResolved: (requestId: string) => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [refundChoice, setRefundChoice] = useState<RefundChoice>("none");
  const [partialAmount, setPartialAmount] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  if (!request) return null;

  const amountPaid = request.booking.amount_paid ?? 0;
  const alreadyRefunded = request.booking.refund_amount ?? 0;
  const refundable = Math.max(amountPaid - alreadyRefunded, 0);
  const hasPreferredSlot = !!request.preferred_start_time;

  function resetAndClose() {
    setDate("");
    setTime("10:00");
    setRefundChoice("none");
    setPartialAmount("");
    setAdminNote("");
    onClose();
  }

  async function handleReject() {
    setBusy("reject");
    try {
      await rejectChangeRequest(request!.id, adminNote.trim() || null);
      toast.success("Request rejected");
      onResolved(request!.id);
      resetAndClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject request");
    } finally {
      setBusy(null);
    }
  }

  async function handleApproveReschedule(useCustomTime: boolean) {
    const newStart = useCustomTime
      ? fromZonedTime(`${date}T${time}:00`, IST)
      : new Date(request!.preferred_start_time!);

    if (useCustomTime && (!date || Number.isNaN(newStart.getTime()))) {
      toast.error("Pick a date and time first");
      return;
    }

    setBusy("approve");
    try {
      await approveReschedule(request!, newStart);
      toast.success("Reschedule approved — client will get a new confirmation");
      onResolved(request!.id);
      resetAndClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve reschedule");
    } finally {
      setBusy(null);
    }
  }

  async function handleApproveCancellation() {
    const refundAmount =
      refundChoice === "full" ? refundable : refundChoice === "partial" ? Number(partialAmount) || 0 : 0;

    if (refundChoice === "partial" && (refundAmount <= 0 || refundAmount > refundable)) {
      toast.error(`Enter an amount between ₹1 and ₹${refundable}`);
      return;
    }

    setBusy("approve");
    try {
      await approveCancellation(request!, refundAmount);
      toast.success(refundAmount > 0 ? "Cancelled — refund initiated" : "Cancelled");
      onResolved(request!.id);
      resetAndClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve cancellation");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      open={!!request}
      onClose={resetAndClose}
      title={request.type === "reschedule" ? "Reschedule request" : "Cancellation request"}
      description={`From ${request.booking.client_name} — ${request.booking.event_types?.name ?? "session"}`}
    >
      <div className="space-y-4">
        {request.client_message && (
          <p className="rounded-lg bg-neutral-50 px-3 py-2.5 text-sm italic text-neutral-600">
            &ldquo;{request.client_message}&rdquo;
          </p>
        )}

        {request.type === "reschedule" ? (
          <>
            {hasPreferredSlot ? (
              <div className="space-y-2">
                <p className="text-sm text-neutral-600">
                  Proposed:{" "}
                  <span className="font-medium text-neutral-900">
                    {formatInTimeZone(new Date(request.preferred_start_time!), IST, "EEEE, MMMM d 'at' h:mm a")}
                  </span>{" "}
                  <span className="text-neutral-400">(IST)</span>
                </p>
                <Button className="w-full" isLoading={busy === "approve"} onClick={() => handleApproveReschedule(false)}>
                  Approve for the proposed time
                </Button>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">The client didn&apos;t propose a specific time — pick one below.</p>
            )}

            <div className="border-t border-border pt-4">
              <p className="mb-2 text-sm font-medium text-neutral-800">
                {hasPreferredSlot ? "Or approve for a different time" : "New time"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Date">
                  <DatePicker value={date} onChange={setDate} minDate={new Date()} />
                </FormField>
                <FormField label="Time (IST)">
                  <TimeInput value={time} onChange={setTime} />
                </FormField>
              </div>
              <Button
                className="mt-3 w-full"
                variant="outline"
                isLoading={busy === "approve"}
                onClick={() => handleApproveReschedule(true)}
              >
                Approve for this time
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-neutral-800">Refund</p>
            {amountPaid > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(["none", "full", "partial"] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setRefundChoice(choice)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      refundChoice === choice
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-border-strong text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    {choice === "none" ? "No refund" : choice === "full" ? `Full (₹${refundable})` : "Partial"}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">This was a free booking — nothing to refund.</p>
            )}
            {refundChoice === "partial" && (
              <FormField label="Refund amount (₹)" hint={`Up to ₹${refundable}`}>
                <Input
                  type="number"
                  min={1}
                  max={refundable}
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                />
              </FormField>
            )}
            <Button className="w-full" variant="danger" isLoading={busy === "approve"} onClick={handleApproveCancellation}>
              Approve cancellation
            </Button>
          </div>
        )}

        <div className="border-t border-border pt-4">
          <FormField label="Note (optional)" hint="Only visible to you — not sent to the client automatically.">
            <Input value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Internal note" />
          </FormField>
          <Button className="mt-2 w-full" variant="ghost" isLoading={busy === "reject"} onClick={handleReject}>
            Reject this request
          </Button>
        </div>
      </div>
    </Modal>
  );
}
