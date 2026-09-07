"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "./ThemeProvider";

/** Sits in the app sidebar. Renders as a compact icon button when the
 * sidebar is collapsed, and a full labelled row when it isn't. */
export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const Icon = isDark ? Sun : Moon;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        className="flex w-full items-center justify-center rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-200/60 hover:text-neutral-900"
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
        "text-neutral-600 transition-colors hover:bg-neutral-200/60 hover:text-neutral-900"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1 text-left">{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
