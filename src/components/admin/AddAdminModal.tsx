"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Modal, Button, FormField, Input } from "@/components/ui";
import { inviteAdmin } from "@/lib/api/admins";
import type { Admin } from "@/types/models";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});
type FormValues = z.infer<typeof schema>;

export function AddAdminModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (admin: Admin) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const admin = await inviteAdmin(values);
      toast.success(`Invite sent to ${values.email}`);
      onCreated(admin);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to invite admin");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add an admin"
      description="They'll get an email invite to set their password and connect their calendar."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Full name" htmlFor="name" error={errors.name?.message} required>
          <Input id="name" placeholder="Priya Sharma" {...register("name")} />
        </FormField>
        <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
          <Input id="email" type="email" placeholder="priya@company.com" {...register("email")} />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting}>
            Send invite
          </Button>
        </div>
      </form>
    </Modal>
  );
}
