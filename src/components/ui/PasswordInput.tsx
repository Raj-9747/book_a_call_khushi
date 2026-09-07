"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./Input";
import { cn } from "@/lib/utils";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: boolean;
}

/** Password field with a show/hide toggle. Forwards its ref so
 * react-hook-form's `register()` spread works exactly as it does on a plain
 * `<Input>`. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, error, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          error={error}
          // Room for the toggle button so long values never run under it.
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          // Not focusable: the toggle is a convenience, and keeping it out
          // of the tab order means Tab still goes straight from the password
          // field to the submit button.
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-r-md text-neutral-400 transition-colors hover:text-neutral-700"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
