"use client";

import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal, Button, Checkbox, FormField, Input, Textarea, Select } from "@/components/ui";
import { eventTypeFormSchema, type EventTypeFormInput, type EventTypeFormValues } from "@/lib/validations/eventType";
import { createEventType, updateEventType } from "@/lib/api/eventTypes";
import type { EventType } from "@/types/models";

function emptyQuestion() {
  return {
    id: crypto.randomUUID(),
    label: "",
    type: "text" as const,
    required: false,
    optionsText: "",
  };
}

function toFormValues(eventType: EventType | null): EventTypeFormInput {
  if (!eventType) {
    return { name: "", duration_minutes: 30, price: 0, description: "", custom_questions: [] };
  }
  return {
    name: eventType.name,
    duration_minutes: eventType.duration_minutes,
    price: eventType.price,
    description: eventType.description ?? "",
    custom_questions: eventType.custom_questions.map((q) => ({
      id: q.id,
      label: q.label,
      type: q.type,
      required: q.required,
      optionsText: (q.options ?? []).join(", "),
    })),
  };
}

function QuestionRow({
  index,
  control,
  register,
  errors,
  onRemove,
}: {
  index: number;
  control: Control<EventTypeFormInput>;
  register: UseFormRegister<EventTypeFormInput>;
  errors: FieldErrors<EventTypeFormInput>;
  onRemove: () => void;
}) {
  const type = useWatch({ control, name: `custom_questions.${index}.type` });
  const questionErrors = errors.custom_questions?.[index];

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <Input placeholder="Question text" error={!!questionErrors?.label} {...register(`custom_questions.${index}.label` as const)} />
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name={`custom_questions.${index}.type` as const}
              render={({ field }) => (
                <Select
                  className="w-36"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: "text", label: "Short text" },
                    { value: "textarea", label: "Long text" },
                    { value: "select", label: "Dropdown" },
                  ]}
                />
              )}
            />
            <Controller
              control={control}
              name={`custom_questions.${index}.required` as const}
              render={({ field }) => <Checkbox checked={field.value} onChange={field.onChange} label="Required" />}
            />
          </div>
          {type === "select" && (
            <FormField
              error={questionErrors?.optionsText?.message}
              hint={!questionErrors?.optionsText ? "Comma-separated options" : undefined}
            >
              <Input placeholder="Option A, Option B, Option C" {...register(`custom_questions.${index}.optionsText` as const)} />
            </FormField>
          )}
          {questionErrors?.label && <p className="text-xs text-danger-500">{questionErrors.label.message}</p>}
        </div>
        <button type="button" onClick={onRemove} className="rounded-md p-1.5 text-neutral-400 hover:bg-danger-50 hover:text-danger-500">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function EventTypeFormModal({
  open,
  adminId,
  eventType,
  onClose,
  onSaved,
}: {
  open: boolean;
  adminId: string;
  eventType: EventType | null;
  onClose: () => void;
  onSaved: (eventType: EventType) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!eventType;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EventTypeFormInput, unknown, EventTypeFormValues>({
    resolver: zodResolver(eventTypeFormSchema),
    defaultValues: toFormValues(eventType),
  });

  const { fields, append, remove } = useFieldArray({ control, name: "custom_questions" });

  useEffect(() => {
    if (open) reset(toFormValues(eventType));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventType]);

  async function onSubmit(values: EventTypeFormValues) {
    setSubmitting(true);
    try {
      const saved = isEdit
        ? await updateEventType(eventType!.id, values)
        : await createEventType(adminId, values);
      toast.success(isEdit ? "Event type updated" : "Event type created");
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save event type");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit event type" : "New event type"}
      description={isEdit ? undefined : "Clients will pick this when booking a call with you."}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <FormField label="Name" htmlFor="name" error={errors.name?.message} required>
            <Input id="name" placeholder="30 Minute Discovery Call" {...register("name")} />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Duration (minutes)" htmlFor="duration" error={errors.duration_minutes?.message} required>
              <Input id="duration" type="number" min={5} max={480} step={5} {...register("duration_minutes")} />
            </FormField>
            <FormField label="Price (₹, 0 = Free)" htmlFor="price" error={errors.price?.message} required>
              <Input id="price" type="number" min={0} step="0.01" {...register("price")} />
            </FormField>
          </div>

          <FormField
            label="Description"
            htmlFor="description"
            error={errors.description?.message}
            hint="Shown to clients on the booking page."
          >
            <Textarea id="description" rows={3} placeholder="What this call is about..." {...register("description")} />
          </FormField>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-neutral-700">Custom questions</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={fields.length >= 10}
                onClick={() => append(emptyQuestion())}
              >
                <Plus className="h-3.5 w-3.5" /> Add question
              </Button>
            </div>

            {fields.length === 0 && (
              <p className="rounded-md border border-dashed border-border-strong px-3 py-4 text-center text-sm text-neutral-400">
                No custom questions — clients will just give their name, email, and phone.
              </p>
            )}

            <div className="space-y-3">
              {fields.map((field, index) => (
                <QuestionRow
                  key={field.id}
                  index={index}
                  control={control}
                  register={register}
                  errors={errors}
                  onRemove={() => remove(index)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting}>
            {isEdit ? "Save changes" : "Create event type"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
