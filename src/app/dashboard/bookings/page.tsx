import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { BookingsManager } from "@/components/dashboard/BookingsManager";

export default async function BookingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  return <BookingsManager adminId={admin.id} />;
}
