"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, FormField, Input } from "@/components/ui";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
type FormValues = z.infer<typeof schema>;

export function ChangePasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Update the password you use to log in to Zaptly.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          <FormField label="New password" htmlFor="new-password" error={errors.password?.message} required>
            <Input id="new-password" type="password" autoComplete="new-password" {...register("password")} />
          </FormField>
          <FormField
            label="Confirm new password"
            htmlFor="confirm-password"
            error={errors.confirmPassword?.message}
            required
          >
            <Input id="confirm-password" type="password" autoComplete="new-password" {...register("confirmPassword")} />
          </FormField>
        </CardContent>
        <CardFooter>
          <Button type="submit" isLoading={submitting}>
            Update password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
