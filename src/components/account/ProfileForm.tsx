"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
  FormField,
  Input,
} from "@/components/ui";
import { updateOwnProfile } from "@/lib/api/admins";
import { phoneSchema } from "@/lib/validations/phone";
import type { Admin } from "@/types/models";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  phone: phoneSchema,
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export function ProfileForm({ admin }: { admin: Admin }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: admin.name, email: admin.email, phone: admin.phone ?? "" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const emailChanged = values.email !== admin.email;
      const updated = await updateOwnProfile({
        name: values.name !== admin.name ? values.name : undefined,
        email: emailChanged ? values.email : undefined,
        phone: values.phone !== admin.phone ? values.phone : undefined,
      });
      toast.success("Profile updated");
      reset({ name: updated.name, email: updated.email, phone: updated.phone ?? "" });
      if (emailChanged) {
        toast.info("Your email changed — please reconnect Google Calendar below.", { duration: 6000 });
        // The Google Calendar card below reads `connected` from the initial
        // server-rendered prop, not from this form's local state — refresh
        // so it picks up the connection this just cleared.
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Changing your email will require you to reconnect Google Calendar.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          <FormField label="Full name" htmlFor="profile-name" error={errors.name?.message} required>
            <Input id="profile-name" {...register("name")} />
          </FormField>
          <FormField label="Email" htmlFor="profile-email" error={errors.email?.message} required>
            <Input id="profile-email" type="email" {...register("email")} />
          </FormField>
          <FormField
            label="Phone number"
            htmlFor="profile-phone"
            error={errors.phone?.message}
            hint="Used for WhatsApp booking notifications."
            required
          >
            <Input id="profile-phone" type="tel" {...register("phone")} />
          </FormField>
        </CardContent>
        <CardFooter>
          <Button type="submit" isLoading={submitting} disabled={!isDirty}>
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
