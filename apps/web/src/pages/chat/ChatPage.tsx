import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { OauthWorkspaceWelcome } from "../../components/auth/OauthWorkspaceWelcome";
import { IconActionButton, IconActionLink } from "../../components/IconAction";
import { StatePanel } from "../../components/StatePanel";
import {
  useAskAssistantStream,
  useAuthMe,
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

type SubmitQuestionOptions = {
  conversationId?: string | null;
  question?: string;
};

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
    answerStopped: string;
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

   if (activeStreamTurn.assistantMessage.status === "stopped") {
    return copy.answerStopped;
  }

  if (activeStreamTurn.phase === "started") {
    return copy.preparingAnswer;
  }

  if (activeStreamTurn.phase === "retrieving") {
    return copy.retrievingContext;
  }

  return copy.generatingAnswer;
}

function isAbortError(error: unknown) {
  if (
    typeof error === "object" &&
    error != null &&
    "cause" in error &&
    isAbortError((error as { cause?: unknown }).cause)
  ) {
    return true;
  }

  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function resolveWorkspaceStatus(input: {
  copy: {
    noActiveKnowledgeBase: string;
    noDocuments: string;
    libraryNeedsAttention: string;
    libraryUpdating: string;
    answerSettingsNeeded: string;
    inProgress: string;
    readyToAsk: string;
  };
  hasKnowledgeBase: boolean;
  documentCount: number;
  failedDocumentCount: number;
  processingDocumentCount: number;
  hasAssistant: boolean;
  hasActiveStreamTurn: boolean;
  streamStatusLabel: string | null;
}): string {
  const {
    copy,
    hasKnowledgeBase,
    documentCount,
    failedDocumentCount,
    processingDocumentCount,
    hasAssistant,
    hasActiveStreamTurn,
    streamStatusLabel
  } = input;

  if (!hasKnowledgeBase) {
    return copy.noActiveKnowledgeBase;
  }

  if (documentCount === 0) {
    return copy.noDocuments;
  }

  if (failedDocumentCount > 0) {
    return copy.libraryNeedsAttention;
  }

  if (processingDocumentCount > 0) {
    return copy.libraryUpdating;
  }

  if (!hasAssistant) {
    return copy.answerSettingsNeeded;
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
  const [desktopPanel, setDesktopPanel] = useState<"history" | "citations">("history");
  const [mobilePanel, setMobilePanel] = useState<"history" | "citations" | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const streamAbortControllerRef = useRef<AbortController | null>(null);

  const assistantsQuery = useAssistants();
  const authMeQuery = useAuthMe();
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
      currentKnowledgeBase: t("chat.copy.currentKnowledgeBase"),
      currentKnowledgeBaseHintHasKb: t("chat.copy.currentKnowledgeBaseHintHasKb"),
      currentKnowledgeBaseHintNoKb: t("chat.copy.currentKnowledgeBaseHintNoKb"),
      currentAssistant: t("chat.copy.currentAssistant"),
      currentAssistantHintHasAssistant: t("chat.copy.currentAssistantHintHasAssistant"),
      currentAssistantHintNoAssistant: t("chat.copy.currentAssistantHintNoAssistant"),
      noActiveKnowledgeBase: t("chat.copy.noActiveKnowledgeBase"),
      noDocuments: t("chat.copy.noDocuments"),
      libraryNeedsAttention: t("chat.copy.libraryNeedsAttention"),
      libraryUpdating: t("chat.copy.libraryUpdating"),
      noKnowledgeBaseName: t("chat.copy.noKnowledgeBaseName"),
      noAssistantName: t("chat.copy.noAssistantName"),
      askStatusHintHasAssistant: t("chat.copy.askStatusHintHasAssistant"),
      askStatusHintNoAssistant: t("chat.copy.askStatusHintNoAssistant"),
      askStatus: t("chat.copy.askStatus"),
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
      regenerateAnswer: t("chat.copy.regenerateAnswer"),
      copyAnswer: t("chat.copy.copyAnswer"),
      copiedAnswer: t("chat.copy.copiedAnswer"),
      stopGenerating: t("chat.copy.stopGenerating"),
      answerFailed: t("chat.copy.answerFailed"),
      answerStopped: t("chat.copy.answerStopped"),
      preparingAnswer: t("chat.copy.preparingAnswer"),
      retrievingContext: t("chat.copy.retrievingContext"),
      generatingAnswer: t("chat.copy.generatingAnswer"),
      answerSettingsNeeded: t("chat.copy.answerSettingsNeeded"),
      inProgress: t("chat.copy.inProgress"),
      readyToAsk: t("chat.copy.readyToAsk"),
      noActiveKnowledgeBaseAction: t("chat.states.noActiveKnowledgeBaseAction"),
      noAssistantForKnowledgeBaseAction: t("chat.states.noAssistantForKnowledgeBaseAction")
    }),
    [t]
  );

  const latestTrace = tracesQuery.data?.[0] ?? null;
  const canAsk = activeAssistant != null;
  const canSubmitQuestion = activeAssistant != null && !askStreamMutation.isPending;
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
  const documents = documentsQuery.data ?? [];
  const documentCount = documents.length;
  const readyDocumentCount = documents.filter(document => document.status === "ready").length;
  const processingDocumentCount = documents.filter(
    document => document.status === "pending" || document.status === "processing"
  ).length;
  const failedDocumentCount = documents.filter(document => document.status === "failed").length;
  const isOauthOnboardingActive =
    authMeQuery.data?.loginProvenance.type === "oauth_session" && !(documentCount > 0 && conversationCount > 0);
  const workspaceStatus = resolveWorkspaceStatus({
    copy: chatCopy,
    hasKnowledgeBase: activeKnowledgeBase != null,
    documentCount,
    failedDocumentCount,
    processingDocumentCount,
    hasAssistant: activeAssistant != null,
    hasActiveStreamTurn: activeStreamTurn != null,
    streamStatusLabel
  });
  const readinessPanel = useMemo(() => {
    if (activeKnowledgeBase == null) {
      return {
        actionHref: "/knowledge-base",
        actionLabel: chatCopy.noActiveKnowledgeBaseAction,
        description: t("chat.states.noActiveKnowledgeBaseDescription"),
        title: t("chat.states.noActiveKnowledgeBaseTitle")
      } as const;
    }

    if (documentCount === 0) {
      return {
        actionHref: "/documents",
        actionLabel: t("chat.states.noDocumentsAction"),
        description: t("chat.states.noDocumentsDescription", { knowledgeBaseName: activeKnowledgeBase.name }),
        title: t("chat.states.noDocumentsTitle")
      } as const;
    }

    if (failedDocumentCount > 0) {
      return {
        actionHref: "/documents",
        actionLabel: t("chat.states.failedDocumentsAction"),
        description: t("chat.states.failedDocumentsDescription", { count: failedDocumentCount }),
        title: t("chat.states.failedDocumentsTitle")
      } as const;
    }

    if (processingDocumentCount > 0) {
      return {
        actionHref: "/documents",
        actionLabel: t("chat.states.processingDocumentsAction"),
        description: t("chat.states.processingDocumentsDescription", { count: processingDocumentCount }),
        title: t("chat.states.processingDocumentsTitle")
      } as const;
    }

    if (activeAssistant == null) {
      return {
        actionHref: "/assistant",
        actionLabel: chatCopy.noAssistantForKnowledgeBaseAction,
        description: t("chat.states.noAssistantForKnowledgeBaseDescription", {
          knowledgeBaseName: activeKnowledgeBase.name
        }),
        title: t("chat.states.noAssistantForKnowledgeBaseTitle")
      } as const;
    }

    return null;
  }, [
    activeAssistant,
    activeKnowledgeBase,
    chatCopy.noActiveKnowledgeBaseAction,
    chatCopy.noAssistantForKnowledgeBaseAction,
    documentCount,
    failedDocumentCount,
    processingDocumentCount,
    t
  ]);

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

  const handleCopyAnswer = useCallback(
    async (messageId: string, content: string) => {
      if (!content.trim()) {
        return;
      }

      try {
        await navigator.clipboard.writeText(content);
        setCopiedMessageId(messageId);
        window.setTimeout(() => {
          setCopiedMessageId(current => (current === messageId ? null : current));
        }, 2000);
      } catch (error) {
        notifications.show({
          color: "red",
          message: error instanceof Error ? error.message : t("chat.states.copyError")
        });
      }
    },
    [t]
  );

  const stopGenerating = useCallback(() => {
    streamAbortControllerRef.current?.abort();
  }, []);

  const submitQuestion = async (options?: SubmitQuestionOptions) => {
    const question = (options?.question ?? composerValue).trim();
    const targetConversationId = options?.conversationId ?? activeConversationId;
    if (!question || !activeAssistant || askStreamMutation.isPending) {
      return;
    }

    const pendingTurn = createPendingChatTurn({ question });
    setActiveStreamTurn({
      conversationId: targetConversationId,
      phase: "started",
      userMessage: pendingTurn.userMessage,
      assistantMessage: pendingTurn.assistantMessage,
      latestResult: null
    });
    if (!options?.question) {
      setComposerValue("");
    }
    const abortController = new AbortController();
    streamAbortControllerRef.current = abortController;

    try {
      await askStreamMutation.mutateAsync({
        question,
        conversationId: targetConversationId ?? undefined,
        signal: abortController.signal,
        onEvent: event => {
          handleAskStreamEvent(event as AskStreamEvent);
        }
      });
    } catch (error) {
      if (isAbortError(error)) {
        setActiveStreamTurn(current =>
          current == null
            ? current
            : {
                ...current,
                assistantMessage: {
                  ...current.assistantMessage,
                  status: "stopped"
                }
              }
        );
        return;
      }

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
    } finally {
      streamAbortControllerRef.current = null;
    }
  };

  const getCitationContext = (citation: Citation) =>
    buildCitationContext(citation, {
      pageLabel: pageNo => t("common.misc.pageLong", { pageNo })
    });

  const findRegenerateQuestion = useCallback(
    (messageIndex: number) => {
      for (let index = messageIndex - 1; index >= 0; index -= 1) {
        const candidate = displayedMessages[index];
        if (candidate?.role === "user") {
          return candidate.content;
        }
      }

      return null;
    },
    [displayedMessages]
  );

  const summaryCards = [
    {
      key: "knowledge-base",
      hint: activeKnowledgeBase ? chatCopy.currentKnowledgeBaseHintHasKb : chatCopy.currentKnowledgeBaseHintNoKb,
      label: chatCopy.currentKnowledgeBase,
      value: activeKnowledgeBase?.name ?? chatCopy.noKnowledgeBaseName
    },
    {
      key: "assistant",
      hint: activeAssistant ? chatCopy.currentAssistantHintHasAssistant : chatCopy.currentAssistantHintNoAssistant,
      label: chatCopy.currentAssistant,
      value: activeAssistant?.name ?? chatCopy.answerSettingsNeeded
    },
    {
      key: "ask-status",
      hint: activeAssistant ? chatCopy.askStatusHintHasAssistant : chatCopy.askStatusHintNoAssistant,
      label: chatCopy.askStatus,
      value: workspaceStatus
    }
  ];

  const visibleSummaryCards = isOauthOnboardingActive
    ? summaryCards.filter(card => card.key === "knowledge-base" || card.key === "assistant" || card.key === "ask-status")
    : summaryCards;
  const mobileSummaryCards = visibleSummaryCards.filter(card => card.key === "ask-status");
  const showReducedCitationsPanel = isOauthOnboardingActive && activeConversationId == null && activeStreamTurn == null;

  const historySection = (
    <section className="mb-6 xl:mb-0">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[var(--app-text-muted)]">
          {chatCopy.history}
        </span>
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border-strong)] px-3 py-1.5 text-[11px] font-medium text-[#818cf8] transition duration-300 hover:bg-[var(--app-accent)] hover:text-white"
          onClick={() => {
            setActiveConversationId(null);
            setActiveStreamTurn(null);
            setMobilePanel(null);
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
                onClick={() => {
                  setActiveConversationId(conversation.id);
                  setMobilePanel(null);
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
        ) : activeConversationId == null && activeStreamTurn == null ? (
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
  );

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
                {activeConversation
                  ? activeConversation.title
                  : chatCopy.heroSubtitle}
              </p>
            </div>
          </div>

              <div className="flex items-center gap-2">
            {activeTraceId ? (
              <Link
                className="hidden rounded-full border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--app-text-secondary)] transition hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)] md:inline-flex"
                to={`/traces/${activeTraceId}`}
              >
                {chatCopy.viewTrace}
              </Link>
            ) : null}
            <IconActionButton
              disabledHint={chatCopy.moreActionsHint}
              label={chatCopy.moreActions}
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" fill="currentColor" r="1" />
                <circle cx="19" cy="12" fill="currentColor" r="1" />
                <circle cx="5" cy="12" fill="currentColor" r="1" />
              </svg>
            </IconActionButton>
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

            <div className="workspace-chat-summary grid gap-3 md:hidden">
              {mobileSummaryCards.map(card => (
                <SummaryCard hint={card.hint} key={card.key} label={card.label} value={card.value} />
              ))}
            </div>

            <div className="hidden workspace-chat-summary gap-3 md:grid md:grid-cols-2 xl:grid-cols-3">
              {visibleSummaryCards.map(card => (
                <SummaryCard hint={card.hint} key={card.key} label={card.label} value={card.value} />
              ))}
            </div>

            {readinessPanel != null ? (
              <StatePanel
                action={
                  <Link
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border-strong)] px-4 py-2 text-sm font-medium text-[#818cf8] transition duration-300 hover:bg-[var(--app-accent)] hover:text-white"
                    to={readinessPanel.actionHref}
                  >
                    {readinessPanel.actionLabel}
                  </Link>
                }
                description={readinessPanel.description}
                title={readinessPanel.title}
              />
            ) : activeConversationId == null && activeStreamTurn == null ? (
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
              displayedMessages.map((message, messageIndex) => {
                const isAssistant = message.role === "assistant";
                const isStreamingAssistant =
                  "status" in message && message.role === "assistant" && message.status === "streaming";
                const isErroredAssistant =
                  "status" in message && message.role === "assistant" && message.status === "error";
                const isStoppedAssistant =
                  "status" in message && message.role === "assistant" && message.status === "stopped";
                const traceId = "traceId" in message ? message.traceId : null;
                const messageTime = "createdAt" in message ? formatMessageTime(message.createdAt, locale) : null;
                const canCopyAssistantAnswer = isAssistant && message.content.trim().length > 0;
                const regenerateQuestion = isAssistant && !isStreamingAssistant ? findRegenerateQuestion(messageIndex) : null;
                const canRegenerateAnswer = Boolean(regenerateQuestion) && !askStreamMutation.isPending;
                const isCopied = copiedMessageId === message.id;

                return (
                  <div
                    className={[
                      "flex gap-3 md:gap-4",
                      isAssistant ? "max-w-[92%] md:max-w-[85%]" : "ml-auto max-w-[92%] md:max-w-[85%] flex-row-reverse"
                    ].join(" ")}
                    key={message.id}
                  >
                    <div
                        className={[
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] text-[12px] font-semibold md:h-9 md:w-9 md:rounded-[14px] md:text-[13px]",
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
                          "rounded-[18px] px-4 py-3.5 text-sm leading-7 shadow-[0_8px_32px_rgba(0,0,0,0.24)] md:rounded-[20px] md:px-5 md:py-4",
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
                        {isStoppedAssistant ? (
                          <p className="mt-3 text-sm text-amber-200">{chatCopy.answerStopped}</p>
                        ) : null}
                      </div>

                      <div className="mt-2.5 flex items-center gap-3 px-1">
                        <span className="text-[11px] text-[var(--app-text-muted)]">
                          {messageTime ?? (isStreamingAssistant ? streamStatusLabel : "")}
                        </span>
                        {traceId ? (
                          <IconActionLink label={chatCopy.viewTrace} to={`/traces/${traceId}`}>
                            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <path d="M4 12h4l2.5-5 3 10 2-5H20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                            </svg>
                          </IconActionLink>
                        ) : null}
                        {isAssistant ? (
                          <IconActionButton
                            disabledHint={chatCopy.regenerateAnswer}
                            label={chatCopy.regenerateAnswer}
                            onClick={
                              canRegenerateAnswer
                                ? () => {
                                    void submitQuestion({
                                      conversationId: "conversationId" in message ? message.conversationId : activeConversationId,
                                      question: regenerateQuestion ?? undefined
                                    });
                                  }
                                : undefined
                            }
                          >
                            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <path d="M20 11a8 8 0 1 0 2.3 5.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                              <path d="M20 4v7h-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                            </svg>
                          </IconActionButton>
                        ) : null}
                        {canCopyAssistantAnswer ? (
                          <IconActionButton
                            label={isCopied ? chatCopy.copiedAnswer : chatCopy.copyAnswer}
                            onClick={() => {
                              void handleCopyAnswer(message.id, message.content);
                            }}
                          >
                            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <rect height="13" rx="2" stroke="currentColor" strokeWidth="2" width="13" x="8" y="8" />
                              <path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                            </svg>
                          </IconActionButton>
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

            <div className="rounded-[22px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-3 transition duration-300 focus-within:border-[var(--app-accent)] focus-within:shadow-[0_0_0_3px_var(--app-accent-glow)] md:rounded-[24px]">
              <div className="flex items-end gap-3">
                <textarea
                  className="min-h-[96px] max-h-[220px] flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-6 text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] md:min-h-[120px]"
                  name="question"
                  onChange={event => setComposerValue(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter" && !event.shiftKey && canSubmitQuestion) {
                      event.preventDefault();
                      void submitQuestion();
                    }
                  }}
                  placeholder={chatCopy.askInputPlaceholder}
                  rows={3}
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
                    aria-label={askStreamMutation.isPending ? chatCopy.stopGenerating : t("common.actions.ask")}
                    className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent)_0%,var(--app-accent-strong)_100%)] text-white shadow-[0_4px_16px_var(--app-accent-glow)] transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_24px_var(--app-accent-glow)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={askStreamMutation.isPending ? false : !canSubmitQuestion}
                    onClick={askStreamMutation.isPending ? stopGenerating : undefined}
                    title={askStreamMutation.isPending ? chatCopy.stopGenerating : t("common.actions.ask")}
                    type={askStreamMutation.isPending ? "button" : "submit"}
                  >
                    {askStreamMutation.isPending ? (
                      <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24">
                        <rect fill="currentColor" height="10" rx="1.5" width="10" x="7" y="7" />
                      </svg>
                    ) : (
                      <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24">
                        <line stroke="currentColor" strokeWidth="2" x1="22" x2="11" y1="2" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    )}
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

      <div className="border-t border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-5 py-4 xl:hidden">
        <div className="flex items-center gap-2">
          <button
            className={[
              "flex-1 rounded-full border px-3 py-2 text-sm font-medium transition duration-300",
              mobilePanel === "history"
                ? "border-[rgba(99,102,241,0.4)] bg-[rgba(99,102,241,0.14)] text-[#c7d2fe]"
                : "border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text-secondary)]"
            ].join(" ")}
            onClick={() => setMobilePanel(current => (current === "history" ? null : "history"))}
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
            onClick={() => setMobilePanel(current => (current === "citations" ? null : "citations"))}
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
              onClick={() => setDesktopPanel("history")}
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
              onClick={() => setDesktopPanel("citations")}
              type="button"
            >
              {chatCopy.currentCitations}
            </button>
          </div>
          {desktopPanel === "history" ? historySection : citationsSection}
        </div>
      </aside>
    </div>
  );
}
