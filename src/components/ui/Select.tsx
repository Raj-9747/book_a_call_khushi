"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  error?: boolean;
  className?: string;
  placeholder?: string;
}

// A fully custom dropdown — NOT a native <select>. The browser/OS renders a
// native <select>'s open option list itself (no CSS control over it), which
// looks jarringly out-of-place next to the rest of the design system. This
// draws its own portal-rendered listbox instead, styled like everything else.
const MAX_LIST_HEIGHT = 256; // matches the old max-h-64
const VIEWPORT_MARGIN = 8;

interface Position {
  left: number;
  width: number;
  maxHeight: number;
  // Exactly one of these is set — anchoring from the trigger's bottom edge
  // (normal case) or its top edge (flipped, when there's more room above
  // than below, e.g. a select near the bottom of a modal).
  top?: number;
  bottom?: number;
}

export function Select({ value, onChange, options, disabled, error, className, placeholder }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      setOpen(true);
      return;
    }

    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;

    // Only flip upward if there's truly not enough room below AND flipping
    // actually helps — otherwise a select near the top of a short viewport
    // would flip for no gain and just as easily run off the top instead.
    const shouldFlip = spaceBelow < MAX_LIST_HEIGHT && spaceAbove > spaceBelow;

    setPosition(
      shouldFlip
        ? {
            bottom: window.innerHeight - rect.top + 4,
            left: rect.left,
            width: rect.width,
            maxHeight: Math.max(Math.min(spaceAbove, MAX_LIST_HEIGHT), 120),
          }
        : {
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            maxHeight: Math.max(Math.min(spaceBelow, MAX_LIST_HEIGHT), 120),
          }
    );
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleWindowScroll(e: Event) {
      // Scroll events don't bubble but DO fire during the capture phase —
      // ignore scrolls inside our own list (e.g. its own scrollIntoView).
      if (listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleResize() {
      setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleWindowScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleWindowScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-surface px-3 text-sm text-neutral-900",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
          "disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed",
          error ? "border-danger-500" : "border-border-strong"
        )}
      >
        <span className={cn("truncate", !selected && "text-neutral-400")}>{selected?.label ?? placeholder ?? "Select..."}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
      </button>

      {open &&
        position &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={listRef}
            style={{
              position: "fixed",
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            className="z-50 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50",
                  opt.value === value ? "font-medium text-brand-700" : "text-neutral-700"
                )}
              >
                {opt.label}
                {opt.value === value && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
