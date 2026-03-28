import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useConversations, useDocuments, useKnowledgeBases, useLogout } from "../features/api/hooks";
import { useI18n } from "../i18n/I18nProvider";
import { useThemePreferences } from "./theme-preferences";

const APP_SHELL_THEME = {
  color: "creative-dark",
  layout: "workspace-app"
} as const;

type NavIconProps = {
  type: "chat" | "documents" | "knowledge" | "assistant" | "trace" | "usage" | "report";
};

type NavItem = {
  to: string;
  label: string;
  icon: NavIconProps["type"];
  badge?: string | null;
  end?: boolean;
};

type NavGroup = {
  heading: string;
  items: NavItem[];
};

type Locale = "zh" | "en";

const APP_SHELL_TEXT: Record<Locale, {
  mainHeading: string;
  tracingHeading: string;
  chat: string;
  documents: string;
  knowledgeBase: string;
  assistant: string;
  traceLog: string;
  usage: string;
  reportCenter: string;
  fallbackActiveLabel: string;
}> = {
  zh: {
    mainHeading: "主要功能",
    tracingHeading: "追踪与分析",
    chat: "对话",
    documents: "文档",
    knowledgeBase: "知识库",
    assistant: "助手配置",
    traceLog: "Trace 日志",
    usage: "使用统计",
    reportCenter: "报告中心",
    fallbackActiveLabel: "对话"
  },
  en: {
    mainHeading: "Main",
    tracingHeading: "Tracing",
    chat: "Chat",
    documents: "Documents",
    knowledgeBase: "Knowledge Base",
    assistant: "Assistant",
    traceLog: "Trace log",
    usage: "Usage",
    reportCenter: "Report center",
    fallbackActiveLabel: "Chat"
  }
};

function buildNavGroups(locale: Locale, badges: { documentBadge: string | null; conversationBadge: string | null }): NavGroup[] {
  const text = APP_SHELL_TEXT[locale];

  return [
    {
      heading: text.mainHeading,
      items: [
        { to: "/", label: text.chat, badge: badges.conversationBadge, end: true, icon: "chat" },
        { to: "/documents", label: text.documents, badge: badges.documentBadge, icon: "documents" },
        { to: "/knowledge-base", label: text.knowledgeBase, icon: "knowledge" },
        { to: "/assistant", label: text.assistant, icon: "assistant" }
      ]
    },
    {
      heading: text.tracingHeading,
      items: [
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
            : type === "trace"
              ? (
                <path d="M22 12h-4l-3 9-6-18-3 9H2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              )
              : type === "usage"
                ? (
                  <>
                    <line x1="18" x2="18" y1="20" y2="10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                    <line x1="12" x2="12" y1="20" y2="4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                    <line x1="6" x2="6" y1="20" y2="14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                  </>
                )
                : (
                <>
                  <path d="M4 4h16v16H4z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
                  <path d="M8 8h8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                  <path d="M8 12h8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                  <path d="M8 16h5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </>
              );

  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      {paths}
    </svg>
  );
}

function ActionButton({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] text-[var(--app-text-muted)] opacity-80"
      title={label}
    >
      {children}
    </span>
  );
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { locale, setLocale } = useI18n();
  const { themeColor, themeLayout, setThemeColor, setThemeLayout } = useThemePreferences();
  const logoutMutation = useLogout();
  const [isHydrated, setIsHydrated] = useState(false);
  const knowledgeBasesQuery = useKnowledgeBases(isHydrated);
  const activeKnowledgeBase = knowledgeBasesQuery.data?.[0] ?? null;
  const documentsQuery = useDocuments(activeKnowledgeBase?.id ?? "default-kb", isHydrated);
  const conversationsQuery = useConversations(isHydrated);
  const isChatRoute = location.pathname === "/";
  const localeKey = locale === "zh" ? "zh" : "en";

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (themeColor !== APP_SHELL_THEME.color) {
      setThemeColor(APP_SHELL_THEME.color);
    }

    if (themeLayout !== APP_SHELL_THEME.layout) {
      setThemeLayout(APP_SHELL_THEME.layout);
    }
  }, [setThemeColor, setThemeLayout, themeColor, themeLayout]);

  const documentBadge = documentsQuery.isSuccess ? String(documentsQuery.data.length) : null;
  const conversationBadge = conversationsQuery.isSuccess ? String(conversationsQuery.data.length) : null;

  const links = useMemo<NavGroup[]>(
    () => buildNavGroups(localeKey, { documentBadge, conversationBadge }),
    [conversationBadge, documentBadge, localeKey]
  );

  const activeLabel = getActiveLabel(location.pathname, links, localeKey);

  function onLogoutClick() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        navigate("/login", { replace: true });
      }
    });
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
        <aside aria-label={locale === "zh" ? "主导航" : "Primary navigation"} className="sticky top-0 hidden h-screen w-[280px] shrink-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-bg-elevated)] lg:flex">
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
                  {locale === "zh" ? "智能知识库问答工作台" : "Intelligent knowledge workspace"}
                </p>
              </div>
            </div>
          </div>

          <nav aria-label={locale === "zh" ? "工作区菜单" : "Workspace menu"} className="flex-1 px-4 py-5">
            {links.map(group => (
              <div className="mb-6" key={group.heading}>
                <div className="mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[1px] text-[var(--app-text-muted)]">
                  {group.heading}
                </div>
                {group.items.map(item => {
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
            <div className="flex items-center gap-3 rounded-[14px] bg-[var(--app-surface)] p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#10b981_0%,#059669_100%)] text-sm font-semibold text-white">
                {activeKnowledgeBase?.name?.slice(0, 1).toUpperCase() ?? "K"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-[var(--app-text)]">
                  {activeKnowledgeBase?.name ?? (locale === "zh" ? "未选择知识库" : "No knowledge base")}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[#10b981]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-[pulse-status_2s_ease-in-out_infinite]" />
                  {documentsQuery.isSuccess
                    ? locale === "zh"
                      ? `${documentsQuery.data.length} 个文档`
                      : `${documentsQuery.data.length} documents`
                    : locale === "zh"
                      ? "加载中"
                      : "Loading"}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden" id="workspace-main">
          <header className="sticky top-0 z-50 flex h-[70px] items-center justify-between border-b border-[var(--app-border)] bg-[rgba(22,22,29,0.8)] px-4 backdrop-blur-xl md:px-8">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[var(--app-text-muted)]">RAG System</span>
                <span className="text-[var(--app-text-muted)]/50">/</span>
                <span className="truncate font-medium text-[var(--app-text)]">{activeLabel}</span>
              </div>
              <div
                aria-hidden="true"
                className="hidden items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3.5 py-2 text-xs font-medium text-[var(--app-text-secondary)] md:flex"
                title={locale === "zh" ? "当前知识库" : "Current knowledge base"}
              >
                <span className="h-2 w-2 rounded-full bg-[#10b981]" />
                {activeKnowledgeBase?.name ?? (locale === "zh" ? "知识库加载中" : "Loading knowledge base")}
                <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ActionButton label={locale === "zh" ? "搜索" : "Search"}>
                <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                  <line stroke="currentColor" strokeWidth="2" x1="21" x2="16.65" y1="21" y2="16.65" />
                </svg>
              </ActionButton>
              <ActionButton label={locale === "zh" ? "通知" : "Notifications"}>
                <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" />
                </svg>
              </ActionButton>
              <div className="flex rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-[3px]">
                <button
                  aria-label={locale === "zh" ? "切换中文" : "Switch to Chinese"}
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
                  aria-label={locale === "en" ? "Switch to English" : "切换到英文"}
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
                className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--app-text-secondary)] transition duration-300 hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={logoutMutation.isPending}
                onClick={onLogoutClick}
                type="button"
              >
                {logoutMutation.isPending ? (locale === "zh" ? "退出中..." : "Logging out...") : locale === "zh" ? "退出登录" : "Logout"}
              </button>
            </div>
          </header>

          <div className={isChatRoute ? "flex min-h-0 flex-1 overflow-hidden" : "flex-1 overflow-auto p-4 md:p-6"}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
