import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { I18nProvider } from "../i18n/I18nProvider";
import { theme } from "../styles/theme";
import { ThemePreferencesProvider } from "./theme-preferences";

const queryClient = new QueryClient();

export function App() {
  return (
    <MantineProvider theme={theme}>
      <ThemePreferencesProvider>
        <I18nProvider>
          <Notifications position="top-right" />
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </I18nProvider>
      </ThemePreferencesProvider>
    </MantineProvider>
  );
}
