"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "theme";
const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

// A minimal external store around localStorage/the <html data-theme> DOM
// attribute. Modeled with useSyncExternalStore (not useState+useEffect) so
// React handles the server/client snapshot mismatch itself: SSR and the
// first client render both use `getServerSnapshot` ("system"), then React
// re-renders once, right after hydration, with the real stored value —
// this is the documented, hydration-safe way to read an external, SSR-
// unavailable source like localStorage. See
// https://react.dev/reference/react/useSyncExternalStore#im-getting-an-error-the-server-rendered-content-didnt-match-the-client
const listeners = new Set<() => void>();

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getServerSnapshot(): Theme {
  return "system";
}

function selectTheme(theme: Theme) {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
    localStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
  listeners.forEach((listener) => listener());
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, getServerSnapshot);

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme selection">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="theme-toggle-option"
          data-active={theme === option.value}
          role="radio"
          aria-checked={theme === option.value}
          onClick={() => selectTheme(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
