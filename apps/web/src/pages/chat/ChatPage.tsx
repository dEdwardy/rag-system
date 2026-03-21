import {
  Alert,
  Anchor,
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
  Title
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { startTransition, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  applyChatStreamEvent,
  createPendingChatTurn,
  type ChatStreamAssistantMessage,
  type ChatStreamEvent,
  type ChatStreamUserMessage
} from "./chat-stream-state";

type ActiveStreamTurn = {
  conversationId: string | null;
  phase: "started" | "generating";
  userMessage: ChatStreamUserMessage;
  assistantMessage: ChatStreamAssistantMessage;
  latestResult: AskStreamFinalData | null;
};

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
  const form = useForm({
    initialValues: {
      question: ""
    }
  });

  const latestTrace = tracesQuery.data?.[0] ?? null;
  const latestModelName = activeStreamTurn?.latestResult?.modelName ?? latestTrace?.modelName ?? null;
  const canAsk = activeAssistant != null && !askStreamMutation.isPending;
  const { locale, t } = useI18n();
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
          : locale === "zh"
            ? "正在生成回答"
            : "Generating answer";

  const displayedMessages: Array<
    | Message
    | (ChatStreamUserMessage & { createdAt?: string })
    | (ChatStreamAssistantMessage & { createdAt?: string })
  > = [...(messagesQuery.data ?? [])];

  if (shouldRenderStreamTurn && activeStreamTurn) {
    displayedMessages.push(activeStreamTurn.userMessage, activeStreamTurn.assistantMessage);
  }

  const citationItems: Citation[] =
    activeStreamTurn?.assistantMessage.citations.length
      ? activeStreamTurn.assistantMessage.citations
      : latestTrace?.citationsJson ?? [];
  const activeTraceId = activeStreamTurn?.assistantMessage.traceId ?? latestTrace?.id ?? null;

  return (
    <Stack gap="lg">
      <Paper
        p="xl"
        radius="xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(246, 242, 235, 0.98) 0%, rgba(234, 240, 236, 0.96) 100%)",
          border: "1px solid rgba(23, 36, 30, 0.10)"
        }}
      >
        <Group align="flex-start" justify="space-between">
          <Stack gap={8}>
            <Title order={2} style={{ letterSpacing: "-0.03em" }}>
              {t("chat.title")}
            </Title>
            <Text c="dimmed" maw={720} size="sm">
              {t("chat.subtitle")}
            </Text>
            <Group gap="xs" mt="xs">
              {activeAssistant ? (
                <Badge color="teal" radius="sm" size="lg" variant="filled">
                  {activeAssistant.name}
                </Badge>
              ) : null}
              {latestModelName ? (
                <Badge color="dark" radius="sm" size="lg" variant="light">
                  {latestModelName}
                </Badge>
              ) : null}
              {streamStatusLabel ? (
                <Badge color="orange" radius="sm" size="lg" variant="light">
                  {streamStatusLabel}
                </Badge>
              ) : null}
            </Group>
          </Stack>
          <Box
            style={{
              minWidth: 220,
              padding: "14px 16px",
              borderRadius: 18,
              background: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(23, 36, 30, 0.08)"
            }}
          >
            <Text c="dimmed" size="xs" tt="uppercase">
              {locale === "zh" ? "体验目标" : "Experience goal"}
            </Text>
            <Text fw={600} mt={6} size="sm">
              {locale === "zh" ? "更快反馈、更强层级、更清晰引用" : "Faster feedback, stronger hierarchy, clearer citations"}
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
              background: "rgba(248, 245, 240, 0.82)",
              border: "1px solid rgba(23, 36, 30, 0.08)"
            }}
          >
            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={700} size="sm" tt="uppercase">
                  {t("chat.conversations")}
                </Text>
                {conversationsQuery.data?.length ? (
                  <Badge radius="sm" variant="light">
                    {conversationsQuery.data.length}
                  </Badge>
                ) : null}
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
                  {conversationsQuery.data.map(conversation => (
                    <Button
                      key={conversation.id}
                      justify="space-between"
                      onClick={() => setActiveConversationId(conversation.id)}
                      radius="lg"
                      style={{
                        minHeight: 54
                      }}
                      variant={activeConversationId === conversation.id ? "filled" : "subtle"}
                    >
                      <Text lineClamp={2} size="sm">
                        {conversation.title}
                      </Text>
                    </Button>
                  ))}
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
                background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246, 243, 238, 0.98) 100%)",
                border: "1px solid rgba(23, 36, 30, 0.08)"
              }}
            >
              <Stack gap="sm">
                <Group justify="space-between">
                  <div>
                    <Text fw={700} size="sm" tt="uppercase">
                      {locale === "zh" ? "对话工作区" : "Conversation workspace"}
                    </Text>
                    <Text c="dimmed" size="sm">
                      {activeConversationId
                        ? locale === "zh"
                          ? "已连接历史消息与最新引用。"
                          : "History and latest citations are connected."
                        : locale === "zh"
                          ? "发送第一个问题即可开始新的会话。"
                          : "Send the first question to start a new session."}
                    </Text>
                  </div>
                  {askStreamMutation.isPending ? <Loader color="teal" size="sm" /> : null}
                </Group>

                <Divider color="rgba(23, 36, 30, 0.08)" />

                <ScrollArea.Autosize mah={460} offsetScrollbars>
                  <Stack gap="sm">
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

                        return (
                          <Paper
                            key={message.id}
                            p="md"
                            radius="xl"
                            style={{
                              alignSelf: isAssistant ? "stretch" : "flex-end",
                              background: isAssistant
                                ? "rgba(255,255,255,0.84)"
                                : "linear-gradient(135deg, rgba(22, 78, 99, 0.96) 0%, rgba(33, 110, 92, 0.94) 100%)",
                              border: isAssistant
                                ? "1px solid rgba(23, 36, 30, 0.08)"
                                : "1px solid rgba(255,255,255,0.08)",
                              boxShadow: isAssistant
                                ? "none"
                                : "0 14px 32px rgba(17, 24, 39, 0.18)"
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
                                      {locale === "zh" ? "流式中" : "Streaming"}
                                    </Badge>
                                  ) : null}
                                  {isErroredAssistant ? (
                                    <Badge color="red" radius="sm" variant="light">
                                      {locale === "zh" ? "失败" : "Failed"}
                                    </Badge>
                                  ) : null}
                                </Group>
                                {traceId ? (
                                  <Anchor component={Link} size="xs" to={`/traces/${traceId}`}>
                                    {traceId}
                                  </Anchor>
                                ) : null}
                              </Group>

                              <Text
                                c={isAssistant ? undefined : "white"}
                                style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}
                              >
                                {message.content || (isStreamingAssistant ? (locale === "zh" ? "正在生成回答…" : "Drafting answer...") : "")}
                              </Text>

                              {isStreamingAssistant ? (
                                <Box
                                  style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 999,
                                    background: "#d97706",
                                    opacity: 0.85
                                  }}
                                />
                              ) : null}

                              {isErroredAssistant && "errorMessage" in message ? (
                                <Alert color="red" radius="lg" variant="light">
                                  {message.errorMessage}
                                </Alert>
                              ) : null}
                            </Stack>
                          </Paper>
                        );
                      })
                    ) : (
                      <StatePanel
                        description={t("chat.states.noMessagesDescription")}
                        title={t("chat.states.noMessagesTitle")}
                      />
                    )}
                  </Stack>
                </ScrollArea.Autosize>
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
                    current
                      && current.assistantMessage.status !== "error"
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
              p="lg"
              radius="xl"
              style={{
                background: "linear-gradient(180deg, rgba(25, 30, 28, 0.96) 0%, rgba(39, 48, 44, 0.96) 100%)",
                color: "white"
              }}
            >
              <Stack gap="sm">
                <Group justify="space-between">
                  <div>
                    <Text fw={700} size="sm" tt="uppercase">
                      {locale === "zh" ? "提问输入区" : "Question composer"}
                    </Text>
                    <Text c="rgba(255,255,255,0.72)" size="sm">
                      {canAsk ? t("chat.askHintEnabled") : t("chat.askHintDisabled")}
                    </Text>
                  </div>
                  {activeAssistant ? (
                    <Badge color="teal" radius="sm" variant="filled">
                      {activeAssistant.name}
                    </Badge>
                  ) : null}
                </Group>

                <Textarea
                  autosize
                  disabled={!canAsk}
                  minRows={4}
                  placeholder={t("chat.askPlaceholder")}
                  radius="lg"
                  styles={{
                    input: {
                      background: "rgba(255,255,255,0.92)",
                      border: "none",
                      fontSize: 16,
                      lineHeight: 1.7
                    }
                  }}
                  {...form.getInputProps("question")}
                />

                <Group justify="space-between">
                  <Text c="rgba(255,255,255,0.72)" size="sm">
                    {activeStreamTurn && activeStreamTurn.assistantMessage.status === "streaming"
                      ? streamStatusLabel
                      : canAsk
                        ? locale === "zh"
                          ? "发送后会立即显示用户消息，并渐进展示回答。"
                          : "Your message appears immediately and the answer reveals progressively."
                        : t("chat.askHintDisabled")}
                  </Text>
                  <Button
                    color="teal"
                    disabled={!canAsk}
                    loading={askStreamMutation.isPending}
                    radius="xl"
                    size="md"
                    type="submit"
                  >
                    {t("common.actions.ask")}
                  </Button>
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
              background: "rgba(243, 247, 244, 0.92)",
              border: "1px solid rgba(23, 36, 30, 0.08)"
            }}
          >
            <Stack gap="md">
              <div>
                <Text fw={700} size="sm" tt="uppercase">
                  {t("chat.latestCitations")}
                </Text>
                <Text c="dimmed" size="sm">
                  {locale === "zh" ? "优先展示当前流式回答的引用，其次显示最新 trace。" : "Current streamed answer citations take priority, then the latest trace."}
                </Text>
              </div>

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
                  {citationItems.map(citation => (
                    <Paper
                      key={citation.chunkId}
                      p="sm"
                      radius="lg"
                      style={{
                        background: "rgba(255,255,255,0.86)",
                        border: "1px solid rgba(23, 36, 30, 0.08)"
                      }}
                    >
                      <Stack gap={6}>
                        <Anchor component={Link} fw={700} size="sm" to={`/documents/${citation.documentId}`}>
                          {citation.documentTitle}
                        </Anchor>
                        <Text c="dimmed" size="xs">
                          {t("common.misc.chunkLabel", { chunkId: citation.chunkId })}
                        </Text>
                        <Text size="sm" style={{ lineHeight: 1.6 }}>
                          {citation.snippet}
                        </Text>
                      </Stack>
                    </Paper>
                  ))}
                  {activeTraceId ? (
                    <Button component={Link} radius="xl" size="sm" to={`/traces/${activeTraceId}`} variant="light">
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
