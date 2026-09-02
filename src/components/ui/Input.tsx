import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-md border bg-surface px-3 text-sm text-neutral-900 placeholder:text-neutral-400",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
          "disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed",
          error ? "border-danger-500" : "border-border-strong",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
