import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readStorageItem, writeStorageItem } from "../lib/browser-storage";
import { loadMessages, type Messages, type SupportedLocale } from "./messages";

type TranslationValues = Record<string, string | number>;

type I18nContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, values?: TranslationValues) => string;
  formatDateTime: (value: string) => string;
};

export const LOCALE_STORAGE_KEY = "rag-system-locale";
const I18nContext = createContext<I18nContextValue | null>(null);

function resolvePath(messages: Messages, key: string) {
  const parts = key.split(".");
  let current: unknown = messages;

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

export function getInitialLocale(): SupportedLocale {
  if (typeof window === "undefined") {
    return "zh";
  }

  const stored = readStorageItem(window.localStorage, LOCALE_STORAGE_KEY);
  if (stored === "zh" || stored === "en") {
    return stored;
  }

  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

type I18nProviderProps = {
  children: React.ReactNode;
  initialLocale: SupportedLocale;
  initialMessages: Messages;
};

export function I18nProvider({ children, initialLocale, initialMessages }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale);
  const [messagesByLocale, setMessagesByLocale] = useState<Partial<Record<SupportedLocale, Messages>>>(() => ({
    [initialLocale]: initialMessages
  }));

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short"
      }),
    [locale]
  );

  const setLocale = useCallback(
    (nextLocale: SupportedLocale) => {
      if (nextLocale === locale) {
        return;
      }

      const cachedMessages = messagesByLocale[nextLocale];
      if (cachedMessages) {
        startTransition(() => {
          setLocaleState(nextLocale);
        });
        return;
      }

      void loadMessages(nextLocale).then(loadedMessages => {
        startTransition(() => {
          setMessagesByLocale(currentMessages => ({
            ...currentMessages,
            [nextLocale]: loadedMessages
          }));
          setLocaleState(nextLocale);
        });
      });
    },
    [locale, messagesByLocale]
  );

  useEffect(() => {
    writeStorageItem(window.localStorage, LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const activeMessages = messagesByLocale[locale] ?? initialMessages;
  const fallbackMessages = messagesByLocale.en;

  const t = useCallback(
    (key: string, values?: TranslationValues) => {
      const translated = resolvePath(activeMessages, key) ?? (fallbackMessages ? resolvePath(fallbackMessages, key) : null) ?? key;
      return interpolate(translated, values);
    },
    [activeMessages, fallbackMessages]
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
