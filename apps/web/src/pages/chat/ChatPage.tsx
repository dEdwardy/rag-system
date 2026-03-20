import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import {
  useAskAssistant,
  useAssistants,
  useConversationMessages,
  useConversations,
  useConversationTraces
} from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";

export function ChatPage() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const assistantsQuery = useAssistants();
  const conversationsQuery = useConversations();
  const activeAssistant = assistantsQuery.data?.[0] ?? null;
  const messagesQuery = useConversationMessages(activeConversationId);
  const tracesQuery = useConversationTraces(activeConversationId);
  const askMutation = useAskAssistant(activeAssistant?.id ?? "default-assistant");
  const form = useForm({
    initialValues: {
      question: ""
    }
  });

  const latestTrace = tracesQuery.data?.[0] ?? null;
  const latestModelName = latestTrace?.modelName ?? null;
  const canAsk = activeAssistant != null;
  const { t } = useI18n();

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>{t("chat.title")}</Title>
          <Text c="dimmed">
            {t("chat.subtitle")}
          </Text>
        </div>
        {activeAssistant ? (
          <Badge color="teal" variant="light">
            {activeAssistant.name}
          </Badge>
        ) : null}
      </Group>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="md" radius="lg">
            <Stack gap="sm">
              <Text fw={600}>{t("chat.conversations")}</Text>
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
                conversationsQuery.data.map(conversation => (
                  <Button
                    key={conversation.id}
                    justify="flex-start"
                    onClick={() => setActiveConversationId(conversation.id)}
                    variant={activeConversationId === conversation.id ? "filled" : "light"}
                  >
                    {conversation.title}
                  </Button>
                ))
              ) : (
                <StatePanel
                  description={t("chat.states.noConversationsDescription")}
                  title={t("chat.states.noConversationsTitle")}
                />
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="md">
            <Paper p="md" radius="lg" withBorder>
              <ScrollArea.Autosize mah={380}>
                <Stack gap="sm">
                  {activeConversationId == null ? (
                    <StatePanel
                      description={t("chat.states.noActiveConversationDescription")}
                      title={t("chat.states.noActiveConversationTitle")}
                    />
                  ) : messagesQuery.isLoading ? (
                    <StatePanel
                      description={t("chat.states.loadingMessagesDescription")}
                      title={t("chat.states.loadingMessagesTitle")}
                      tone="loading"
                    />
                  ) : messagesQuery.isError ? (
                    <StatePanel
                      description={messagesQuery.error instanceof Error ? messagesQuery.error.message : undefined}
                      title={t("chat.states.messagesErrorTitle")}
                      tone="error"
                    />
                  ) : messagesQuery.data?.length ? (
                    messagesQuery.data.map(message => (
                      <Card key={message.id} padding="sm" radius="md" withBorder>
                        <Group justify="space-between" mb={6}>
                          <Badge variant="light">
                            {t(`common.status.${message.role}`)}
                          </Badge>
                          {message.traceId ? (
                            <Anchor component={Link} size="xs" to={`/traces/${message.traceId}`}>
                              {message.traceId}
                            </Anchor>
                          ) : null}
                        </Group>
                        <Text style={{ whiteSpace: "pre-wrap" }}>{message.content}</Text>
                      </Card>
                    ))
                  ) : (
                    <StatePanel
                      description={t("chat.states.noMessagesDescription")}
                      title={t("chat.states.noMessagesTitle")}
                    />
                  )}
                </Stack>
              </ScrollArea.Autosize>
            </Paper>

            <Paper
              component="form"
              onSubmit={form.onSubmit(async values => {
                try {
                  const result = await askMutation.mutateAsync({
                    question: values.question,
                    conversationId: activeConversationId ?? undefined
                  });
                  setActiveConversationId(result.conversationId);
                  form.reset();
                } catch (error) {
                  notifications.show({
                    color: "red",
                    message: error instanceof Error ? error.message : t("chat.states.askError")
                  });
                }
              })}
              p="md"
              radius="lg"
              withBorder
            >
              <Stack gap="sm">
                <Textarea
                  autosize
                  disabled={!canAsk}
                  minRows={4}
                  placeholder={t("chat.askPlaceholder")}
                  {...form.getInputProps("question")}
                />
                <Group justify="space-between">
                  <Text c="dimmed" size="sm">
                    {canAsk
                      ? t("chat.askHintEnabled")
                      : t("chat.askHintDisabled")}
                  </Text>
                  <Button disabled={!canAsk} loading={askMutation.isPending} type="submit">
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
            {askMutation.isError ? (
              <Alert color="red" variant="light">
                {askMutation.error instanceof Error ? askMutation.error.message : t("chat.states.askError")}
              </Alert>
            ) : null}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="md" radius="lg">
            <Stack gap="sm">
              {latestModelName ? (
                <Badge color="blue" variant="light" w="fit-content">
                  {latestModelName}
                </Badge>
              ) : null}
              <Text fw={600}>{t("chat.latestCitations")}</Text>
              {activeConversationId == null ? (
                <StatePanel
                  description={t("chat.states.noTraceDescription")}
                  title={t("chat.states.noTraceTitle")}
                />
              ) : tracesQuery.isLoading ? (
                <StatePanel
                  description={t("chat.states.loadingTraceDescription")}
                  title={t("chat.states.loadingTraceTitle")}
                  tone="loading"
                />
              ) : tracesQuery.isError ? (
                <StatePanel
                  description={tracesQuery.error instanceof Error ? tracesQuery.error.message : undefined}
                  title={t("chat.states.traceErrorTitle")}
                  tone="error"
                />
              ) : latestTrace?.citationsJson?.length ? (
                <>
                  {latestTrace.citationsJson.map(citation => (
                    <Card key={citation.chunkId} padding="sm" radius="md" withBorder>
                      <Anchor component={Link} fw={600} size="sm" to={`/documents/${citation.documentId}`}>
                        {citation.documentTitle}
                      </Anchor>
                      <Text c="dimmed" size="xs">
                        {t("common.misc.chunkLabel", { chunkId: citation.chunkId })}
                      </Text>
                      <Text mt="xs" size="sm">
                        {citation.snippet}
                      </Text>
                    </Card>
                  ))}
                  <Button component={Link} size="xs" to={`/traces/${latestTrace.id}`} variant="light">
                    {t("common.actions.viewTraceDetails")}
                  </Button>
                </>
              ) : (
                <StatePanel
                  description={t("chat.states.noCitationsDescription")}
                  title={t("chat.states.noCitationsTitle")}
                />
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
