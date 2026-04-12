import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { IconActionButton, IconActionLink } from "../../components/IconAction";
import { StatePanel } from "../../components/StatePanel";
import {
  useAskAssistantStream,
  useAssistants,
  useDeleteConversation,
  useConversationMessages,
  useConversations,
  useKnowledgeBases,
  useUpdateConversation
} from "../../features/api/hooks";
import { getPrimaryAssistantForKnowledgeBase, getPrimaryKnowledgeBase } from "../../features/api/workspace-selection";
import { useI18n } from "../../i18n/I18nProvider";
import type { AskStreamEvent, AskStreamFinalData, Message } from "../../types/api";
import { formatMessageTime } from "./chat-page-helpers";
import {
  applyChatStreamEvent,
  createPendingChatTurn,
  type ChatStreamAssistantMessage,
  type ChatStreamUserMessage
} from "./chat-stream-state";

const ChatWorkspacePanels = lazy(async () => {
  const module = await import("./ChatWorkspacePanels");
  return { default: module.ChatWorkspacePanels };
});

const NEW_CHAT_CONVERSATION_ID = "__new_chat__";

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

function normalizeConversationId(conversationId: string | null | undefined): string | null {
  if (conversationId == null || conversationId === NEW_CHAT_CONVERSATION_ID) {
    return null;
  }

  return conversationId;
}

const ENGLISH_INSUFFICIENT_CONTEXT_ANSWERS = [
  "I don't have enough information in the retrieved sources to answer that reliably.",
  "I couldn't find relevant information in the knowledge base."
];

const CHINESE_INSUFFICIENT_CONTEXT_ANSWER = "根据当前检索到的资料，我还没有足够信息来可靠回答这个问题。";

function localizeTransientInsufficientContextAnswer(input: {
  question: string;
  answer: string;
}) {
  const { question, answer } = input;
  if (!/[\u3400-\u9fff]/.test(question)) {
    return answer;
  }

  const normalizedAnswer = answer.replace(/\s+/g, " ").trim().toLowerCase();
  if (normalizedAnswer.length < 8) {
    return answer;
  }

  const matchesEnglishFallback = ENGLISH_INSUFFICIENT_CONTEXT_ANSWERS.some(candidate => {
    const normalizedCandidate = candidate.toLowerCase();
    return (
      normalizedCandidate === normalizedAnswer ||
      normalizedCandidate.startsWith(normalizedAnswer) ||
      normalizedAnswer.startsWith(normalizedCandidate)
    );
  });

  return matchesEnglishFallback ? CHINESE_INSUFFICIENT_CONTEXT_ANSWER : answer;
}

function applyLocalizedChatStreamEvent(input: {
  event: AskStreamEvent;
  message: ChatStreamAssistantMessage;
  question: string;
}) {
  const nextMessage = applyChatStreamEvent(input.message, input.event);
  return {
    ...nextMessage,
    content: localizeTransientInsufficientContextAnswer({
      question: input.question,
      answer: nextMessage.content
    })
  };
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

function upsertMessage(messages: Message[], nextMessage: Message): Message[] {
  const existingIndex = messages.findIndex(message => message.id === nextMessage.id);
  if (existingIndex === -1) {
    return [...messages, nextMessage];
  }

  return messages.map((message, index) => (index === existingIndex ? nextMessage : message));
}

function syncFinalTurnToMessageCache(input: {
  finalData: AskStreamFinalData;
  queryClient: ReturnType<typeof useQueryClient>;
  streamTurn: ActiveStreamTurn;
}) {
  const { finalData, queryClient, streamTurn } = input;
  const userMessageId =
    "userMessageId" in finalData && typeof finalData.userMessageId === "string"
      ? finalData.userMessageId
      : streamTurn.userMessage.id;

  const persistedUserMessage: Message = {
    id: userMessageId,
    conversationId: finalData.conversationId,
    role: "user",
    content: streamTurn.userMessage.content,
    traceId: null,
    createdAt: streamTurn.userMessage.createdAt
  };

  const persistedAssistantMessage: Message = {
    id: finalData.assistantMessageId,
    conversationId: finalData.conversationId,
    role: "assistant",
    content: finalData.answer,
    traceId: finalData.traceId,
    createdAt: streamTurn.assistantMessage.createdAt
  };

  queryClient.setQueryData<Message[]>(["conversation-messages", finalData.conversationId], current => {
    const nextMessages = upsertMessage(current ?? [], persistedUserMessage);
    return upsertMessage(nextMessages, persistedAssistantMessage);
  });
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

function resolveActiveTraceId(displayedMessages: DisplayedMessage[], activeStreamTurn: ActiveStreamTurn | null): string | null {
  if (activeStreamTurn?.assistantMessage.traceId != null) {
    return activeStreamTurn.assistantMessage.traceId;
  }

  for (let index = displayedMessages.length - 1; index >= 0; index -= 1) {
    const message = displayedMessages[index];
    if (message.role === "assistant" && "traceId" in message && message.traceId != null) {
      return message.traceId;
    }
  }

  return null;
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

function ActionSlotPlaceholder() {
  return <span aria-hidden="true" className="h-9 w-9 shrink-0 rounded-[10px] opacity-0" />;
}

function ChatWorkspacePanelsFallback({
  history
}: {
  history: string;
}) {
  return (
    <>
      <div className="border-t border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-5 py-4 xl:hidden">
        <div className="grid gap-3 rounded-[18px] border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-4">
          <div className="text-sm font-medium text-[var(--app-text-secondary)]">{history}</div>
          <StatePanel
            description="Loading chat workspace panels."
            title="Loading workspace panels"
            tone="loading"
          />
        </div>
      </div>

      <aside className="hidden min-h-0 flex-col bg-[var(--app-bg-elevated)] xl:flex">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <StatePanel
            description="Loading conversation history and citations."
            title="Loading workspace panels"
            tone="loading"
          />
        </div>
      </aside>
    </>
  );
}

export function ChatPage() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeStreamTurn, setActiveStreamTurn] = useState<ActiveStreamTurn | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [didAutoSelectConversation, setDidAutoSelectConversation] = useState(false);
  const [isTranscriptNearBottom, setIsTranscriptNearBottom] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const streamAbortControllerRef = useRef<AbortController | null>(null);

  const assistantsQuery = useAssistants();
  const knowledgeBasesQuery = useKnowledgeBases();
  const conversationsQuery = useConversations();
  const fallbackConversationId = conversationsQuery.data?.[0]?.id ?? null;
  const isNewChat = activeConversationId === NEW_CHAT_CONVERSATION_ID;
  const resolvedConversationId = isNewChat ? null : activeConversationId ?? fallbackConversationId;
  const activeKnowledgeBase = getPrimaryKnowledgeBase(knowledgeBasesQuery.data);
  const activeAssistant = getPrimaryAssistantForKnowledgeBase(assistantsQuery.data, activeKnowledgeBase?.id ?? null);
  const messagesQuery = useConversationMessages(resolvedConversationId);
  const askStreamMutation = useAskAssistantStream(activeAssistant?.id ?? "");
  const updateConversationMutation = useUpdateConversation();
  const deleteConversationMutation = useDeleteConversation();
  const queryClient = useQueryClient();
  const { locale, t } = useI18n();
  const conversationsForWorkspace = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data]);
  const chatCopy = useMemo(
    () => ({
      heroTitle: t("chat.copy.heroTitle"),
      heroSubtitle: t("chat.copy.heroSubtitle"),
      moreActionsHint: t("chat.copy.moreActionsHint"),
      moreActions: t("chat.copy.moreActions"),
      inputSection: t("chat.copy.inputSection"),
      inputHelpCanAsk: t("chat.copy.inputHelpCanAsk"),
      inputHelpDisabled: t("chat.copy.inputHelpDisabled"),
      askInputPlaceholder: t("chat.copy.askInputPlaceholder"),
      uploadFromLibrary: locale === "zh" ? "请到资料库页面上传文档" : "Add documents from the library page",
      enterHint: t("chat.copy.enterHint"),
      history: t("chat.copy.history"),
      newChat: t("chat.copy.newChat"),
      conversationLabel: t("chat.copy.conversationLabel"),
      currentCitations: t("chat.copy.currentCitations"),
      renameConversation: t("chat.copy.renameConversation"),
      deleteConversation: t("chat.copy.deleteConversation"),
      renameConversationPrompt: t("chat.copy.renameConversationPrompt"),
      renameConversationError: t("chat.copy.renameConversationError"),
      deleteConversationConfirm: t("chat.copy.deleteConversationConfirm"),
      deleteConversationError: t("chat.copy.deleteConversationError"),
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
      answerSettingsNeeded: t("chat.copy.answerSettingsNeeded")
    }),
    [locale, t]
  );

  const canAsk = activeAssistant != null;
  const isStreamingTurnActive = activeStreamTurn != null;
  const canSubmitQuestion = activeAssistant != null && !isStreamingTurnActive;
  const shouldRenderStreamTurn = shouldRenderActiveStreamTurn(activeStreamTurn, resolvedConversationId);

  useEffect(() => {
    if (!didAutoSelectConversation && activeConversationId == null && fallbackConversationId != null) {
      setActiveConversationId(fallbackConversationId);
      setDidAutoSelectConversation(true);
    }
  }, [activeConversationId, didAutoSelectConversation, fallbackConversationId]);

  useEffect(() => {
    setIsTranscriptNearBottom(true);
  }, [resolvedConversationId]);

  const displayedMessages: DisplayedMessage[] = useMemo(
    () => buildDisplayedMessages(messagesQuery.data, activeStreamTurn, shouldRenderStreamTurn),
    [activeStreamTurn, messagesQuery.data, shouldRenderStreamTurn]
  );

  useEffect(() => {
    const target = transcriptRef.current;
    if (!target || !isTranscriptNearBottom) {
      return;
    }

    target.scrollTop = target.scrollHeight;
  }, [displayedMessages, isTranscriptNearBottom]);

  const streamStatusLabel = resolveStreamStatusLabel(chatCopy, activeStreamTurn);

  const activeTraceId = resolveActiveTraceId(displayedMessages, activeStreamTurn);
  const activeConversation = conversationsForWorkspace.find(conversation => conversation.id === resolvedConversationId) ?? null;
  const handleFinalStreamEvent = useCallback(
    (finalData: AskStreamFinalData, streamTurn: ActiveStreamTurn) => {
      syncFinalTurnToMessageCache({
        finalData: {
          ...finalData,
          answer: localizeTransientInsufficientContextAnswer({
            question: streamTurn.userMessage.content,
            answer: finalData.answer
          })
        },
        queryClient,
        streamTurn
      });

      startTransition(() => {
        setActiveConversationId(finalData.conversationId);
        setDidAutoSelectConversation(true);
      });

      queryClient.invalidateQueries({ queryKey: ["conversations"] });
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
          handleFinalStreamEvent(streamEvent.data, current);
          return null;
        }

          return {
            ...current,
            assistantMessage: applyLocalizedChatStreamEvent({
              event: streamEvent,
              message: current.assistantMessage,
              question: current.userMessage.content
            })
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

  const handleRenameConversation = useCallback(
    async (conversationId: string, currentTitle: string) => {
      const nextTitle = window.prompt(chatCopy.renameConversationPrompt, currentTitle)?.trim();
      if (!nextTitle || nextTitle === currentTitle.trim()) {
        return;
      }

      try {
        await updateConversationMutation.mutateAsync({
          conversationId,
          input: { title: nextTitle }
        });
      } catch (error) {
        notifications.show({
          color: "red",
          message: error instanceof Error ? error.message : chatCopy.renameConversationError
        });
      }
    },
    [
      chatCopy.renameConversationError,
      chatCopy.renameConversationPrompt,
      updateConversationMutation
    ]
  );

  const handleDeleteConversation = useCallback(
    async (conversationId: string, currentTitle: string) => {
      const confirmed = window.confirm(chatCopy.deleteConversationConfirm.replace("{title}", currentTitle));
      if (!confirmed) {
        return;
      }

      try {
        await deleteConversationMutation.mutateAsync(conversationId);
        if (activeConversationId === conversationId) {
          const nextConversationId =
            conversationsForWorkspace.find(conversation => conversation.id !== conversationId)?.id ?? null;
          setActiveConversationId(nextConversationId);
        }
      } catch (error) {
        notifications.show({
          color: "red",
          message: error instanceof Error ? error.message : chatCopy.deleteConversationError
        });
      }
    },
    [
      activeConversationId,
      chatCopy.deleteConversationConfirm,
      chatCopy.deleteConversationError,
      conversationsForWorkspace,
      deleteConversationMutation
    ]
  );

  const submitQuestion = async (options?: SubmitQuestionOptions) => {
    const question = (options?.question ?? composerValue).trim();
    const targetConversationId = normalizeConversationId(options?.conversationId ?? activeConversationId);
    if (!question || !activeAssistant || isStreamingTurnActive) {
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

  return (
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]" data-testid="chat-page">
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

        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-8"
          onScroll={event => {
            const target = event.currentTarget;
            setIsTranscriptNearBottom(target.scrollHeight - target.scrollTop - target.clientHeight < 96);
          }}
          ref={transcriptRef}
        >
          <div className="flex flex-col gap-6">
            {activeAssistant == null ? (
              <StatePanel
                action={
                  <Link
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border-strong)] px-4 py-2 text-sm font-medium text-[#818cf8] transition duration-300 hover:bg-[var(--app-accent)] hover:text-white"
                    to="/assistant"
                  >
                    {t("chat.states.noAssistantForKnowledgeBaseAction")}
                  </Link>
                }
                description={chatCopy.inputHelpDisabled}
                title={t("chat.states.noAssistantForKnowledgeBaseTitle")}
              />
            ) : resolvedConversationId == null && activeStreamTurn == null ? (
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
                const canCopyAssistantAnswer = isAssistant && !isStreamingAssistant && message.content.trim().length > 0;
                const regenerateQuestion = isAssistant && !isStreamingAssistant ? findRegenerateQuestion(messageIndex) : null;
                const canRegenerateAnswer = Boolean(regenerateQuestion) && !isStreamingTurnActive;
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
                        {isErroredAssistant && "errorMessage" in message ? (
                          <p className="mt-3 text-sm text-red-300">{message.errorMessage}</p>
                        ) : null}
                        {isStoppedAssistant ? (
                          <p className="mt-3 text-sm text-amber-200">{chatCopy.answerStopped}</p>
                        ) : null}
                      </div>

                      <div className="mt-2.5 flex min-h-9 items-center gap-3 px-1">
                        <span className="min-w-0 shrink-0 text-[11px] text-[var(--app-text-muted)]">
                          {messageTime ?? (isStreamingAssistant ? streamStatusLabel : "")}
                        </span>
                        {isAssistant ? (
                          !isStreamingAssistant && traceId ? (
                            <IconActionLink label={chatCopy.viewTrace} to={`/traces/${traceId}`}>
                              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <path d="M4 12h4l2.5-5 3 10 2-5H20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                              </svg>
                            </IconActionLink>
                          ) : (
                            <ActionSlotPlaceholder />
                          )
                        ) : null}
                        {isAssistant ? (
                          !isStreamingAssistant ? (
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
                          ) : (
                            <ActionSlotPlaceholder />
                          )
                        ) : null}
                        {isAssistant ? (
                          canCopyAssistantAnswer ? (
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
                          ) : (
                            <ActionSlotPlaceholder />
                          )
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
                    aria-label={chatCopy.uploadFromLibrary}
                    className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[var(--app-text-muted)] opacity-65"
                    disabled
                    title={chatCopy.uploadFromLibrary}
                    type="button"
                  >
                    <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </button>
                  <button
                    aria-label={isStreamingTurnActive ? chatCopy.stopGenerating : t("common.actions.ask")}
                    className={[
                      "flex h-10 w-10 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--app-accent)_0%,var(--app-accent-strong)_100%)] text-white shadow-[0_4px_16px_var(--app-accent-glow)] transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_24px_var(--app-accent-glow)] disabled:cursor-not-allowed disabled:opacity-60",
                      isStreamingTurnActive ? "animate-pulse ring-2 ring-[var(--app-accent-glow)] ring-offset-2 ring-offset-[var(--app-bg-elevated)]" : ""
                    ].join(" ")}
                    disabled={isStreamingTurnActive ? false : !canSubmitQuestion}
                    onClick={isStreamingTurnActive ? stopGenerating : undefined}
                    title={isStreamingTurnActive ? chatCopy.stopGenerating : t("common.actions.ask")}
                    type={isStreamingTurnActive ? "button" : "submit"}
                  >
                    {isStreamingTurnActive ? (
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
              <span>{chatCopy.uploadFromLibrary}</span>
            </div>
          </form>
        </div>
      </section>

      <Suspense
        fallback={<ChatWorkspacePanelsFallback history={chatCopy.history} />}
      >
        <ChatWorkspacePanels
          activeConversationId={resolvedConversationId}
          chatCopy={{
            conversationLabel: chatCopy.conversationLabel,
            history: chatCopy.history,
            renameConversation: chatCopy.renameConversation,
            deleteConversation: chatCopy.deleteConversation,
            renameConversationPrompt: chatCopy.renameConversationPrompt,
            renameConversationError: chatCopy.renameConversationError,
            deleteConversationConfirm: chatCopy.deleteConversationConfirm,
            deleteConversationError: chatCopy.deleteConversationError,
            newChat: chatCopy.newChat
          }}
          conversations={conversationsForWorkspace}
          conversationsError={conversationsQuery.error}
          conversationsLoading={conversationsQuery.isLoading}
          locale={locale}
          onSelectConversation={conversationId => {
            setActiveConversationId(conversationId);
            setDidAutoSelectConversation(true);
          }}
          onStartNewChat={() => {
            setActiveConversationId(NEW_CHAT_CONVERSATION_ID);
            setActiveStreamTurn(null);
            setDidAutoSelectConversation(true);
          }}
          onRenameConversation={handleRenameConversation}
          onDeleteConversation={handleDeleteConversation}
          t={t}
        />
      </Suspense>
    </div>
  );
}
