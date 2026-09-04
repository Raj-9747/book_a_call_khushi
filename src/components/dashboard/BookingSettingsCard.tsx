"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FormField,
  Select,
} from "@/components/ui";

const NOTICE_OPTIONS = [
  { value: "0", label: "No minimum" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "120", label: "2 hours" },
  { value: "240", label: "4 hours" },
  { value: "720", label: "12 hours" },
  { value: "1440", label: "1 day" },
  { value: "2880", label: "2 days" },
];

const WINDOW_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
];

/** Minimum notice and booking window — both were hardcoded before (no
 * notice at all, and a fixed 14-day horizon). */
export function BookingSettingsCard({
  adminId,
  initialMinNotice,
  initialWindowDays,
}: {
  adminId: string;
  initialMinNotice: number;
  initialWindowDays: number;
}) {
  const router = useRouter();
  const [minNotice, setMinNotice] = useState(String(initialMinNotice));
  const [windowDays, setWindowDays] = useState(String(initialWindowDays));
  const [saving, setSaving] = useState(false);

  const dirty = Number(minNotice) !== initialMinNotice || Number(windowDays) !== initialWindowDays;

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("admins")
        .update({ min_notice_minutes: Number(minNotice), booking_window_days: Number(windowDays) })
        .eq("id", adminId);
      if (error) throw error;
      toast.success("Booking settings saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking rules</CardTitle>
        <CardDescription>How close to a call, and how far ahead, clients are allowed to book.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Minimum notice"
          hint="Slots sooner than this are hidden, so you're never booked minutes before a call."
        >
          <Select value={minNotice} onChange={setMinNotice} options={NOTICE_OPTIONS} />
        </FormField>
        <FormField label="Booking window" hint="How far into the future clients can pick a slot.">
          <Select value={windowDays} onChange={setWindowDays} options={WINDOW_OPTIONS} />
        </FormField>
      </CardContent>
      <CardFooter>
        <Button type="button" isLoading={saving} disabled={!dirty} onClick={handleSave}>
          Save settings
        </Button>
      </CardFooter>
    </Card>
  );
}
