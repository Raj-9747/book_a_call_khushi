import { type TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-24 w-full rounded-md border bg-surface px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400",
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
Textarea.displayName = "Textarea";
