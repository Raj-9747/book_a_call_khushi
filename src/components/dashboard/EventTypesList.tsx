"use client";

import { Pencil, Trash2 } from "lucide-react";
import { ActionsMenu, Badge, Card, Switch } from "@/components/ui";
import type { EventType } from "@/types/models";

export function EventTypesList({
  adminSlug,
  eventTypes,
  busyId,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  adminSlug: string;
  eventTypes: EventType[];
  busyId: string | null;
  onEdit: (eventType: EventType) => void;
  onToggleActive: (eventType: EventType) => void;
  onDelete: (eventType: EventType) => void;
}) {
  if (eventTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface py-16 text-center">
        <p className="text-sm font-medium text-neutral-900">No event types yet</p>
        <p className="mt-1 text-sm text-neutral-500">Create one so clients have something to book.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {eventTypes.map((eventType) => (
        <Card key={eventType.id} className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-neutral-900">{eventType.name}</h3>
                {!eventType.is_active && <Badge tone="neutral">Inactive</Badge>}
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                {eventType.duration_minutes} min · {eventType.price > 0 ? `₹${eventType.price}` : "Free"}
              </p>
              {eventType.description && (
                <p className="mt-1.5 line-clamp-2 text-sm text-neutral-500">{eventType.description}</p>
              )}
              <p className="mt-1.5 truncate text-xs text-neutral-400">
                /book/{adminSlug}/{eventType.slug}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Switch
                checked={eventType.is_active}
                disabled={busyId === eventType.id}
                onChange={() => onToggleActive(eventType)}
                label={eventType.is_active ? "Deactivate" : "Activate"}
              />
              <ActionsMenu
                disabled={busyId === eventType.id}
                items={[
                  { label: "Edit", icon: Pencil, onClick: () => onEdit(eventType) },
                  { label: "Delete", icon: Trash2, tone: "danger", onClick: () => onDelete(eventType) },
                ]}
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
