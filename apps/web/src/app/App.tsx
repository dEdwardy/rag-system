import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import type { Messages, SupportedLocale } from "../i18n/messages";
import { I18nProvider } from "../i18n/I18nProvider";
import { theme } from "../styles/theme";
import { getThemeColorScheme, ThemePreferencesProvider, useThemePreferences } from "./theme-preferences";

const AppRouter = lazy(async () => {
  const module = await import("./AppRouter");

  return { default: module.AppRouter };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30_000
    }
  }
});

type AppProps = {
  initialLocale: SupportedLocale;
  initialMessages: Messages;
};

export function App({ initialLocale, initialMessages }: AppProps) {
  return (
    <ThemePreferencesProvider>
      <AppProviders initialLocale={initialLocale} initialMessages={initialMessages} />
    </ThemePreferencesProvider>
  );
}

function AppProviders({ initialLocale, initialMessages }: AppProps) {
  const { themeColor } = useThemePreferences();

  return (
    <MantineProvider forceColorScheme={getThemeColorScheme(themeColor)} theme={theme}>
      <I18nProvider initialLocale={initialLocale} initialMessages={initialMessages}>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<AppBootstrapFallback />}>
            <AppRouter />
          </Suspense>
        </QueryClientProvider>
      </I18nProvider>
    </MantineProvider>
  );
}

function AppBootstrapFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--app-bg)] px-6 text-center">
      <div className="space-y-3">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--app-border)] border-t-[var(--app-accent)]" />
        <div>
          <p className="text-sm font-medium text-[var(--app-text)]">Loading workspace</p>
          <p className="mt-1 text-xs text-[var(--app-text-muted)]">Preparing the application router and shell.</p>
        </div>
      </div>
    </div>
  );
}
