"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FormField,
  Switch,
  Textarea,
} from "@/components/ui";
import { updateProfileFields } from "@/lib/api/admins";
import type { Admin } from "@/types/models";

const MAX_MESSAGE = 300;

/** Master switch for an admin's public pages. Off means the slot picker is
 * replaced by a short enquiry form — bookings stop, but leads don't. */
export function BookingToggleCard({ admin }: { admin: Admin }) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(admin.accepting_bookings);
  const [message, setMessage] = useState(admin.unavailable_message ?? "");
  const [saving, setSaving] = useState(false);

  const messageDirty = (message.trim() || null) !== (admin.unavailable_message ?? null);

  async function persist(nextAccepting: boolean, nextMessage: string | null) {
    setSaving(true);
    try {
      await updateProfileFields(admin.id, {
        accepting_bookings: nextAccepting,
        unavailable_message: nextMessage,
      });
      router.refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(next: boolean) {
    // Optimistic — the switch should feel instant; revert if the write fails.
    setAccepting(next);
    const ok = await persist(next, message.trim() || null);
    if (!ok) {
      setAccepting(!next);
      return;
    }
    toast.success(next ? "You're accepting bookings again" : "Bookings paused");
  }

  async function handleSaveMessage() {
    if (await persist(accepting, message.trim() || null)) {
      toast.success("Message saved");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              Accepting bookings
              <Badge tone={accepting ? "success" : "warning"}>{accepting ? "On" : "Paused"}</Badge>
            </CardTitle>
            <CardDescription>
              {accepting
                ? "Clients can pick a slot and book you as normal."
                : "Your booking pages show “currently unavailable” with a short form so clients can still leave their details. Their submissions appear under Bookings → Enquiries."}
            </CardDescription>
          </div>
          <Switch checked={accepting} onChange={handleToggle} disabled={saving} label="Accepting bookings" />
        </div>
      </CardHeader>

      {!accepting && (
        <>
          <CardContent>
            <FormField
              label="Message shown to clients"
              htmlFor="unavailable-message"
              hint={`Optional. Leave blank to use the default wording. ${message.length}/${MAX_MESSAGE}`}
            >
              <Textarea
                id="unavailable-message"
                rows={3}
                maxLength={MAX_MESSAGE}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="I'm not taking calls until the 20th — leave your details and I'll reach out."
              />
            </FormField>
          </CardContent>
          <CardFooter>
            <Button type="button" isLoading={saving} disabled={!messageDirty} onClick={handleSaveMessage}>
              Save message
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
