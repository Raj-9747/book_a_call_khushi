"use client";

import { useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { Pencil, Plus, Power, Search, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { ActionsMenu, Badge, Button, Input, Pagination, Select, Spinner, useConfirm } from "@/components/ui";
import { usePagination } from "@/lib/usePagination";
import {
  deleteDiscountCode,
  listDiscountCodes,
  setDiscountCodeActive,
} from "@/lib/api/discounts";
import { listEventTypes } from "@/lib/api/eventTypes";
import type { DiscountCodeWithEvents, EventType } from "@/types/models";
import { DiscountFormModal } from "./DiscountFormModal";

const IST = "Asia/Kolkata";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "Expired", label: "Expired" },
  { value: "Used up", label: "Used up" },
];

type Health = { label: string; tone: "success" | "neutral" | "warning" | "danger" };

/** A code can be "inactive" for several unrelated reasons — switched off,
 * past its expiry, or out of uses. Collapse them into one status the admin
 * can scan, rather than making them cross-reference three columns. */
function health(code: DiscountCodeWithEvents): Health {
  if (!code.is_active) return { label: "Inactive", tone: "neutral" };
  if (code.expires_at && new Date(code.expires_at) <= new Date()) return { label: "Expired", tone: "danger" };
  if (code.max_uses !== null && code.times_used >= code.max_uses) return { label: "Used up", tone: "warning" };
  return { label: "Active", tone: "success" };
}

export function DiscountsManager({ adminId }: { adminId: string }) {
  const [codes, setCodes] = useState<DiscountCodeWithEvents[] | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountCodeWithEvents | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    listDiscountCodes(adminId)
      .then(setCodes)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load discount codes"));
    listEventTypes(adminId)
      .then(setEventTypes)
      .catch(() => {
        /* Non-fatal — the form falls back to "all sessions" only. */
      });
  }, [adminId]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");

  // Filtered in memory rather than re-queried — the list is small enough
  // that a round trip per keystroke would be slower than just slicing it,
  // and it keeps the derived "status" filter (which isn't a column) simple.
  const filteredCodes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (codes ?? []).filter((code) => {
      if (query && !code.code.toLowerCase().includes(query)) return false;
      if (statusFilter !== "all" && health(code).label !== statusFilter) return false;
      if (eventTypeFilter !== "all") {
        // An "all sessions" code legitimately matches any event-type filter.
        if (!code.applies_to_all && !code.event_type_ids.includes(eventTypeFilter)) return false;
      }
      return true;
    });
  }, [codes, search, statusFilter, eventTypeFilter]);

  const { page, setPage, pageSize, totalCount, pageItems } = usePagination(filteredCodes);

  const eventTypeNames = useMemo(
    () => new Map(eventTypes.map((et) => [et.id, et.name])),
    [eventTypes]
  );

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(code: DiscountCodeWithEvents) {
    setEditing(code);
    setModalOpen(true);
  }

  function handleSaved(saved: DiscountCodeWithEvents) {
    setCodes((prev) => {
      if (!prev) return [saved];
      const exists = prev.some((c) => c.id === saved.id);
      return exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev];
    });
  }

  async function handleToggle(code: DiscountCodeWithEvents) {
    setBusyId(code.id);
    try {
      await setDiscountCodeActive(code.id, !code.is_active);
      setCodes((prev) => (prev ? prev.map((c) => (c.id === code.id ? { ...c, is_active: !c.is_active } : c)) : prev));
      toast.success(code.is_active ? "Code deactivated" : "Code activated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update code");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(code: DiscountCodeWithEvents) {
    if (
      !(await confirm({
        description: `Delete "${code.code}"? Bookings that already used it keep their discounted price.`,
        tone: "danger",
      }))
    )
      return;
    setBusyId(code.id);
    try {
      await deleteDiscountCode(code.id);
      setCodes((prev) => (prev ? prev.filter((c) => c.id !== code.id) : prev));
      toast.success("Discount code deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete code");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Discounts"
        description="Percent-off codes clients can apply at checkout"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New code
          </Button>
        }
      />

      <div className="p-4 sm:p-8">
        {codes === null ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-neutral-400" />
          </div>
        ) : codes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface py-16 text-center">
            <Tag className="h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-sm font-medium text-neutral-900">No discount codes yet</p>
            <p className="mt-1 max-w-sm text-sm text-neutral-500">
              Create a code to give clients a percentage off one or all of your sessions.
            </p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New code
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  placeholder="Search by code..."
                  className="pl-9 uppercase"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select className="sm:w-44" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
              <Select
                className="sm:w-52"
                value={eventTypeFilter}
                onChange={setEventTypeFilter}
                options={[
                  { value: "all", label: "All event types" },
                  ...eventTypes.map((et) => ({ value: et.id, label: et.name })),
                ]}
              />
            </div>

            {filteredCodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface py-16 text-center">
                <p className="text-sm font-medium text-neutral-900">No codes match your filters</p>
                <p className="mt-1 text-sm text-neutral-500">Try clearing the search or filters above.</p>
              </div>
            ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    <th className="w-12 px-4 py-3">#</th>
                    <th className="px-6 py-3">Code</th>
                    <th className="px-6 py-3">Applies to</th>
                    <th className="px-6 py-3">Expires</th>
                    <th className="px-6 py-3">Used</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((code, index) => {
                    const status = health(code);
                    const scope = code.applies_to_all
                      ? "All sessions"
                      : code.event_type_ids
                          .map((id) => eventTypeNames.get(id))
                          .filter(Boolean)
                          .join(", ") || "—";
                    return (
                      <tr key={code.id} className="border-b border-border last:border-0 hover:bg-neutral-50">
                        <td className="px-4 py-3.5 text-neutral-400">{(page - 1) * pageSize + index + 1}</td>
                        <td className="px-6 py-3.5">
                          <p className="font-mono font-semibold tracking-wide text-neutral-900">{code.code}</p>
                          <p className="text-xs text-neutral-500">{code.percent}% off</p>
                        </td>
                        <td className="max-w-[220px] px-6 py-3.5 text-neutral-600">
                          <span className="line-clamp-2">{scope}</span>
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-neutral-600">
                          {code.expires_at
                            ? formatInTimeZone(new Date(code.expires_at), IST, "MMM d, yyyy")
                            : "Never"}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-neutral-600">
                          {code.times_used}
                          {code.max_uses !== null ? ` / ${code.max_uses}` : ""}
                        </td>
                        <td className="px-6 py-3.5">
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </td>
                        <td className="px-6 py-3.5">
                          {/* Edit pulled out of the overflow menu and into
                              the empty space beside it — it's by far the
                              most-used action here, and burying the common
                              one behind a menu costs two clicks every time. */}
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busyId === code.id}
                              onClick={() => openEdit(code)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <ActionsMenu
                              disabled={busyId === code.id}
                              items={[
                                {
                                  label: code.is_active ? "Deactivate" : "Activate",
                                  icon: Power,
                                  onClick: () => handleToggle(code),
                                },
                                { label: "Delete", icon: Trash2, tone: "danger", onClick: () => handleDelete(code) },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
          </div>
            )}
          </div>
        )}
      </div>

      <DiscountFormModal
        open={modalOpen}
        adminId={adminId}
        eventTypes={eventTypes}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </>
  );
}
