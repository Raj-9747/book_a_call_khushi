"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Button, FormField, Input } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error || !data.user) {
      setSubmitting(false);
      toast.error(error?.message ?? "Invalid email or password");
      return;
    }

    const { data: admin } = await supabase
      .from("admins")
      .select("role, is_active")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    if (!admin) {
      await supabase.auth.signOut();
      setSubmitting(false);
      toast.error("No Zaptly account is linked to this login. Contact your admin.");
      return;
    }

    if (!admin.is_active) {
      await supabase.auth.signOut();
      setSubmitting(false);
      toast.error("Your account has been deactivated. Contact your admin.");
      return;
    }

    const redirectTo = searchParams.get("redirectTo");
    const destination =
      redirectTo && redirectTo !== "/login"
        ? redirectTo
        : admin.role === "super_admin"
          ? "/admin"
          : "/dashboard";

    router.push(destination);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
        <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...register("email")} />
      </FormField>
      <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
        <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...register("password")} />
      </FormField>
      <Button type="submit" className="w-full" isLoading={submitting}>
        Sign in
      </Button>
    </form>
  );
}
