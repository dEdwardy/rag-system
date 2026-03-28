import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { I18nProvider } from "../i18n/I18nProvider";
import { theme } from "../styles/theme";
import { ThemePreferencesProvider } from "./theme-preferences";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30_000
    }
  }
});

export function App() {
  return (
    <MantineProvider forceColorScheme="dark" theme={theme}>
      <ThemePreferencesProvider>
        <I18nProvider>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </I18nProvider>
      </ThemePreferencesProvider>
    </MantineProvider>
  );
}
