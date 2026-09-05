"use client";

import { useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { CheckCircle2, MailCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionsMenu, Badge, Spinner, useConfirm } from "@/components/ui";
import { deleteEnquiry, listEnquiries, setEnquiryStatus, type EnquiryWithEventType } from "@/lib/api/enquiries";
import type { EnquiryStatus } from "@/types/models";

const IST = "Asia/Kolkata";

function statusTone(status: EnquiryStatus): "brand" | "success" | "neutral" {
  if (status === "new") return "brand";
  if (status === "contacted") return "success";
  return "neutral";
}

/** People who left their details while the admin had bookings paused.
 * These are leads, not calendar entries — no slot, no reminders. */
export function EnquiriesTable({ adminId }: { adminId: string }) {
  const [enquiries, setEnquiries] = useState<EnquiryWithEventType[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    listEnquiries(adminId)
      .then(setEnquiries)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load enquiries"));
  }, [adminId]);

  async function handleStatus(id: string, status: EnquiryStatus) {
    setBusyId(id);
    try {
      await setEnquiryStatus(id, status);
      setEnquiries((prev) => (prev ? prev.map((e) => (e.id === id ? { ...e, status } : e)) : prev));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update enquiry");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm({ description: "Delete this enquiry? This can't be undone.", tone: "danger" }))) return;
    setBusyId(id);
    try {
      await deleteEnquiry(id);
      setEnquiries((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
      toast.success("Enquiry deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete enquiry");
    } finally {
      setBusyId(null);
    }
  }

  if (enquiries === null) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-neutral-400" />
      </div>
    );
  }

  if (enquiries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface py-16 text-center">
        <p className="text-sm font-medium text-neutral-900">No enquiries yet</p>
        <p className="mt-1 text-sm text-neutral-500">
          When you pause bookings, people who leave their details show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
              <th className="px-6 py-3">Person</th>
              <th className="px-6 py-3">Interested in</th>
              <th className="px-6 py-3">Message</th>
              <th className="px-6 py-3">Received</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {enquiries.map((enquiry) => (
              <tr key={enquiry.id} className="border-b border-border last:border-0 hover:bg-neutral-50">
                <td className="px-6 py-3.5">
                  <p className="font-medium text-neutral-900">{enquiry.name}</p>
                  <p className="text-xs text-neutral-500">{enquiry.email}</p>
                  {enquiry.phone && <p className="text-xs text-neutral-500">{enquiry.phone}</p>}
                </td>
                <td className="px-6 py-3.5 text-neutral-600">{enquiry.event_types?.name ?? "—"}</td>
                <td className="max-w-xs px-6 py-3.5 text-neutral-600">
                  {enquiry.message ? (
                    <span className="line-clamp-2">{enquiry.message}</span>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </td>
                <td className="px-6 py-3.5 whitespace-nowrap text-neutral-600">
                  {formatInTimeZone(new Date(enquiry.created_at), IST, "MMM d, h:mm a")}
                </td>
                <td className="px-6 py-3.5">
                  <Badge tone={statusTone(enquiry.status)}>{enquiry.status}</Badge>
                </td>
                <td className="px-6 py-3.5 text-right">
                  <ActionsMenu
                    disabled={busyId === enquiry.id}
                    items={[
                      ...(enquiry.status !== "contacted"
                        ? [
                            {
                              label: "Mark contacted",
                              icon: MailCheck,
                              onClick: () => handleStatus(enquiry.id, "contacted"),
                            },
                          ]
                        : []),
                      ...(enquiry.status !== "closed"
                        ? [
                            {
                              label: "Mark closed",
                              icon: CheckCircle2,
                              onClick: () => handleStatus(enquiry.id, "closed"),
                            },
                          ]
                        : []),
                      { label: "Delete", icon: Trash2, tone: "danger" as const, onClick: () => handleDelete(enquiry.id) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
