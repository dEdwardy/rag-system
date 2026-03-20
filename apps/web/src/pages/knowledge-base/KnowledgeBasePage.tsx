import { Alert, Badge, Button, Card, Grid, Group, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import { useAssistants, useDocuments, useKnowledgeBases } from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";

export function KnowledgeBasePage() {
  const knowledgeBasesQuery = useKnowledgeBases();
  const assistantsQuery = useAssistants();
  const knowledgeBase = knowledgeBasesQuery.data?.[0] ?? null;
  const documentsQuery = useDocuments(knowledgeBase?.id ?? "default-kb");
  const documents = documentsQuery.data ?? [];
  const assistants = assistantsQuery.data ?? [];
  const chunkCount = documents.reduce((sum, document) => sum + document.chunkCount, 0);
  const readyCount = documents.filter(document => document.status === "ready").length;
  const processingCount = documents.filter(
    document => document.status === "pending" || document.status === "processing"
  ).length;
  const failedCount = documents.filter(document => document.status === "failed").length;
  const assistantCount = assistants.filter(assistant => assistant.kbId === knowledgeBase?.id).length;
  const { formatDateTime, t } = useI18n();

  const knowledgeBaseTone =
    failedCount > 0 ? "failed" : processingCount > 0 ? "processing" : readyCount > 0 ? "ready" : "empty";
  const toneColor =
    knowledgeBaseTone === "failed"
      ? "red"
      : knowledgeBaseTone === "processing"
        ? "yellow"
        : knowledgeBaseTone === "ready"
          ? "teal"
          : "gray";
  const toneLabelKey =
    knowledgeBaseTone === "failed"
      ? "knowledgeBase.summary.failed"
      : knowledgeBaseTone === "processing"
        ? "knowledgeBase.summary.processing"
        : knowledgeBaseTone === "ready"
          ? "knowledgeBase.summary.ready"
          : "knowledgeBase.summary.empty";

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t("knowledgeBase.title")}</Title>
        <Text c="dimmed">{t("knowledgeBase.subtitle")}</Text>
      </div>

      {knowledgeBasesQuery.isLoading ? (
        <StatePanel
          title={t("knowledgeBase.states.loadingTitle")}
          description={t("knowledgeBase.states.loadingDescription")}
          tone="loading"
        />
      ) : null}

      {knowledgeBasesQuery.isError ? (
        <StatePanel
          title={t("knowledgeBase.states.loadErrorTitle")}
          description={
            knowledgeBasesQuery.error instanceof Error
              ? knowledgeBasesQuery.error.message
              : t("knowledgeBase.states.loadErrorDescription")
          }
          tone="error"
        />
      ) : null}

      {assistantsQuery.isError ? (
        <StatePanel
          title={t("knowledgeBase.states.assistantsErrorTitle")}
          description={
            assistantsQuery.error instanceof Error
              ? assistantsQuery.error.message
              : t("knowledgeBase.states.assistantsErrorDescription")
          }
          tone="error"
        />
      ) : null}

      {documentsQuery.isError ? (
        <StatePanel
          title={t("knowledgeBase.states.documentsErrorTitle")}
          description={
            documentsQuery.error instanceof Error
              ? documentsQuery.error.message
              : t("knowledgeBase.states.documentsErrorDescription")
          }
          tone="error"
        />
      ) : null}

      {!knowledgeBasesQuery.isLoading && !knowledgeBasesQuery.isError && !knowledgeBase ? (
        <StatePanel
          title={t("knowledgeBase.states.emptyTitle")}
          description={t("knowledgeBase.states.emptyDescription")}
        />
      ) : null}

      {knowledgeBase ? (
        <Grid align="stretch" gutter="lg">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Card withBorder padding="lg" radius="lg">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text c="dimmed" size="sm">
                      {t("common.fields.name")}
                    </Text>
                    <Title order={3}>{knowledgeBase.name}</Title>
                  </div>
                  <Badge color={toneColor} variant="light">
                    {t(toneLabelKey)}
                  </Badge>
                </Group>

                <div>
                  <Text c="dimmed" size="sm">
                    {t("common.fields.description")}
                  </Text>
                  <Text>{knowledgeBase.description ?? t("common.noDescription")}</Text>
                </div>

                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Text c="dimmed" size="sm">
                      {t("common.fields.status")}
                    </Text>
                    <Text fw={600}>{t(`common.status.${knowledgeBase.status}`)}</Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Text c="dimmed" size="sm">
                      {t("common.fields.updated")}
                    </Text>
                    <Text fw={600}>{formatDateTime(knowledgeBase.updatedAt)}</Text>
                  </Grid.Col>
                </Grid>

                <Alert color={toneColor} variant="light">
                  {processingCount > 0
                    ? t("knowledgeBase.summary.processingDescription", { count: processingCount })
                    : failedCount > 0
                      ? t("knowledgeBase.summary.failedDescription", { count: failedCount })
                      : readyCount > 0
                        ? t("knowledgeBase.summary.readyDescription", { count: readyCount })
                        : t("knowledgeBase.summary.emptyDescription")}
                </Alert>

                <Group>
                  <Button component={Link} to="/documents" variant="light">
                    {t("knowledgeBase.actions.openDocuments")}
                  </Button>
                  <Button component={Link} to="/assistant" variant="light">
                    {t("knowledgeBase.actions.openAssistant")}
                  </Button>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 5 }}>
            <Grid gutter="md">
              <Grid.Col span={{ base: 6, sm: 4, md: 6 }}>
                <Card withBorder padding="lg" radius="lg">
                  <Text c="dimmed" size="sm">
                    {t("common.fields.documents")}
                  </Text>
                  <Title order={3}>{documents.length}</Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 4, md: 6 }}>
                <Card withBorder padding="lg" radius="lg">
                  <Text c="dimmed" size="sm">
                    {t("common.fields.chunks")}
                  </Text>
                  <Title order={3}>{chunkCount}</Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 4, md: 6 }}>
                <Card withBorder padding="lg" radius="lg">
                  <Text c="dimmed" size="sm">
                    {t("knowledgeBase.metrics.readyDocuments")}
                  </Text>
                  <Title order={3}>{readyCount}</Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 4, md: 6 }}>
                <Card withBorder padding="lg" radius="lg">
                  <Text c="dimmed" size="sm">
                    {t("knowledgeBase.metrics.processingDocuments")}
                  </Text>
                  <Title order={3}>{processingCount}</Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 4, md: 6 }}>
                <Card withBorder padding="lg" radius="lg">
                  <Text c="dimmed" size="sm">
                    {t("knowledgeBase.metrics.failedDocuments")}
                  </Text>
                  <Title order={3}>{failedCount}</Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 4, md: 6 }}>
                <Card withBorder padding="lg" radius="lg">
                  <Text c="dimmed" size="sm">
                    {t("knowledgeBase.metrics.boundAssistants")}
                  </Text>
                  <Title order={3}>{assistantCount}</Title>
                </Card>
              </Grid.Col>
            </Grid>
          </Grid.Col>

          <Grid.Col span={{ base: 12 }}>
            <Card withBorder padding="lg" radius="lg">
              <Stack gap="xs">
                <Title order={4}>{t("knowledgeBase.summary.title")}</Title>
                <Text c="dimmed">
                  {t("knowledgeBase.summary.caption", {
                    documents: documents.length,
                    chunks: chunkCount,
                    assistants: assistantCount
                  })}
                </Text>
                {documents.length === 0 ? (
                  <StatePanel
                    title={t("knowledgeBase.states.noDocumentsTitle")}
                    description={t("knowledgeBase.states.noDocumentsDescription")}
                    action={
                      <Button component={Link} size="xs" to="/documents" variant="light">
                        {t("knowledgeBase.actions.openDocuments")}
                      </Button>
                    }
                  />
                ) : null}
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      ) : null}
    </Stack>
  );
}
