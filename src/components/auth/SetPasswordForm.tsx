"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { setPasswordSchema, type SetPasswordInput } from "@/lib/validations/auth";
import { Button, FormField, Input } from "@/components/ui";

export function SetPasswordForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetPasswordInput>({ resolver: zodResolver(setPasswordSchema) });

  async function onSubmit(values: SetPasswordInput) {
    setSubmitting(true);
    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: admin } = await supabase
      .from("admins")
      .select("role")
      .eq("auth_user_id", user?.id)
      .maybeSingle();

    toast.success("Password set. Welcome to Zaptly!");
    router.push(admin?.role === "super_admin" ? "/admin" : "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField label="New password" htmlFor="password" error={errors.password?.message} required>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
      </FormField>
      <FormField
        label="Confirm password"
        htmlFor="confirmPassword"
        error={errors.confirmPassword?.message}
        required
      >
        <Input id="confirmPassword" type="password" autoComplete="new-password" {...register("confirmPassword")} />
      </FormField>
      <Button type="submit" className="w-full" isLoading={submitting}>
        Set password &amp; continue
      </Button>
    </form>
  );
}
