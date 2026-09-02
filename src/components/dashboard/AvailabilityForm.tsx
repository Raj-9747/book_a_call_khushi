"use client";

import { useState } from "react";
import { Controller, useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, Input, Switch } from "@/components/ui";
import {
  availabilityFormSchema,
  normalizeAvailability,
  WEEKDAYS,
  type AvailabilityFormValues,
  type Weekday,
} from "@/lib/validations/availability";
import { updateAvailability } from "@/lib/api/availability";

const DAY_LABELS: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

function DayRow({
  day,
  control,
  register,
  errors,
}: {
  day: Weekday;
  control: Control<AvailabilityFormValues>;
  register: UseFormRegister<AvailabilityFormValues>;
  errors: FieldErrors<AvailabilityFormValues>;
}) {
  const enabled = useWatch({ control, name: `${day}.enabled` });
  const dayErrors = errors[day];

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-0 sm:flex-nowrap">
      <div className="flex w-32 shrink-0 items-center gap-2.5">
        <Controller
          control={control}
          name={`${day}.enabled`}
          render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label={DAY_LABELS[day]} />}
        />
        <span className="text-sm font-medium text-neutral-700">{DAY_LABELS[day]}</span>
      </div>
      <div className="flex flex-1 items-center gap-2">
        <Input type="time" className="w-32" disabled={!enabled} {...register(`${day}.start`)} />
        <span className="text-sm text-neutral-400">to</span>
        <Input type="time" className="w-32" disabled={!enabled} {...register(`${day}.end`)} />
      </div>
      {dayErrors?.end && <p className="w-full text-xs text-danger-500 sm:w-auto">{dayErrors.end.message}</p>}
    </div>
  );
}

export function AvailabilityForm({
  adminId,
  timezone,
  initialAvailability,
}: {
  adminId: string;
  timezone: string;
  initialAvailability: unknown;
}) {
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilityFormSchema),
    defaultValues: normalizeAvailability(initialAvailability),
  });

  async function onSubmit(values: AvailabilityFormValues) {
    setSubmitting(true);
    try {
      await updateAvailability(adminId, values);
      toast.success("Availability updated");
      reset(values);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update availability");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly availability</CardTitle>
        <CardDescription>
          Times are in your timezone ({timezone}). Clients see slots converted to their own.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-1">
          {WEEKDAYS.map((day) => (
            <DayRow key={day} day={day} control={control} register={register} errors={errors} />
          ))}
        </CardContent>
        <CardFooter>
          <Button type="submit" isLoading={submitting} disabled={!isDirty}>
            Save availability
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
