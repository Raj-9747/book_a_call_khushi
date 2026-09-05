"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Themed stand-in for `window.confirm` — the browser's native dialog can't
 * be restyled at all and breaks the "no default browser/OS UI" rule, plus
 * it blocks the whole tab synchronously rather than fitting this app's
 * async, portal-based modal pattern.
 *
 * Wrap the app once with `<ConfirmProvider>`, then call the `useConfirm()`
 * hook anywhere below it — it resolves to a boolean exactly like
 * `window.confirm` did, so existing `if (!(await confirm(...))) return;`
 * call sites port over with only an `await` added. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((input) => {
    const normalized = typeof input === "string" ? { description: input } : input;
    setOptions(normalized);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function settle(value: boolean) {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOptions(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!options} onClose={() => settle(false)} title={options?.title ?? "Are you sure?"}>
        <div className="flex gap-3">
          {options?.tone === "danger" && (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-500" aria-hidden="true" />
          )}
          <p className="text-sm text-neutral-600">{options?.description}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => settle(false)}>
            {options?.cancelLabel ?? "Cancel"}
          </Button>
          <Button variant={options?.tone === "danger" ? "danger" : "primary"} onClick={() => settle(true)}>
            {options?.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

/** Returns an async confirm function, resolving `true`/`false` the same way
 * `window.confirm` did. Must be called below `<ConfirmProvider>`. */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return confirm;
}
