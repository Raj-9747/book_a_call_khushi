import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { AvailabilityForm } from "@/components/dashboard/AvailabilityForm";

export default async function AvailabilityPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  return (
    <>
      <PageHeader title="Availability" description="When clients can book time with you" />
      <div className="max-w-2xl p-4 sm:p-8">
        <AvailabilityForm adminId={admin.id} timezone={admin.timezone} initialAvailability={admin.weekly_availability} />
      </div>
    </>
  );
}
