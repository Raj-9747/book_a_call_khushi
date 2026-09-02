"use client";

import { useState } from "react";
import { CalendarCheck2, CalendarX2, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Badge, Button } from "@/components/ui";
import { removeAdmin, setAdminActive } from "@/lib/api/admins";
import type { Admin } from "@/types/models";

export function AdminsTable({
  admins,
  onChange,
}: {
  admins: Admin[];
  onChange: (admins: Admin[]) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  async function handleToggleActive(admin: Admin) {
    setBusyId(admin.id);
    try {
      await setAdminActive(admin.id, !admin.is_active);
      onChange(
        admins.map((f) => (f.id === admin.id ? { ...f, is_active: !f.is_active } : f))
      );
      toast.success(`${admin.name} ${admin.is_active ? "deactivated" : "reactivated"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update admin");
    } finally {
      setBusyId(null);
      setMenuOpenId(null);
    }
  }

  async function handleRemove(admin: Admin) {
    if (!confirm(`Remove ${admin.name}? This permanently deletes their account and all their data.`)) return;
    setBusyId(admin.id);
    try {
      await removeAdmin(admin.id);
      onChange(admins.filter((f) => f.id !== admin.id));
      toast.success(`${admin.name} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove admin");
    } finally {
      setBusyId(null);
      setMenuOpenId(null);
    }
  }

  if (admins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface py-16 text-center">
        <p className="text-sm font-medium text-neutral-900">No admins yet</p>
        <p className="mt-1 text-sm text-neutral-500">Add your first admin to get them set up.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
            <th className="px-6 py-3">Admin</th>
            <th className="px-6 py-3">Booking link</th>
            <th className="px-6 py-3">Calendar</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3" />
          </tr>
        </thead>
        <tbody>
          {admins.map((admin) => (
            <tr key={admin.id} className="border-b border-border last:border-0">
              <td className="px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={admin.name} />
                  <div>
                    <p className="font-medium text-neutral-900">{admin.name}</p>
                    <p className="text-xs text-neutral-500">{admin.email}</p>
                  </div>
                  {admin.role === "super_admin" && (
                    <Badge tone="brand">Super admin</Badge>
                  )}
                </div>
              </td>
              <td className="px-6 py-3.5 text-neutral-600">/book/{admin.slug}</td>
              <td className="px-6 py-3.5">
                {admin.google_calendar_connected ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600">
                    <CalendarCheck2 className="h-4 w-4" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-neutral-400">
                    <CalendarX2 className="h-4 w-4" /> Not connected
                  </span>
                )}
              </td>
              <td className="px-6 py-3.5">
                <Badge tone={admin.is_active ? "success" : "neutral"}>
                  {admin.is_active ? "Active" : "Deactivated"}
                </Badge>
              </td>
              <td className="relative px-6 py-3.5 text-right">
                {admin.role !== "super_admin" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === admin.id}
                      onClick={() => setMenuOpenId(menuOpenId === admin.id ? null : admin.id)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    {menuOpenId === admin.id && (
                      <div className="absolute right-6 top-11 z-10 w-44 rounded-md border border-border bg-surface py-1 shadow-md">
                        <button
                          className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                          onClick={() => handleToggleActive(admin)}
                        >
                          {admin.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                        <button
                          className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-danger-500 hover:bg-red-50"
                          onClick={() => handleRemove(admin)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
