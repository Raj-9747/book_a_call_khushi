import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { RequestsManager } from "@/components/dashboard/RequestsManager";

export default async function RequestsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  return <RequestsManager adminId={admin.id} />;
}
