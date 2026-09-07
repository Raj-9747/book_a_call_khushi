"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isThemedRoute, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

export type { Theme };

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Starts "light" to match what the server rendered; the real preference
  // is read from storage on mount below, so there's no hydration mismatch.
  const [theme, setTheme] = useState<Theme>("light");
  const pathname = usePathname();

  useEffect(() => {
    // Wrapped rather than called straight in the effect body — this
    // project's lint config rejects a bare synchronous setState there
    // (react-hooks/set-state-in-effect).
    function loadStoredTheme() {
      try {
        setTheme(window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light");
      } catch {
        // Storage blocked (private mode) — light is a fine fallback.
      }
    }
    loadStoredTheme();
  }, []);

  // The single place the class is applied. Keyed on the route as well as the
  // preference, so navigating from the dashboard to a public booking page
  // drops dark mode and navigating back restores it.
  useEffect(() => {
    const shouldBeDark = theme === "dark" && isThemedRoute(pathname ?? "");
    document.documentElement.classList.toggle("dark", shouldBeDark);
  }, [theme, pathname]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Preference won't persist, but the toggle still works this session.
      }
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
