import { CalendarDays, Check, Clock, Mail } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import type { PublicAdmin, PublicEventType } from "@/lib/api/publicBooking";
import { Avatar } from "@/components/ui";
import { SparkleDoodle } from "./doodles";

export function ConfirmationCard({
  admin,
  eventType,
  startTime,
  amountPaid,
  visitorTimeZone,
}: {
  admin: PublicAdmin;
  eventType: PublicEventType;
  startTime: Date;
  amountPaid: number;
  visitorTimeZone: string;
}) {
  return (
    <div className="mx-auto max-w-lg overflow-clip rounded-[2rem] border border-border bg-surface text-center shadow-md">
      <div className="relative bg-neutral-50 px-6 pb-8 pt-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,var(--brand-100)_0%,transparent_75%)]"
        />
        <SparkleDoodle aria-hidden="true" className="absolute left-[22%] top-8 h-4 w-4 text-marigold-400" />
        <SparkleDoodle aria-hidden="true" className="absolute right-[24%] top-14 h-3 w-3 text-brand-400" />
        <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg">
          <Check className="h-8 w-8" strokeWidth={3} />
        </span>
        <h2 className="relative mt-5 font-display text-3xl font-semibold tracking-tight text-neutral-900 [font-variation-settings:'SOFT'_100]">
          You&apos;re booked!
        </h2>
        <p className="relative mt-1.5 text-sm text-neutral-500">Can&apos;t wait to chat ✨</p>
      </div>

      <div className="space-y-5 px-6 py-7 text-left sm:px-8">
        <div className="flex items-center gap-3">
          <Avatar name={admin.name} src={admin.photo_url} className="h-11 w-11" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-neutral-900">{eventType.name}</p>
            <p className="truncate text-sm text-neutral-500">with {admin.name}</p>
          </div>
        </div>

        <ul className="space-y-2.5 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-700">
          <li className="flex items-center gap-2.5">
            <CalendarDays className="h-4 w-4 shrink-0 text-brand-500" />
            {formatInTimeZone(startTime, visitorTimeZone, "EEEE, MMMM d 'at' h:mm a")}
          </li>
          <li className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 shrink-0 text-brand-500" />
            {eventType.duration_minutes} min · {visitorTimeZone.replace(/_/g, " ")}
          </li>
          {amountPaid > 0 && (
            <li className="flex items-center gap-2.5">
              <Check className="h-4 w-4 shrink-0 text-brand-500" />
              Paid <span className="font-semibold text-neutral-900">₹{amountPaid.toLocaleString("en-IN")}</span>
            </li>
          )}
        </ul>

        <p className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-500">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
          A confirmation with your Google Meet link is on its way to your email shortly.
        </p>
      </div>
    </div>
  );
}
