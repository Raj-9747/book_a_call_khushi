import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/supabase/auth";

export default async function RootPage() {
  const admin = await getCurrentAdmin();

  if (!admin) redirect("/login");
  redirect(admin.role === "super_admin" ? "/admin" : "/dashboard");
}
