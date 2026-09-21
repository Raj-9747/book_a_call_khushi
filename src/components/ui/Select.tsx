"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
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
  /** Force the type-to-filter box on or off. Left unset, it appears once
   * the list is long enough to be annoying to scroll. */
  searchable?: boolean;
}

// A fully custom dropdown — NOT a native <select>. The browser/OS renders a
// native <select>'s open option list itself (no CSS control over it), which
// looks jarringly out-of-place next to the rest of the design system. This
// draws its own portal-rendered listbox instead, styled like everything else.

// Roughly 4 rows. Kept deliberately short so the list usually fits BELOW the
// trigger — a tall list inside a modal was flipping upward to find room,
// which reads as the menu opening in the wrong direction.
const MAX_OPTIONS_HEIGHT = 168;
const SEARCH_ROW_HEIGHT = 44;
const VIEWPORT_MARGIN = 8;
// Below this, scrolling is quicker than typing and a search box is clutter.
const SEARCHABLE_THRESHOLD = 8;

interface Position {
  left: number;
  width: number;
  maxHeight: number;
  // Exactly one of these is set — anchoring from the trigger's bottom edge
  // (normal case) or its top edge (flipped, only when there's genuinely no
  // room below).
  top?: number;
  bottom?: number;
}

export function Select({
  value,
  onChange,
  options,
  disabled,
  error,
  className,
  placeholder,
  searchable,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showSearch = searchable ?? options.length >= SEARCHABLE_THRESHOLD;
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query]);

  /** Where the list goes, measured from the trigger and the *visible* area.
   * Pulled out of openMenu so it can be re-run when the on-screen keyboard
   * changes how much of the screen is actually visible — otherwise the list
   * ends up hidden behind the keyboard. */
  function computePosition(): Position | null {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;

    // visualViewport is the part of the page actually visible, which shrinks
    // when a phone keyboard opens (iOS leaves innerHeight alone and overlays
    // the keyboard). Fall back to the layout viewport where it's missing.
    const vv = window.visualViewport;
    const visibleTop = vv ? vv.offsetTop : 0;
    const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;

    const wanted = MAX_OPTIONS_HEIGHT + (showSearch ? SEARCH_ROW_HEIGHT : 0);
    const spaceBelow = visibleBottom - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - visibleTop - VIEWPORT_MARGIN;

    // Prefer opening downward. Only flip when there genuinely isn't room
    // below and flipping actually buys space — a short list plus this rule
    // means flipping is now rare rather than the default in a modal.
    const shouldFlip = spaceBelow < Math.min(wanted, 160) && spaceAbove > spaceBelow;

    return shouldFlip
      ? {
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
          width: rect.width,
          maxHeight: Math.max(Math.min(spaceAbove, wanted), 140),
        }
      : {
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
          maxHeight: Math.max(Math.min(spaceBelow, wanted), 140),
        };
  }

  function openMenu() {
    setPosition(computePosition());
    setQuery("");
    setOpen(true);
  }

  // Focus the filter box on open so you can just start typing — but only with
  // a physical keyboard. On a touch device focusing an input pops the
  // on-screen keyboard, which was covering half the screen (and, before the
  // handlers below learned to cope, closing the list) every time someone
  // opened a short dropdown just to pick from it. They can still tap the
  // search box if they do want to filter.
  useEffect(() => {
    if (!open || !showSearch) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    function focusSearch() {
      searchRef.current?.focus();
    }
    focusSearch();
  }, [open, showSearch]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    }
    // With the search box focused, a resize or scroll is the on-screen keyboard
    // opening (the browser resizes the view and scrolls the field into sight)
    // — not the user leaving. Closing here is what made the dropdown vanish
    // the instant the keyboard appeared; instead, keep it and move it so it
    // still sits in the part of the screen that's actually visible.
    function searchHasFocus() {
      return !!listRef.current?.contains(document.activeElement);
    }
    function reposition() {
      const next = computePosition();
      if (next) setPosition(next);
    }
    function handleWindowScroll(e: Event) {
      // Scroll events don't bubble but DO fire during the capture phase —
      // ignore scrolls inside our own list (e.g. its own scrollIntoView).
      if (listRef.current?.contains(e.target as Node)) return;
      if (searchHasFocus()) {
        reposition();
        return;
      }
      setOpen(false);
    }
    function handleResize() {
      if (searchHasFocus()) {
        reposition();
        return;
      }
      setOpen(false);
    }
    // iOS overlays the keyboard without resizing the window, so it only shows
    // up here.
    function handleViewportResize() {
      if (searchHasFocus()) reposition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleWindowScroll, true);
    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleViewportResize);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleWindowScroll, true);
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleViewportResize);
    };
    // computePosition only reads refs and props that can't change while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function choose(optionValue: string) {
    onChange(optionValue);
    setOpen(false);
    setQuery("");
  }

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
        <span className={cn("truncate", !selected && "text-neutral-400")}>
          {selected?.label ?? placeholder ?? "Select..."}
        </span>
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
            className="z-50 flex flex-col overflow-hidden rounded-md border border-border bg-surface shadow-lg"
          >
            {showSearch && (
              <div className="relative shrink-0 border-b border-border p-1.5">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter picks the first match, so a full keyboard flow
                    // works: open, type a few letters, press Enter.
                    if (e.key === "Enter" && filtered[0]) {
                      e.preventDefault();
                      choose(filtered[0].value);
                    }
                    if (e.key === "Escape") setOpen(false);
                  }}
                  placeholder="Type to search…"
                  className="w-full rounded bg-transparent py-1.5 pl-7 pr-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
                />
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-sm text-neutral-400">No matches</p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => choose(opt.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50",
                      opt.value === value ? "font-medium text-brand-700" : "text-neutral-700"
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {opt.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
