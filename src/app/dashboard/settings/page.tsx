import { PageHeader } from "@/components/layout/PageHeader";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";

export default function DashboardSettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your account" />
      <div className="max-w-lg p-4 sm:p-8">
        <ChangePasswordForm />
      </div>
    </>
  );
}
