import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { OauthWorkspaceWelcome } from "../../components/auth/OauthWorkspaceWelcome";
import { StatePanel } from "../../components/StatePanel";
import {
  useAskAssistantStream,
  useAssistants,
  useConversationMessages,
  useConversations,
  useConversationTraces,
  useDocuments,
  useKnowledgeBases
} from "../../features/api/hooks";
import {
  getPrimaryAssistantForKnowledgeBase,
  getPrimaryKnowledgeBase
} from "../../features/api/workspace-selection";
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

function resolveStreamConversationId(activeStreamTurn: ActiveStreamTurn | null): string | null {
  return activeStreamTurn?.latestResult?.conversationId ?? activeStreamTurn?.conversationId ?? null;
}

function shouldRenderActiveStreamTurn(
  activeStreamTurn: ActiveStreamTurn | null,
  activeConversationId: string | null
): boolean {
  const streamConversationId = resolveStreamConversationId(activeStreamTurn);
  return (
    activeStreamTurn != null &&
    (activeConversationId == null || streamConversationId == null || streamConversationId === activeConversationId)
  );
}

function buildDisplayedMessages(
  persistedMessages: Message[] | undefined,
  activeStreamTurn: ActiveStreamTurn | null,
  shouldRenderStreamTurn: boolean
): DisplayedMessage[] {
  const items: DisplayedMessage[] = [...(persistedMessages ?? [])];

  if (shouldRenderStreamTurn && activeStreamTurn) {
    items.push(activeStreamTurn.userMessage, activeStreamTurn.assistantMessage);
  }

  return items;
}

function resolveStreamStatusLabel(
  copy: {
    answerFailed: string;
    preparingAnswer: string;
    retrievingContext: string;
    generatingAnswer: string;
  },
  activeStreamTurn: ActiveStreamTurn | null
): string | null {
  if (activeStreamTurn == null) {
    return null;
  }

  if (activeStreamTurn.assistantMessage.status === "error") {
    return copy.answerFailed;
  }

  if (activeStreamTurn.phase === "started") {
    return copy.preparingAnswer;
  }

  if (activeStreamTurn.phase === "retrieving") {
    return copy.retrievingContext;
  }

  return copy.generatingAnswer;
}

function resolveWorkspaceStatus(input: {
  copy: {
    assistantUnavailable: string;
    inProgress: string;
    readyToAsk: string;
  };
  hasAssistant: boolean;
  hasActiveStreamTurn: boolean;
  streamStatusLabel: string | null;
}): string {
  const { copy, hasAssistant, hasActiveStreamTurn, streamStatusLabel } = input;

  if (!hasAssistant) {
    return copy.assistantUnavailable;
  }

  if (hasActiveStreamTurn) {
    return streamStatusLabel ?? copy.inProgress;
  }

  return copy.readyToAsk;
}

function resolveCitationItems(
  activeStreamTurn: ActiveStreamTurn | null,
  latestTraceCitations: Citation[] | null | undefined
): Citation[] {
  return activeStreamTurn?.assistantMessage.citations.length
    ? activeStreamTurn.assistantMessage.citations
    : latestTraceCitations ?? [];
}

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

function SummaryCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 py-4 shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">{value}</div>
      <div className="mt-1 text-[12px] leading-5 text-[var(--app-text-secondary)]">{hint}</div>
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
  const knowledgeBasesQuery = useKnowledgeBases();
  const activeKnowledgeBase = getPrimaryKnowledgeBase(knowledgeBasesQuery.data);
  const documentsQuery = useDocuments(activeKnowledgeBase?.id ?? "", activeKnowledgeBase != null);
  const conversationsQuery = useConversations();
  const activeAssistant = getPrimaryAssistantForKnowledgeBase(assistantsQuery.data, activeKnowledgeBase?.id ?? null);
  const messagesQuery = useConversationMessages(activeConversationId);
  const tracesQuery = useConversationTraces(activeConversationId);
  const askStreamMutation = useAskAssistantStream(activeAssistant?.id ?? "");
  const queryClient = useQueryClient();
  const { locale, t } = useI18n();
  const chatCopy = useMemo(
    () => ({
      heroTitle: t("chat.copy.heroTitle"),
      heroSubtitle: t("chat.copy.heroSubtitle"),
      moreActionsHint: t("chat.copy.moreActionsHint"),
      moreActions: t("chat.copy.moreActions"),
      currentWorkspaceHintHasConversation: t("chat.copy.currentWorkspaceHintHasConversation"),
      currentWorkspaceHintNewConversation: t("chat.copy.currentWorkspaceHintNewConversation"),
      currentWorkspace: t("chat.copy.currentWorkspace"),
      newConversationDraft: t("chat.copy.newConversationDraft"),
      askStatusHintHasAssistant: t("chat.copy.askStatusHintHasAssistant"),
      askStatusHintNoAssistant: t("chat.copy.askStatusHintNoAssistant"),
      askStatus: t("chat.copy.askStatus"),
      citationsAndTrace: t("chat.copy.citationsAndTrace"),
      waitingForNextTrace: t("chat.copy.waitingForNextTrace"),
      inputSection: t("chat.copy.inputSection"),
      inputHelpCanAsk: t("chat.copy.inputHelpCanAsk"),
      inputHelpDisabled: t("chat.copy.inputHelpDisabled"),
      askInputPlaceholder: t("chat.copy.askInputPlaceholder"),
      fileUploadComingSoon: t("chat.copy.fileUploadComingSoon"),
      enterHint: t("chat.copy.enterHint"),
      history: t("chat.copy.history"),
      newChat: t("chat.copy.newChat"),
      conversationLabel: t("chat.copy.conversationLabel"),
      currentCitations: t("chat.copy.currentCitations"),
      viewTrace: t("chat.copy.viewTrace"),
      answerFailed: t("chat.copy.answerFailed"),
      preparingAnswer: t("chat.copy.preparingAnswer"),
      retrievingContext: t("chat.copy.retrievingContext"),
      generatingAnswer: t("chat.copy.generatingAnswer"),
      assistantUnavailable: t("chat.copy.assistantUnavailable"),
      inProgress: t("chat.copy.inProgress"),
      readyToAsk: t("chat.copy.readyToAsk")
    }),
    [t]
  );

  const latestTrace = tracesQuery.data?.[0] ?? null;
  const latestModelName = activeStreamTurn?.latestResult?.modelName ?? latestTrace?.modelName ?? null;
  const canAsk = activeAssistant != null && !askStreamMutation.isPending;
  const shouldRenderStreamTurn = shouldRenderActiveStreamTurn(activeStreamTurn, activeConversationId);

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

  const displayedMessages: DisplayedMessage[] = useMemo(
    () => buildDisplayedMessages(messagesQuery.data, activeStreamTurn, shouldRenderStreamTurn),
    [activeStreamTurn, messagesQuery.data, shouldRenderStreamTurn]
  );

  useEffect(() => {
    const target = transcriptRef.current;
    if (!target) {
      return;
    }

    target.scrollTop = target.scrollHeight;
  }, [displayedMessages]);

  const streamStatusLabel = resolveStreamStatusLabel(chatCopy, activeStreamTurn);

  const citationItems: Citation[] = resolveCitationItems(activeStreamTurn, latestTrace?.citationsJson);
  const activeTraceId = activeStreamTurn?.assistantMessage.traceId ?? latestTrace?.id ?? null;
  const activeConversation =
    conversationsQuery.data?.find(conversation => conversation.id === activeConversationId) ?? null;
  const conversationCount = conversationsQuery.data?.length ?? 0;
  const documentCount = documentsQuery.data?.length ?? 0;
  const workspaceStatus = resolveWorkspaceStatus({
    copy: chatCopy,
    hasAssistant: activeAssistant != null,
    hasActiveStreamTurn: activeStreamTurn != null,
    streamStatusLabel
  });

  const handleFinalStreamEvent = useCallback(
    (finalData: AskStreamFinalData) => {
      startTransition(() => {
        setActiveConversationId(finalData.conversationId);
        setDidAutoSelectConversation(true);
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", finalData.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversation-traces", finalData.conversationId] });
    },
    [queryClient]
  );

  const handleAskStreamEvent = useCallback(
    (streamEvent: AskStreamEvent) => {
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
          handleFinalStreamEvent(streamEvent.data);

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
    },
    [handleFinalStreamEvent]
  );

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
          handleAskStreamEvent(event as AskStreamEvent);
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
                {chatCopy.heroTitle}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                {chatCopy.heroSubtitle}
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
              disabledHint={chatCopy.moreActionsHint}
              label={chatCopy.moreActions}
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
            <OauthWorkspaceWelcome
              assistantCount={activeAssistant ? 1 : 0}
              context="chat"
              conversationCount={conversationCount}
              documentCount={documentCount}
            />

            <div className="workspace-chat-summary grid gap-3 md:grid-cols-3">
              <SummaryCard
                hint={
                  activeConversation
                    ? chatCopy.currentWorkspaceHintHasConversation
                    : chatCopy.currentWorkspaceHintNewConversation
                }
                label={chatCopy.currentWorkspace}
                value={
                  activeConversation?.title ??
                  chatCopy.newConversationDraft
                }
              />
              <SummaryCard
                hint={
                  activeAssistant
                    ? chatCopy.askStatusHintHasAssistant
                    : chatCopy.askStatusHintNoAssistant
                }
                label={chatCopy.askStatus}
                value={workspaceStatus}
              />
              <SummaryCard
                hint={
                  t("chat.copy.citationsCount", {
                    conversationCount,
                    citationCount: citationItems.length
                  })
                }
                label={chatCopy.citationsAndTrace}
                value={
                  activeTraceId ??
                  chatCopy.waitingForNextTrace
                }
              />
            </div>

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
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)]">
                  {chatCopy.inputSection}
                </div>
                <div className="mt-1 text-xs text-[var(--app-text-secondary)]">
                  {canAsk ? chatCopy.inputHelpCanAsk : chatCopy.inputHelpDisabled}
                </div>
              </div>
              <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 py-1 text-[11px] text-[var(--app-text-secondary)]">
                {workspaceStatus}
              </span>
            </div>

            <div className="rounded-[20px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-2 transition duration-300 focus-within:border-[var(--app-accent)] focus-within:shadow-[0_0_0_3px_var(--app-accent-glow)]">
              <div className="flex items-end gap-3">
                <textarea
                  className="min-h-6 max-h-[120px] flex-1 resize-none bg-transparent px-4 py-3 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
                  disabled={!canAsk}
                  name="question"
                  onChange={event => setComposerValue(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitQuestion();
                    }
                  }}
                  placeholder={chatCopy.askInputPlaceholder}
                  rows={1}
                  spellCheck
                  value={composerValue}
                />
                <div className="flex items-center gap-2 pr-1">
                  <button
                    aria-label={chatCopy.fileUploadComingSoon}
                    className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[var(--app-text-muted)] opacity-65"
                    disabled
                    title={chatCopy.fileUploadComingSoon}
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
              <span>{chatCopy.enterHint}</span>
              <span>{chatCopy.fileUploadComingSoon}</span>
            </div>
          </form>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col bg-[var(--app-bg-elevated)]">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[var(--app-text-muted)]">
                {chatCopy.history}
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
                {chatCopy.newChat}
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
