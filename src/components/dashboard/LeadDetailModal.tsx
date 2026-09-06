"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import { Modal, Badge, Button, FormField, Select, Textarea } from "@/components/ui";
import { updateBookingLeadInfo } from "@/lib/api/bookings";
import type { BookingWithEventType } from "@/lib/api/bookings";
import type { LeadTag } from "@/types/models";

const IST = "Asia/Kolkata";
const TAG_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "No tag" },
  { value: "Lead", label: "Lead" },
  { value: "Client", label: "Client" },
  { value: "Follow-up", label: "Follow-up" },
  { value: "Closed", label: "Closed" },
];

export function LeadDetailModal({
  booking,
  onClose,
  onUpdated,
}: {
  booking: BookingWithEventType | null;
  onClose: () => void;
  onUpdated: (booking: BookingWithEventType) => void;
}) {
  const [notes, setNotes] = useState(booking?.notes ?? "");
  const [tag, setTag] = useState<string>(booking?.tag ?? "");
  const [saving, setSaving] = useState(false);

  if (!booking) return null;

  const questionLabels = new Map((booking.event_types?.custom_questions ?? []).map((q) => [q.id, q.label]));

  async function handleSave() {
    setSaving(true);
    try {
      // `|| null`, not `|| undefined` — an omitted key leaves the old value
      // in place, which made clearing a note impossible.
      const nextNotes = notes.trim() || null;
      const nextTag = (tag || null) as LeadTag | null;
      await updateBookingLeadInfo(booking!.id, { notes: nextNotes, tag: nextTag });
      toast.success("Saved");
      onUpdated({ ...booking!, notes: nextNotes, tag: nextTag });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!booking} onClose={onClose} title={booking.client_name} description={booking.event_types?.name}>
      <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
          <div className="min-w-0">
            <p className="text-neutral-400">Email</p>
            {/* break-all, not break-words — an email has no spaces to break
                on, so without this it overflows its grid cell and visually
                overlaps the Phone column next to it. */}
            <p className="break-all text-neutral-900">{booking.client_email}</p>
          </div>
          <div className="min-w-0">
            <p className="text-neutral-400">Phone</p>
            <p className="break-all text-neutral-900">{booking.client_phone || "—"}</p>
          </div>
          <div className="min-w-0">
            <p className="text-neutral-400">When</p>
            <p className="text-neutral-900">{formatInTimeZone(new Date(booking.start_time), IST, "MMM d, yyyy h:mm a")}</p>
          </div>
          <div className="min-w-0">
            <p className="text-neutral-400">Status</p>
            <Badge tone={booking.status === "cancelled" ? "danger" : booking.status === "completed" ? "success" : "brand"}>
              {booking.status.replace("_", " ")}
            </Badge>
          </div>
        </div>

        {Object.keys(booking.custom_answers ?? {}).length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            {Object.entries(booking.custom_answers).map(([id, answer]) => (
              <div key={id} className="text-sm">
                <p className="text-neutral-400">{questionLabels.get(id) ?? "Question"}</p>
                <p className="text-neutral-900">{answer}</p>
              </div>
            ))}
          </div>
        )}

        <FormField label="Tag">
          <Select value={tag} onChange={setTag} options={TAG_OPTIONS} />
        </FormField>

        <FormField label="Notes">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Private notes about this lead..." />
        </FormField>
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={handleSave} isLoading={saving}>
          Save
        </Button>
      </div>
    </Modal>
  );
}
