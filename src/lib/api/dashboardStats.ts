import { createClient } from "@/lib/supabase/client";

export interface DashboardStats {
  upcomingCount: number;
  todayCount: number;
  totalBookings: number;
  nextBooking: { clientName: string; eventName: string; startTime: string } | null;
}

export async function getDashboardStats(adminId: string): Promise<DashboardStats> {
  const supabase = createClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [upcomingRes, todayRes, totalRes, nextRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", adminId)
      .eq("status", "confirmed")
      .gte("start_time", now.toISOString()),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", adminId)
      .eq("status", "confirmed")
      .gte("start_time", todayStart.toISOString())
      .lte("start_time", todayEnd.toISOString()),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("admin_id", adminId),
    supabase
      .from("bookings")
      .select("client_name, start_time, event_types(name)")
      .eq("admin_id", adminId)
      .eq("status", "confirmed")
      .gte("start_time", now.toISOString())
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const nextRow = nextRes.data as { client_name: string; start_time: string; event_types: { name: string } | null } | null;

  return {
    upcomingCount: upcomingRes.count ?? 0,
    todayCount: todayRes.count ?? 0,
    totalBookings: totalRes.count ?? 0,
    nextBooking: nextRow
      ? { clientName: nextRow.client_name, eventName: nextRow.event_types?.name ?? "Call", startTime: nextRow.start_time }
      : null,
  };
}
