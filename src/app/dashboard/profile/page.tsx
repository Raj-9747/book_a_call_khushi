import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { ProfileForm } from "@/components/account/ProfileForm";
import { PublicProfileForm } from "@/components/account/PublicProfileForm";
import { PublicLinkCard } from "@/components/account/PublicLinkCard";
import { BookingToggleCard } from "@/components/account/BookingToggleCard";
import { GoogleCalendarConnect } from "@/components/dashboard/GoogleCalendarConnect";

export default async function DashboardProfilePage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  return (
    <>
      <PageHeader title="Profile" description="Your public page, account details and integrations" />
      <div className="max-w-2xl space-y-6 p-4 sm:p-8">
        <PublicLinkCard admin={admin} />
        <PublicProfileForm admin={admin} />
        <BookingToggleCard admin={admin} />
        <ProfileForm admin={admin} />
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
