import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();

  if (!admin) redirect("/login");
  if (admin.role === "super_admin") redirect("/admin");

  // RLS on booking_change_requests already scopes rows to this admin's own
  // bookings (via a join in the policy), so a plain count needs no extra
  // filter to stay siloed.
  const supabase = await createClient();
  const { count: pendingRequestsCount } = await supabase
    .from("booking_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <AppShell
      section="dashboard"
      userName={admin.name}
      userRole={admin.role}
      pendingRequestsCount={pendingRequestsCount ?? 0}
    >
      {children}
    </AppShell>
  );
}
