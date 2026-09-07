"use client";

import { useState } from "react";
import { CalendarCheck2, CalendarX2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionsMenu, Avatar, Badge, Pagination, useConfirm } from "@/components/ui";
import { usePagination } from "@/lib/usePagination";
import { removeAdmin, setAdminActive } from "@/lib/api/admins";
import { EditAdminModal } from "./EditAdminModal";
import type { Admin } from "@/types/models";

export function AdminsTable({
  admins,
  onChange,
}: {
  admins: Admin[];
  onChange: (admins: Admin[]) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const confirm = useConfirm();
  const { page, setPage, pageSize, totalCount, pageItems } = usePagination(admins);

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
    }
  }

  async function handleRemove(admin: Admin) {
    if (
      !(await confirm({
        description: `Remove ${admin.name}? This permanently deletes their account and all their data.`,
        tone: "danger",
      }))
    )
      return;
    setBusyId(admin.id);
    try {
      await removeAdmin(admin.id);
      onChange(admins.filter((f) => f.id !== admin.id));
      toast.success(`${admin.name} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove admin");
    } finally {
      setBusyId(null);
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
      <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
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
          {pageItems.map((admin) => (
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
                  <span className="inline-flex items-center gap-1.5 text-success-600">
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
              <td className="px-6 py-3.5 text-right">
                {admin.role !== "super_admin" && (
                  <ActionsMenu
                    disabled={busyId === admin.id}
                    items={[
                      { label: "Edit", icon: Pencil, onClick: () => setEditingAdmin(admin) },
                      {
                        label: admin.is_active ? "Deactivate" : "Reactivate",
                        onClick: () => handleToggleActive(admin),
                      },
                      { label: "Remove", icon: Trash2, tone: "danger", onClick: () => handleRemove(admin) },
                    ]}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <Pagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
      <EditAdminModal
        admin={editingAdmin}
        onClose={() => setEditingAdmin(null)}
        onUpdated={(updated) => onChange(admins.map((a) => (a.id === updated.id ? updated : a)))}
      />
    </div>
  );
}
