import { Menu } from "@mantine/core";
import { useState } from "react";
import { StatePanel } from "../../components/StatePanel";
import type { SupportedLocale } from "../../i18n/messages";
import type { Conversation } from "../../types/api";
import { formatConversationUpdatedAt } from "./chat-page-helpers";

type TranslationValues = Record<string, string | number>;

type ChatWorkspacePanelsProps = {
  locale: SupportedLocale;
  t: (key: string, values?: TranslationValues) => string;
  chatCopy: {
    conversationLabel: string;
    history: string;
    renameConversation: string;
    deleteConversation: string;
    renameConversationPrompt: string;
    renameConversationError: string;
    deleteConversationConfirm: string;
    deleteConversationError: string;
    newChat: string;
  };
  activeConversationId: string | null;
  conversations: Conversation[] | undefined;
  conversationsError: unknown;
  conversationsLoading: boolean;
  onSelectConversation: (conversationId: string) => void;
  onStartNewChat: () => void;
  onRenameConversation: (conversationId: string, currentTitle: string) => Promise<void> | void;
  onDeleteConversation: (conversationId: string, currentTitle: string) => Promise<void> | void;
};

export function ChatWorkspacePanels({
  locale,
  t,
  chatCopy,
  activeConversationId,
  conversations,
  conversationsError,
  conversationsLoading,
  onSelectConversation,
  onStartNewChat,
  onRenameConversation,
  onDeleteConversation
}: ChatWorkspacePanelsProps) {
  const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);

  return (
    <aside className="min-h-0 border-t border-[var(--app-border)] bg-[var(--app-bg-elevated)] xl:flex xl:border-t-0">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="mb-5 rounded-full border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-2 text-center text-sm font-medium text-[var(--app-text-secondary)]">
          {chatCopy.history}
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[var(--app-text-muted)]">
              {chatCopy.history}
            </span>
            <button
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border-strong)] bg-[var(--app-bg-elevated)] px-3 py-1.5 text-[11px] font-medium text-[var(--app-text-secondary)] transition duration-300 hover:border-[var(--app-accent)] hover:bg-[rgba(99,102,241,0.12)] hover:text-[var(--app-text)]"
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
                const isMenuOpen = openConversationMenuId === conversation.id;

                return (
                  <div
                    className={[
                      "rounded-[14px] border px-4 py-3 text-left transition duration-200 ease-out",
                      isActive
                        ? "border-[rgba(99,102,241,0.3)] bg-[linear-gradient(135deg,rgba(99,102,241,0.15)_0%,rgba(99,102,241,0.05)_100%)]"
                        : "border-transparent bg-[var(--app-bg-elevated)] hover:border-[var(--app-border-strong)]"
                    ].join(" ")}
                    key={conversation.id}
                    onClick={() => {
                      onSelectConversation(conversation.id);
                      setOpenConversationMenuId(null);
                    }}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectConversation(conversation.id);
                        setOpenConversationMenuId(null);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="mb-1.5 line-clamp-2 text-[13px] font-medium leading-5 text-[var(--app-text)]">
                      {conversation.title}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-[var(--app-text-muted)]">
                        {formatConversationUpdatedAt(conversation.updatedAt, locale)}
                      </span>
                      <Menu
                        onChange={opened => {
                          setOpenConversationMenuId(opened ? conversation.id : current => (current === conversation.id ? null : current));
                        }}
                        opened={isMenuOpen}
                        position="bottom-end"
                        shadow="lg"
                        withinPortal
                        zIndex={400}
                      >
                        <Menu.Target>
                          <button
                            aria-label={chatCopy.conversationLabel}
                            className={[
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border bg-[var(--app-bg-elevated)] transition",
                              isMenuOpen
                                ? "border-[var(--app-accent)] text-[var(--app-text)]"
                                : "border-[var(--app-border)] text-[var(--app-text-muted)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
                            ].join(" ")}
                            onClick={event => {
                              event.stopPropagation();
                            }}
                            type="button"
                          >
                            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" fill="currentColor" r="1.25" />
                              <circle cx="5" cy="12" fill="currentColor" r="1.25" />
                              <circle cx="19" cy="12" fill="currentColor" r="1.25" />
                            </svg>
                          </button>
                        </Menu.Target>

                        <Menu.Dropdown
                          onClick={event => {
                            event.stopPropagation();
                          }}
                          style={{
                            background: "var(--app-bg)",
                            borderColor: "var(--app-border)",
                            minWidth: 160
                          }}
                        >
                          <Menu.Item
                            leftSection={
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] bg-[rgba(99,102,241,0.12)] text-[#c7d2fe]">
                                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <path d="M12 20h9" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                </svg>
                              </span>
                            }
                            onClick={() => {
                              setOpenConversationMenuId(null);
                              void onRenameConversation(conversation.id, conversation.title);
                            }}
                          >
                            {chatCopy.renameConversation}
                          </Menu.Item>
                          <Menu.Item
                            color="red"
                            leftSection={
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] bg-[rgba(244,63,94,0.12)] text-rose-300">
                                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <path d="M3 6h18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                                  <path d="M8 6V4h8v2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                  <path d="M10 11v6M14 11v6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                                  <path d="M6 6l1 14h10l1-14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                </svg>
                              </span>
                            }
                            onClick={() => {
                              setOpenConversationMenuId(null);
                              void onDeleteConversation(conversation.id, conversation.title);
                            }}
                          >
                            {chatCopy.deleteConversation}
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </div>
                  </div>
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
      </div>
    </aside>
  );
}
