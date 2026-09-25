"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui";
import { DateSlotPicker } from "@/components/booking/DateSlotPicker";
import { getBusyRanges, getGoogleBusyRanges } from "@/lib/api/publicBooking";
import { computeAvailableSlots, withoutOwnBooking } from "@/lib/availability/computeSlots";
import { createClient } from "@/lib/supabase/client";

const IST = "Asia/Kolkata";

/** The same slot list a client sees when booking or asking to reschedule:
 * the admin's weekly hours, booking window, minimum notice, Zaptly bookings,
 * blocked times and Google Calendar. The booking being moved is excluded
 * from "busy", so its current time (if still in the future) is offered
 * again as a free slot. Admins therefore can't pick a time that would
 * collide with someone else. */
export function AdminSlotPicker({
  adminId,
  booking: { start_time, end_time, duration_minutes },
  selected,
  onSelect,
}: {
  adminId: string;
  booking: { start_time: string; end_time: string; duration_minutes: number };
  selected: Date | null;
  onSelect: (slot: Date) => void;
}) {
  const [slots, setSlots] = useState<Date[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const { data: admin, error } = await supabase
          .from("admins")
          .select("weekly_availability, booking_window_days, min_notice_minutes, google_calendar_connected")
          .eq("id", adminId)
          .single();
        if (error) throw error;

        const windowDays = admin.booking_window_days ?? 14;
        const from = new Date();
        const to = new Date(from.getTime() + windowDays * 86_400_000);
        const [zaptlyBusy, googleBusy] = await Promise.all([
          getBusyRanges(adminId, from, to),
          admin.google_calendar_connected ? getGoogleBusyRanges(adminId, from, to) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setSlots(
          computeAvailableSlots({
            weeklyAvailability: admin.weekly_availability,
            durationMinutes: duration_minutes,
            busyRanges: withoutOwnBooking([...zaptlyBusy, ...googleBusy], { start_time, end_time }),
            daysAhead: windowDays,
            minNoticeMinutes: admin.min_notice_minutes ?? 0,
          })
        );
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [adminId, start_time, end_time, duration_minutes]);

  if (failed) {
    return <p className="text-sm text-danger-600">Couldn&apos;t load available times — close and try again.</p>;
  }
  if (slots === null) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="h-5 w-5 text-neutral-400" />
      </div>
    );
  }
  return <DateSlotPicker slots={slots} visitorTimeZone={IST} selectedSlot={selected} onSelect={onSelect} />;
}
