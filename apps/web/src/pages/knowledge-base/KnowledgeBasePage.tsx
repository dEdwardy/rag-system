import { Alert, Badge, Box, Button, Grid, Group, Modal, Paper, SegmentedControl, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { type ComponentProps, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { OauthWorkspaceWelcome } from "../../components/auth/OauthWorkspaceWelcome";
import { DocumentRunList } from "../../components/document-runs/DocumentRunList";
import {
  formatRunSourceTypeLabel,
  formatRunTriggerLabel
} from "../../components/document-runs/document-run-observability";
import { StatePanel } from "../../components/StatePanel";
import {
  useAssistants,
  useCreateKnowledgeBase,
  useDocuments,
  useKnowledgeBaseDocumentRuns,
  useKnowledgeBaseDocumentRunSummary,
  useKnowledgeBases,
  useReindexDocument
} from "../../features/api/hooks";
import { getPrimaryKnowledgeBase } from "../../features/api/workspace-selection";
import { useI18n } from "../../i18n/I18nProvider";
import {
  buildKnowledgeBaseWorkspaceNextAction,
  buildKnowledgeBaseWorkspaceSummary
} from "./knowledge-base-page-helpers";

type RunFilter = "all" | "failed" | "processing";
type RunRecord = Parameters<NonNullable<ComponentProps<typeof DocumentRunList>["onReindexRun"]>>[0];

export function KnowledgeBasePage() {
  const knowledgeBasesQuery = useKnowledgeBases();
  const assistantsQuery = useAssistants();
  const createKnowledgeBaseMutation = useCreateKnowledgeBase();
  const knowledgeBase = getPrimaryKnowledgeBase(knowledgeBasesQuery.data);
  const hasKnowledgeBase = knowledgeBase != null;
  const documentsQuery = useDocuments(knowledgeBase?.id ?? "", hasKnowledgeBase);
  const reindexMutation = useReindexDocument();
  const [runFilter, setRunFilter] = useState<RunFilter>("all");
  const [isCreateKnowledgeBaseOpen, setIsCreateKnowledgeBaseOpen] = useState(false);
  const [isActivityExpanded, setIsActivityExpanded] = useState(false);
  const [createKnowledgeBaseName, setCreateKnowledgeBaseName] = useState("");
  const [createKnowledgeBaseDescription, setCreateKnowledgeBaseDescription] = useState("");
  const [recentlyCreatedKnowledgeBaseName, setRecentlyCreatedKnowledgeBaseName] = useState<string | null>(null);
  const runStatusFilter = runFilter === "all" ? undefined : runFilter;
  const recentRunsQuery = useKnowledgeBaseDocumentRuns(knowledgeBase?.id ?? null, {
    limit: 6,
    sinceHours: 72,
    includeDiagnostics: true,
    status: runStatusFilter
  });
  const runSummaryQuery = useKnowledgeBaseDocumentRunSummary(knowledgeBase?.id ?? null, {
    sinceHours: 72,
    status: runStatusFilter
  });
  const documents = documentsQuery.data ?? [];
  const assistants = assistantsQuery.data ?? [];
  const assistantCount = useMemo(
    () => assistants.filter(assistant => assistant.kbId === knowledgeBase?.id).length,
    [assistants, knowledgeBase?.id]
  );
  const { formatDateTime, t, locale } = useI18n();
  const summary = useMemo(
    () =>
      buildKnowledgeBaseWorkspaceSummary({
        documents,
        assistantCount
      }),
    [documents, assistantCount]
  );
  const nextAction = useMemo(
    () =>
      buildKnowledgeBaseWorkspaceNextAction({
        documents,
        assistantCount
      }),
    [assistantCount, documents]
  );

  const metricCards = useMemo(
    () => [
      {
        key: "documents",
        label: t("common.fields.documents"),
        value: documents.length,
        testId: "knowledge-base-document-count"
      },
      {
        key: "chunks",
        label: t("common.fields.chunks"),
        value: summary.chunkCount,
        testId: "knowledge-base-chunk-count"
      },
      {
        key: "ready",
        label: t("knowledgeBase.metrics.readyDocuments"),
        value: summary.readyCount,
        testId: "knowledge-base-ready-count"
      },
      {
        key: "processing",
        label: t("knowledgeBase.metrics.processingDocuments"),
        value: summary.processingCount,
        testId: "knowledge-base-processing-count"
      },
      {
        key: "failed",
        label: t("knowledgeBase.metrics.failedDocuments"),
        value: summary.failedCount,
        testId: "knowledge-base-failed-count"
      },
      {
        key: "assistants",
        label: t("knowledgeBase.metrics.boundAssistants"),
        value: assistantCount,
        testId: "knowledge-base-assistant-count"
      }
    ],
    [assistantCount, documents.length, summary.chunkCount, summary.failedCount, summary.processingCount, summary.readyCount, t]
  );

  const runFilterOptions = useMemo(
    () => [
      {
        label: locale === "zh" ? "全部" : "All",
        value: "all"
      },
      {
        label: locale === "zh" ? "失败" : "Failed",
        value: "failed"
      },
      {
        label: locale === "zh" ? "处理中" : "Processing",
        value: "processing"
      }
    ],
    [locale]
  );

  const runSummaryMetrics = useMemo(
    () =>
      runSummaryQuery.data
        ? [
            {
              key: "total-runs",
              heading: locale === "zh" ? "最近运行总数" : "Recent runs",
              value: runSummaryQuery.data.totalRuns
            },
            {
              key: "retryable-failures",
              heading: locale === "zh" ? "可重试失败" : "Retryable failures",
              value: runSummaryQuery.data.retryableFailures
            },
            {
              key: "latest-finished",
              heading: locale === "zh" ? "最新完成时间" : "Latest finished",
              value: runSummaryQuery.data.latestFinishedAt
                ? formatDateTime(runSummaryQuery.data.latestFinishedAt)
                : locale === "zh"
                  ? "暂无"
                  : "No finished runs yet",
              valueSize: "sm" as const
            }
          ]
        : [],
    [formatDateTime, locale, runSummaryQuery.data]
  );
  const runSummaryData = runSummaryQuery.data;
  const latestFailure = runSummaryData?.latestFailure ?? null;

  const summaryDotStyle = useMemo(
    () => ({
      width: 10,
      height: 10,
      borderRadius: 999,
      background:
        summary.toneColor === "red"
          ? "#ef4444"
          : summary.toneColor === "yellow"
            ? "#f59e0b"
            : summary.toneColor === "indigo"
              ? "var(--app-accent)"
              : "rgba(255,255,255,0.35)",
      boxShadow:
        summary.toneColor === "gray"
          ? "none"
          : `0 0 0 6px ${summary.toneColor === "indigo" ? "rgba(99, 102, 241, 0.12)" : "rgba(255,255,255,0.06)"}`
    }),
    [summary.toneColor]
  );

  const handleRunFilterChange = useCallback((value: string) => {
    setRunFilter(value as RunFilter);
  }, []);

  const handleCreateKnowledgeBase = useCallback(async () => {
    const normalizedName = createKnowledgeBaseName.trim();
    if (!normalizedName) {
      notifications.show({
        color: "red",
        message: t("knowledgeBase.create.nameRequired")
      });
      return;
    }

    try {
      await createKnowledgeBaseMutation.mutateAsync({
        name: normalizedName,
        description: createKnowledgeBaseDescription.trim() || undefined
      });
      notifications.show({
        color: "teal",
        message: t("knowledgeBase.create.success", { name: normalizedName })
      });
      setRecentlyCreatedKnowledgeBaseName(normalizedName);
      setCreateKnowledgeBaseName("");
      setCreateKnowledgeBaseDescription("");
      setIsCreateKnowledgeBaseOpen(false);
    } catch (error) {
      notifications.show({
        color: "red",
        message: error instanceof Error ? error.message : t("knowledgeBase.create.error")
      });
    }
  }, [createKnowledgeBaseDescription, createKnowledgeBaseMutation, createKnowledgeBaseName, t]);

  const handleReindexRun = useCallback(
    async (run: RunRecord) => {
      if (!("document" in run)) {
        return;
      }

      try {
        await reindexMutation.mutateAsync({
          documentId: run.documentId,
          knowledgeBaseId: run.document.kbId
        });
        notifications.show({
          color: "indigo",
          message:
            locale === "zh"
              ? `已请求重新索引：${run.document.title}`
              : `Reindex requested for ${run.document.title}`
        });
      } catch (error) {
        notifications.show({
          color: "red",
          message:
            error instanceof Error
              ? error.message
              : locale === "zh"
                ? "重新索引失败。"
                : "Reindex failed."
        });
      }
    },
    [locale, reindexMutation]
  );

  return (
    <Stack data-testid="knowledge-base-page" gap="md">
      <Modal
        centered
        opened={isCreateKnowledgeBaseOpen}
        onClose={() => setIsCreateKnowledgeBaseOpen(false)}
        radius="xl"
        title={t("knowledgeBase.create.modalTitle")}
      >
        <Stack gap="md">
          <Text c="var(--app-text-muted)" size="sm">
            {t("knowledgeBase.create.modalDescription")}
          </Text>
          <TextInput
            autoFocus
            classNames={{ input: "workspace-input" }}
            data-testid="knowledge-base-create-name"
            label={t("knowledgeBase.create.nameLabel")}
            onChange={event => setCreateKnowledgeBaseName(event.currentTarget.value)}
            placeholder={t("knowledgeBase.create.namePlaceholder")}
            value={createKnowledgeBaseName}
          />
          <Textarea
            autosize
            classNames={{ input: "workspace-input" }}
            label={t("knowledgeBase.create.descriptionLabel")}
            minRows={3}
            onChange={event => setCreateKnowledgeBaseDescription(event.currentTarget.value)}
            placeholder={t("knowledgeBase.create.descriptionPlaceholder")}
            value={createKnowledgeBaseDescription}
          />
          <Group justify="flex-end">
            <Button color="gray" onClick={() => setIsCreateKnowledgeBaseOpen(false)} radius="xl" variant="light">
              {t("knowledgeBase.create.cancel")}
            </Button>
            <Button
              className="workspace-button"
              color="indigo"
              loading={createKnowledgeBaseMutation.isPending}
              onClick={() => void handleCreateKnowledgeBase()}
              radius="xl"
            >
              {t("knowledgeBase.create.submit")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split">
          <Group gap="md" wrap="nowrap">
            <Box className="workspace-hero-icon">KB</Box>
            <div className="workspace-hero-copy">
              <Text className="workspace-hero-kicker">{locale === "zh" ? "工作区设置" : "Workspace setup"}</Text>
              <Title
                c="var(--app-text)"
                order={3}
                style={{ fontFamily: "var(--app-font-display)", letterSpacing: "-0.03em" }}
              >
                {t("knowledgeBase.title")}
              </Title>
              <Text c="var(--app-text-muted)" mt={4} size="sm">
                {t("knowledgeBase.subtitle")}
              </Text>
            </div>
          </Group>

          <Stack align="flex-end" gap={10}>
            <Group gap="xs">
              <Badge color={summary.toneColor} radius="sm" variant="light">
                {t(summary.toneLabelKey)}
              </Badge>
              {!knowledgeBase ? (
                <Button
                  className="workspace-button"
                  color="indigo"
                  onClick={() => setIsCreateKnowledgeBaseOpen(true)}
                  radius="xl"
                >
                  {t("knowledgeBase.actions.create")}
                </Button>
              ) : null}
              <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/documents" variant="light">
                {t("knowledgeBase.actions.openDocuments")}
              </Button>
              <Button
                className="workspace-button"
                color="indigo"
                component={Link}
                data-testid="knowledge-base-open-assistant"
                radius="xl"
                to="/assistant"
                variant="light"
              >
                {t("knowledgeBase.actions.openAssistant")}
              </Button>
            </Group>
              <Text className="workspace-hero-sidecopy" ta="right">
                {locale === "zh"
                  ? "先确认当前资料归属、可用状态和助手连接，再决定是否继续补资料或调整助手。"
                  : "Review the current library target, readiness, and assistant connection before adding more material or tuning behavior."}
              </Text>
          </Stack>
        </div>
      </Paper>

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
          action={
            <Button
              className="workspace-button"
              color="indigo"
              data-testid="knowledge-base-create-empty-action"
              onClick={() => setIsCreateKnowledgeBaseOpen(true)}
              radius="xl"
              variant="light"
            >
              {t("knowledgeBase.states.emptyAction")}
            </Button>
          }
        />
      ) : null}

      {knowledgeBase ? (
        <>
          {recentlyCreatedKnowledgeBaseName === knowledgeBase.name && documents.length === 0 ? (
            <Alert color="teal" data-testid="knowledge-base-create-success-guide" radius="xl" variant="light">
              <Group align="flex-start" justify="space-between" wrap="wrap">
                <div>
                  <Text c="var(--app-text)" fw={700} size="sm">
                    {t("knowledgeBase.create.nextStepTitle", { name: knowledgeBase.name })}
                  </Text>
                  <Text c="var(--app-text-muted)" mt={4} size="sm">
                    {t("knowledgeBase.create.nextStepDescription")}
                  </Text>
                </div>
                <Group gap="xs">
                  <Button className="workspace-button" color="teal" component={Link} radius="xl" size="xs" to="/documents" variant="light">
                    {t("knowledgeBase.create.nextStepPrimaryAction")}
                  </Button>
                  <Button
                    className="workspace-button"
                    color="gray"
                    onClick={() => setRecentlyCreatedKnowledgeBaseName(null)}
                    radius="xl"
                    size="xs"
                    variant="subtle"
                  >
                    {t("knowledgeBase.create.nextStepDismiss")}
                  </Button>
                </Group>
              </Group>
            </Alert>
          ) : null}

          <OauthWorkspaceWelcome
            assistantCount={assistantCount}
            context="knowledge"
            documentCount={documents.length}
          />

          <div className="workspace-metric-grid">
            {metricCards.map(metric => (
              <Paper className="workspace-metric-card workspace-metric-card-compact" key={metric.key} p="lg" radius="xl">
                <Text c="var(--app-text-secondary)" fw={700} size="xs" tt="uppercase">
                  {metric.label}
                </Text>
                <Title c="var(--app-text)" data-testid={metric.testId} mt={8} order={2}>
                  {metric.value}
                </Title>
              </Paper>
            ))}
          </div>

          <div className="workspace-page-grid">
            <div className="workspace-page-side-stack">
              <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
                <Stack gap="md">
                  <Group align="flex-start" justify="space-between" wrap="nowrap">
                    <div>
                      <Text className="workspace-section-heading">
                        {locale === "zh" ? "当前资料空间" : "Current library space"}
                      </Text>
                      <Title c="var(--app-text)" order={2} style={{ fontFamily: "var(--app-font-display)" }}>
                        {knowledgeBase.name}
                      </Title>
                      <Text c="var(--app-text-muted)" data-testid="knowledge-base-id" size="sm">
                        {knowledgeBase.id}
                      </Text>
                    </div>
                    <Badge color={summary.toneColor} radius="sm" variant="light">
                      {t(summary.toneLabelKey)}
                    </Badge>
                  </Group>

                  <div>
                    <Text className="workspace-section-heading">{t("common.fields.description")}</Text>
                    <Text c="var(--app-text)" mt={6}>
                      {knowledgeBase.description ?? t("common.noDescription")}
                    </Text>
                  </div>

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Text className="workspace-section-heading">{t("common.fields.status")}</Text>
                      <Text c="var(--app-text)" fw={600} mt={6}>
                        {t(`common.status.${knowledgeBase.status}`)}
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Text className="workspace-section-heading">{t("common.fields.updated")}</Text>
                      <Text c="var(--app-text)" fw={600} mt={6}>
                        {formatDateTime(knowledgeBase.updatedAt)}
                      </Text>
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Paper>
            </div>

            <div className="workspace-page-main-stack">
              <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
                <Stack gap="md">
                  <div>
                    <Text className="workspace-section-heading">
                        {locale === "zh" ? "当前设置概览" : "Setup snapshot"}
                    </Text>
                    <Text className="workspace-section-copy">
                      {locale === "zh"
                        ? "把当前可用资料、正在更新的条目和助手连接状态压缩成一眼能扫完的概览。"
                        : "Keep the ready items, in-progress updates, and assistant connection in one quick summary."}
                    </Text>
                  </div>

                  <Paper className="workspace-subpanel" p="md" radius="xl">
                    <Group gap="sm" wrap="nowrap">
                      <Box style={summaryDotStyle} />
                      <Text c="var(--app-text-secondary)" size="sm">
                        {summary.processingCount > 0
                          ? t("knowledgeBase.summary.processingDescription", { count: summary.processingCount })
                          : summary.failedCount > 0
                            ? t("knowledgeBase.summary.failedDescription", { count: summary.failedCount })
                            : summary.readyCount > 0
                              ? t("knowledgeBase.summary.readyDescription", { count: summary.readyCount })
                              : t("knowledgeBase.summary.emptyDescription")}
                      </Text>
                    </Group>
                  </Paper>

                  <Paper className="workspace-subpanel" p="md" radius="xl">
                    <Stack gap={6}>
                      <Text className="workspace-section-heading">{t("knowledgeBase.summary.title")}</Text>
                      <Text c="var(--app-text)" fw={600} size="sm">
                        {t("knowledgeBase.summary.caption", {
                          documents: documents.length,
                          chunks: summary.chunkCount,
                          assistants: assistantCount
                        })}
                      </Text>
                      <Text c="var(--app-text-muted)" size="sm">
                        {summary.tone === "processing"
                          ? locale === "zh"
                            ? "当前仍有资料在导入或更新中。"
                            : "Some library items are still being added or refreshed."
                          : summary.tone === "failed"
                            ? locale === "zh"
                              ? "部分资料还需要处理，之后回答会更稳定。"
                              : "Some library items still need attention before answers become more reliable."
                            : summary.tone === "ready"
                              ? locale === "zh"
                                ? "当前资料已经可以稳定用于提问和助手回答。"
                                : "The current library is ready for chat and assistant responses."
                              : locale === "zh"
                                ? "先添加资料，再逐步建立这个工作区的知识范围。"
                                : "Add library items first to shape what this workspace can answer."}
                      </Text>
                    </Stack>
                  </Paper>

                  <Paper className="workspace-subpanel" p="md" radius="xl">
                    <Stack gap={8}>
                      <Text className="workspace-section-heading">
                        {locale === "zh" ? "推荐下一步" : "Recommended next step"}
                      </Text>
                      <Text c="var(--app-text)" fw={600} size="sm">
                        {t(nextAction.labelKey)}
                      </Text>
                      <Group gap="xs">
                        <Button
                          className="workspace-button"
                          color="indigo"
                          component={Link}
                          radius="xl"
                          size="xs"
                          to={nextAction.actionHref}
                          variant="light"
                        >
                          {nextAction.actionHref === "/documents"
                            ? t("knowledgeBase.actions.openDocuments")
                            : t("knowledgeBase.actions.openAssistant")}
                        </Button>
                        {nextAction.action === "review_failed_documents" && latestFailure ? (
                          <Button
                            className="workspace-button"
                            color="gray"
                            component={Link}
                            radius="xl"
                            size="xs"
                            to={`/documents/${latestFailure.documentId}`}
                            variant="light"
                          >
                            {locale === "zh" ? "查看最新异常资料" : "Open latest item with issues"}
                          </Button>
                        ) : null}
                      </Group>
                    </Stack>
                  </Paper>
                </Stack>
              </Paper>

              <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
                <Stack gap="md">
                  <div>
                    <Text className="workspace-section-heading">
                        {locale === "zh" ? "更新详情" : "Activity details"}
                    </Text>
                    <Text className="workspace-section-copy">
                      {locale === "zh"
                        ? "日常先看上面的设置概览；只有在资料导入或更新看起来不对时，再展开这里查看细节。"
                        : "Start with the setup snapshot above. Expand this only when an add or refresh needs a closer look."}
                    </Text>
                  </div>

                  {runSummaryQuery.isLoading ? (
                    <StatePanel
                      title={locale === "zh" ? "加载更新摘要中" : "Loading activity summary"}
                      description={
                        locale === "zh"
                          ? "正在读取最近 72 小时的资料更新记录。"
                          : "Fetching the most recent 72 hours of library activity."
                      }
                       tone="loading"
                     />
                   ) : runSummaryMetrics.length > 0 ? (
                    <div className="workspace-metric-grid">
                      {runSummaryMetrics.map(metric => (
                        <Paper className="workspace-subpanel" key={metric.key} p="md" radius="xl">
                          <Text className="workspace-section-heading">{metric.heading}</Text>
                          <Text c="var(--app-text)" fw={700} mt={6} size={metric.valueSize}>
                            {metric.value}
                          </Text>
                        </Paper>
                      ))}
                    </div>
                   ) : null}

                  <Group justify="space-between" wrap="wrap">
                    <Text c="var(--app-text-muted)" size="sm">
                      {locale === "zh"
                        ? "这里保留最近 72 小时的资料更新和异常线索。"
                        : "This keeps the last 72 hours of library updates and issue context."}
                    </Text>
                    <Button
                      className="workspace-button"
                      color="gray"
                      onClick={() => setIsActivityExpanded(current => !current)}
                      radius="xl"
                      size="xs"
                      variant="light"
                    >
                      {isActivityExpanded
                        ? locale === "zh"
                          ? "收起更新详情"
                          : "Hide activity details"
                        : locale === "zh"
                          ? "展开更新详情"
                          : "Show activity details"}
                    </Button>
                  </Group>

                  {isActivityExpanded && runSummaryMetrics.length > 0 ? (
                    <>
                      <SegmentedControl
                        data={runFilterOptions}
                        onChange={handleRunFilterChange}
                        radius="xl"
                        size="sm"
                        value={runFilter}
                      />

                      {latestFailure ? (
                        <Paper className="workspace-focus-banner" p="md" radius="xl">
                          <Stack gap={6}>
                            <Text c="var(--app-text)" fw={700} size="sm">
                              {locale === "zh" ? "最近异常记录" : "Latest issue context"}
                            </Text>
                            <Group gap="xs">
                              <Badge color="red" variant="light">
                                {formatRunSourceTypeLabel(latestFailure.sourceType)}
                              </Badge>
                              <Badge color="gray" variant="light">
                                {formatRunTriggerLabel(latestFailure.trigger)}
                              </Badge>
                            </Group>
                            <Text c="var(--app-text-secondary)" size="sm">
                              {latestFailure.message ??
                                (locale === "zh" ? "暂时没有更多异常说明。" : "No additional issue details were recorded.")}
                            </Text>
                            <Group gap="xs">
                              <Button
                                className="workspace-button"
                                color="indigo"
                                component={Link}
                                radius="xl"
                                size="xs"
                                to={`/documents/${latestFailure.documentId}`}
                                variant="light"
                              >
                                {locale === "zh" ? "查看资料" : "Open item"}
                              </Button>
                            </Group>
                          </Stack>
                        </Paper>
                      ) : null}
                    </>
                  ) : null}
                </Stack>
              </Paper>
            </div>
          </div>

          {isActivityExpanded && recentRunsQuery.isError ? (
            <StatePanel
              title={locale === "zh" ? "加载最近更新失败" : "Failed to load recent activity"}
              description={
                recentRunsQuery.error instanceof Error
                  ? recentRunsQuery.error.message
                  : locale === "zh"
                    ? "最近的资料更新记录暂时不可用。"
                    : "Recent library activity is currently unavailable."
              }
              tone="error"
            />
          ) : isActivityExpanded ? (
            <DocumentRunList
              title={locale === "zh" ? "最近更新记录" : "Recent update activity"}
              description={
                locale === "zh"
                  ? "按时间展示最近的资料导入与更新记录，优先帮助你判断哪些内容已经就绪，哪些还需要处理。"
                  : "Recent add and refresh runs ordered by time so you can quickly see what is ready and what still needs attention."
              }
              runs={recentRunsQuery.data ?? []}
              emptyTitle={locale === "zh" ? "还没有更新记录" : "No recent activity yet"}
              emptyDescription={
                locale === "zh"
                  ? "当前工作区还没有可展示的资料更新记录。"
                  : "This workspace does not have recent library activity yet."
              }
              onReindexRun={handleReindexRun}
            />
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
