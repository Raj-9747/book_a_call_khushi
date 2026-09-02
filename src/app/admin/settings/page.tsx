import { PageHeader } from "@/components/layout/PageHeader";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your account" />
      <div className="max-w-lg p-8">
        <ChangePasswordForm />
      </div>
    </>
  );
}
