"use client";

import { useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionsMenu, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from "@/components/ui";
import { deleteBlockedSlot, listBlockedSlots } from "@/lib/api/blockedSlots";
import { AddBlockModal } from "./AddBlockModal";
import type { BlockedSlot } from "@/types/models";

const IST = "Asia/Kolkata";

function formatRange(slot: BlockedSlot): string {
  const start = new Date(slot.start_time);
  const end = new Date(slot.end_time);
  const dateLabel = formatInTimeZone(start, IST, "EEE, MMM d");
  const startsAtMidnight = formatInTimeZone(start, IST, "HH:mm") === "00:00";
  const endsAtDayEnd = formatInTimeZone(end, IST, "HH:mm") === "23:59";
  if (startsAtMidnight && endsAtDayEnd) return `${dateLabel} · All day`;
  return `${dateLabel} · ${formatInTimeZone(start, IST, "h:mm a")} – ${formatInTimeZone(end, IST, "h:mm a")}`;
}

export function BlockedSlotsCard({ adminId }: { adminId: string }) {
  const [slots, setSlots] = useState<BlockedSlot[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    listBlockedSlots(adminId)
      .then(setSlots)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load blocked time"));
  }, [adminId]);

  async function handleDelete(slot: BlockedSlot) {
    setBusyId(slot.id);
    try {
      await deleteBlockedSlot(slot.id);
      setSlots((prev) => (prev ? prev.filter((s) => s.id !== slot.id) : prev));
      toast.success("Block removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove block");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Blocked time</CardTitle>
          <CardDescription>Days or windows you&apos;re unavailable, on top of your weekly schedule.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Block time
        </Button>
      </CardHeader>
      <CardContent>
        {slots === null ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-5 w-5 text-neutral-400" />
          </div>
        ) : slots.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">No blocked time yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {slots.map((slot) => (
              <li key={slot.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900">{formatRange(slot)}</p>
                  {slot.reason && <p className="truncate text-xs text-neutral-500">{slot.reason}</p>}
                </div>
                <ActionsMenu
                  disabled={busyId === slot.id}
                  items={[{ label: "Remove", icon: Trash2, tone: "danger", onClick: () => handleDelete(slot) }]}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AddBlockModal
        open={modalOpen}
        adminId={adminId}
        onClose={() => setModalOpen(false)}
        onCreated={(slot) => setSlots((prev) => (prev ? [...prev, slot] : [slot]))}
      />
    </Card>
  );
}
