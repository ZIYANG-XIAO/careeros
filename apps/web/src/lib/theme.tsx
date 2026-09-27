"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark" | "system";

type ThemeValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const defaultValue: ThemeValue = {
  theme: "system",
  setTheme: () => undefined,
};

const ThemeContext = createContext<ThemeValue>(defaultValue);
const STORAGE_KEY = "careeros.theme";
const COOKIE_KEY = "careeros_theme";

export function ThemeProvider({
  children,
  initialTheme = "system",
}: {
  children: ReactNode;
  initialTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  function setTheme(next: Theme) {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `${COOKIE_KEY}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    if (next === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", next);
    }
  }

  const value = useMemo<ThemeValue>(() => ({ theme, setTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
