import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { PaymentsManager } from "@/components/dashboard/PaymentsManager";

export default async function PaymentsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  return <PaymentsManager adminId={admin.id} />;
}
