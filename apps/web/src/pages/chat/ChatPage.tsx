import {
  ActionIcon,
  Alert,
  Anchor,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title,
  UnstyledButton
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { startTransition, useEffect, useState } from "react";
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

type DisplayedMessage =
  | Message
  | ChatStreamUserMessage
  | ChatStreamAssistantMessage;

export function ChatPage() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeStreamTurn, setActiveStreamTurn] = useState<ActiveStreamTurn | null>(null);

  const assistantsQuery = useAssistants();
  const conversationsQuery = useConversations();
  const activeAssistant = assistantsQuery.data?.[0] ?? null;
  const messagesQuery = useConversationMessages(activeConversationId);
  const tracesQuery = useConversationTraces(activeConversationId);
  const askStreamMutation = useAskAssistantStream(activeAssistant?.id ?? "default-assistant");

  const queryClient = useQueryClient();
  const { locale, t } = useI18n();
  const form = useForm({
    initialValues: {
      question: ""
    }
  });

  const latestTrace = tracesQuery.data?.[0] ?? null;
  const latestModelName = activeStreamTurn?.latestResult?.modelName ?? latestTrace?.modelName ?? null;
  const canAsk = activeAssistant != null && !askStreamMutation.isPending;
  const streamConversationId = activeStreamTurn?.latestResult?.conversationId ?? activeStreamTurn?.conversationId ?? null;
  const shouldRenderStreamTurn =
    activeStreamTurn != null &&
    (activeConversationId == null || streamConversationId == null || streamConversationId === activeConversationId);

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

  const displayedMessages: DisplayedMessage[] = [...(messagesQuery.data ?? [])];

  if (shouldRenderStreamTurn && activeStreamTurn) {
    displayedMessages.push(activeStreamTurn.userMessage, activeStreamTurn.assistantMessage);
  }

  const citationItems: Citation[] =
    activeStreamTurn?.assistantMessage.citations.length
      ? activeStreamTurn.assistantMessage.citations
      : latestTrace?.citationsJson ?? [];
  const activeTraceId = activeStreamTurn?.assistantMessage.traceId ?? latestTrace?.id ?? null;
  const activeCitationCount = citationItems.length;

  const getCitationContext = (citation: Citation) =>
    buildCitationContext(citation, {
      pageLabel: pageNo => t("common.misc.pageLong", { pageNo })
    });

  const renderMessage = (message: DisplayedMessage) => {
    const isAssistant = message.role === "assistant";
    const isStreamingAssistant =
      "status" in message && message.role === "assistant" && message.status === "streaming";
    const isErroredAssistant =
      "status" in message && message.role === "assistant" && message.status === "error";
    const traceId = "traceId" in message ? message.traceId : null;
    const messageTime = "createdAt" in message ? formatMessageTime(message.createdAt, locale) : null;

    return (
      <Box
        key={message.id}
        style={{
          display: "flex",
          justifyContent: isAssistant ? "flex-start" : "flex-end"
        }}
      >
        <Group
          align="flex-end"
          gap="sm"
          style={{
            flexDirection: isAssistant ? "row" : "row-reverse",
            maxWidth: "92%"
          }}
          wrap="nowrap"
        >
          <Avatar
            color={isAssistant ? "gray" : "indigo"}
            radius="xl"
            size={36}
            styles={{
              root: isAssistant
                ? {
                    background: "rgba(255,255,255,0.06)",
                    color: "var(--app-text)"
                  }
                : {
                    background:
                      "linear-gradient(135deg, var(--app-accent) 0%, var(--app-accent-strong) 100%)",
                    color: "white"
                  }
            }}
          >
            {isAssistant ? "AI" : "U"}
          </Avatar>

          <Paper
            p="md"
            radius="xl"
            style={{
              minWidth: 0,
              background: isAssistant
                ? "linear-gradient(180deg, rgba(37, 40, 57, 0.98) 0%, rgba(30, 32, 46, 0.98) 100%)"
                : "linear-gradient(135deg, var(--app-accent) 0%, var(--app-accent-strong) 100%)",
              border: isAssistant
                ? "1px solid var(--app-border)"
                : "1px solid rgba(255,255,255,0.08)",
              boxShadow: isAssistant
                ? "var(--app-shadow-soft)"
                : "0 18px 38px var(--app-accent-glow)"
            }}
          >
            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap="xs">
                  <Badge radius="sm" variant={isAssistant ? "light" : "filled"}>
                    {t(`common.status.${message.role}`)}
                  </Badge>
                  {isStreamingAssistant ? (
                    <Badge color="orange" radius="sm" variant="light">
                      {locale === "zh" ? "生成中" : "Streaming"}
                    </Badge>
                  ) : null}
                  {isErroredAssistant ? (
                    <Badge color="red" radius="sm" variant="light">
                      {locale === "zh" ? "失败" : "Failed"}
                    </Badge>
                  ) : null}
                </Group>
                {traceId ? (
                  <Anchor
                    c={isAssistant ? undefined : "rgba(255,255,255,0.84)"}
                    component={Link}
                    size="xs"
                    to={`/traces/${traceId}`}
                  >
                    {traceId}
                  </Anchor>
                ) : null}
              </Group>

              <Text c={isAssistant ? "var(--app-text)" : "white"} style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                {message.content || (isStreamingAssistant ? (locale === "zh" ? "正在生成回答..." : "Drafting answer...") : "")}
              </Text>

              {isStreamingAssistant ? (
                <Group gap={6}>
                  {[0.95, 0.72, 0.5].map(opacity => (
                    <Box
                      key={opacity}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: "#d97706",
                        opacity
                      }}
                    />
                  ))}
                </Group>
              ) : null}

              <Group justify="space-between">
                <Text c={isAssistant ? "var(--app-text-muted)" : "rgba(255,255,255,0.78)"} size="xs">
                  {messageTime ?? (isStreamingAssistant ? streamStatusLabel : "")}
                </Text>
              </Group>

              {isErroredAssistant && "errorMessage" in message ? (
                <Alert color="red" radius="lg" variant="light">
                  {message.errorMessage}
                </Alert>
              ) : null}
            </Stack>
          </Paper>
        </Group>
      </Box>
    );
  };

  return (
    <Stack gap="md">
      <Paper
        p="md"
        radius="xl"
        style={{
          background: "rgba(20, 22, 34, 0.82)",
          border: "1px solid var(--app-border)",
          boxShadow: "var(--app-shadow-soft)",
          backdropFilter: "blur(18px)"
        }}
      >
        <Group align="center" justify="space-between">
          <Group align="center" gap="md">
            <Avatar
              color="indigo"
              radius="xl"
              size={48}
              styles={{
                root: {
                  background: "linear-gradient(135deg, var(--app-accent) 0%, var(--app-accent-strong) 100%)",
                  boxShadow: "0 12px 30px var(--app-accent-glow)"
                }
              }}
            >
              AI
            </Avatar>
            <Stack gap={6}>
              <Group gap="xs">
                <Title
                  order={4}
                  c="var(--app-text)"
                  style={{ fontFamily: "var(--app-font-display)", letterSpacing: "-0.03em" }}
                >
                  {t("chat.title")}
                </Title>
                {activeAssistant ? (
                  <Badge color="indigo" radius="sm" size="lg" variant="filled">
                    {activeAssistant.name}
                  </Badge>
                ) : null}
              </Group>
              <Text c="var(--app-text-muted)" maw={560} size="sm">
                {t("chat.subtitle")}
              </Text>
              <Group gap="xs" mt={2}>
                <Badge color="indigo" radius="sm" size="md" variant="light">
                  {locale === "zh" ? "在线" : "Online"}
                </Badge>
                {latestModelName ? (
                  <Badge color="gray" radius="sm" size="md" variant="light">
                    {latestModelName}
                  </Badge>
                ) : null}
                {streamStatusLabel ? (
                  <Badge color="orange" radius="sm" size="md" variant="light">
                    {streamStatusLabel}
                  </Badge>
                ) : null}
              </Group>
            </Stack>
          </Group>

          <Box
            style={{
              minWidth: 220,
              maxWidth: 280,
              padding: "12px 14px",
              borderRadius: 18,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--app-border)"
            }}
          >
            <Text c="var(--app-text-muted)" size="xs" tt="uppercase">
              {locale === "zh" ? "体验目标" : "Experience goal"}
            </Text>
            <Text c="var(--app-text)" fw={600} mt={6} size="sm">
              {locale === "zh"
                ? "让身份、状态、时间和输入区更贴近高频对话工作台。"
                : "Bring identity, status, timing, and the composer closer to a real chat workspace"}
            </Text>
          </Box>
        </Group>
      </Paper>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Paper
            p="md"
            radius="xl"
            style={{
              background: "linear-gradient(180deg, rgba(24, 26, 38, 0.96) 0%, rgba(21, 23, 34, 0.94) 100%)",
              border: "1px solid var(--app-border)",
              boxShadow: "var(--app-shadow-soft)"
            }}
          >
            <Stack gap="md">
              <Group justify="space-between">
                <Text c="var(--app-text-secondary)" fw={700} size="sm" tt="uppercase">
                  {t("chat.conversations")}
                </Text>
                <Group gap="xs">
                  {conversationsQuery.data?.length ? (
                    <Badge color="indigo" radius="sm" variant="light">
                      {conversationsQuery.data.length}
                    </Badge>
                  ) : null}
                  <Button
                    color="indigo"
                    disabled={askStreamMutation.isPending}
                    onClick={() => setActiveConversationId(null)}
                    radius="xl"
                    size="xs"
                    variant="light"
                  >
                    {locale === "zh" ? "新会话" : "New chat"}
                  </Button>
                </Group>
              </Group>

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
                <Stack gap="xs">
                  {conversationsQuery.data.map(conversation => {
                    const isActive = activeConversationId === conversation.id;

                    return (
                      <UnstyledButton
                        key={conversation.id}
                        onClick={() => setActiveConversationId(conversation.id)}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "12px 14px",
                          minHeight: 72,
                          borderRadius: 18,
                          textAlign: "left",
                          background: isActive
                            ? "linear-gradient(135deg, rgba(109, 114, 255, 0.2) 0%, rgba(109, 114, 255, 0.08) 100%)"
                            : "rgba(255,255,255,0.03)",
                          border: isActive
                            ? "1px solid rgba(109, 114, 255, 0.36)"
                            : "1px solid var(--app-border)",
                          boxShadow: isActive
                            ? "0 16px 34px rgba(109, 114, 255, 0.14)"
                            : "none"
                        }}
                      >
                        <Stack gap={8}>
                          <Group justify="space-between" wrap="nowrap">
                            <Text c="var(--app-text)" fw={600} lineClamp={2} size="sm">
                              {conversation.title}
                            </Text>
                            {isActive ? (
                              <Badge color="indigo" radius="sm" size="xs" variant="light">
                                {locale === "zh" ? "当前" : "Active"}
                              </Badge>
                            ) : null}
                          </Group>
                          <Text c="var(--app-text-muted)" size="xs">
                            {formatConversationUpdatedAt(conversation.updatedAt, locale)}
                          </Text>
                        </Stack>
                      </UnstyledButton>
                    );
                  })}
                </Stack>
              ) : (
                <StatePanel
                  description={t("chat.states.noConversationsDescription")}
                  title={t("chat.states.noConversationsTitle")}
                />
              )}
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="md">
            <Paper
              p="lg"
              radius="xl"
              style={{
                background:
                  "linear-gradient(180deg, rgba(24, 26, 38, 0.98) 0%, rgba(19, 21, 32, 0.98) 100%)",
                border: "1px solid var(--app-border)",
                boxShadow: "var(--app-shadow-strong)"
              }}
            >
              <Stack gap="md">
                <Group justify="space-between">
                  <Group align="center" gap="sm">
                    <Avatar
                      color="gray"
                      radius="xl"
                      size={42}
                      styles={{
                        root: {
                          background: "rgba(255,255,255,0.06)",
                          color: "var(--app-text)"
                        }
                      }}
                    >
                      AI
                    </Avatar>
                    <div>
                      <Text c="var(--app-text-secondary)" fw={700} size="sm" tt="uppercase">
                        {locale === "zh" ? "对话工作区" : "Conversation workspace"}
                      </Text>
                      <Text c="var(--app-text-muted)" size="sm">
                        {activeConversationId
                          ? locale === "zh"
                            ? "历史消息、流式回答与最新引用会在这里汇合。"
                            : "History, streamed answers, and the latest citations meet here."
                          : locale === "zh"
                            ? "发送第一个问题即可开始新会话。"
                            : "Send the first question to start a new session."}
                      </Text>
                    </div>
                  </Group>
                  {askStreamMutation.isPending ? <Loader color="indigo" size="sm" /> : null}
                </Group>

                <Divider color="var(--app-border)" />

                <Box
                  style={{
                    borderRadius: 22,
                    background:
                      "linear-gradient(180deg, rgba(14, 16, 25, 0.92) 0%, rgba(18, 20, 30, 0.86) 100%)",
                    border: "1px solid var(--app-border)",
                    padding: 14
                  }}
                >
                  <ScrollArea.Autosize mah={500} offsetScrollbars>
                    <Stack gap="md">
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
                        displayedMessages.map(renderMessage)
                      ) : (
                        <StatePanel
                          description={t("chat.states.noMessagesDescription")}
                          title={t("chat.states.noMessagesTitle")}
                        />
                      )}
                    </Stack>
                  </ScrollArea.Autosize>
                </Box>
              </Stack>
            </Paper>

            <Paper
              component="form"
              onSubmit={form.onSubmit(async values => {
                const question = values.question.trim();
                if (!question || !activeAssistant) {
                  return;
                }

                const pendingTurn = createPendingChatTurn({
                  question
                });

                setActiveStreamTurn({
                  conversationId: activeConversationId,
                  phase: "started",
                  userMessage: pendingTurn.userMessage,
                  assistantMessage: pendingTurn.assistantMessage,
                  latestResult: null
                });
                form.reset();

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
              })}
              p="md"
              radius="xl"
              style={{
                background: "rgba(20, 22, 34, 0.92)",
                border: "1px solid var(--app-border)",
                boxShadow: "var(--app-shadow-soft)"
              }}
            >
              <Stack gap="sm">
                <Group justify="space-between">
                  <div>
                    <Text c="var(--app-text-secondary)" fw={700} size="sm" tt="uppercase">
                      {locale === "zh" ? "提问输入区" : "Question composer"}
                    </Text>
                    <Text c="var(--app-text-muted)" size="sm">
                      {activeStreamTurn && activeStreamTurn.assistantMessage.status === "streaming"
                        ? streamStatusLabel
                        : canAsk
                          ? locale === "zh"
                            ? "消息会立即出现，回答会随着流式返回逐步展开。"
                            : "Your message appears immediately and the answer reveals progressively."
                          : t("chat.askHintDisabled")}
                    </Text>
                  </div>
                  {activeAssistant ? (
                    <Badge color="indigo" radius="sm" variant="filled">
                      {activeAssistant.name}
                    </Badge>
                  ) : null}
                </Group>

                <Group align="flex-end" gap="sm" wrap="nowrap">
                  <Textarea
                    autosize
                    disabled={!canAsk}
                    minRows={3}
                    placeholder={t("chat.askPlaceholder")}
                    radius="xl"
                    styles={{
                      root: {
                        flex: 1
                      },
                      input: {
                        background: "rgba(255,255,255,0.04)",
                        color: "var(--app-text)",
                        border: "1px solid var(--app-border)",
                        fontSize: 15,
                        lineHeight: 1.7,
                        padding: "16px 18px",
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.01)"
                      }
                    }}
                    {...form.getInputProps("question")}
                  />

                  <ActionIcon
                    aria-label={t("common.actions.ask")}
                    color="indigo"
                    disabled={!canAsk}
                    loading={askStreamMutation.isPending}
                    radius="xl"
                    size={52}
                    type="submit"
                    variant="filled"
                  >
                    <svg
                      aria-hidden="true"
                      fill="none"
                      height="18"
                      viewBox="0 0 24 24"
                      width="18"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M5 12H19M19 12L13 6M19 12L13 18"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  </ActionIcon>
                </Group>
              </Stack>
            </Paper>

            {assistantsQuery.isError ? (
              <StatePanel
                description={assistantsQuery.error instanceof Error ? assistantsQuery.error.message : undefined}
                title={t("chat.states.assistantErrorTitle")}
                tone="error"
              />
            ) : null}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Paper
            p="md"
            radius="xl"
            style={{
              background: "linear-gradient(180deg, rgba(24, 26, 38, 0.96) 0%, rgba(21, 23, 34, 0.94) 100%)",
              border: "1px solid var(--app-border)",
              boxShadow: "var(--app-shadow-soft)"
            }}
          >
            <Stack gap="md">
              <div>
                <Text c="var(--app-text-secondary)" fw={700} size="sm" tt="uppercase">
                  {t("chat.latestCitations")}
                </Text>
                <Text c="var(--app-text-muted)" size="sm">
                  {locale === "zh"
                    ? "优先展示当前流式回答的引用，其次展示最新 trace。"
                    : "Current streamed answer citations take priority, then the latest trace."}
                </Text>
              </div>

              {(activeConversationId != null || activeStreamTurn != null) && (
                <Paper
                  p="sm"
                  radius="lg"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--app-border)"
                  }}
                >
                  <Group justify="space-between">
                    <div>
                      <Text c="var(--app-text-muted)" size="xs" tt="uppercase">
                        {locale === "zh" ? "当前上下文" : "Current context"}
                      </Text>
                      <Text c="var(--app-text)" fw={600} size="sm">
                        {activeCitationCount > 0
                          ? locale === "zh"
                            ? `已捕获 ${activeCitationCount} 条引用`
                            : `${activeCitationCount} citations captured`
                          : locale === "zh"
                            ? "等待引用返回"
                            : "Waiting for citations"}
                      </Text>
                    </div>
                    {activeTraceId ? (
                      <Badge color="indigo" radius="sm" variant="light">
                        Trace
                      </Badge>
                    ) : null}
                  </Group>
                </Paper>
              )}

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
                <Stack gap="sm">
                  {citationItems.map(citation => {
                    const citationContext = getCitationContext(citation);

                    return (
                      <Paper
                        key={citation.chunkId}
                        p="sm"
                        radius="lg"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid var(--app-border)",
                          boxShadow: "none"
                        }}
                      >
                        <Stack gap={8}>
                          <Anchor c="var(--app-text)" component={Link} fw={700} size="sm" to={`/documents/${citation.documentId}`}>
                            {citation.documentTitle}
                          </Anchor>
                          <Group gap={6}>
                            <Badge color="indigo" radius="sm" size="xs" variant="light">
                              {t("common.misc.chunkLabel", { chunkId: citation.chunkId })}
                            </Badge>
                            {citationContext ? (
                              <Text c="var(--app-text-muted)" size="xs">
                                {citationContext}
                              </Text>
                            ) : null}
                          </Group>
                          <Text c="var(--app-text-secondary)" size="sm" style={{ lineHeight: 1.65 }}>
                            {citation.snippet}
                          </Text>
                        </Stack>
                      </Paper>
                    );
                  })}
                  {activeTraceId ? (
                    <Button color="indigo" component={Link} radius="xl" size="sm" to={`/traces/${activeTraceId}`} variant="light">
                      {t("common.actions.viewTraceDetails")}
                    </Button>
                  ) : null}
                </Stack>
              ) : (
                <StatePanel
                  description={t("chat.states.noCitationsDescription")}
                  title={t("chat.states.noCitationsTitle")}
                />
              )}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
