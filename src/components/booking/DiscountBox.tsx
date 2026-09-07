"use client";

import { useState } from "react";
import { Tag, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { validateDiscountCode } from "@/lib/api/publicBooking";

export interface AppliedDiscount {
  code: string;
  percent: number;
}

/** Collapsed by default — a visible empty coupon field makes every client
 * feel they're missing a deal. Clicking the link reveals the input. */
export function DiscountBox({
  adminSlug,
  eventSlug,
  applied,
  onApply,
  onRemove,
}: {
  adminSlug: string;
  eventSlug: string;
  applied: AppliedDiscount | null;
  onApply: (discount: AppliedDiscount) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    const trimmed = code.trim();
    if (!trimmed) return;

    setChecking(true);
    setError(null);
    try {
      const result = await validateDiscountCode(adminSlug, eventSlug, trimmed);
      if (result.valid && result.percent !== null) {
        onApply({ code: trimmed.toUpperCase(), percent: result.percent });
        setCode("");
        setOpen(false);
      } else {
        setError(result.reason ?? "That code isn't valid for this session.");
      }
    } catch {
      setError("Couldn't check that code. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-success-200 bg-success-50 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Tag className="h-4 w-4 shrink-0 text-success-600" />
          <p className="truncate text-sm text-success-700">
            <span className="font-semibold">{applied.code}</span> applied — {applied.percent}% off
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove discount code"
          className="shrink-0 rounded p-1 text-success-700 transition-colors hover:bg-success-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
      >
        <Tag className="h-3.5 w-3.5" />
        Have a discount code?
      </button>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleApply();
            }
          }}
          placeholder="Enter code"
          className="uppercase"
          autoCapitalize="characters"
          autoFocus
          aria-label="Discount code"
        />
        <Button type="button" variant="outline" isLoading={checking} disabled={!code.trim()} onClick={handleApply}>
          Apply
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-danger-500">{error}</p>}
    </div>
  );
}
