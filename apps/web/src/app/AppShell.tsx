import {
  AppShell as MantineAppShell,
  Badge,
  Box,
  Group,
  NavLink as MantineNavLink,
  SegmentedControl,
  Stack,
  Text,
  Title
} from "@mantine/core";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { useThemePreferences } from "./theme-preferences";

export function AppShell() {
  const location = useLocation();
  const { locale, setLocale, t } = useI18n();
  const { themeColor, themeLayout, setThemeColor, setThemeLayout } = useThemePreferences();
  const links = [
    { to: "/", label: t("appShell.nav.chat"), end: true, badge: "AI" },
    { to: "/documents", label: t("appShell.nav.documents"), badge: "DOC" },
    { to: "/knowledge-base", label: t("appShell.nav.knowledgeBase"), badge: "KB" },
    { to: "/assistant", label: t("appShell.nav.assistant"), badge: "CFG" }
  ];

  return (
    <Box
      style={{
        minHeight: "100vh",
        color: "var(--app-text)"
      }}
    >
      <MantineAppShell
        header={{ height: "var(--app-shell-header-height)" }}
        navbar={{ width: "var(--app-shell-navbar-width)", breakpoint: "sm" }}
        padding="lg"
      >
        <MantineAppShell.Header
          p="md"
          style={{
            background: "rgba(18, 20, 31, 0.78)",
            borderBottom: "1px solid var(--app-border)",
            backdropFilter: "blur(18px)"
          }}
        >
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Badge
                radius="md"
                size="lg"
                styles={{
                  root: {
                    background: "linear-gradient(135deg, var(--app-accent) 0%, var(--app-accent-strong) 100%)",
                    color: "white",
                    boxShadow: "0 10px 26px var(--app-accent-glow)"
                  }
                }}
              >
                R
              </Badge>
              <div>
                <Text c="var(--app-text-muted)" fw={600} size="xs" tt="uppercase">
                  {locale === "zh" ? "工作台" : "Workspace"}
                </Text>
                <Title
                  order={4}
                  style={{
                    fontFamily: "var(--app-font-display)",
                    color: "var(--app-text)"
                  }}
                >
                  {t("appShell.title")}
                </Title>
              </div>
            </Group>

            <Group gap="sm" wrap="nowrap">
              <SegmentedControl
                data={[
                  { label: locale === "zh" ? "深色" : "Dark", value: "creative-dark" },
                  { label: locale === "zh" ? "浅色" : "Light", value: "constrained-light" }
                ]}
                onChange={value => setThemeColor(value as typeof themeColor)}
                radius="xl"
                size="xs"
                styles={{
                  root: {
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid var(--app-border)"
                  },
                  label: {
                    color: "var(--app-text-secondary)"
                  },
                  indicator: {
                    background: "var(--app-accent)"
                  }
                }}
                value={themeColor}
              />
              <SegmentedControl
                data={[
                  { label: locale === "zh" ? "工作台" : "Workspace", value: "workspace-app" },
                  { label: locale === "zh" ? "默认" : "Default", value: "default-app" }
                ]}
                onChange={value => setThemeLayout(value as typeof themeLayout)}
                radius="xl"
                size="xs"
                styles={{
                  root: {
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid var(--app-border)"
                  },
                  label: {
                    color: "var(--app-text-secondary)"
                  },
                  indicator: {
                    background: "var(--app-surface)"
                  }
                }}
                value={themeLayout}
              />
              <SegmentedControl
                data={[
                  { label: "中", value: "zh" },
                  { label: "EN", value: "en" }
                ]}
                onChange={value => setLocale(value as "zh" | "en")}
                radius="xl"
                size="xs"
                styles={{
                  root: {
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid var(--app-border)"
                  },
                  label: {
                    color: "var(--app-text-secondary)"
                  },
                  indicator: {
                    background: "var(--app-surface)"
                  }
                }}
                value={locale}
              />
            </Group>
          </Group>
        </MantineAppShell.Header>

        <MantineAppShell.Navbar
          p="md"
          style={{
            background:
              "linear-gradient(180deg, rgba(16, 18, 27, 0.96) 0%, rgba(20, 22, 34, 0.98) 100%)",
            borderRight: "1px solid var(--app-border)"
          }}
        >
          <Stack h="100%" justify="space-between">
            <Stack gap="lg">
              <Stack gap={4}>
                <Link to="/">
                  <Group align="flex-start" gap="sm" wrap="nowrap">
                    <Box
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "var(--app-radius-md)",
                        display: "grid",
                        placeItems: "center",
                        background: "linear-gradient(135deg, var(--app-accent) 0%, var(--app-accent-strong) 100%)",
                        boxShadow: "0 12px 30px var(--app-accent-glow)",
                        color: "white",
                        fontFamily: "var(--app-font-display)",
                        fontWeight: 700
                      }}
                    >
                      R
                    </Box>
                    <div>
                      <Title
                        order={3}
                        style={{
                          fontFamily: "var(--app-font-display)",
                          color: "var(--app-text)"
                        }}
                      >
                        {t("appShell.title")}
                      </Title>
                      <Text c="var(--app-text-muted)" size="sm">
                        {t("appShell.subtitle")}
                      </Text>
                    </div>
                  </Group>
                </Link>
              </Stack>

              <Stack gap="xs">
                <Text c="var(--app-text-muted)" fw={700} size="xs" tt="uppercase">
                  {locale === "zh" ? "主要功能" : "Main"}
                </Text>
                {links.map(link => (
                  <MantineNavLink
                    key={link.to}
                    active={link.end ? location.pathname === link.to : location.pathname.startsWith(link.to)}
                    component={NavLink}
                    description={locale === "zh" ? "进入工作区" : "Open workspace"}
                    end={link.end}
                    label={link.label}
                    leftSection={
                      <Badge
                        radius="sm"
                        size="xs"
                        styles={{
                          root: {
                            background: "rgba(255,255,255,0.06)",
                            color: "var(--app-text-secondary)",
                            border: "1px solid var(--app-border)"
                          }
                        }}
                        variant="filled"
                      >
                        {link.badge}
                      </Badge>
                    }
                    styles={{
                      root: {
                        borderRadius: "var(--app-radius-md)",
                        background: "transparent",
                        border: "1px solid transparent"
                      },
                      body: {
                        paddingBlock: 4
                      },
                      label: {
                        color: "var(--app-text)"
                      },
                      description: {
                        color: "var(--app-text-muted)"
                      },
                      section: {
                        marginInlineEnd: 10
                      }
                    }}
                    to={link.to}
                  />
                ))}
              </Stack>
            </Stack>

            <Stack gap="sm">
              <Text c="var(--app-text-muted)" fw={700} size="xs" tt="uppercase">
                {locale === "zh" ? "当前模式" : "Current mode"}
              </Text>
              <Box
                style={{
                  padding: 14,
                  borderRadius: "var(--app-radius-lg)",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--app-border)"
                }}
              >
                <Stack gap={6}>
                  <Text c="var(--app-text)" fw={600} size="sm">
                    {themeColor === "creative-dark"
                      ? locale === "zh"
                        ? "B 主题深色工作台"
                        : "B dark workspace"
                      : locale === "zh"
                        ? "浅色约束主题"
                        : "Constrained light"}
                  </Text>
                  <Text c="var(--app-text-muted)" size="sm">
                    {themeLayout === "workspace-app"
                      ? locale === "zh"
                        ? "三栏工作台布局已启用。"
                        : "Three-panel workspace layout enabled."
                      : locale === "zh"
                        ? "默认应用布局已启用。"
                        : "Default app layout enabled."}
                  </Text>
                </Stack>
              </Box>
            </Stack>
          </Stack>
        </MantineAppShell.Navbar>

        <MantineAppShell.Main
          style={{
            background: "transparent"
          }}
        >
          <Outlet />
        </MantineAppShell.Main>
      </MantineAppShell>
    </Box>
  );
}
