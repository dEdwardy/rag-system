import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Messages, SupportedLocale } from "../i18n/messages";
import { I18nProvider } from "../i18n/I18nProvider";
import { theme } from "../styles/theme";
import { AppRouter } from "./AppRouter";
import { getThemeColorScheme, ThemePreferencesProvider, useThemePreferences } from "./theme-preferences";

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
          <AppRouter />
        </QueryClientProvider>
      </I18nProvider>
    </MantineProvider>
  );
}
