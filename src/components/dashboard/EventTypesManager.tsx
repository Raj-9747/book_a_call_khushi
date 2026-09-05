"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Spinner, useConfirm } from "@/components/ui";
import { deleteEventType, listEventTypes, setEventTypeActive } from "@/lib/api/eventTypes";
import { EventTypesList } from "./EventTypesList";
import { EventTypeFormModal } from "./EventTypeFormModal";
import type { EventType } from "@/types/models";

export function EventTypesManager({ adminId, adminSlug }: { adminId: string; adminSlug: string }) {
  const [eventTypes, setEventTypes] = useState<EventType[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EventType | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    listEventTypes(adminId)
      .then(setEventTypes)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load event types"));
  }, [adminId]);

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(eventType: EventType) {
    setEditTarget(eventType);
    setFormOpen(true);
  }

  async function handleToggleActive(eventType: EventType) {
    setBusyId(eventType.id);
    try {
      await setEventTypeActive(eventType.id, !eventType.is_active);
      setEventTypes((prev) =>
        prev ? prev.map((e) => (e.id === eventType.id ? { ...e, is_active: !e.is_active } : e)) : prev
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update event type");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(eventType: EventType) {
    if (!(await confirm({ description: `Delete "${eventType.name}"? This can't be undone.`, tone: "danger" }))) return;
    setBusyId(eventType.id);
    try {
      await deleteEventType(eventType.id);
      setEventTypes((prev) => (prev ? prev.filter((e) => e.id !== eventType.id) : prev));
      toast.success("Event type deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete event type");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Event types"
        description="The calls clients can book with you"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add event type
          </Button>
        }
      />
      <div className="p-4 sm:p-8">
        {eventTypes === null ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-neutral-400" />
          </div>
        ) : (
          <EventTypesList
            adminSlug={adminSlug}
            eventTypes={eventTypes}
            busyId={busyId}
            onEdit={openEdit}
            onToggleActive={handleToggleActive}
            onDelete={handleDelete}
          />
        )}
      </div>

      <EventTypeFormModal
        open={formOpen}
        adminId={adminId}
        eventType={editTarget}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) =>
          setEventTypes((prev) =>
            !prev ? [saved] : prev.some((e) => e.id === saved.id) ? prev.map((e) => (e.id === saved.id ? saved : e)) : [...prev, saved]
          )
        }
      />
    </>
  );
}
