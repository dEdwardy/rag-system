import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import type { SupportedLocale } from "../../i18n/messages";
import type { Citation, Conversation } from "../../types/api";
import { buildCitationContext, formatConversationUpdatedAt } from "./chat-page-helpers";

type TranslationValues = Record<string, string | number>;

type ChatWorkspacePanelsProps = {
  locale: SupportedLocale;
  t: (key: string, values?: TranslationValues) => string;
  chatCopy: {
    conversationLabel: string;
    currentCitations: string;
    history: string;
    newChat: string;
    viewTrace: string;
  };
  activeConversationId: string | null;
  activeTraceId: string | null;
  citationItems: Citation[];
  conversations: Conversation[] | undefined;
  conversationsError: unknown;
  conversationsLoading: boolean;
  desktopPanel: "history" | "citations";
  mobilePanel: "history" | "citations" | null;
  showReducedCitationsPanel: boolean;
  showTracePlaceholder: boolean;
  tracesError: unknown;
  tracesLoading: boolean;
  onSelectConversation: (conversationId: string) => void;
  onSelectDesktopPanel: (panel: "history" | "citations") => void;
  onSelectMobilePanel: (panel: "history" | "citations" | null) => void;
  onStartNewChat: () => void;
};

export function ChatWorkspacePanels({
  locale,
  t,
  chatCopy,
  activeConversationId,
  activeTraceId,
  citationItems,
  conversations,
  conversationsError,
  conversationsLoading,
  desktopPanel,
  mobilePanel,
  showReducedCitationsPanel,
  showTracePlaceholder,
  tracesError,
  tracesLoading,
  onSelectConversation,
  onSelectDesktopPanel,
  onSelectMobilePanel,
  onStartNewChat
}: ChatWorkspacePanelsProps) {
  const historySection = (
    <section className="mb-6 xl:mb-0">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[var(--app-text-muted)]">
          {chatCopy.history}
        </span>
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border-strong)] px-3 py-1.5 text-[11px] font-medium text-[#818cf8] transition duration-300 hover:bg-[var(--app-accent)] hover:text-white"
          onClick={onStartNewChat}
          type="button"
        >
          <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24">
            <line stroke="currentColor" strokeWidth="2" x1="12" x2="12" y1="5" y2="19" />
            <line stroke="currentColor" strokeWidth="2" x1="5" x2="19" y1="12" y2="12" />
          </svg>
          {chatCopy.newChat}
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {conversationsLoading ? (
          <StatePanel
            description={t("chat.states.loadingConversationsDescription")}
            title={t("chat.states.loadingConversationsTitle")}
            tone="loading"
          />
        ) : conversationsError ? (
          <StatePanel
            description={conversationsError instanceof Error ? conversationsError.message : undefined}
            title={t("chat.states.conversationsErrorTitle")}
            tone="error"
          />
        ) : conversations?.length ? (
          conversations.map(conversation => {
            const isActive = activeConversationId === conversation.id;

            return (
              <button
                className={[
                  "rounded-[14px] border px-4 py-3 text-left transition duration-300 ease-out hover:-translate-y-0.5",
                  isActive
                    ? "border-[rgba(99,102,241,0.3)] bg-[linear-gradient(135deg,rgba(99,102,241,0.15)_0%,rgba(99,102,241,0.05)_100%)]"
                    : "border-transparent bg-[var(--app-bg-elevated)] hover:border-[var(--app-border-strong)]"
                ].join(" ")}
                key={conversation.id}
                onClick={() => {
                  onSelectConversation(conversation.id);
                  onSelectMobilePanel(null);
                }}
                type="button"
              >
                <div className="mb-1.5 line-clamp-2 text-[13px] font-medium leading-5 text-[var(--app-text)]">
                  {conversation.title}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-[var(--app-text-muted)]">
                    {formatConversationUpdatedAt(conversation.updatedAt, locale)}
                  </span>
                  <span className="max-w-[140px] truncate text-[11px] text-[var(--app-text-muted)]">
                    {chatCopy.conversationLabel}
                  </span>
                </div>
              </button>
            );
          })
        ) : (
          <StatePanel
            description={t("chat.states.noConversationsDescription")}
            title={t("chat.states.noConversationsTitle")}
          />
        )}
      </div>
    </section>
  );

  const citationsSection = (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[var(--app-text-muted)]">
          {chatCopy.currentCitations}
        </span>
        {activeTraceId ? (
          <Link className="text-[11px] text-[#818cf8] transition hover:text-white" to={`/traces/${activeTraceId}`}>
            {chatCopy.viewTrace}
          </Link>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        {showReducedCitationsPanel ? (
          <StatePanel
            description={t("chat.states.onboardingDiagnosticsDescription")}
            title={t("chat.states.onboardingDiagnosticsTitle")}
          />
        ) : showTracePlaceholder ? (
          <StatePanel description={t("chat.states.noTraceDescription")} title={t("chat.states.noTraceTitle")} />
        ) : tracesLoading && citationItems.length === 0 ? (
          <StatePanel
            description={t("chat.states.loadingTraceDescription")}
            title={t("chat.states.loadingTraceTitle")}
            tone="loading"
          />
        ) : tracesError && citationItems.length === 0 ? (
          <StatePanel
            description={tracesError instanceof Error ? tracesError.message : undefined}
            title={t("chat.states.traceErrorTitle")}
            tone="error"
          />
        ) : citationItems.length ? (
          citationItems.map(citation => {
            const citationContext = buildCitationContext(citation, {
              pageLabel: pageNo => t("common.misc.pageLong", { pageNo })
            });

            return (
              <div
                className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-4 transition duration-300 ease-out hover:-translate-y-0.5 hover:border-[var(--app-border-strong)]"
                key={`${citation.chunkId}-${citation.documentId}`}
              >
                <div className="mb-2.5 flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,rgba(99,102,241,0.2)_0%,rgba(99,102,241,0.1)_100%)] text-[#818cf8]">
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" />
                      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <Link className="block truncate text-sm font-semibold text-[var(--app-text)] transition hover:text-[#c7d2fe]" to={`/documents/${citation.documentId}`}>
                      {citation.documentTitle}
                    </Link>
                    <div className="mt-0.5 truncate text-[11px] text-[var(--app-text-muted)]">
                      {citationContext ?? t("common.misc.chunkLabel", { chunkId: citation.chunkId })}
                    </div>
                  </div>
                </div>
                <p className="text-sm leading-6 text-[var(--app-text-secondary)]">{citation.snippet}</p>
              </div>
            );
          })
        ) : (
          <StatePanel description={t("chat.states.noCitationsDescription")} title={t("chat.states.noCitationsTitle")} />
        )}
      </div>
    </section>
  );

  return (
    <>
      <div className="border-t border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-5 py-4 xl:hidden">
        <div className="flex items-center gap-2">
          <button
            className={[
              "flex-1 rounded-full border px-3 py-2 text-sm font-medium transition duration-300",
              mobilePanel === "history"
                ? "border-[rgba(99,102,241,0.4)] bg-[rgba(99,102,241,0.14)] text-[#c7d2fe]"
                : "border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text-secondary)]"
            ].join(" ")}
            onClick={() => onSelectMobilePanel(mobilePanel === "history" ? null : "history")}
            type="button"
          >
            {chatCopy.history}
          </button>
          <button
            className={[
              "flex-1 rounded-full border px-3 py-2 text-sm font-medium transition duration-300",
              mobilePanel === "citations"
                ? "border-[rgba(99,102,241,0.4)] bg-[rgba(99,102,241,0.14)] text-[#c7d2fe]"
                : "border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text-secondary)]"
            ].join(" ")}
            onClick={() => onSelectMobilePanel(mobilePanel === "citations" ? null : "citations")}
            type="button"
          >
            {chatCopy.currentCitations}
          </button>
        </div>

        {mobilePanel ? (
          <div className="mt-4 rounded-[18px] border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-4">
            {mobilePanel === "history" ? historySection : citationsSection}
          </div>
        ) : null}
      </div>

      <aside className="hidden min-h-0 flex-col bg-[var(--app-bg-elevated)] xl:flex">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-5 flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-bg)] p-1">
            <button
              className={[
                "flex-1 rounded-full px-3 py-2 text-sm font-medium transition duration-300",
                desktopPanel === "history"
                  ? "bg-[rgba(99,102,241,0.14)] text-[#c7d2fe]"
                  : "text-[var(--app-text-secondary)]"
              ].join(" ")}
              onClick={() => onSelectDesktopPanel("history")}
              type="button"
            >
              {chatCopy.history}
            </button>
            <button
              className={[
                "flex-1 rounded-full px-3 py-2 text-sm font-medium transition duration-300",
                desktopPanel === "citations"
                  ? "bg-[rgba(99,102,241,0.14)] text-[#c7d2fe]"
                  : "text-[var(--app-text-secondary)]"
              ].join(" ")}
              onClick={() => onSelectDesktopPanel("citations")}
              type="button"
            >
              {chatCopy.currentCitations}
            </button>
          </div>
          {desktopPanel === "history" ? historySection : citationsSection}
        </div>
      </aside>
    </>
  );
}
