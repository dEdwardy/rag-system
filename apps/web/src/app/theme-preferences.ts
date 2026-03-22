import { createContext, createElement, useContext, useEffect, useState } from "react";

export type ThemeColorMode = "constrained-light" | "creative-dark";
export type ThemeLayoutMode = "default-app" | "workspace-app";

export type ThemePreferences = {
  themeColor: ThemeColorMode;
  themeLayout: ThemeLayoutMode;
};

export const THEME_COLOR_STORAGE_KEY = "rag-system-theme-color";
export const THEME_LAYOUT_STORAGE_KEY = "rag-system-theme-layout";

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  themeColor: "creative-dark",
  themeLayout: "workspace-app"
};

type StorageLike = Pick<Storage, "getItem">;
type StorageWriterLike = Pick<Storage, "setItem">;

export function normalizeThemeColor(value: string | null | undefined): ThemeColorMode {
  return value === "constrained-light" || value === "creative-dark"
    ? value
    : DEFAULT_THEME_PREFERENCES.themeColor;
}

export function normalizeThemeLayout(value: string | null | undefined): ThemeLayoutMode {
  return value === "default-app" || value === "workspace-app"
    ? value
    : DEFAULT_THEME_PREFERENCES.themeLayout;
}

export function getStoredThemePreferences(storage: StorageLike): ThemePreferences {
  return {
    themeColor: normalizeThemeColor(storage.getItem(THEME_COLOR_STORAGE_KEY)),
    themeLayout: normalizeThemeLayout(storage.getItem(THEME_LAYOUT_STORAGE_KEY))
  };
}

export function getDocumentThemeDataset(storage: StorageLike): {
  themeColor: ThemeColorMode;
  themeLayout: ThemeLayoutMode;
} {
  return getStoredThemePreferences(storage);
}

export function setStoredThemePreferences(storage: StorageWriterLike, preferences: ThemePreferences) {
  storage.setItem(THEME_COLOR_STORAGE_KEY, preferences.themeColor);
  storage.setItem(THEME_LAYOUT_STORAGE_KEY, preferences.themeLayout);
}

export function getInitialThemePreferences(): ThemePreferences {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_PREFERENCES;
  }

  return getStoredThemePreferences(window.localStorage);
}

type ThemePreferencesContextValue = ThemePreferences & {
  setThemeColor: (value: ThemeColorMode) => void;
  setThemeLayout: (value: ThemeLayoutMode) => void;
};

const ThemePreferencesContext = createContext<ThemePreferencesContextValue | null>(null);

export function ThemePreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<ThemePreferences>(getInitialThemePreferences);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setStoredThemePreferences(window.localStorage, preferences);
    }

    document.documentElement.dataset.themeColor = preferences.themeColor;
    document.documentElement.dataset.themeLayout = preferences.themeLayout;
  }, [preferences]);

  return createElement(
    ThemePreferencesContext.Provider,
    {
      value: {
        ...preferences,
        setThemeColor: themeColor => setPreferences(current => ({ ...current, themeColor })),
        setThemeLayout: themeLayout => setPreferences(current => ({ ...current, themeLayout }))
      }
    },
    children
  );
}

export function useThemePreferences() {
  const context = useContext(ThemePreferencesContext);

  if (!context) {
    throw new Error("useThemePreferences must be used within ThemePreferencesProvider.");
  }

  return context;
}
