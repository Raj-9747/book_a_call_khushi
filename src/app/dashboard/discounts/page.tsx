import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { DiscountsManager } from "@/components/dashboard/DiscountsManager";

export default async function DiscountsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  return <DiscountsManager adminId={admin.id} />;
}
