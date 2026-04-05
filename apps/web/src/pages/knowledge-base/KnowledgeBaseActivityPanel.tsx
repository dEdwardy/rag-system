import { Badge, Button, Group, Paper, SegmentedControl, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { type ComponentProps, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DocumentRunList } from "../../components/document-runs/DocumentRunList";
import {
  formatRunSourceTypeLabel,
  formatRunTriggerLabel
} from "../../components/document-runs/document-run-observability";
import { StatePanel } from "../../components/StatePanel";
import { useKnowledgeBaseDocumentRuns, useReindexDocument } from "../../features/api/hooks";
import type { SupportedLocale } from "../../i18n/messages";
import type { KnowledgeBaseDocumentRunSummary } from "../../types/api";

type RunFilter = "all" | "failed" | "processing";
type SummaryMetric = {
  key: string;
  heading: string;
  value: number | string;
  valueSize?: "sm";
};

type TranslationFn = (key: string, values?: Record<string, string | number>) => string;

type KnowledgeBaseActivityPanelProps = {
  formatDateTime: (value: string) => string;
  knowledgeBaseId: string;
  latestFailure: KnowledgeBaseDocumentRunSummary["latestFailure"];
  locale: SupportedLocale;
  runSummary: KnowledgeBaseDocumentRunSummary | null;
  t: TranslationFn;
};

type RunRecord = Parameters<NonNullable<ComponentProps<typeof DocumentRunList>["onReindexRun"]>>[0];

export function KnowledgeBaseActivityPanel({ formatDateTime, knowledgeBaseId, latestFailure, locale, runSummary, t }: KnowledgeBaseActivityPanelProps) {
  const [runFilter, setRunFilter] = useState<RunFilter>("all");
  const [isActivityExpanded, setIsActivityExpanded] = useState(false);
  const runStatusFilter = runFilter === "all" ? undefined : runFilter;
  const recentRunsQuery = useKnowledgeBaseDocumentRuns(isActivityExpanded ? knowledgeBaseId : null, {
    limit: 6,
    sinceHours: 72,
    includeDiagnostics: true,
    status: runStatusFilter
  });
  const reindexMutation = useReindexDocument();

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

  const runSummaryMetrics = useMemo<SummaryMetric[]>(
    () =>
      runSummary
        ? [
            {
              key: "total-runs",
              heading: locale === "zh" ? "最近运行总数" : "Recent runs",
              value: runSummary.totalRuns
            },
            {
              key: "retryable-failures",
              heading: locale === "zh" ? "可重试失败" : "Retryable failures",
              value: runSummary.retryableFailures
            },
            {
              key: "latest-finished",
              heading: locale === "zh" ? "最新完成时间" : "Latest finished",
              value: runSummary.latestFinishedAt
                ? formatDateTime(runSummary.latestFinishedAt)
                : locale === "zh"
                  ? "暂无"
                  : "No finished runs yet",
              valueSize: "sm"
            }
          ]
        : [],
    [formatDateTime, locale, runSummary]
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
          message: locale === "zh" ? `已请求重新索引：${run.document.title}` : `Reindex requested for ${run.document.title}`
        });
      } catch (error) {
        notifications.show({
          color: "red",
          message: error instanceof Error ? error.message : locale === "zh" ? "重新索引失败。" : "Reindex failed."
        });
      }
    },
    [locale, reindexMutation]
  );

  return (
    <>
      <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
        <Stack gap="md">
          <div>
            <Text className="workspace-section-heading">{locale === "zh" ? "更新详情" : "Activity details"}</Text>
            <Text className="workspace-section-copy">
              {locale === "zh"
                ? "日常先看上面的设置概览；只有在资料导入或更新看起来不对时，再展开这里查看细节。"
                : "Start with the setup snapshot above. Expand this only when an add or refresh needs a closer look."}
            </Text>
          </div>

          {runSummary == null ? (
            <StatePanel
              title={locale === "zh" ? "加载更新摘要中" : "Loading activity summary"}
              description={
                locale === "zh" ? "正在读取最近 72 小时的资料更新记录。" : "Fetching the most recent 72 hours of library activity."
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
              <SegmentedControl data={runFilterOptions} onChange={handleRunFilterChange} radius="xl" size="sm" value={runFilter} />

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
  );
}
