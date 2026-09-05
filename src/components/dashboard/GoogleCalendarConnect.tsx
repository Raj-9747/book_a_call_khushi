"use client";

import { useState } from "react";
import { CalendarCheck2 } from "lucide-react";
import { toast } from "sonner";
import { Button, useConfirm } from "@/components/ui";
import { disconnectGoogleCalendar, getGoogleAuthUrl } from "@/lib/api/googleCalendar";

export function GoogleCalendarConnect({ connected }: { connected: boolean }) {
  const [disconnecting, setDisconnecting] = useState(false);
  const confirm = useConfirm();

  function handleConnect() {
    try {
      const redirectUri = `${window.location.origin}/dashboard/calendar/callback`;
      window.location.href = getGoogleAuthUrl(redirectUri);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start Google connection");
    }
  }

  async function handleDisconnect() {
    if (!(await confirm("Disconnect Google Calendar? Zaptly will stop checking your calendar for conflicts.")))
      return;
    setDisconnecting(true);
    try {
      await disconnectGoogleCalendar();
      toast.success("Google Calendar disconnected");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  if (connected) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
          <CalendarCheck2 className="h-4 w-4" /> Google Calendar connected
        </span>
        <Button variant="outline" size="sm" isLoading={disconnecting} onClick={handleDisconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleConnect}>
      <CalendarCheck2 className="h-4 w-4" /> Connect Google Calendar
    </Button>
  );
}
