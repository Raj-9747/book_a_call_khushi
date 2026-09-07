import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { ProfileForm } from "@/components/account/ProfileForm";

export default async function AdminSettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  return (
    <>
      <PageHeader title="Settings" description="Manage your account" />
      <div className="mx-auto max-w-5xl p-4 sm:p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ProfileForm admin={admin} />
          <ChangePasswordForm />
        </div>
      </div>
    </>
  );
}
