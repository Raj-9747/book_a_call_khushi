"use client";

import { useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { groupSlotsByDay } from "@/lib/availability/computeSlots";
import { Button } from "@/components/ui";

export function DateSlotPicker({
  slots,
  visitorTimeZone,
  selectedSlot,
  onSelect,
}: {
  slots: Date[];
  visitorTimeZone: string;
  selectedSlot: Date | null;
  onSelect: (slot: Date) => void;
}) {
  const grouped = useMemo(() => groupSlotsByDay(slots, visitorTimeZone), [slots, visitorTimeZone]);
  const days = useMemo(() => Array.from(grouped.keys()).sort(), [grouped]);
  const [selectedDay, setSelectedDay] = useState(days[0]);

  if (days.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border-strong px-4 py-10 text-center text-sm text-neutral-500">
        No upcoming availability right now — please check back soon.
      </p>
    );
  }

  const activeDay = selectedDay && grouped.has(selectedDay) ? selectedDay : days[0];
  const daySlots = grouped.get(activeDay) ?? [];

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((day) => {
          const [y, m, d] = day.split("-").map(Number);
          const label = formatInTimeZone(new Date(Date.UTC(y, m - 1, d, 12)), visitorTimeZone, "EEE, MMM d");
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={cn(
                "shrink-0 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                day === activeDay
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-border-strong text-neutral-600 hover:bg-neutral-50"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* grid-cols-2 on narrow phones — 3 columns left too little width for
          "10:00 AM" to fit on one line at this font size, so it wrapped
          and squashed against the button's fixed height. whitespace-nowrap
          is the actual guarantee; the column counts just make sure there's
          room for it. */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {daySlots.map((slot) => {
          const isSelected = selectedSlot?.getTime() === slot.getTime();
          return (
            <Button
              key={slot.toISOString()}
              variant={isSelected ? "primary" : "outline"}
              size="sm"
              aria-pressed={isSelected}
              onClick={() => onSelect(slot)}
              className="whitespace-nowrap"
            >
              {formatInTimeZone(slot, visitorTimeZone, "h:mm a")}
            </Button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-neutral-400">Times shown in your timezone ({visitorTimeZone.replace("_", " ")})</p>
    </div>
  );
}
