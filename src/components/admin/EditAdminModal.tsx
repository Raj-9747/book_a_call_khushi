"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Modal, Button, FormField, Input } from "@/components/ui";
import { updateAdmin } from "@/lib/api/admins";
import type { Admin } from "@/types/models";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.union([z.literal(""), z.string().min(8, "Password must be at least 8 characters")]),
});
type FormValues = z.infer<typeof schema>;

export function EditAdminModal({
  admin,
  onClose,
  onUpdated,
}: {
  admin: Admin | null;
  onClose: () => void;
  onUpdated: (admin: Admin) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (admin) reset({ name: admin.name, email: admin.email, password: "" });
  }, [admin, reset]);

  async function onSubmit(values: FormValues) {
    if (!admin) return;
    setSubmitting(true);
    try {
      await updateAdmin({
        admin_id: admin.id,
        name: values.name !== admin.name ? values.name : undefined,
        email: values.email !== admin.email ? values.email : undefined,
        password: values.password || undefined,
      });
      toast.success(`${values.name} updated`);
      onUpdated({ ...admin, name: values.name, email: values.email });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update admin");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={!!admin}
      onClose={onClose}
      title="Edit admin"
      description="Update their details, or set a new password to reset it."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Full name" htmlFor="edit-name" error={errors.name?.message} required>
          <Input id="edit-name" {...register("name")} />
        </FormField>
        <FormField label="Email" htmlFor="edit-email" error={errors.email?.message} required>
          <Input id="edit-email" type="email" {...register("email")} />
        </FormField>
        <FormField
          label="New password"
          htmlFor="edit-password"
          error={errors.password?.message}
          hint="Leave blank to keep their current password."
        >
          <Input id="edit-password" type="text" placeholder="Leave blank to keep unchanged" {...register("password")} />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
