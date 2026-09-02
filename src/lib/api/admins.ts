import { createClient } from "@/lib/supabase/client";
import type { Admin } from "@/types/models";

export async function listAdmins(): Promise<Admin[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("admins")
    .select("id, name, email, slug, role, is_active, timezone, google_calendar_connected, created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as Admin[];
}

export async function createAdmin(input: { name: string; email: string; password: string }): Promise<Admin> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("create-admin", { body: input });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.admin as Admin;
}

export async function updateAdmin(input: {
  admin_id: string;
  name?: string;
  email?: string;
  password?: string;
}): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("update-admin", { body: input });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function setAdminActive(id: string, isActive: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("admins").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function removeAdmin(id: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("remove-admin", { body: { admin_id: id } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
