import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { AppShell } from "@/components/layout/AppShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();

  if (!admin) redirect("/login");
  if (admin.role !== "super_admin") redirect("/dashboard");

  return (
    <AppShell section="admin" userName={admin.name} userRole={admin.role}>
      {children}
    </AppShell>
  );
}
