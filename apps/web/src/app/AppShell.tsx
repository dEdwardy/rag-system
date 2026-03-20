import {
  AppShell as MantineAppShell,
  Badge,
  Group,
  NavLink as MantineNavLink,
  SegmentedControl,
  Stack,
  Text,
  Title
} from "@mantine/core";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";

export function AppShell() {
  const location = useLocation();
  const { locale, setLocale, t } = useI18n();
  const links = [
    { to: "/", label: t("appShell.nav.chat"), end: true },
    { to: "/documents", label: t("appShell.nav.documents") },
    { to: "/knowledge-base", label: t("appShell.nav.knowledgeBase") },
    { to: "/assistant", label: t("appShell.nav.assistant") }
  ];

  return (
    <MantineAppShell
      header={{ height: 72 }}
      navbar={{ width: 260, breakpoint: "sm" }}
      padding="lg"
    >
      <MantineAppShell.Header p="md">
        <Group justify="space-between">
          <div>
            <Link to="/">
              <Title order={3}>{t("appShell.title")}</Title>
            </Link>
            <Text c="dimmed" size="sm">
              {t("appShell.subtitle")}
            </Text>
          </div>
          <Group gap="sm">
            <SegmentedControl
              data={[
                { label: "中", value: "zh" },
                { label: "EN", value: "en" }
              ]}
              onChange={value => setLocale(value as "zh" | "en")}
              size="xs"
              value={locale}
            />
            <Badge color="teal" variant="light">
              {t("common.mvp")}
            </Badge>
          </Group>
        </Group>
      </MantineAppShell.Header>
      <MantineAppShell.Navbar p="md">
        <Stack gap="xs">
          {links.map(link => (
            <MantineNavLink
              key={link.to}
              active={link.end ? location.pathname === link.to : location.pathname.startsWith(link.to)}
              component={NavLink}
              end={link.end}
              label={link.label}
              to={link.to}
            />
          ))}
        </Stack>
      </MantineAppShell.Navbar>
      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
