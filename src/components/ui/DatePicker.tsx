"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  parseISO,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// A fully custom calendar popover — not the native <input type="date">,
// whose picker is OS/browser chrome that can't be restyled with CSS at all.
export function DatePicker({
  value,
  onChange,
  disabled,
  className,
  minDate,
}: {
  value: string; // "yyyy-MM-dd"
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  minDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => (value ? parseISO(value) : new Date()));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const selectedDate = value ? parseISO(value) : null;
  const today = startOfDay(new Date());

  function openPicker() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.left });
    setVisibleMonth(selectedDate ?? new Date());
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

  const gridStart = startOfWeek(startOfMonth(visibleMonth));
  const gridEnd = endOfWeek(endOfMonth(visibleMonth));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function handleSelect(day: Date) {
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
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
        <span className={cn(!selectedDate && "text-neutral-400")}>
          {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Select a date"}
        </span>
        <Calendar className="h-4 w-4 shrink-0 text-neutral-400" />
      </button>

      {open &&
        position &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: "fixed", top: position.top, left: position.left }}
            className="z-50 w-64 rounded-md border border-border bg-surface p-3 shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-neutral-900">{format(visibleMonth, "MMMM yyyy")}</span>
              <button
                type="button"
                onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center">
              {WEEKDAY_LABELS.map((label, i) => (
                <span key={i} className="py-1 text-xs font-medium text-neutral-400">
                  {label}
                </span>
              ))}
              {days.map((day) => {
                const inMonth = isSameMonth(day, visibleMonth);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isPast = minDate ? isBefore(day, minDate) : isBefore(day, today);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={isPast}
                    onClick={() => handleSelect(day)}
                    className={cn(
                      "rounded-md py-1.5 text-sm transition-colors",
                      !inMonth && "text-neutral-300",
                      inMonth && !isPast && !isSelected && "text-neutral-700 hover:bg-neutral-100",
                      isPast && "cursor-not-allowed text-neutral-300",
                      isSelected && "bg-brand-600 font-semibold text-white"
                    )}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
