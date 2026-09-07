"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type LucideIcon, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionsMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}

const MENU_WIDTH = 176; // w-44

// Renders the dropdown into a portal (document.body) instead of inline, so it
// can never get clipped by an ancestor's `overflow-hidden` (e.g. a rounded
// table wrapper) — a problem inline absolutely-positioned menus hit on the
// last row of a table.
export function ActionsMenu({ items, disabled }: { items: ActionsMenuItem[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ top: rect.bottom + 4, left: Math.max(8, rect.right - MENU_WIDTH) });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      // Menu items live in a portal, outside the button's DOM subtree — check
      // both refs, otherwise this fires on mousedown before the menu item's
      // own click handler gets a chance to run (the portal unmounts first).
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleClose() {
      setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open &&
        position &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: position.top, left: position.left, width: MENU_WIDTH }}
            className="z-50 rounded-md border border-border bg-surface py-1 shadow-md"
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className={cn(
                    "flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm disabled:opacity-50",
                    item.tone === "danger" ? "text-danger-500 hover:bg-danger-50" : "text-neutral-700 hover:bg-neutral-50"
                  )}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {item.label}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
