"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Modal, Button, FormField, Input, useConfirm } from "@/components/ui";
import { updateAdmin } from "@/lib/api/admins";
import { phoneSchema } from "@/lib/validations/phone";
import { slugSchema } from "@/lib/validations/slug";
import type { Admin } from "@/types/models";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  phone: phoneSchema,
  slug: slugSchema,
  password: z.union([z.literal(""), z.string().min(8, "Password must be at least 8 characters")]),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

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
  const confirm = useConfirm();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (admin) reset({ name: admin.name, email: admin.email, phone: admin.phone ?? "", slug: admin.slug, password: "" });
  }, [admin, reset]);

  async function onSubmit(values: FormValues) {
    if (!admin) return;

    const slugChanged = values.slug !== admin.slug;
    if (slugChanged) {
      const confirmed = await confirm({
        title: "Change their booking link?",
        description: `Their link will become /book/${values.slug}. The old link (/book/${admin.slug}) will stop working immediately — anyone who saved or was sent it won't be able to book with them there anymore.`,
        confirmLabel: "Change it",
        tone: "danger",
      });
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      const emailChanged = values.email !== admin.email;
      await updateAdmin({
        admin_id: admin.id,
        name: values.name !== admin.name ? values.name : undefined,
        email: emailChanged ? values.email : undefined,
        phone: values.phone !== admin.phone ? values.phone : undefined,
        slug: slugChanged ? values.slug : undefined,
        password: values.password || undefined,
      });
      toast.success(`${values.name} updated`);
      if (emailChanged) {
        toast.info(`${values.name}'s email changed — they'll need to reconnect Google Calendar.`, { duration: 6000 });
      }
      onUpdated({
        ...admin,
        name: values.name,
        email: values.email,
        phone: values.phone,
        slug: values.slug,
        google_calendar_connected: emailChanged ? false : admin.google_calendar_connected,
      });
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
      dismissible={!isDirty}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Full name" htmlFor="edit-name" error={errors.name?.message} required>
          <Input id="edit-name" {...register("name")} />
        </FormField>
        <FormField
          label="Email"
          htmlFor="edit-email"
          error={errors.email?.message}
          hint="Changing this will require them to reconnect Google Calendar."
          required
        >
          <Input id="edit-email" type="email" {...register("email")} />
        </FormField>
        <FormField label="Phone number" htmlFor="edit-phone" error={errors.phone?.message} required>
          <Input id="edit-phone" type="tel" {...register("phone")} />
        </FormField>
        <FormField
          label="Booking link"
          htmlFor="edit-slug"
          error={errors.slug?.message}
          hint="Changing this breaks any /book/<old-link> they've already shared."
          required
        >
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-sm text-neutral-400">/book/</span>
            <Input id="edit-slug" {...register("slug")} />
          </div>
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
