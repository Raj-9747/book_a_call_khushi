import { AuthShell } from "@/components/layout/AuthShell";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";

export default function SetPasswordPage() {
  return (
    <AuthShell title="Set your password" description="You're almost in — choose a password for your Zaptly account">
      <SetPasswordForm />
    </AuthShell>
  );
}
