"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarOff, CheckCircle2 } from "lucide-react";
import { Button, FormField, Input, Textarea } from "@/components/ui";
import { createBookingEnquiry } from "@/lib/api/publicBooking";
import { phoneSchema } from "@/lib/validations/phone";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name"),
  email: z.string().trim().min(1, "Please enter your email").email("Enter a valid email address"),
  phone: phoneSchema.or(z.literal("")),
  message: z.string().trim().max(600, "Keep it under 600 characters"),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const DEFAULT_MESSAGE = "isn't taking bookings right now.";

/** Shown in place of the slot picker when an admin has paused bookings.
 * Collects just enough to follow up later — these land in the admin's
 * Enquiries list, not in their calendar. */
export function EnquiryForm({
  adminSlug,
  adminName,
  eventSlug,
  unavailableMessage,
}: {
  adminSlug: string;
  adminName: string;
  eventSlug?: string | null;
  unavailableMessage?: string | null;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", message: "" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setServerError(null);
    try {
      await createBookingEnquiry({
        adminSlug,
        eventSlug: eventSlug ?? null,
        name: values.name,
        email: values.email,
        phone: values.phone || null,
        message: values.message || null,
      });
      setSubmitted(true);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success-600" />
        <h2 className="mt-3 text-base font-semibold text-neutral-900">Thanks — we&apos;ve got your details</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {adminName} will reach out to you directly once they&apos;re taking bookings again.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
        <CalendarOff className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" />
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Currently unavailable</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {unavailableMessage?.trim() || `${adminName} ${DEFAULT_MESSAGE}`} Leave your details and they&apos;ll get
            back to you.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 px-5 py-5 sm:px-6">
        <FormField label="Your name" htmlFor="enquiry-name" error={errors.name?.message} required>
          <Input id="enquiry-name" autoComplete="name" {...register("name")} />
        </FormField>
        <FormField label="Email" htmlFor="enquiry-email" error={errors.email?.message} required>
          <Input id="enquiry-email" type="email" autoComplete="email" {...register("email")} />
        </FormField>
        <FormField label="Phone" htmlFor="enquiry-phone" error={errors.phone?.message} hint="Optional.">
          <Input id="enquiry-phone" type="tel" autoComplete="tel" {...register("phone")} />
        </FormField>
        <FormField label="Message" htmlFor="enquiry-message" error={errors.message?.message} hint="Optional.">
          <Textarea id="enquiry-message" rows={3} placeholder="What would you like to talk about?" {...register("message")} />
        </FormField>

        {serverError && <p className="text-sm text-danger-500">{serverError}</p>}

        <Button type="submit" className="w-full" isLoading={submitting}>
          Send details
        </Button>
      </form>
    </div>
  );
}
