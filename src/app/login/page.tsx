import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { AuthShell } from "@/components/layout/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  const admin = await getCurrentAdmin();
  if (admin) {
    redirect(admin.role === "super_admin" ? "/admin" : "/dashboard");
  }

  return (
    <AuthShell title="Sign in to Zaptly" description="Manage your calls, leads and schedule">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
