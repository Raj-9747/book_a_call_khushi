import { CheckCircle2 } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { Card, CardContent } from "@/components/ui";
import type { PublicAdmin, PublicEventType } from "@/lib/api/publicBooking";

export function ConfirmationCard({
  admin,
  eventType,
  startTime,
  visitorTimeZone,
}: {
  admin: PublicAdmin;
  eventType: PublicEventType;
  startTime: Date;
  visitorTimeZone: string;
}) {
  return (
    <Card className="text-center">
      <CardContent className="flex flex-col items-center py-10">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <h2 className="mt-4 text-lg font-semibold text-neutral-900">You&apos;re booked!</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {eventType.name} with {admin.name}
        </p>
        <p className="mt-3 text-sm font-medium text-neutral-900">
          {formatInTimeZone(startTime, visitorTimeZone, "EEEE, MMMM d 'at' h:mm a")}
        </p>
        <p className="mt-1 text-xs text-neutral-400">({visitorTimeZone.replace("_", " ")})</p>
        <p className="mt-6 max-w-sm text-sm text-neutral-500">
          We&apos;ve received your booking. A confirmation with your Google Meet link will be sent to your email
          shortly.
        </p>
      </CardContent>
    </Card>
  );
}
