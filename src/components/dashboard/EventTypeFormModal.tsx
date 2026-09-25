"use client";

import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal, Button, Checkbox, FormField, Input, Textarea, Select, Switch } from "@/components/ui";
import { eventTypeFormSchema, type EventTypeFormInput, type EventTypeFormValues } from "@/lib/validations/eventType";
import { createEventType, updateEventType } from "@/lib/api/eventTypes";
import type { CustomQuestion, EventType } from "@/types/models";

const MAX_QUESTIONS = 10;

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
    return { name: "", duration_minutes: 30, price: 0, description: "", record_meeting: false, custom_questions: [] };
  }
  return {
    name: eventType.name,
    duration_minutes: eventType.duration_minutes,
    price: eventType.price,
    description: eventType.description ?? "",
    record_meeting: eventType.record_meeting,
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
  otherEventTypes = [],
  onClose,
  onSaved,
}: {
  open: boolean;
  adminId: string;
  eventType: EventType | null;
  /** The admin's other events — the source list for "Import questions". */
  otherEventTypes?: EventType[];
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
    formState: { errors, isDirty },
  } = useForm<EventTypeFormInput, unknown, EventTypeFormValues>({
    resolver: zodResolver(eventTypeFormSchema),
    defaultValues: toFormValues(eventType),
  });

  const { fields, append, remove } = useFieldArray({ control, name: "custom_questions" });
  const [importOpen, setImportOpen] = useState(false);
  // Keyed `${eventId}:${questionId}` so the same question id in two events
  // (after an earlier import) can't be ticked as one.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const currentLabels = useWatch({ control, name: "custom_questions" });

  const importable = otherEventTypes.filter((et) => et.id !== eventType?.id && et.custom_questions.length > 0);
  const takenLabels = new Set((currentLabels ?? []).map((q) => (q?.label ?? "").trim().toLowerCase()));
  const room = MAX_QUESTIONS - fields.length;

  function togglePick(key: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function importPicked() {
    const chosen: CustomQuestion[] = [];
    for (const et of importable) {
      for (const q of et.custom_questions) {
        if (picked.has(`${et.id}:${q.id}`)) chosen.push(q);
      }
    }
    const toAdd = chosen.slice(0, room);
    for (const q of toAdd) {
      // Fresh id: the copy must be independent of the source question, so
      // editing one event's answers never touches the other's.
      append({ id: crypto.randomUUID(), label: q.label, type: q.type, required: q.required, optionsText: (q.options ?? []).join(", ") });
    }
    if (chosen.length > toAdd.length) toast.info(`Only ${MAX_QUESTIONS} questions fit — imported ${toAdd.length}.`);
    else toast.success(`Imported ${toAdd.length} question${toAdd.length === 1 ? "" : "s"}`);
    setPicked(new Set());
    setImportOpen(false);
  }

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
      dismissible={!isDirty}
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

          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-800">Record & summarise this meeting</span>
              <Controller
                control={control}
                name="record_meeting"
                render={({ field }) => (
                  <Switch checked={field.value} onChange={field.onChange} label="Record and summarise this meeting" />
                )}
              />
            </div>
            <p className="text-xs text-neutral-500">
              A Fireflies bot joins the call and sends both sides the notes afterwards. The client sees this on the
              booking page before they book. Off by default.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-neutral-700">Custom questions</p>
              <div className="flex gap-2">
                {importable.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={room <= 0}
                    onClick={() => setImportOpen((v) => !v)}
                  >
                    <Download className="h-3.5 w-3.5" /> Import
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={fields.length >= MAX_QUESTIONS}
                  onClick={() => append(emptyQuestion())}
                >
                  <Plus className="h-3.5 w-3.5" /> Add question
                </Button>
              </div>
            </div>

            {importOpen && (
              <div className="mb-3 space-y-3 rounded-lg border border-border bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">
                  Tick the questions to copy into this event. Copies are independent, and ones you already have are
                  skipped. {room} slot{room === 1 ? "" : "s"} left.
                </p>
                <div className="max-h-56 space-y-3 overflow-y-auto">
                  {importable.map((et) => (
                    <div key={et.id}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{et.name}</p>
                      <div className="space-y-1.5">
                        {et.custom_questions.map((q) => {
                          const dup = takenLabels.has(q.label.trim().toLowerCase());
                          const key = `${et.id}:${q.id}`;
                          return (
                            <div key={q.id} className={dup ? "flex items-center gap-2 opacity-50" : "flex items-center gap-2"}>
                              <Checkbox checked={picked.has(key)} disabled={dup} onChange={() => togglePick(key)} label={q.label} />
                              <span className="text-xs text-neutral-400">
                                {q.type}
                                {q.required ? " · required" : ""}
                                {dup ? " · already added" : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImportOpen(false)}>
                    Close
                  </Button>
                  <Button type="button" size="sm" disabled={picked.size === 0} onClick={importPicked}>
                    Import {picked.size || ""}
                  </Button>
                </div>
              </div>
            )}

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
