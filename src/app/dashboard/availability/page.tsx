import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { AvailabilityForm } from "@/components/dashboard/AvailabilityForm";
import { BlockedSlotsCard } from "@/components/dashboard/BlockedSlotsCard";
import { BookingSettingsCard } from "@/components/dashboard/BookingSettingsCard";

export default async function AvailabilityPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  return (
    <>
      <PageHeader title="Availability" description="When clients can book time with you" />
      {/* Two columns from xl up. Stacked in one narrow column this page ran
          to several screens of scrolling while leaving most of the width
          empty — the weekly grid is the tall one, so it gets its own column
          and the two shorter cards stack beside it. */}
      <div className="mx-auto max-w-7xl p-4 sm:p-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <AvailabilityForm
              adminId={admin.id}
              timezone={admin.timezone}
              initialAvailability={admin.weekly_availability}
            />
          </div>
          <div className="space-y-6 xl:col-span-2">
            <BookingSettingsCard
              adminId={admin.id}
              initialMinNotice={admin.min_notice_minutes}
              initialWindowDays={admin.booking_window_days}
            />
            <BlockedSlotsCard adminId={admin.id} />
          </div>
        </div>
      </div>
    </>
  );
}
