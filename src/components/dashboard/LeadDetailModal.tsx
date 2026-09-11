"use client";

import { useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Modal, Badge, Button, FormField, Select, Textarea } from "@/components/ui";
import { updateBookingLeadInfo } from "@/lib/api/bookings";
import type { BookingWithEventType } from "@/lib/api/bookings";
import { getMeetingSummary, type MeetingSummary } from "@/lib/api/meetingSummaries";
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
  // undefined = still loading, null = loaded but nothing there yet.
  const [summary, setSummary] = useState<MeetingSummary | null | undefined>(undefined);

  // The parent keys this modal with `key={selected?.id}` (LeadDetailModal
  // never unmounts otherwise — see PLAN.md §10.6), so a plain effect here
  // is safe: it re-runs on mount per booking rather than needing to guard
  // against stale state from a previous one.
  useEffect(() => {
    if (!booking?.event_types?.record_meeting) return;
    let cancelled = false;
    getMeetingSummary(booking.id)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch(() => {
        // Non-fatal — the rest of the modal is still useful without it.
        // Falls back to the "still loading" copy rather than a false
        // "not available yet", but that's an acceptable trade for a
        // network hiccup on a secondary panel.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id]);

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

        {booking.event_types?.record_meeting && (
          <div className="space-y-2.5 border-t border-border pt-3">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <Sparkles className="h-3.5 w-3.5" />
              Meeting notes
            </p>
            {summary === undefined ? (
              <p className="text-sm text-neutral-400">Loading…</p>
            ) : summary ? (
              <div className="space-y-2.5 rounded-lg bg-neutral-50 px-3.5 py-3 text-sm">
                {summary.short_summary && <p className="text-neutral-800">{summary.short_summary}</p>}
                {summary.action_items.length > 0 && (
                  <ul className="list-disc space-y-1 pl-4 text-neutral-700">
                    {summary.action_items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
                {summary.transcript_url && (
                  <a
                    href={summary.transcript_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-brand-600 hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    View full transcript
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">
                Not available yet — notes appear here once the call ends and Fireflies finishes processing it.
              </p>
            )}
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
