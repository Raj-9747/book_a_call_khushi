"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal, Button, DatePicker, FormField, Input, Switch, TimeInput } from "@/components/ui";
import {
  blockedSlotFormSchema,
  DEFAULT_BLOCKED_SLOT_FORM,
  type BlockedSlotFormValues,
} from "@/lib/validations/blockedSlot";
import { createBlockedSlot } from "@/lib/api/blockedSlots";
import type { BlockedSlot } from "@/types/models";

export function AddBlockModal({
  open,
  adminId,
  onClose,
  onCreated,
}: {
  open: boolean;
  adminId: string;
  onClose: () => void;
  onCreated: (slot: BlockedSlot) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BlockedSlotFormValues>({
    resolver: zodResolver(blockedSlotFormSchema),
    defaultValues: DEFAULT_BLOCKED_SLOT_FORM,
  });

  const allDay = useWatch({ control, name: "allDay" });

  function handleClose() {
    reset(DEFAULT_BLOCKED_SLOT_FORM);
    onClose();
  }

  async function onSubmit(values: BlockedSlotFormValues) {
    setSubmitting(true);
    try {
      const slot = await createBlockedSlot(adminId, values);
      toast.success("Time blocked");
      onCreated(slot);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to block time");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Block time off" description="Clients won't be able to book during this window.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Date" htmlFor="block-date" error={errors.date?.message} required>
          <Controller
            control={control}
            name="date"
            render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
          />
        </FormField>

        <div className="flex items-center gap-2.5">
          <Controller
            control={control}
            name="allDay"
            render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Block the full day" />}
          />
          <span className="text-sm text-neutral-700">Block the full day</span>
        </div>

        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start time" htmlFor="block-start" error={errors.startTime?.message} required>
              <Controller
                control={control}
                name="startTime"
                render={({ field }) => <TimeInput value={field.value} onChange={field.onChange} />}
              />
            </FormField>
            <FormField label="End time" htmlFor="block-end" error={errors.endTime?.message} required>
              <Controller
                control={control}
                name="endTime"
                render={({ field }) => <TimeInput value={field.value} onChange={field.onChange} />}
              />
            </FormField>
          </div>
        )}

        <FormField label="Reason (optional)" htmlFor="block-reason" error={errors.reason?.message}>
          <Input id="block-reason" placeholder="e.g. Vacation, personal time" {...register("reason")} />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting}>
            Block time
          </Button>
        </div>
      </form>
    </Modal>
  );
}
