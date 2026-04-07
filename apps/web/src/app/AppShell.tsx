import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useConversations, useDocuments, useKnowledgeBases, useLogout } from "../features/api/hooks";
import { getPrimaryKnowledgeBase } from "../features/api/workspace-selection";
import { useI18n } from "../i18n/I18nProvider";
import type { AuthIdentity, AuthMeResponse } from "../types/api";
import { useThemePreferences } from "./theme-preferences";

const APP_SHELL_THEME = {
  color: "creative-dark",
  layout: "workspace-app"
} as const;

type NavIconProps = {
  type: "chat" | "documents" | "knowledge" | "assistant" | "workbench" | "trace" | "usage" | "report";
};

type NavItem = {
  to: string;
  label: string;
  icon: NavIconProps["type"];
  badge?: string | null;
  end?: boolean;
};

type NavGroup = {
  key: "main" | "setup" | "advanced";
  heading: string;
  items: NavItem[];
  collapsible?: boolean;
};

type Locale = "zh" | "en";

export type AppShellOutletContext = {
  currentIdentity: AuthIdentity;
  loginProvenance: AuthMeResponse["loginProvenance"];
};

const APP_SHELL_TEXT: Record<Locale, {
  mainHeading: string;
  setupHeading: string;
  advancedHeading: string;
  workbenchHome: string;
  chat: string;
  library: string;
  knowledgeBase: string;
  assistant: string;
  traceLog: string;
  usage: string;
  reportCenter: string;
  fallbackActiveLabel: string;
}> = {
  zh: {
    mainHeading: "开始使用",
    setupHeading: "工作区设置",
    advancedHeading: "管理工作台",
    workbenchHome: "概览",
    chat: "对话",
    library: "资料库",
    knowledgeBase: "工作区设置",
    assistant: "回答设置",
    traceLog: "诊断",
    usage: "运行概览",
    reportCenter: "质量报告",
    fallbackActiveLabel: "对话"
  },
  en: {
    mainHeading: "Use",
    setupHeading: "Setup",
    advancedHeading: "Workbench",
    workbenchHome: "Overview",
    chat: "Chat",
    library: "Library",
    knowledgeBase: "Workspace settings",
    assistant: "Answer settings",
    traceLog: "Diagnostics",
    usage: "Operations overview",
    reportCenter: "Quality reports",
    fallbackActiveLabel: "Chat"
  }
};

function buildNavGroups(locale: Locale, badges: { documentBadge: string | null; conversationBadge: string | null }): NavGroup[] {
  const text = APP_SHELL_TEXT[locale];

  return [
    {
      key: "main",
      heading: text.mainHeading,
      items: [
        { to: "/", label: text.chat, badge: badges.conversationBadge, end: true, icon: "chat" },
        { to: "/documents", label: text.library, badge: badges.documentBadge, icon: "documents" }
      ]
    },
    {
      key: "setup",
      heading: text.setupHeading,
      items: [
        { to: "/knowledge-base", label: text.knowledgeBase, icon: "knowledge" },
        { to: "/assistant", label: text.assistant, icon: "assistant" }
      ]
    },
    {
      key: "advanced",
      heading: text.advancedHeading,
      collapsible: true,
      items: [
        { to: "/workbench", label: text.workbenchHome, icon: "workbench" },
        { to: "/traces", label: text.traceLog, icon: "trace" },
        { to: "/usage", label: text.usage, icon: "usage" },
        { to: "/reports", label: text.reportCenter, icon: "report" }
      ]
    }
  ];
}

function isLinkActivePath(pathname: string, link: NavItem) {
  if (link.end) {
    return pathname === link.to;
  }

  if (link.to === "/documents") {
    return pathname === "/documents" || pathname.startsWith("/documents/");
  }

  if (link.to === "/traces") {
    return pathname === "/traces" || pathname.startsWith("/traces/");
  }

  if (link.to === "/reports") {
    return pathname === "/reports";
  }

  return pathname === link.to;
}

function getActiveLabel(pathname: string, links: NavGroup[], locale: Locale) {
  return links.flatMap(group => group.items).find(link => isLinkActivePath(pathname, link))?.label ?? APP_SHELL_TEXT[locale].fallbackActiveLabel;
}

function NavIcon({ type }: NavIconProps) {
  const paths =
    type === "chat"
      ? (
        <path
          d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )
      : type === "documents"
        ? (
          <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
            <path d="M14 2v6h6" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
          </>
        )
        : type === "knowledge"
          ? (
            <>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="2" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
            </>
          )
            : type === "assistant"
              ? (
                <>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.6.13 1.26.13 1.6.13a2 2 0 1 1 0 4h-.09c-.25 0-.96 0-1.51.87z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                </>
              )
              : type === "workbench"
                ? (
                  <>
                    <rect height="7" rx="1.5" stroke="currentColor" strokeWidth="2" width="7" x="3" y="3" />
                    <rect height="7" rx="1.5" stroke="currentColor" strokeWidth="2" width="7" x="14" y="3" />
                    <rect height="7" rx="1.5" stroke="currentColor" strokeWidth="2" width="7" x="3" y="14" />
                    <rect height="7" rx="1.5" stroke="currentColor" strokeWidth="2" width="7" x="14" y="14" />
                  </>
                )
              : type === "trace"
                ? (
                  <path d="M22 12h-4l-3 9-6-18-3 9H2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                )
              : (
                <>
                  <line x1="18" x2="18" y1="20" y2="10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                  <line x1="12" x2="12" y1="20" y2="4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                  <line x1="6" x2="6" y1="20" y2="14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </>
              );

  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      {paths}
    </svg>
  );
}

type AppShellProps = {
  currentIdentity: AuthIdentity;
  loginProvenance: AuthMeResponse["loginProvenance"];
};

type IdleHandle = number;

export function AppShell({ currentIdentity, loginProvenance }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  const { locale, setLocale, t } = useI18n();
  const { themeLayout, setThemeLayout } = useThemePreferences();
  const [isShellMetricsEnabled, setIsShellMetricsEnabled] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isAdvancedNavOpen, setIsAdvancedNavOpen] = useState(false);
  const mobileNavToggleRef = useRef<HTMLButtonElement | null>(null);
  const firstMobileNavLinkRef = useRef<HTMLAnchorElement | null>(null);
  const knowledgeBasesQuery = useKnowledgeBases();
  const activeKnowledgeBase = getPrimaryKnowledgeBase(knowledgeBasesQuery.data);
  const documentsQuery = useDocuments(activeKnowledgeBase?.id ?? "", isShellMetricsEnabled && activeKnowledgeBase != null);
  const conversationsQuery = useConversations(isShellMetricsEnabled);
  const isChatRoute = location.pathname === "/";
  const localeKey = locale === "zh" ? "zh" : "en";
  const appShellCopy = useMemo(
    () => ({
      primaryNavigation: t("appShell.copy.primaryNavigation"),
      intelligentWorkspace: t("appShell.copy.intelligentWorkspace"),
      workspaceMenu: t("appShell.copy.workspaceMenu"),
      noKnowledgeBase: t("appShell.copy.noKnowledgeBase"),
      loading: t("appShell.copy.loading"),
      documentCount: (count: number) => t("appShell.copy.documentCount", { count }),
      openNavigationMenu: t("appShell.copy.openNavigationMenu"),
      currentKnowledgeBase: t("appShell.copy.currentKnowledgeBase"),
      loadingKnowledgeBase: t("appShell.copy.loadingKnowledgeBase"),
      switchToChinese: t("appShell.copy.switchToChinese"),
      switchToEnglish: t("appShell.copy.switchToEnglish"),
      closeNavigationMenu: t("appShell.copy.closeNavigationMenu"),
      mobileWorkspaceMenu: t("appShell.copy.mobileWorkspaceMenu"),
      workspaceNavigation: t("appShell.copy.workspaceNavigation"),
      showAdvancedTools: t("appShell.copy.showAdvancedTools"),
      hideAdvancedTools: t("appShell.copy.hideAdvancedTools"),
      reportCenter: t("appShell.copy.reportCenter"),
      currentIdentityHeading: t("appShell.copy.currentIdentityHeading"),
      currentIdentityDescription: t("appShell.copy.currentIdentityDescription"),
      userIdLabel: t("appShell.copy.userIdLabel"),
      tenantIdLabel: t("appShell.copy.tenantIdLabel"),
      authSourceLabel: t("appShell.copy.authSourceLabel"),
      loginSessionLabel: t("appShell.copy.loginSessionLabel"),
      localSessionValue: t("appShell.copy.localSessionValue"),
      oauthSessionPrefix: (provider: string) => t("appShell.copy.oauthSessionPrefix", { provider }),
      oauthProviderUnknown: t("appShell.copy.oauthProviderUnknown"),
      sessionIdLabel: t("appShell.copy.sessionIdLabel"),
      noSessionValue: t("appShell.copy.noSessionValue"),
      logout: t("appShell.copy.logout")
    }),
    [t]
  );

  useEffect(() => {
    const fallbackTimeout = window.setTimeout(() => {
      setIsShellMetricsEnabled(true);
    }, 1500);

    if (typeof window.requestIdleCallback !== "function") {
      return () => {
        window.clearTimeout(fallbackTimeout);
      };
    }

    const idleHandle: IdleHandle = window.requestIdleCallback(() => {
      window.clearTimeout(fallbackTimeout);
      setIsShellMetricsEnabled(true);
    });

    return () => {
      window.clearTimeout(fallbackTimeout);
      window.cancelIdleCallback?.(idleHandle);
    };
  }, []);

  useEffect(() => {
    if (themeLayout !== APP_SHELL_THEME.layout) {
      setThemeLayout(APP_SHELL_THEME.layout);
    }
  }, [setThemeLayout, themeLayout]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const currentMobileNavToggleRef = mobileNavToggleRef.current;
    document.body.style.overflow = "hidden";

    const focusTimeoutId = window.setTimeout(() => {
      firstMobileNavLinkRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimeoutId);
      document.body.style.overflow = previousOverflow;
      currentMobileNavToggleRef?.focus();
    };
  }, [isMobileNavOpen]);

  const documentBadge = documentsQuery.isSuccess ? String(documentsQuery.data.length) : null;
  const conversationBadge = conversationsQuery.isSuccess ? String(conversationsQuery.data.length) : null;

  const links = useMemo<NavGroup[]>(
    () => buildNavGroups(localeKey, { documentBadge, conversationBadge }),
    [conversationBadge, documentBadge, localeKey]
  );
  const hasActiveAdvancedRoute = links
    .find(group => group.key === "advanced")
    ?.items.some(item => isLinkActivePath(location.pathname, item)) ?? false;
  const isAdvancedNavExpanded = isAdvancedNavOpen || hasActiveAdvancedRoute;

  const activeLabel = getActiveLabel(location.pathname, links, localeKey);
  const oauthProviderLabel = loginProvenance.oauthProvider?.toUpperCase() ?? appShellCopy.oauthProviderUnknown;
  const currentKnowledgeBaseLabel =
    activeKnowledgeBase?.name ?? (knowledgeBasesQuery.isLoading ? appShellCopy.loadingKnowledgeBase : appShellCopy.noKnowledgeBase);
  const loginSessionBadgeText =
    loginProvenance.type === "oauth_session"
      ? appShellCopy.oauthSessionPrefix(oauthProviderLabel)
      : appShellCopy.localSessionValue;
  const outletContext: AppShellOutletContext = {
    currentIdentity,
    loginProvenance
  };

  function onLogoutClick() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        navigate("/login", { replace: true });
      }
    });
  }

  function getGroupToggleLabel(group: NavGroup) {
    if (!group.collapsible) {
      return group.heading;
    }

    return isAdvancedNavExpanded ? appShellCopy.hideAdvancedTools : appShellCopy.showAdvancedTools;
  }

  return (
    <div className="relative h-screen overflow-hidden bg-[var(--app-bg)] font-sans text-[var(--app-text)]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_-10%,rgba(99,102,241,0.15)_0%,transparent_50%),radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(16,185,129,0.10)_0%,transparent_50%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:60px_60px]"
      />

      <div className="relative z-10 flex h-full">
        <aside aria-label={appShellCopy.primaryNavigation} className="sticky top-0 hidden h-screen w-[280px] shrink-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-bg-elevated)] lg:flex">
          <div className="border-b border-[var(--app-border)] px-6 py-6">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent)_0%,var(--app-accent-strong)_100%)] text-lg font-bold text-white shadow-[0_4px_20px_var(--app-accent-glow)]">
                R
              </div>
              <div>
                <h1 className="bg-[linear-gradient(135deg,var(--app-text)_0%,var(--app-text-secondary)_100%)] bg-clip-text text-xl font-bold tracking-[-0.03em] text-transparent">
                  RAG System
                </h1>
                <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
                  {appShellCopy.intelligentWorkspace}
                </p>
              </div>
            </div>
          </div>

          <nav aria-label={appShellCopy.workspaceMenu} className="flex-1 px-4 py-5">
            {links.map(group => (
              <div className="mb-6" key={group.heading}>
                {group.collapsible ? (
                  <button
                    aria-expanded={isAdvancedNavExpanded}
                    aria-label={getGroupToggleLabel(group)}
                    className="mb-2.5 flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[1px] text-[var(--app-text-muted)] transition duration-300 hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
                    onClick={() => setIsAdvancedNavOpen(current => !isAdvancedNavExpanded || !current)}
                    type="button"
                  >
                    <span>{group.heading}</span>
                    <svg aria-hidden="true" className={["h-4 w-4 transition duration-300", isAdvancedNavExpanded ? "rotate-180" : ""].join(" ")} fill="none" viewBox="0 0 24 24">
                      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </button>
                ) : (
                  <div className="mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[1px] text-[var(--app-text-muted)]">
                    {group.heading}
                  </div>
                )}
                {(group.collapsible && !isAdvancedNavExpanded ? [] : group.items).map(item => {
                  const isActive = isLinkActivePath(location.pathname, item);

                  return (
                    <NavLink
                      className={[
                        "group relative mb-1 flex items-center gap-3 rounded-[10px] px-3.5 py-3 text-sm font-medium transition duration-300 ease-out hover:-translate-y-0.5",
                        isActive
                          ? "bg-[linear-gradient(135deg,rgba(99,102,241,0.15)_0%,rgba(99,102,241,0.05)_100%)] text-[#818cf8]"
                          : "text-[var(--app-text-secondary)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
                      ].join(" ")}
                      key={item.to + item.label}
                      to={item.to}
                    >
                      {isActive ? (
                        <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-[var(--app-accent)]" />
                      ) : null}
                      <span className={isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"}>
                        <NavIcon type={item.icon} />
                      </span>
                      <span>{item.label}</span>
                      {item.badge ? (
                        <span className="ml-auto rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--app-text-muted)]">
                          {item.badge}
                        </span>
                      ) : null}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="border-t border-[var(--app-border)] p-5">
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-[14px] bg-[var(--app-surface)] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#10b981_0%,#059669_100%)] text-sm font-semibold text-white">
                  {activeKnowledgeBase?.name?.slice(0, 1).toUpperCase() ?? "K"}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-[var(--app-text)]">
                      {currentKnowledgeBaseLabel}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-[#10b981]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-[pulse-status_2s_ease-in-out_infinite]" />
                      {documentsQuery.isSuccess
                        ? appShellCopy.documentCount(documentsQuery.data.length)
                        : currentKnowledgeBaseLabel === appShellCopy.noKnowledgeBase
                          ? appShellCopy.noKnowledgeBase
                          : appShellCopy.loading}
                    </div>
                  </div>
                </div>

              <div className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-bg)]/80 p-3" data-testid="current-identity-card">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-secondary)]">
                    {appShellCopy.currentIdentityHeading}
                  </div>
                  <div className="rounded-full border border-[var(--app-border)] px-2 py-0.5 text-[10px] text-[var(--app-text-muted)]">
                    {appShellCopy.currentIdentityDescription}
                  </div>
                </div>

                <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1 text-[11px] leading-5">
                  <span className="text-[var(--app-text-muted)]">{appShellCopy.userIdLabel}</span>
                  <span className="truncate font-medium text-[var(--app-text)]" title={currentIdentity.userId}>{currentIdentity.userId}</span>

                  <span className="text-[var(--app-text-muted)]">{appShellCopy.tenantIdLabel}</span>
                  <span className="truncate font-medium text-[var(--app-text)]" title={currentIdentity.tenantId}>{currentIdentity.tenantId}</span>

                  <span className="text-[var(--app-text-muted)]">{appShellCopy.authSourceLabel}</span>
                  <span className="truncate font-medium text-[var(--app-text)]" title={currentIdentity.authSource}>{currentIdentity.authSource}</span>

                  <span className="text-[var(--app-text-muted)]">{appShellCopy.loginSessionLabel}</span>
                  <span className="truncate font-medium text-[var(--app-text)]" title={loginSessionBadgeText}>{loginSessionBadgeText}</span>

                  <span className="text-[var(--app-text-muted)]">{appShellCopy.sessionIdLabel}</span>
                  <span className="truncate font-medium text-[var(--app-text)]" title={currentIdentity.sessionId ?? appShellCopy.noSessionValue}>
                    {currentIdentity.sessionId ?? appShellCopy.noSessionValue}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden" id="workspace-main">
          <header className="sticky top-0 z-50 flex min-h-[70px] items-center justify-between border-b border-[var(--app-border)] bg-[rgba(22,22,29,0.8)] px-4 py-3 backdrop-blur-xl md:h-[70px] md:px-8 md:py-0">
            <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
              <button
                aria-controls="mobile-nav-drawer"
                aria-expanded={isMobileNavOpen}
                aria-label={appShellCopy.openNavigationMenu}
                className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] text-[var(--app-text)] transition duration-300 hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] lg:hidden"
                data-testid="mobile-nav-toggle"
                onClick={() => setIsMobileNavOpen(current => !current)}
                ref={mobileNavToggleRef}
                type="button"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <line x1="4" x2="20" y1="7" y2="7" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                  <line x1="4" x2="20" y1="12" y2="12" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                  <line x1="4" x2="20" y1="17" y2="17" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-[var(--app-text-muted)] md:hidden">RAG System</div>
                <div className="hidden items-center gap-2 text-[13px] md:flex">
                  <span className="text-[var(--app-text-muted)]">RAG System</span>
                  <span className="text-[var(--app-text-muted)]/50">/</span>
                  <span className="truncate font-medium text-[var(--app-text)]">{activeLabel}</span>
                </div>
                <div className="truncate text-sm font-medium text-[var(--app-text)] md:hidden">{activeLabel}</div>
              </div>
              <div
                aria-hidden="true"
                className="hidden items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3.5 py-2 text-xs font-medium text-[var(--app-text-secondary)] md:flex"
                title={appShellCopy.currentKnowledgeBase}
              >
                <span className="h-2 w-2 rounded-full bg-[#10b981]" />
                {currentKnowledgeBaseLabel}
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <div className="hidden rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-[3px] md:flex">
                <button
                  aria-label={appShellCopy.switchToChinese}
                  aria-pressed={locale === "zh"}
                  className={[
                    "rounded-md px-3 py-1.5 text-xs font-medium transition duration-300",
                    locale === "zh" ? "bg-[var(--app-accent)] text-white" : "text-[var(--app-text-muted)]"
                  ].join(" ")}
                  onClick={() => setLocale("zh")}
                  type="button"
                >
                  中
                </button>
                <button
                  aria-label={appShellCopy.switchToEnglish}
                  aria-pressed={locale === "en"}
                  className={[
                    "rounded-md px-3 py-1.5 text-xs font-medium transition duration-300",
                    locale === "en" ? "bg-[var(--app-accent)] text-white" : "text-[var(--app-text-muted)]"
                  ].join(" ")}
                  onClick={() => setLocale("en")}
                  type="button"
                >
                  EN
                </button>
              </div>
              <button
                className="hidden rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--app-text-secondary)] transition duration-300 hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex"
                disabled={logoutMutation.isPending}
                onClick={onLogoutClick}
                type="button"
              >
                {logoutMutation.isPending ? (locale === "zh" ? "退出中..." : "Logging out...") : appShellCopy.logout}
              </button>
              <div className="max-w-[45vw] truncate rounded-full border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 py-1.5 text-[11px] font-medium text-[var(--app-text-secondary)] md:hidden">
                {currentKnowledgeBaseLabel}
              </div>
            </div>
          </header>

          {isMobileNavOpen ? (
            <div className="fixed inset-0 z-[60] lg:hidden">
              <button
                aria-label={appShellCopy.closeNavigationMenu}
                className="absolute inset-0 bg-[rgba(7,10,18,0.72)]"
                onClick={() => setIsMobileNavOpen(false)}
                type="button"
              />

              <div
                aria-modal="true"
                aria-label={appShellCopy.mobileWorkspaceMenu}
                className="absolute inset-y-0 left-0 flex w-[min(88vw,320px)] flex-col border-r border-[var(--app-border)] bg-[var(--app-bg-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
                data-testid="mobile-nav-drawer"
                id="mobile-nav-drawer"
                onKeyDown={event => {
                  if (event.key === "Escape") {
                    setIsMobileNavOpen(false);
                  }
                }}
                role="dialog"
              >
                <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-5">
                  <div>
                    <div className="text-sm font-semibold text-[var(--app-text)]">
                      {appShellCopy.workspaceNavigation}
                    </div>
                    <div className="mt-1 text-xs text-[var(--app-text-muted)]">
                      {activeKnowledgeBase?.name ?? appShellCopy.loadingKnowledgeBase}
                    </div>
                  </div>

                  <button
                    aria-label={appShellCopy.closeNavigationMenu}
                    className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text)] transition duration-300 hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
                    onClick={() => setIsMobileNavOpen(false)}
                    type="button"
                  >
                    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <line x1="6" x2="18" y1="6" y2="18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                      <line x1="18" x2="6" y1="6" y2="18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                    </svg>
                  </button>
                </div>

                <nav aria-label={appShellCopy.mobileWorkspaceMenu} className="flex-1 overflow-y-auto px-4 py-5">
                  {links.map((group, groupIndex) => (
                    <div className="mb-6" key={`mobile-${group.heading}`}>
                      {group.collapsible ? (
                        <button
                          aria-expanded={isAdvancedNavExpanded}
                          aria-label={getGroupToggleLabel(group)}
                          className="mb-2.5 flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[1px] text-[var(--app-text-muted)] transition duration-300 hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
                          onClick={() => setIsAdvancedNavOpen(current => !isAdvancedNavExpanded || !current)}
                          type="button"
                        >
                          <span>{group.heading}</span>
                          <svg aria-hidden="true" className={["h-4 w-4 transition duration-300", isAdvancedNavExpanded ? "rotate-180" : ""].join(" ")} fill="none" viewBox="0 0 24 24">
                            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                          </svg>
                        </button>
                      ) : (
                        <div className="mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[1px] text-[var(--app-text-muted)]">
                          {group.heading}
                        </div>
                      )}
                      {(group.collapsible && !isAdvancedNavExpanded ? [] : group.items).map((item, itemIndex) => {
                        const isActive = isLinkActivePath(location.pathname, item);

                        return (
                          <NavLink
                            className={[
                              "group relative mb-1 flex items-center gap-3 rounded-[10px] px-3.5 py-3 text-sm font-medium transition duration-300 ease-out hover:-translate-y-0.5",
                              isActive
                                ? "bg-[linear-gradient(135deg,rgba(99,102,241,0.15)_0%,rgba(99,102,241,0.05)_100%)] text-[#818cf8]"
                                : "text-[var(--app-text-secondary)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
                            ].join(" ")}
                            key={`mobile-${item.to}-${item.label}`}
                            onClick={() => setIsMobileNavOpen(false)}
                            ref={groupIndex === 0 && itemIndex === 0 ? firstMobileNavLinkRef : undefined}
                            to={item.to}
                          >
                            {isActive ? (
                              <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-[var(--app-accent)]" />
                            ) : null}
                            <span className={isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"}>
                              <NavIcon type={item.icon} />
                            </span>
                            <span>{item.label}</span>
                            {item.badge ? (
                              <span className="ml-auto rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--app-text-muted)]">
                                {item.badge}
                              </span>
                            ) : null}
                          </NavLink>
                        );
                      })}
                    </div>
                  ))}
                </nav>

                <div className="border-t border-[var(--app-border)] px-4 py-4">
                  <div className="mb-3 flex rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] p-[3px]">
                    <button
                      aria-label={appShellCopy.switchToChinese}
                      aria-pressed={locale === "zh"}
                      className={[
                        "flex-1 rounded-md px-3 py-2 text-xs font-medium transition duration-300",
                        locale === "zh" ? "bg-[var(--app-accent)] text-white" : "text-[var(--app-text-muted)]"
                      ].join(" ")}
                      onClick={() => setLocale("zh")}
                      type="button"
                    >
                      中文
                    </button>
                    <button
                      aria-label={appShellCopy.switchToEnglish}
                      aria-pressed={locale === "en"}
                      className={[
                        "flex-1 rounded-md px-3 py-2 text-xs font-medium transition duration-300",
                        locale === "en" ? "bg-[var(--app-accent)] text-white" : "text-[var(--app-text-muted)]"
                      ].join(" ")}
                      onClick={() => setLocale("en")}
                      type="button"
                    >
                      English
                    </button>
                  </div>
                  <button
                    className="flex w-full items-center justify-center rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2.5 text-sm font-medium text-[var(--app-text-secondary)] transition duration-300 hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={logoutMutation.isPending}
                    onClick={onLogoutClick}
                    type="button"
                  >
                    {logoutMutation.isPending ? (locale === "zh" ? "退出中..." : "Logging out...") : appShellCopy.logout}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className={isChatRoute ? "flex min-h-0 flex-1 overflow-hidden" : "flex-1 overflow-auto p-4 md:p-6"}>
            <div
              key={location.pathname}
              className={[
                "workspace-route-surface",
                isChatRoute ? "" : "workspace-route-surface-standard"
              ].join(" ")}
            >
              <Outlet context={outletContext} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
