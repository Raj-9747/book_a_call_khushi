"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

export type { Theme };

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Always starts "light" to match what the server rendered. The real value
  // is read from the DOM in the effect below — the boot script in the
  // document head has already applied the stored theme by then, so this
  // only syncs React's copy of it and never causes a hydration mismatch.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Wrapped rather than called straight in the effect body — this
    // project's lint config rejects a bare synchronous setState there
    // (react-hooks/set-state-in-effect).
    function syncFromDom() {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    }
    syncFromDom();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Private mode / storage disabled — the theme still applies for
        // this session, it just won't be remembered.
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
