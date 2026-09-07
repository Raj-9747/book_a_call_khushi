"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import {
  bookingDetailsSchema,
  type BookingDetailsInput,
  type BookingDetailsValues,
} from "@/lib/validations/publicBooking";
import { COUNTRY_CODE_OPTIONS, DEFAULT_COUNTRY_CODE } from "@/lib/validations/countryCodes";
import type { PublicEventType } from "@/lib/api/publicBooking";

/** Sentinel for the always-present "Other" choice on dropdown questions.
 * Deliberately not a plausible real option, so it can't collide with one an
 * admin actually configured. It never reaches the database — picking it
 * swaps in a free-text box and the typed value is what gets submitted. */
const OTHER_VALUE = "__other__";

export function BookingDetailsForm({
  eventType,
  submitLabel,
  defaultValues,
  defaultCustomAnswers,
  onSubmit,
}: {
  eventType: PublicEventType;
  submitLabel: string;
  /** Re-populates the form when the client comes back to edit details —
   * e.g. from the payment step's "Back to your details" — instead of
   * making them retype everything from a blank form. */
  defaultValues?: BookingDetailsValues;
  defaultCustomAnswers?: Record<string, string>;
  onSubmit: (details: BookingDetailsValues, customAnswers: Record<string, string>) => void;
}) {
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>(defaultCustomAnswers ?? {});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});

  // Which dropdown questions the client has switched to "Other". Tracked
  // separately from the answer itself so the answer stays the free text
  // they typed — the admin should see "Fintech", not a literal "Other".
  const [otherMode, setOtherMode] = useState<Record<string, boolean>>(() => {
    // Coming back from the payment step: an existing answer that isn't one
    // of the listed options must have been an "Other" one.
    const initial: Record<string, boolean> = {};
    for (const q of eventType.custom_questions) {
      const existing = defaultCustomAnswers?.[q.id];
      if (q.type === "select" && existing && !(q.options ?? []).includes(existing)) {
        initial[q.id] = true;
      }
    }
    return initial;
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingDetailsInput, unknown, BookingDetailsValues>({
    resolver: zodResolver(bookingDetailsSchema),
    defaultValues: defaultValues ?? { countryCode: DEFAULT_COUNTRY_CODE },
  });

  function handleFormSubmit(values: BookingDetailsValues) {
    const nextErrors: Record<string, string> = {};
    for (const q of eventType.custom_questions) {
      const answer = customAnswers[q.id]?.trim();
      if (q.required && !answer) {
        nextErrors[q.id] = "This is required";
      } else if (otherMode[q.id] && !answer) {
        // Picked "Other" but left the box empty — invalid whether or not
        // the question itself was required, since they did start answering.
        nextErrors[q.id] = "Please type your answer";
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
      <FormField
        label="Phone"
        htmlFor="client-phone"
        error={errors.phone?.message ?? errors.countryCode?.message}
        required
      >
        <div className="flex gap-2">
          <Controller
            control={control}
            name="countryCode"
            render={({ field }) => (
              <Select
                className="w-40 shrink-0"
                value={field.value ?? DEFAULT_COUNTRY_CODE}
                onChange={field.onChange}
                options={COUNTRY_CODE_OPTIONS}
              />
            )}
          />
          <Input
            id="client-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="Phone number"
            error={!!errors.phone}
            {...register("phone")}
          />
        </div>
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
            <div className="space-y-2">
              <Select
                // "Other" is always appended, so a client whose answer isn't
                // on the admin's list isn't forced into a wrong one.
                value={otherMode[q.id] ? OTHER_VALUE : customAnswers[q.id] ?? ""}
                onChange={(value) => {
                  const choseOther = value === OTHER_VALUE;
                  setOtherMode((prev) => ({ ...prev, [q.id]: choseOther }));
                  // Clear the answer when switching into "Other" so the
                  // previous pick isn't submitted as the typed value.
                  setCustomAnswers((prev) => ({ ...prev, [q.id]: choseOther ? "" : value }));
                }}
                options={[
                  ...(q.options ?? []).map((opt) => ({ value: opt, label: opt })),
                  { value: OTHER_VALUE, label: "Other" },
                ]}
                placeholder="Select an option"
              />
              {otherMode[q.id] && (
                <Input
                  aria-label={`${q.label} — other`}
                  placeholder="Type your answer"
                  value={customAnswers[q.id] ?? ""}
                  onChange={(e) => setCustomAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                />
              )}
            </div>
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
