"use client";

import { useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ActionsMenu,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Spinner,
  useConfirm,
} from "@/components/ui";
import { deleteBlockedSlot, deleteBlockedSlotSeries, listBlockedSlots } from "@/lib/api/blockedSlots";
import { AddBlockModal } from "./AddBlockModal";
import type { BlockedSlot } from "@/types/models";

const IST = "Asia/Kolkata";

function timeLabel(slot: BlockedSlot): string {
  const start = new Date(slot.start_time);
  const end = new Date(slot.end_time);
  const startsAtMidnight = formatInTimeZone(start, IST, "HH:mm") === "00:00";
  const endsAtDayEnd = formatInTimeZone(end, IST, "HH:mm") === "23:59";
  if (startsAtMidnight && endsAtDayEnd) return "All day";
  return `${formatInTimeZone(start, IST, "h:mm a")} – ${formatInTimeZone(end, IST, "h:mm a")}`;
}

function dateLabel(slot: BlockedSlot): string {
  return formatInTimeZone(new Date(slot.start_time), IST, "EEE, MMM d");
}

/** One list row: either a standalone block, or a whole repeating series
 * collapsed into a single entry. Showing 30 individual rows for one weekly
 * commitment would bury everything else. */
interface BlockRow {
  key: string;
  slots: BlockedSlot[];
  groupId: string | null;
}

function groupSlots(slots: BlockedSlot[]): BlockRow[] {
  const rows: BlockRow[] = [];
  const seriesIndex = new Map<string, BlockRow>();

  for (const slot of slots) {
    const groupId = slot.recurrence_group_id ?? null;
    if (!groupId) {
      rows.push({ key: slot.id, slots: [slot], groupId: null });
      continue;
    }
    const existing = seriesIndex.get(groupId);
    if (existing) {
      existing.slots.push(slot);
    } else {
      const row: BlockRow = { key: groupId, slots: [slot], groupId };
      seriesIndex.set(groupId, row);
      rows.push(row);
    }
  }

  return rows;
}

export function BlockedSlotsCard({ adminId }: { adminId: string }) {
  const [slots, setSlots] = useState<BlockedSlot[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    listBlockedSlots(adminId)
      .then(setSlots)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load blocked time"));
  }, [adminId]);

  const rows = useMemo(() => groupSlots(slots ?? []), [slots]);

  async function handleDelete(row: BlockRow) {
    const isSeries = !!row.groupId && row.slots.length > 1;
    if (isSeries) {
      const ok = await confirm({
        title: "Remove the whole series?",
        description: `This removes all ${row.slots.length} blocked dates in this repeating block.`,
        confirmLabel: "Remove all",
        tone: "danger",
      });
      if (!ok) return;
    }

    setBusyKey(row.key);
    try {
      if (isSeries && row.groupId) {
        await deleteBlockedSlotSeries(row.groupId);
        const removed = new Set(row.slots.map((s) => s.id));
        setSlots((prev) => (prev ? prev.filter((s) => !removed.has(s.id)) : prev));
        toast.success("Series removed");
      } else {
        await deleteBlockedSlot(row.slots[0].id);
        setSlots((prev) => (prev ? prev.filter((s) => s.id !== row.slots[0].id) : prev));
        toast.success("Block removed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove block");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Blocked time</CardTitle>
          <CardDescription>Days or windows you&apos;re unavailable, on top of your weekly schedule.</CardDescription>
        </div>
        <Button size="sm" className="shrink-0 self-start whitespace-nowrap sm:self-auto" onClick={() => setModalOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Block time
        </Button>
      </CardHeader>
      <CardContent>
        {slots === null ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-5 w-5 text-neutral-400" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">No blocked time yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const first = row.slots[0];
              const last = row.slots[row.slots.length - 1];
              const isSeries = !!row.groupId && row.slots.length > 1;

              return (
                <li key={row.key} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-neutral-900">
                        {isSeries ? `${dateLabel(first)} – ${dateLabel(last)}` : dateLabel(first)}
                        <span className="text-neutral-400"> · </span>
                        {timeLabel(first)}
                      </p>
                      {isSeries && (
                        <Badge tone="neutral" className="inline-flex items-center gap-1">
                          <Repeat className="h-3 w-3" />
                          {row.slots.length} dates
                        </Badge>
                      )}
                    </div>
                    {first.reason && <p className="truncate text-xs text-neutral-500">{first.reason}</p>}
                  </div>
                  <ActionsMenu
                    disabled={busyKey === row.key}
                    items={[
                      {
                        label: isSeries ? "Remove series" : "Remove",
                        icon: Trash2,
                        tone: "danger",
                        onClick: () => handleDelete(row),
                      },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <AddBlockModal
        open={modalOpen}
        adminId={adminId}
        onClose={() => setModalOpen(false)}
        onCreated={(created) =>
          setSlots((prev) =>
            [...(prev ?? []), ...created].sort((a, b) => a.start_time.localeCompare(b.start_time))
          )
        }
      />
    </Card>
  );
}
