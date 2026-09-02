"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { bookingDetailsSchema, type BookingDetailsValues } from "@/lib/validations/publicBooking";
import type { PublicEventType } from "@/lib/api/publicBooking";

export function BookingDetailsForm({
  eventType,
  submitLabel,
  onSubmit,
}: {
  eventType: PublicEventType;
  submitLabel: string;
  onSubmit: (details: BookingDetailsValues, customAnswers: Record<string, string>) => void;
}) {
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingDetailsValues>({ resolver: zodResolver(bookingDetailsSchema) });

  function handleFormSubmit(values: BookingDetailsValues) {
    const nextErrors: Record<string, string> = {};
    for (const q of eventType.custom_questions) {
      if (q.required && !customAnswers[q.id]?.trim()) {
        nextErrors[q.id] = "This is required";
      }
    }
    setCustomErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(values, customAnswers);
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
      <FormField label="Full name" htmlFor="client-name" error={errors.name?.message} required>
        <Input id="client-name" {...register("name")} />
      </FormField>
      <FormField label="Email" htmlFor="client-email" error={errors.email?.message} required>
        <Input id="client-email" type="email" {...register("email")} />
      </FormField>
      <FormField label="Phone" htmlFor="client-phone" error={errors.phone?.message} required>
        <Input id="client-phone" type="tel" {...register("phone")} />
      </FormField>

      {eventType.custom_questions.map((q) => (
        <FormField key={q.id} label={q.label} htmlFor={`q-${q.id}`} error={customErrors[q.id]} required={q.required}>
          {q.type === "textarea" ? (
            <Textarea
              id={`q-${q.id}`}
              value={customAnswers[q.id] ?? ""}
              onChange={(e) => setCustomAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
            />
          ) : q.type === "select" ? (
            <Select
              value={customAnswers[q.id] ?? ""}
              onChange={(value) => setCustomAnswers((prev) => ({ ...prev, [q.id]: value }))}
              options={(q.options ?? []).map((opt) => ({ value: opt, label: opt }))}
              placeholder="Select an option"
            />
          ) : (
            <Input
              id={`q-${q.id}`}
              value={customAnswers[q.id] ?? ""}
              onChange={(e) => setCustomAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
            />
          )}
        </FormField>
      ))}

      <Button type="submit" className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
