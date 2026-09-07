"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Modal, Button, FormField, Input } from "@/components/ui";
import { createAdmin } from "@/lib/api/admins";
import { phoneSchema } from "@/lib/validations/phone";
import type { Admin } from "@/types/models";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  phone: phoneSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

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
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema) });

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const admin = await createAdmin(values);
      toast.success(`${values.name} can now log in with the email + password you set`);
      toast.info(`If ${values.name} needs Google Calendar sync, add their Google email as a test user in Google Cloud Console first.`, {
        duration: 8000,
      });
      onCreated(admin);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add admin");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add an admin"
      description="Set their login email and an initial password — share it with them yourself."
      dismissible={!isDirty}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Full name" htmlFor="name" error={errors.name?.message} required>
          <Input id="name" placeholder="Priya Sharma" {...register("name")} />
        </FormField>
        <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
          <Input id="email" type="email" placeholder="priya@company.com" {...register("email")} />
        </FormField>
        <FormField
          label="Phone number"
          htmlFor="phone"
          error={errors.phone?.message}
          hint="Used for WhatsApp booking notifications."
          required
        >
          <Input id="phone" type="tel" placeholder="9876543210" {...register("phone")} />
        </FormField>
        <FormField
          label="Initial password"
          htmlFor="password"
          error={errors.password?.message}
          hint="At least 8 characters. They can change it later from their account settings."
          required
        >
          <Input id="password" type="text" placeholder="Set a password" {...register("password")} />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting}>
            Add admin
          </Button>
        </div>
      </form>
    </Modal>
  );
}
