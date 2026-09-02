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
export function Select({ value, onChange, options, disabled, error, className, placeholder }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
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
            style={{ position: "fixed", top: position.top, left: position.left, width: position.width }}
            className="z-50 max-h-64 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
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
