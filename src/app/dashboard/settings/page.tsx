import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { GoogleCalendarConnect } from "@/components/dashboard/GoogleCalendarConnect";

export default async function DashboardSettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  return (
    <>
      <PageHeader title="Settings" description="Manage your account" />
      <div className="max-w-lg space-y-6 p-4 sm:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Google Calendar</CardTitle>
            <CardDescription>Used to check for conflicts before showing a slot as available.</CardDescription>
          </CardHeader>
          <CardContent>
            <GoogleCalendarConnect connected={admin.google_calendar_connected} />
          </CardContent>
        </Card>
        <ChangePasswordForm />
      </div>
    </>
  );
}
