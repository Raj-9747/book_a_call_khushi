"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Spinner } from "@/components/ui";
import { AdminsTable } from "@/components/admin/AdminsTable";
import { AddAdminModal } from "@/components/admin/AddAdminModal";
import { listAdmins } from "@/lib/api/admins";
import type { Admin } from "@/types/models";

export default function ManageAdminsPage() {
  const [admins, setAdmins] = useState<Admin[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    listAdmins()
      .then(setAdmins)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load admins"));
  }, []);

  return (
    <>
      <PageHeader
        title="Admins"
        description="Manage who can run their own schedule on Zaptly"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add admin
          </Button>
        }
      />
      <div className="p-4 sm:p-8">
        {admins === null ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-neutral-400" />
          </div>
        ) : (
          <AdminsTable admins={admins} onChange={setAdmins} />
        )}
      </div>
      <AddAdminModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(admin) => setAdmins((prev) => (prev ? [...prev, admin] : [admin]))}
      />
    </>
  );
}
