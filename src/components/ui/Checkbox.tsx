"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Custom-styled checkbox (button + icon) instead of a native <input
// type="checkbox">, so it matches the design system instead of the
// browser/OS default appearance.
export function Checkbox({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  const button = (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-brand-600 bg-brand-600 text-white" : "border-border-strong bg-surface"
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );

  if (!label) return button;

  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-500">
      {button}
      {label}
    </label>
  );
}
