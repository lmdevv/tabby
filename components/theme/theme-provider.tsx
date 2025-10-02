import { useEffect } from "react";
import { useAppState, useUpdateState } from "@/hooks/use-state";
import type { Theme } from "@/lib/types";

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Use the state management system for theme
  const { data: theme } = useAppState("theme");

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme as Theme);
  }, [theme]);

  return <div {...props}>{children}</div>;
}

export const useTheme = () => {
  const { data: theme } = useAppState("theme");
  const { updateState } = useUpdateState();

  const setTheme = (newTheme: Theme) => {
    updateState("theme", newTheme);
  };

  return {
    theme: theme as Theme,
    setTheme,
  };
};
