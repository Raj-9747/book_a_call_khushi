"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button, DatePicker, FormField, Input, Modal, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createDiscountCode, updateDiscountCode } from "@/lib/api/discounts";
import {
  discountCodeSchema,
  type DiscountCodeFormInput,
  type DiscountCodeFormValues,
} from "@/lib/validations/discountCode";
import type { DiscountCodeWithEvents, EventType } from "@/types/models";

const EMPTY: DiscountCodeFormInput = {
  code: "",
  percent: 10,
  neverExpires: true,
  expiresOn: "",
  unlimitedUses: true,
  maxUses: "",
  appliesToAll: true,
  eventTypeIds: [],
};

export function DiscountFormModal({
  open,
  adminId,
  eventTypes,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  adminId: string;
  eventTypes: EventType[];
  editing: DiscountCodeWithEvents | null;
  onClose: () => void;
  onSaved: (code: DiscountCodeWithEvents) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<DiscountCodeFormInput, unknown, DiscountCodeFormValues>({
    resolver: zodResolver(discountCodeSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? {
            code: editing.code,
            percent: editing.percent,
            neverExpires: editing.expires_at === null,
            expiresOn: editing.expires_at ? editing.expires_at.slice(0, 10) : "",
            unlimitedUses: editing.max_uses === null,
            maxUses: editing.max_uses ? String(editing.max_uses) : "",
            appliesToAll: editing.applies_to_all,
            eventTypeIds: editing.event_type_ids,
          }
        : EMPTY
    );
  }, [open, editing, reset]);

  // `useWatch` rather than `watch()` — the latter returns a fresh function
  // each render, which makes React Compiler skip memoizing this whole
  // component.
  const neverExpires = useWatch({ control, name: "neverExpires" });
  const unlimitedUses = useWatch({ control, name: "unlimitedUses" });
  const appliesToAll = useWatch({ control, name: "appliesToAll" });
  const selectedIds = useWatch({ control, name: "eventTypeIds" }) ?? [];

  async function onSubmit(values: DiscountCodeFormValues) {
    setSubmitting(true);
    try {
      const input = {
        code: values.code,
        percent: values.percent,
        // Expire at the END of the chosen day, in IST — an admin picking
        // "the 20th" means the code works all through the 20th.
        expires_at: values.neverExpires ? null : new Date(`${values.expiresOn}T23:59:59+05:30`).toISOString(),
        max_uses: values.unlimitedUses ? null : Number(values.maxUses),
        applies_to_all: values.appliesToAll,
        event_type_ids: values.appliesToAll ? [] : values.eventTypeIds,
      };
      const saved = editing
        ? await updateDiscountCode(editing.id, input)
        : await createDiscountCode(adminId, input);
      toast.success(editing ? "Discount updated" : "Discount created");
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save discount");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit discount code" : "New discount code"}
      description="Percent off, for the sessions you choose."
      className="max-w-lg"
      dismissible={!isDirty}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Code" htmlFor="discount-code" error={errors.code?.message} required hint="Shown in caps.">
            <Input
              id="discount-code"
              placeholder="SAVE20"
              className="uppercase"
              autoCapitalize="characters"
              {...register("code")}
            />
          </FormField>
          <FormField label="Discount" htmlFor="discount-percent" error={errors.percent?.message} required hint="% off.">
            <Input id="discount-percent" type="number" min={1} max={100} {...register("percent")} />
          </FormField>
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-800">Never expires</span>
            <Controller
              control={control}
              name="neverExpires"
              render={({ field }) => (
                <Switch checked={field.value} onChange={field.onChange} label="Never expires" />
              )}
            />
          </div>
          {!neverExpires && (
            <FormField label="Expires on" error={errors.expiresOn?.message}>
              <Controller
                control={control}
                name="expiresOn"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={field.onChange} minDate={new Date()} />
                )}
              />
            </FormField>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-800">Unlimited uses</span>
            <Controller
              control={control}
              name="unlimitedUses"
              render={({ field }) => (
                <Switch checked={field.value} onChange={field.onChange} label="Unlimited uses" />
              )}
            />
          </div>
          {!unlimitedUses && (
            <FormField
              label="Maximum uses"
              htmlFor="discount-max-uses"
              error={errors.maxUses?.message}
              hint={
                editing && editing.times_used > 0
                  ? `Already used ${editing.times_used} time${editing.times_used === 1 ? "" : "s"}.`
                  : undefined
              }
            >
              <Input id="discount-max-uses" type="number" min={1} {...register("maxUses")} />
            </FormField>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-800">Applies to all my sessions</span>
            <Controller
              control={control}
              name="appliesToAll"
              render={({ field }) => (
                <Switch checked={field.value} onChange={field.onChange} label="Applies to all sessions" />
              )}
            />
          </div>

          {!appliesToAll &&
            (eventTypes.length === 0 ? (
              <p className="text-sm text-neutral-500">You don&apos;t have any event types yet.</p>
            ) : (
              <>
                <div className="max-h-48 space-y-1 overflow-y-auto pt-1">
                  {eventTypes.map((eventType) => {
                    const checked = selectedIds.includes(eventType.id);
                    return (
                      <button
                        key={eventType.id}
                        type="button"
                        onClick={() =>
                          setValue(
                            "eventTypeIds",
                            checked
                              ? selectedIds.filter((id) => id !== eventType.id)
                              : [...selectedIds, eventType.id],
                            { shouldValidate: true }
                          )
                        }
                        role="checkbox"
                        aria-checked={checked}
                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-neutral-50"
                      >
                        {/* The checkbox visual is inline rather than the
                            <Checkbox> component: that renders its own
                            <button>, and a button inside a button is
                            invalid HTML (and breaks click handling). */}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                            checked ? "border-brand-600 bg-brand-600 text-white" : "border-border-strong bg-surface"
                          )}
                        >
                          {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span className="flex-1 truncate text-sm text-neutral-800">{eventType.name}</span>
                        <span className="text-xs text-neutral-400">
                          {eventType.price > 0 ? `₹${eventType.price}` : "Free"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {errors.eventTypeIds && (
                  <p className="text-xs text-danger-500">{errors.eventTypeIds.message}</p>
                )}
              </>
            ))}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting}>
            {editing ? "Save changes" : "Create code"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
