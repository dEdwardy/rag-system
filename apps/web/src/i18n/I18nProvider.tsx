import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { messages, type SupportedLocale } from "./messages";

type TranslationValues = Record<string, string | number>;

type I18nContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, values?: TranslationValues) => string;
  formatDateTime: (value: string) => string;
};

const STORAGE_KEY = "rag-system-locale";
const I18nContext = createContext<I18nContextValue | null>(null);

function resolvePath(locale: SupportedLocale, key: string) {
  const parts = key.split(".");
  let current: unknown = messages[locale];

  for (const part of parts) {
    if (typeof current !== "object" || current == null || !(part in current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : null;
}

function interpolate(template: string, values?: TranslationValues) {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

function getInitialLocale(): SupportedLocale {
  if (typeof window === "undefined") {
    return "zh";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "zh" || stored === "en") {
    return stored;
  }

  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(getInitialLocale);

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short"
      }),
    [locale]
  );

  const setLocale = useCallback((nextLocale: SupportedLocale) => {
    setLocaleState(currentLocale => (currentLocale === nextLocale ? currentLocale : nextLocale));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const t = useCallback(
    (key: string, values?: TranslationValues) => {
      const translated = resolvePath(locale, key) ?? resolvePath("en", key) ?? key;
      return interpolate(translated, values);
    },
    [locale]
  );

  const formatDateTime = useCallback((value: string) => dateTimeFormatter.format(new Date(value)), [dateTimeFormatter]);

  const value = useMemo(
    () => ({ locale, setLocale, t, formatDateTime }),
    [formatDateTime, locale, setLocale, t]
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider.");
  }

  return context;
}
