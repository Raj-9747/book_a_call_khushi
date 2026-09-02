"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")); // 01..12
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")); // 00..59
const MERIDIEMS = ["AM", "PM"] as const;

function parseValue(value: string) {
  const [hStr, mStr] = value.split(":");
  const h24 = parseInt(hStr, 10) || 0;
  const meridiem = h24 >= 12 ? "PM" : "AM";
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour: String(hour12).padStart(2, "0"), minute: (mStr ?? "00").padStart(2, "0"), meridiem };
}

function toValue(hour12: string, minute: string, meridiem: string) {
  let h = parseInt(hour12, 10) % 12;
  if (meridiem === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function formatDisplay(value: string) {
  const { hour, minute, meridiem } = parseValue(value);
  return `${parseInt(hour, 10)}:${minute} ${meridiem}`;
}

function Column({
  items,
  selected,
  onSelect,
}: {
  items: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Only run once, on mount (i.e. when the popover opens) — not every time
  // `selected` changes, so clicking a value doesn't yank the scroll position.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div className="h-48 w-14 space-y-0.5 overflow-y-auto px-0.5">
      {items.map((item) => (
        <button
          key={item}
          ref={item === selected ? selectedRef : undefined}
          type="button"
          onClick={() => onSelect(item)}
          className={cn(
            "block w-full rounded-md px-2 py-1.5 text-center text-sm transition-colors",
            item === selected ? "bg-brand-600 font-semibold text-white" : "text-neutral-700 hover:bg-neutral-100"
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

// Same three-column hour/minute/AM-PM picker as the native <input
// type="time">'s popup, but fully custom-drawn (portal-rendered, styled with
// the app's own tokens) instead of the browser/OS chrome, which can't be
// restyled with CSS at all.
export function TimeInput({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const { hour, minute, meridiem } = parseValue(value);

  function openPicker() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleWindowScroll(e: Event) {
      // Scroll events don't bubble, but DO fire during the capture phase —
      // without this check, the popover's own columns auto-scrolling
      // themselves into position on open (see Column's scrollIntoView)
      // would immediately close the popover it just opened.
      if (popoverRef.current?.contains(e.target as Node)) return;
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

  function update(part: "hour" | "minute" | "meridiem", val: string) {
    const next = { hour, minute, meridiem, [part]: val };
    onChange(toValue(next.hour, next.minute, next.meridiem));
  }

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-surface px-3 text-sm text-neutral-900",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
          "disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed",
          "border-border-strong"
        )}
      >
        <span>{formatDisplay(value)}</span>
        <Clock className="h-4 w-4 shrink-0 text-neutral-400" />
      </button>

      {open &&
        position &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: "fixed", top: position.top, left: position.left }}
            className="z-50 flex gap-1 rounded-md border border-border bg-surface p-2 shadow-lg"
          >
            <Column items={HOURS} selected={hour} onSelect={(v) => update("hour", v)} />
            <Column items={MINUTES} selected={minute} onSelect={(v) => update("minute", v)} />
            <Column items={MERIDIEMS} selected={meridiem} onSelect={(v) => update("meridiem", v)} />
          </div>,
          document.body
        )}
    </div>
  );
}
