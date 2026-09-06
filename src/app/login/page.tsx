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
    <AuthShell title="Welcome back" description="Sign in to manage your bookings, availability and clients.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
