"use client";

import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Whether a backdrop click or Escape closes the dialog.
   *
   * Set this to false while a form has unsaved input: a stray click just
   * outside a modal used to wipe everything typed into it, with no undo and
   * no warning. The X and Cancel buttons always work regardless, so the
   * dialog is never a trap — it just stops losing work to a misclick. */
  dismissible?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, dismissible]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          // Capped to the screen and laid out as header + scrolling body.
          // Without this a dialog taller than the viewport (a slot grid plus
          // a textarea plus a Send button on a phone) simply ran off both
          // edges of the screen, and since the page behind is scroll-locked
          // there was no way to reach the button. `dvh` tracks the *visible*
          // viewport (mobile browser toolbars, in-app browsers like
          // WhatsApp's); plain `vh` is the fallback for engines without it.
          "relative flex w-full max-w-md flex-col rounded-xl border border-border bg-surface shadow-lg",
          "max-h-[calc(100vh-2rem)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)]",
          className
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* min-h-0 lets this flex child actually shrink below its content
            height; overscroll-contain stops a scroll that reaches the end
            of the dialog from chaining to the (locked) page behind. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
