import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import {
  useAskAssistantStream,
  useAssistants,
  useConversationMessages,
  useConversations,
  useConversationTraces
} from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";
import type { AskStreamEvent, AskStreamFinalData, Citation, Message } from "../../types/api";
import { buildCitationContext, formatConversationUpdatedAt, formatMessageTime } from "./chat-page-helpers";
import {
  applyChatStreamEvent,
  createPendingChatTurn,
  type ChatStreamAssistantMessage,
  type ChatStreamUserMessage
} from "./chat-stream-state";

type ActiveStreamTurn = {
  conversationId: string | null;
  phase: "started" | "retrieving" | "generating";
  userMessage: ChatStreamUserMessage;
  assistantMessage: ChatStreamAssistantMessage;
  latestResult: AskStreamFinalData | null;
};

type DisplayedMessage = Message | ChatStreamUserMessage | ChatStreamAssistantMessage;

function IconButton({
  children,
  label,
  disabledHint,
  onClick
}: {
  children: React.ReactNode;
  label: string;
  disabledHint?: string;
  onClick?: () => void;
}) {
  const isDisabled = onClick == null;

  return (
    <button
      aria-label={label}
      className={[
        "flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] transition duration-300 ease-out",
        isDisabled
          ? "cursor-default text-[var(--app-text-muted)] opacity-70"
          : "text-[var(--app-text-secondary)] hover:-translate-y-0.5 hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
      ].join(" ")}
      disabled={isDisabled}
      onClick={onClick}
      title={isDisabled ? disabledHint ?? label : undefined}
      type="button"
    >
      {children}
    </button>
  );
}

function TypingIndicator() {
  return (
    <div className="inline-flex w-fit items-center gap-1.5 rounded-[14px] bg-[var(--app-bg-elevated)] px-4 py-3">
      {[0, 200, 400].map(delay => (
        <span
          className="h-2 w-2 rounded-full bg-[var(--app-accent)] animate-[typing-bounce_1.4s_ease-in-out_infinite]"
          key={delay}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

export function ChatPage() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeStreamTurn, setActiveStreamTurn] = useState<ActiveStreamTurn | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [didAutoSelectConversation, setDidAutoSelectConversation] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const assistantsQuery = useAssistants();
  const conversationsQuery = useConversations();
  const activeAssistant = assistantsQuery.data?.[0] ?? null;
  const messagesQuery = useConversationMessages(activeConversationId);
  const tracesQuery = useConversationTraces(activeConversationId);
  const askStreamMutation = useAskAssistantStream(activeAssistant?.id ?? "default-assistant");
  const queryClient = useQueryClient();
  const { locale, t } = useI18n();

  const latestTrace = tracesQuery.data?.[0] ?? null;
  const latestModelName = activeStreamTurn?.latestResult?.modelName ?? latestTrace?.modelName ?? null;
  const canAsk = activeAssistant != null && !askStreamMutation.isPending;
  const streamConversationId = activeStreamTurn?.latestResult?.conversationId ?? activeStreamTurn?.conversationId ?? null;
  const shouldRenderStreamTurn =
    activeStreamTurn != null &&
    (activeConversationId == null || streamConversationId == null || streamConversationId === activeConversationId);

  useEffect(() => {
    if (!didAutoSelectConversation && activeConversationId == null && conversationsQuery.data?.length) {
      setActiveConversationId(conversationsQuery.data[0].id);
      setDidAutoSelectConversation(true);
    }
  }, [activeConversationId, conversationsQuery.data, didAutoSelectConversation]);

  useEffect(() => {
    if (!activeStreamTurn?.latestResult?.assistantMessageId || !messagesQuery.data) {
      return;
    }

    const hasPersistedAssistantMessage = messagesQuery.data.some(
      message => message.id === activeStreamTurn.latestResult?.assistantMessageId
    );

    if (hasPersistedAssistantMessage) {
      setActiveStreamTurn(null);
    }
  }, [activeStreamTurn, messagesQuery.data]);

  const displayedMessages: DisplayedMessage[] = useMemo(() => {
    const items: DisplayedMessage[] = [...(messagesQuery.data ?? [])];

    if (shouldRenderStreamTurn && activeStreamTurn) {
      items.push(activeStreamTurn.userMessage, activeStreamTurn.assistantMessage);
    }

    return items;
  }, [activeStreamTurn, messagesQuery.data, shouldRenderStreamTurn]);

  useEffect(() => {
    const target = transcriptRef.current;
    if (!target) {
      return;
    }

    target.scrollTop = target.scrollHeight;
  }, [displayedMessages]);

  const streamStatusLabel =
    activeStreamTurn == null
      ? null
      : activeStreamTurn.assistantMessage.status === "error"
        ? locale === "zh"
          ? "本轮回答失败"
          : "Answer failed"
        : activeStreamTurn.phase === "started"
          ? locale === "zh"
            ? "正在准备回答"
            : "Preparing answer"
          : activeStreamTurn.phase === "retrieving"
            ? locale === "zh"
              ? "正在检索上下文"
              : "Retrieving context"
            : locale === "zh"
              ? "正在生成回答"
              : "Generating answer";

  const citationItems: Citation[] =
    activeStreamTurn?.assistantMessage.citations.length
      ? activeStreamTurn.assistantMessage.citations
      : latestTrace?.citationsJson ?? [];
  const activeTraceId = activeStreamTurn?.assistantMessage.traceId ?? latestTrace?.id ?? null;

  const submitQuestion = async () => {
    const question = composerValue.trim();
    if (!question || !activeAssistant) {
      return;
    }

    const pendingTurn = createPendingChatTurn({ question });
    setActiveStreamTurn({
      conversationId: activeConversationId,
      phase: "started",
      userMessage: pendingTurn.userMessage,
      assistantMessage: pendingTurn.assistantMessage,
      latestResult: null
    });
    setComposerValue("");

    try {
      await askStreamMutation.mutateAsync({
        question,
        conversationId: activeConversationId ?? undefined,
        onEvent: event => {
          const streamEvent = event as AskStreamEvent;

          setActiveStreamTurn(current => {
            if (!current) {
              return current;
            }

            if (streamEvent.type === "status") {
              return {
                ...current,
                phase: streamEvent.phase
              };
            }

            if (streamEvent.type === "final") {
              startTransition(() => {
                setActiveConversationId(streamEvent.data.conversationId);
                setDidAutoSelectConversation(true);
              });
              queryClient.invalidateQueries({ queryKey: ["conversations"] });
              queryClient.invalidateQueries({
                queryKey: ["conversation-messages", streamEvent.data.conversationId]
              });
              queryClient.invalidateQueries({
                queryKey: ["conversation-traces", streamEvent.data.conversationId]
              });

              return {
                ...current,
                conversationId: streamEvent.data.conversationId,
                assistantMessage: applyChatStreamEvent(current.assistantMessage, streamEvent),
                latestResult: streamEvent.data
              };
            }

            return {
              ...current,
              assistantMessage: applyChatStreamEvent(current.assistantMessage, streamEvent)
            };
          });
        }
      });
    } catch (error) {
      setActiveStreamTurn(current =>
        current && current.assistantMessage.status !== "error"
          ? {
              ...current,
              assistantMessage: applyChatStreamEvent(current.assistantMessage, {
                type: "error",
                message: error instanceof Error ? error.message : t("chat.states.askError")
              })
            }
          : current
      );
      notifications.show({
        color: "red",
        message: error instanceof Error ? error.message : t("chat.states.askError")
      });
    }
  };

  const getCitationContext = (citation: Citation) =>
    buildCitationContext(citation, {
      pageLabel: pageNo => t("common.misc.pageLong", { pageNo })
    });

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex min-h-0 flex-col border-r border-[var(--app-border)]">
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-6 md:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent)_0%,var(--app-accent-strong)_100%)] text-lg font-bold text-white shadow-[0_4px_20px_var(--app-accent-glow)]">
              AI
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--app-text)]">
                {locale === "zh" ? "智能问答助手" : "Intelligent answer assistant"}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                {locale === "zh"
                  ? "基于知识库的智能问答与溯源"
                  : "Knowledge-grounded answers with citations and traces"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {latestModelName ? (
              <span className="hidden rounded-full border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--app-text-secondary)] md:inline-flex">
                {latestModelName}
              </span>
            ) : null}
            <IconButton
              disabledHint={locale === "zh" ? "更多操作即将支持" : "More actions coming soon"}
              label={locale === "zh" ? "更多操作" : "More actions"}
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" fill="currentColor" r="1" />
                <circle cx="19" cy="12" fill="currentColor" r="1" />
                <circle cx="5" cy="12" fill="currentColor" r="1" />
              </svg>
            </IconButton>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-8" ref={transcriptRef}>
          <div className="flex flex-col gap-6">
            {activeConversationId == null && activeStreamTurn == null ? (
              <StatePanel
                description={t("chat.states.noActiveConversationDescription")}
                title={t("chat.states.noActiveConversationTitle")}
              />
            ) : messagesQuery.isLoading && !shouldRenderStreamTurn ? (
              <StatePanel
                description={t("chat.states.loadingMessagesDescription")}
                title={t("chat.states.loadingMessagesTitle")}
                tone="loading"
              />
            ) : messagesQuery.isError && !shouldRenderStreamTurn ? (
              <StatePanel
                description={messagesQuery.error instanceof Error ? messagesQuery.error.message : undefined}
                title={t("chat.states.messagesErrorTitle")}
                tone="error"
              />
            ) : displayedMessages.length ? (
              displayedMessages.map(message => {
                const isAssistant = message.role === "assistant";
                const isStreamingAssistant =
                  "status" in message && message.role === "assistant" && message.status === "streaming";
                const isErroredAssistant =
                  "status" in message && message.role === "assistant" && message.status === "error";
                const traceId = "traceId" in message ? message.traceId : null;
                const messageTime = "createdAt" in message ? formatMessageTime(message.createdAt, locale) : null;

                return (
                  <div
                    className={["flex gap-4", isAssistant ? "max-w-[85%]" : "ml-auto max-w-[85%] flex-row-reverse"].join(" ")}
                    key={message.id}
                  >
                    <div
                      className={[
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] text-[13px] font-semibold",
                        isAssistant
                          ? "bg-[linear-gradient(135deg,rgba(99,102,241,0.2)_0%,rgba(99,102,241,0.1)_100%)] text-[#818cf8]"
                          : "bg-[linear-gradient(135deg,#10b981_0%,#059669_100%)] text-white"
                      ].join(" ")}
                    >
                      {isAssistant ? "AI" : "U"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className={[
                          "rounded-[20px] px-5 py-4 text-sm leading-7 shadow-[0_8px_32px_rgba(0,0,0,0.24)]",
                          isAssistant
                            ? "rounded-tl-[6px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] text-[var(--app-text)]"
                            : "rounded-tr-[6px] bg-[linear-gradient(135deg,var(--app-accent)_0%,var(--app-accent-strong)_100%)] text-white"
                        ].join(" ")}
                      >
                        {message.content ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : isStreamingAssistant ? (
                          <TypingIndicator />
                        ) : null}
                        {isStreamingAssistant && message.content ? (
                          <div className="mt-4">
                            <TypingIndicator />
                          </div>
                        ) : null}
                        {isErroredAssistant && "errorMessage" in message ? (
                          <p className="mt-3 text-sm text-red-300">{message.errorMessage}</p>
                        ) : null}
                      </div>

                      <div className="mt-2.5 flex items-center gap-3 px-1">
                        <span className="text-[11px] text-[var(--app-text-muted)]">
                          {messageTime ?? (isStreamingAssistant ? streamStatusLabel : "")}
                        </span>
                        {traceId ? (
                          <Link className="text-[11px] text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]" to={`/traces/${traceId}`}>
                            {traceId}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <StatePanel
                description={t("chat.states.noMessagesDescription")}
                title={t("chat.states.noMessagesTitle")}
              />
            )}
          </div>
        </div>

        <div className="border-t border-[var(--app-border)] bg-[linear-gradient(180deg,transparent_0%,rgba(22,22,29,0.5)_100%)] px-5 pb-6 pt-5 md:px-8">
          <form
            onSubmit={event => {
              event.preventDefault();
              void submitQuestion();
            }}
          >
            <div className="rounded-[20px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-2 transition duration-300 focus-within:border-[var(--app-accent)] focus-within:shadow-[0_0_0_3px_var(--app-accent-glow)]">
              <div className="flex items-end gap-3">
                <textarea
                  className="min-h-6 max-h-[120px] flex-1 resize-none bg-transparent px-4 py-3 text-sm text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-muted)]"
                  disabled={!canAsk}
                  onChange={event => setComposerValue(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitQuestion();
                    }
                  }}
                  placeholder={locale === "zh" ? "输入问题，按 Enter 发送..." : "Ask a question and press Enter..."}
                  rows={1}
                  value={composerValue}
                />
                <div className="flex items-center gap-2 pr-1">
                  <button
                    aria-label={locale === "zh" ? "文件上传即将支持" : "File upload coming soon"}
                    className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[var(--app-text-muted)] opacity-65"
                    disabled
                    title={locale === "zh" ? "文件上传即将支持" : "File upload coming soon"}
                    type="button"
                  >
                    <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </button>
                  <button
                    className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent)_0%,var(--app-accent-strong)_100%)] text-white shadow-[0_4px_16px_var(--app-accent-glow)] transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_24px_var(--app-accent-glow)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canAsk}
                    type="submit"
                  >
                    <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24">
                      <line stroke="currentColor" strokeWidth="2" x1="22" x2="11" y1="2" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between px-2 text-[11px] text-[var(--app-text-muted)]">
              <span>{locale === "zh" ? "回车发送，Shift + Enter 换行" : "Press Enter to send, Shift + Enter for a new line"}</span>
              <span>{locale === "zh" ? "文件上传即将支持" : "File upload coming soon"}</span>
            </div>
          </form>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col bg-[var(--app-bg-elevated)]">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[var(--app-text-muted)]">
                {locale === "zh" ? "历史会话" : "History"}
              </span>
              <button
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border-strong)] px-3 py-1.5 text-[11px] font-medium text-[#818cf8] transition duration-300 hover:bg-[var(--app-accent)] hover:text-white"
                onClick={() => {
                  setActiveConversationId(null);
                  setActiveStreamTurn(null);
                }}
                type="button"
              >
                <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <line stroke="currentColor" strokeWidth="2" x1="12" x2="12" y1="5" y2="19" />
                  <line stroke="currentColor" strokeWidth="2" x1="5" x2="19" y1="12" y2="12" />
                </svg>
                {locale === "zh" ? "新会话" : "New chat"}
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {conversationsQuery.isLoading ? (
                <StatePanel
                  description={t("chat.states.loadingConversationsDescription")}
                  title={t("chat.states.loadingConversationsTitle")}
                  tone="loading"
                />
              ) : conversationsQuery.isError ? (
                <StatePanel
                  description={conversationsQuery.error instanceof Error ? conversationsQuery.error.message : undefined}
                  title={t("chat.states.conversationsErrorTitle")}
                  tone="error"
                />
              ) : conversationsQuery.data?.length ? (
                conversationsQuery.data.map(conversation => {
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
                      onClick={() => setActiveConversationId(conversation.id)}
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
                          {locale === "zh" ? "会话记录" : "Conversation"}
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

          <section>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[var(--app-text-muted)]">
                {locale === "zh" ? "当前引用" : "Current citations"}
              </span>
              {activeTraceId ? (
                <Link className="text-[11px] text-[#818cf8] transition hover:text-white" to={`/traces/${activeTraceId}`}>
                  {locale === "zh" ? "查看 Trace" : "View trace"}
                </Link>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              {activeConversationId == null && activeStreamTurn == null ? (
                <StatePanel
                  description={t("chat.states.noTraceDescription")}
                  title={t("chat.states.noTraceTitle")}
                />
              ) : tracesQuery.isLoading && citationItems.length === 0 ? (
                <StatePanel
                  description={t("chat.states.loadingTraceDescription")}
                  title={t("chat.states.loadingTraceTitle")}
                  tone="loading"
                />
              ) : tracesQuery.isError && citationItems.length === 0 ? (
                <StatePanel
                  description={tracesQuery.error instanceof Error ? tracesQuery.error.message : undefined}
                  title={t("chat.states.traceErrorTitle")}
                  tone="error"
                />
              ) : citationItems.length ? (
                citationItems.map(citation => {
                  const citationContext = getCitationContext(citation);

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
                      <p className="text-sm leading-6 text-[var(--app-text-secondary)]">
                        {citation.snippet}
                      </p>
                    </div>
                  );
                })
              ) : (
                <StatePanel
                  description={t("chat.states.noCitationsDescription")}
                  title={t("chat.states.noCitationsTitle")}
                />
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
