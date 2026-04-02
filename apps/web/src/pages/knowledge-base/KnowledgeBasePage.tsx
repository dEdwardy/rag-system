import { Badge, Box, Button, Grid, Group, Paper, SegmentedControl, Stack, Text, Title } from "@mantine/core";
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
  useDocuments,
  useKnowledgeBaseDocumentRuns,
  useKnowledgeBaseDocumentRunSummary,
  useKnowledgeBases,
  useReindexDocument
} from "../../features/api/hooks";
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
  const knowledgeBase = knowledgeBasesQuery.data?.[0] ?? null;
  const hasKnowledgeBase = knowledgeBase != null;
  const documentsQuery = useDocuments(knowledgeBase?.id ?? "", hasKnowledgeBase);
  const reindexMutation = useReindexDocument();
  const [runFilter, setRunFilter] = useState<RunFilter>("all");
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
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split">
          <Group gap="md" wrap="nowrap">
            <Box className="workspace-hero-icon">KB</Box>
            <div className="workspace-hero-copy">
              <Text className="workspace-hero-kicker">
                {locale === "zh" ? "知识库工作台" : "Knowledge workspace"}
              </Text>
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
                ? "用同一套工作台语言集中展示 corpus 覆盖、处理状态和助手绑定关系。"
                : "Keep the operational summary tight and readable without pushing metrics into a long side rail."}
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
        />
      ) : null}

      {knowledgeBase ? (
        <>
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
                        {locale === "zh" ? "知识库身份" : "Knowledge base identity"}
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
                      {locale === "zh" ? "工作台读数" : "Workspace readout"}
                    </Text>
                    <Text className="workspace-section-copy">
                      {locale === "zh"
                        ? "把当前可检索资料、处理中任务和助手绑定关系压缩到一眼能扫完的摘要里。"
                        : "Keep corpus coverage, queue state, and assistant binding in one compact operational readout."}
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
                            ? "当前仍有 ingestion 正在队列中推进。"
                            : "Active ingestion is still moving through the queue."
                          : summary.tone === "failed"
                            ? locale === "zh"
                              ? "部分资料需要处理后，检索质量才会稳定。"
                              : "Some source material needs attention before retrieval quality stabilizes."
                            : summary.tone === "ready"
                              ? locale === "zh"
                                ? "当前资料已经可以稳定用于检索和助手问答。"
                                : "The current corpus is ready for retrieval and assistant usage."
                              : locale === "zh"
                                ? "先添加文档，再逐步形成知识库主体。"
                                : "Add source documents to start shaping the knowledge base."}
                      </Text>
                    </Stack>
                  </Paper>

                  <Paper className="workspace-subpanel" p="md" radius="xl">
                    <Stack gap={8}>
                      <Text className="workspace-section-heading">
                        {locale === "zh" ? "下一步动作" : "Next action"}
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
                            {locale === "zh" ? "打开最新失败文档" : "Open latest failed document"}
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
                      {locale === "zh" ? "Recent source runs" : "Recent source runs"}
                    </Text>
                    <Text className="workspace-section-copy">
                      {locale === "zh"
                        ? "先承载最近执行概况、最新失败上下文和最小 run 列表，不把这里扩成诊断工作台。"
                        : "Surface a recent execution readout, the latest failure anchor, and a small run list without turning this page into a diagnostics workbench."}
                    </Text>
                  </div>

                  <SegmentedControl
                    data={runFilterOptions}
                    onChange={handleRunFilterChange}
                    radius="xl"
                    size="sm"
                    value={runFilter}
                  />

                  {runSummaryQuery.isLoading ? (
                    <StatePanel
                      title={locale === "zh" ? "加载 run 摘要中" : "Loading run summary"}
                      description={
                        locale === "zh"
                          ? "正在读取最近 72 小时 source runs。"
                          : "Fetching the most recent 72 hours of source runs."
                      }
                      tone="loading"
                    />
                  ) : null}

                  {runSummaryMetrics.length > 0 ? (
                    <>
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

                      {latestFailure ? (
                        <Paper className="workspace-focus-banner" p="md" radius="xl">
                          <Stack gap={6}>
                            <Text c="var(--app-text)" fw={700} size="sm">
                              {locale === "zh" ? "最新失败上下文" : "Latest failure context"}
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
                                (locale === "zh" ? "暂无 message。" : "No failure message recorded.")}
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
                                {locale === "zh" ? "查看文档" : "Open document"}
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

          <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
            <Stack gap="xs">
              <Title c="var(--app-text)" order={4}>
                {t("knowledgeBase.summary.title")}
              </Title>
              <Text c="var(--app-text-muted)">
                {t("knowledgeBase.summary.caption", {
                  documents: documents.length,
                  chunks: summary.chunkCount,
                  assistants: assistantCount
                })}
              </Text>
              {documents.length === 0 ? (
                <StatePanel
                  title={t("knowledgeBase.states.noDocumentsTitle")}
                  description={t("knowledgeBase.states.noDocumentsDescription")}
                  action={
                    <Button className="workspace-button" color="indigo" component={Link} radius="xl" size="xs" to="/documents" variant="light">
                      {t("knowledgeBase.actions.openDocuments")}
                    </Button>
                  }
                />
              ) : (
                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Paper className="workspace-subpanel" p="md" radius="xl">
                      <Text className="workspace-section-heading">
                        {locale === "zh" ? "语料覆盖" : "Corpus coverage"}
                      </Text>
                      <Text c="var(--app-text)" fw={600} mt={6} size="sm">
                        {summary.readyCount} ready / {documents.length} total
                      </Text>
                    </Paper>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Paper className="workspace-subpanel" p="md" radius="xl">
                      <Text className="workspace-section-heading">
                        {locale === "zh" ? "检索材料" : "Retrieval material"}
                      </Text>
                      <Text c="var(--app-text)" fw={600} mt={6} size="sm">
                        {summary.chunkCount} chunks available for retrieval.
                      </Text>
                    </Paper>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Paper className="workspace-subpanel" p="md" radius="xl">
                      <Text className="workspace-section-heading">
                        {locale === "zh" ? "助手绑定" : "Assistant binding"}
                      </Text>
                      <Text c="var(--app-text)" fw={600} mt={6} size="sm">
                        {assistantCount} assistant{assistantCount === 1 ? "" : "s"} currently attached.
                      </Text>
                    </Paper>
                  </Grid.Col>
                </Grid>
              )}
            </Stack>
          </Paper>

          {recentRunsQuery.isError ? (
            <StatePanel
              title={locale === "zh" ? "加载 recent runs 失败" : "Failed to load recent runs"}
              description={
                recentRunsQuery.error instanceof Error
                  ? recentRunsQuery.error.message
                  : locale === "zh"
                    ? "最近 source runs 暂时不可用。"
                    : "Recent source runs are currently unavailable."
              }
              tone="error"
            />
          ) : (
            <DocumentRunList
              title={locale === "zh" ? "Knowledge base recent runs" : "Knowledge base recent runs"}
              description={
                locale === "zh"
                  ? "按最近时间展示已有 source/document runs，先优先承载状态、触发方式、来源类型、起止时间和失败上下文。"
                  : "Recent source/document runs ordered by time, carrying status, trigger, source type, timing, and failure context first."
              }
              runs={recentRunsQuery.data ?? []}
              emptyTitle={locale === "zh" ? "暂无 recent runs" : "No recent runs yet"}
              emptyDescription={
                locale === "zh"
                  ? "当前知识库还没有可展示的 source run 历史。"
                  : "This knowledge base does not have recent source run history yet."
              }
              onReindexRun={handleReindexRun}
            />
          )}
        </>
      ) : null}
    </Stack>
  );
}
