import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/supabase/auth";
import { EventTypesManager } from "@/components/dashboard/EventTypesManager";

export default async function EventTypesPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  return <EventTypesManager adminId={admin.id} adminSlug={admin.slug} />;
}
