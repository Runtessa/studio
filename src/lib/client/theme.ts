import { useCallback, useEffect, useState } from "react";

export type IdeTheme = "dark" | "light";

const THEME_STORAGE_KEY = "ashna-cloudway.theme";
const DEFAULT_THEME: IdeTheme = "dark";

const themeColors: Record<IdeTheme, string> = {
  dark: "#121212",
  light: "#F8FAFC",
};

const isIdeTheme = (value: string | null): value is IdeTheme =>
  value === "dark" || value === "light";

export const applyIdeTheme = (theme: IdeTheme) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const metaThemeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  if (metaThemeColor) {
    metaThemeColor.content = themeColors[theme];
  }
};

export const readStoredIdeTheme = (): IdeTheme => {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isIdeTheme(storedTheme) ? storedTheme : DEFAULT_THEME;
};

export const storeIdeTheme = (theme: IdeTheme) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
};

export const useIdeTheme = () => {
  const [theme, setThemeState] = useState<IdeTheme>(DEFAULT_THEME);

  useEffect(() => {
    const storedTheme = readStoredIdeTheme();
    setThemeState(storedTheme);
    applyIdeTheme(storedTheme);
  }, []);

  const setTheme = useCallback((nextTheme: IdeTheme) => {
    setThemeState(nextTheme);
    storeIdeTheme(nextTheme);
    applyIdeTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  return { theme, setTheme, toggleTheme };
};
