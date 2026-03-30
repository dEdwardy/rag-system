import { Badge, Button, Paper } from "@mantine/core";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import {
  useApiHealth,
  useAssistants,
  useAuditEvents,
  useConversations,
  useDocuments,
  useKnowledgeBaseDocumentRuns,
  useKnowledgeBaseDocumentRunComparison,
  useKnowledgeBaseDocumentRunSummary,
  useKnowledgeBases
} from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";
import type {
  KnowledgeBaseDocumentRunComparisonRunDifference,
  KnowledgeBaseDocumentRunComparisonSnapshotDifference,
  KnowledgeBaseDocumentRunComparisonSourceFamilyDelta
} from "../../types/api";

export function UsagePage() {
  const knowledgeBasesQuery = useKnowledgeBases();
  const assistantsQuery = useAssistants();
  const conversationsQuery = useConversations();
  const apiHealthQuery = useApiHealth();
  const auditEventsQuery = useAuditEvents({ issueOnly: true, sinceHours: 24, limit: 5 });
  const issueTrend1hQuery = useAuditEvents({ issueOnly: true, sinceHours: 1, limit: 100 });
  const issueTrend6hQuery = useAuditEvents({ issueOnly: true, sinceHours: 6, limit: 100 });
  const issueTrend24hQuery = useAuditEvents({ issueOnly: true, sinceHours: 24, limit: 100 });
  const activeKnowledgeBase = knowledgeBasesQuery.data?.[0] ?? null;
  const hasActiveKnowledgeBase = activeKnowledgeBase != null;
  const documentsQuery = useDocuments(activeKnowledgeBase?.id ?? "", hasActiveKnowledgeBase);
  const runSummary1hQuery = useKnowledgeBaseDocumentRunSummary(activeKnowledgeBase?.id ?? null, { sinceHours: 1 });
  const runSummary6hQuery = useKnowledgeBaseDocumentRunSummary(activeKnowledgeBase?.id ?? null, { sinceHours: 6 });
  const runSummaryQuery = useKnowledgeBaseDocumentRunSummary(activeKnowledgeBase?.id ?? null, { sinceHours: 24 });
  const anomalyRunsQuery = useKnowledgeBaseDocumentRuns(activeKnowledgeBase?.id ?? null, {
    issueOnly: true,
    sinceHours: 24,
    limit: 100
  });
  const latestIssueRunPair = useMemo(() => {
    const issueRuns = anomalyRunsQuery.data ?? [];
    if (issueRuns.length < 2) {
      return null;
    }

    return {
      leftRunId: issueRuns[1].id,
      rightRunId: issueRuns[0].id
    };
  }, [anomalyRunsQuery.data]);
  const runDiffQuery = useKnowledgeBaseDocumentRunComparison(
    activeKnowledgeBase?.id ?? null,
    latestIssueRunPair ?? {
      leftRunId: "",
      rightRunId: ""
    },
    latestIssueRunPair != null
  );
  const snapshotWindowDiffQuery = useKnowledgeBaseDocumentRunComparison(activeKnowledgeBase?.id ?? null, {
    issueOnly: true,
    leftSinceHours: 6,
    rightSinceHours: 24
  });
  const { locale } = useI18n();

  const documents = documentsQuery.data ?? [];
  const assistants = assistantsQuery.data ?? [];
  const conversations = conversationsQuery.data ?? [];
  const { readyDocuments, processingDocuments, failedDocuments, totalChunks } = useMemo(
    () =>
      documents.reduce(
        (acc, document) => {
          acc.totalChunks += document.chunkCount;
          if (document.status === "ready") {
            acc.readyDocuments += 1;
          } else if (document.status === "pending" || document.status === "processing") {
            acc.processingDocuments += 1;
          } else if (document.status === "failed") {
            acc.failedDocuments += 1;
          }

          return acc;
        },
        {
          readyDocuments: 0,
          processingDocuments: 0,
          failedDocuments: 0,
          totalChunks: 0
        }
      ),
    [documents]
  );

  const metrics = useMemo(
    () => [
      { label: locale === "zh" ? "知识库" : "Knowledge bases", value: knowledgeBasesQuery.data?.length ?? 0 },
      { label: locale === "zh" ? "文档" : "Documents", value: documents.length },
      { label: locale === "zh" ? "Chunk" : "Chunks", value: totalChunks },
      { label: locale === "zh" ? "助手" : "Assistants", value: assistants.length },
      { label: locale === "zh" ? "会话" : "Conversations", value: conversations.length },
      { label: locale === "zh" ? "就绪文档" : "Ready docs", value: readyDocuments }
    ],
    [assistants.length, conversations.length, documents.length, knowledgeBasesQuery.data?.length, locale, readyDocuments, totalChunks]
  );

  const hasError = useMemo(
    () =>
      knowledgeBasesQuery.isError ||
      assistantsQuery.isError ||
      conversationsQuery.isError ||
      documentsQuery.isError,
    [assistantsQuery.isError, conversationsQuery.isError, documentsQuery.isError, knowledgeBasesQuery.isError]
  );
  const isUsageLoading = useMemo(
    () =>
      !hasError &&
      (knowledgeBasesQuery.isLoading ||
        assistantsQuery.isLoading ||
        conversationsQuery.isLoading ||
        documentsQuery.isLoading),
    [assistantsQuery.isLoading, conversationsQuery.isLoading, documentsQuery.isLoading, hasError, knowledgeBasesQuery.isLoading]
  );

  const runSummary = runSummaryQuery.data;
  const runSummaryBySourceFamily = (
    runSummary as
      | (typeof runSummary & {
          bySourceFamily?: Record<
            string,
            {
              failedRuns: number;
              runsWithBoundaryHit: number;
              totalRuns: number;
            }
          >;
        })
      | undefined
  )?.bySourceFamily;
  const runSummary1h = runSummary1hQuery.data;
  const runSummary6h = runSummary6hQuery.data;
  const pendingRunCount =
    (runSummary?.byStatus.pending ?? 0) + (runSummary?.byStatus.processing ?? 0);
  const recentIssueCount = auditEventsQuery.data?.length ?? 0;
  const issueTrend1h = issueTrend1hQuery.data?.length ?? 0;
  const issueTrend6h = issueTrend6hQuery.data?.length ?? 0;
  const issueTrend24h = issueTrend24hQuery.data?.length ?? 0;
  const isApiHealthy = apiHealthQuery.data?.status === "ok";
  const retryableFailureCount = runSummary?.retryableFailures ?? 0;
  const nonRetryableFailureCount = runSummary?.nonRetryableFailures ?? 0;
  const hasRecentFailure = retryableFailureCount + nonRetryableFailureCount > 0;
  const hasDocumentRunHistory = (runSummary?.totalRuns ?? 0) > 0;
  const boundaryHitCount = runSummary?.boundaryStats.runsWithBoundaryHit ?? 0;
  const healthSignals = useMemo(
    () => [
      {
        label: locale === "zh" ? "API" : "API",
        tone: isApiHealthy ? "green" : apiHealthQuery.isLoading ? "gray" : "red",
        value: isApiHealthy
          ? locale === "zh"
            ? "正常"
            : "healthy"
          : apiHealthQuery.isLoading
            ? locale === "zh"
              ? "检查中"
              : "checking"
            : locale === "zh"
              ? "不可用"
              : "unhealthy"
      },
      {
        label: locale === "zh" ? "运行积压" : "Run backlog",
        tone: pendingRunCount > 0 ? "yellow" : "green",
        value: pendingRunCount > 0 ? `${pendingRunCount}` : locale === "zh" ? "无" : "none"
      },
      {
        label: locale === "zh" ? "最近 24h 问题事件" : "Issue events (24h)",
        tone: recentIssueCount > 0 ? "orange" : "green",
        value: String(recentIssueCount)
      },
      {
        label: locale === "zh" ? "失败运行" : "Failed runs",
        tone: hasRecentFailure ? "red" : "green",
        value: hasRecentFailure
          ? `${retryableFailureCount} / ${nonRetryableFailureCount}`
          : locale === "zh"
            ? "无"
            : "none"
      }
    ],
    [
      apiHealthQuery.isLoading,
      hasRecentFailure,
      isApiHealthy,
      locale,
      pendingRunCount,
      recentIssueCount,
      nonRetryableFailureCount,
      retryableFailureCount
    ]
  );

  const alertItems = useMemo(
    () => {
      const alerts: Array<{
        id: string;
        tone: "red" | "orange" | "yellow";
        title: string;
        detail: string;
        actionLabel: string;
        actionTo: string;
      }> = [];

      if (!apiHealthQuery.isLoading && !isApiHealthy) {
        alerts.push({
          id: "api-unhealthy",
          tone: "red",
          title: locale === "zh" ? "API 不可用" : "API unavailable",
          detail:
            locale === "zh"
              ? "健康探针未返回 ok，优先检查 API 进程与基础依赖。"
              : "Health probe is not ok; check API process and dependencies first.",
          actionLabel: locale === "zh" ? "查看 Trace" : "Open traces",
          actionTo: "/traces"
        });
      }

      if (nonRetryableFailureCount > 0) {
        alerts.push({
          id: "non-retryable-failures",
          tone: "red",
          title: locale === "zh" ? "存在不可重试失败" : "Non-retryable failures detected",
          detail:
            locale === "zh"
              ? `最近 24h 有 ${nonRetryableFailureCount} 条不可重试失败运行。`
              : `${nonRetryableFailureCount} non-retryable failed runs in the last 24h.`,
          actionLabel: locale === "zh" ? "查看运行摘要" : "Open run summary",
          actionTo: "/knowledge-base"
        });
      }

      if (pendingRunCount >= 3) {
        alerts.push({
          id: "run-backlog-threshold",
          tone: pendingRunCount >= 10 ? "orange" : "yellow",
          title: locale === "zh" ? "运行积压触发阈值" : "Run backlog threshold reached",
          detail:
            locale === "zh"
              ? `当前积压 ${pendingRunCount} 条（阈值 >= 3）。`
              : `Current backlog is ${pendingRunCount} (threshold >= 3).`,
          actionLabel: locale === "zh" ? "查看运行摘要" : "Open run summary",
          actionTo: "/knowledge-base"
        });
      }

      if (retryableFailureCount >= 3) {
        alerts.push({
          id: "retryable-failure-threshold",
          tone: "orange",
          title: locale === "zh" ? "可重试失败超过阈值" : "Retryable-failure threshold reached",
          detail:
            locale === "zh"
              ? `最近 24h 可重试失败 ${retryableFailureCount} 条（阈值 >= 3）。`
              : `${retryableFailureCount} retryable failed runs in the last 24h (threshold >= 3).`,
          actionLabel: locale === "zh" ? "查看运行摘要" : "Open run summary",
          actionTo: "/knowledge-base"
        });
      }

      if (recentIssueCount >= 5) {
        alerts.push({
          id: "issue-events-threshold",
          tone: "orange",
          title: locale === "zh" ? "问题事件超过阈值" : "Issue-event threshold reached",
          detail:
            locale === "zh"
              ? `最近 24h 问题事件 ${recentIssueCount} 条（阈值 >= 5）。`
              : `${recentIssueCount} issue events in the last 24h (threshold >= 5).`,
          actionLabel: locale === "zh" ? "查看 Trace" : "Open traces",
          actionTo: "/traces"
        });
      }

      if (boundaryHitCount > 0) {
        alerts.push({
          id: "boundary-hit",
          tone: "yellow",
          title: locale === "zh" ? "检测到边界截断" : "Boundary truncation observed",
          detail:
            locale === "zh"
              ? `最近 24h 有 ${boundaryHitCount} 次 source 边界命中。`
              : `${boundaryHitCount} source boundary-hit runs in the last 24h.`,
          actionLabel: locale === "zh" ? "查看运行摘要" : "Open run summary",
          actionTo: "/knowledge-base"
        });
      }

      return alerts;
    },
    [
      apiHealthQuery.isLoading,
      boundaryHitCount,
      isApiHealthy,
      locale,
      nonRetryableFailureCount,
      pendingRunCount,
      recentIssueCount,
      retryableFailureCount
    ]
  );

  const healthPanelErrorMessage =
    (apiHealthQuery.error instanceof Error && apiHealthQuery.error.message) ||
    (runSummaryQuery.error instanceof Error && runSummaryQuery.error.message) ||
    (auditEventsQuery.error instanceof Error && auditEventsQuery.error.message) ||
    null;
  const showP6PreRunGuidance =
    !healthPanelErrorMessage &&
    !runSummaryQuery.isLoading &&
    runSummary != null &&
    !hasDocumentRunHistory;

  const trendPanelErrorMessage =
    (runSummary1hQuery.error instanceof Error && runSummary1hQuery.error.message) ||
    (runSummary6hQuery.error instanceof Error && runSummary6hQuery.error.message) ||
    (runSummaryQuery.error instanceof Error && runSummaryQuery.error.message) ||
    (issueTrend1hQuery.error instanceof Error && issueTrend1hQuery.error.message) ||
    (issueTrend6hQuery.error instanceof Error && issueTrend6hQuery.error.message) ||
    (issueTrend24hQuery.error instanceof Error && issueTrend24hQuery.error.message) ||
    null;

  const trendMetrics = useMemo(
    () => [
      {
        key: "failed-runs",
        label: locale === "zh" ? "失败运行" : "Failed runs",
        values: [runSummary1h?.byStatus.failed ?? 0, runSummary6h?.byStatus.failed ?? 0, runSummary?.byStatus.failed ?? 0]
      },
      {
        key: "retryable-failures",
        label: locale === "zh" ? "可重试失败" : "Retryable failures",
        values: [runSummary1h?.retryableFailures ?? 0, runSummary6h?.retryableFailures ?? 0, runSummary?.retryableFailures ?? 0]
      },
      {
        key: "non-retryable-failures",
        label: locale === "zh" ? "不可重试失败" : "Non-retryable failures",
        values: [runSummary1h?.nonRetryableFailures ?? 0, runSummary6h?.nonRetryableFailures ?? 0, runSummary?.nonRetryableFailures ?? 0]
      },
      {
        key: "boundary-hits",
        label: locale === "zh" ? "边界命中" : "Boundary hits",
        values: [
          runSummary1h?.boundaryStats.runsWithBoundaryHit ?? 0,
          runSummary6h?.boundaryStats.runsWithBoundaryHit ?? 0,
          runSummary?.boundaryStats.runsWithBoundaryHit ?? 0
        ]
      },
      {
        key: "issue-events",
        label: locale === "zh" ? "问题事件" : "Issue events",
        values: [issueTrend1h, issueTrend6h, issueTrend24h]
      }
    ],
    [
      issueTrend1h,
      issueTrend24h,
      issueTrend6h,
      locale,
      runSummary?.boundaryStats.runsWithBoundaryHit,
      runSummary?.byStatus.failed,
      runSummary?.nonRetryableFailures,
      runSummary?.retryableFailures,
      runSummary1h?.boundaryStats.runsWithBoundaryHit,
      runSummary1h?.byStatus.failed,
      runSummary1h?.nonRetryableFailures,
      runSummary1h?.retryableFailures,
      runSummary6h?.boundaryStats.runsWithBoundaryHit,
      runSummary6h?.byStatus.failed,
      runSummary6h?.nonRetryableFailures,
      runSummary6h?.retryableFailures
    ]
  );

  const isTrendLoading =
    runSummary1hQuery.isLoading ||
    runSummary6hQuery.isLoading ||
    runSummaryQuery.isLoading ||
    issueTrend1hQuery.isLoading ||
    issueTrend6hQuery.isLoading ||
    issueTrend24hQuery.isLoading;

  const anomalyPanelErrorMessage =
    (anomalyRunsQuery.error instanceof Error && anomalyRunsQuery.error.message) ||
    null;
  const runDiffPanelErrorMessage =
    (runDiffQuery.error instanceof Error && runDiffQuery.error.message) ||
    null;
  const snapshotWindowDiffPanelErrorMessage =
    (snapshotWindowDiffQuery.error instanceof Error && snapshotWindowDiffQuery.error.message) ||
    null;

  const anomalyClusters = useMemo(
    () => {
      const clusters = new Map<
        string,
        {
          count: number;
          failedStage: string;
          code: string;
          retryable: boolean;
          sourceTypeCounts: Record<string, number>;
          latestAt: string;
          sampleMessage: string | null;
        }
      >();

      for (const run of anomalyRunsQuery.data ?? []) {
        const summary = run.failureSummary;
        if (!summary) {
          continue;
        }

        const failedStage = summary.failedStage ?? run.failedStage ?? "unknown";
        const code = summary.code ?? "UNKNOWN_FAILURE";
        const retryable = summary.retryable;
        const sourceType = run.document.sourceType || "unknown";
        const clusterKey = `${failedStage}::${code}::${retryable ? "retryable" : "non_retryable"}`;

        const current = clusters.get(clusterKey);
        const runAt = run.finishedAt ?? run.startedAt;
        if (!current) {
          clusters.set(clusterKey, {
            count: 1,
            failedStage,
            code,
            retryable,
            sourceTypeCounts: { [sourceType]: 1 },
            latestAt: runAt,
            sampleMessage: summary.message ?? null
          });
          continue;
        }

        current.count += 1;
        current.sourceTypeCounts[sourceType] = (current.sourceTypeCounts[sourceType] ?? 0) + 1;
        if (runAt > current.latestAt) {
          current.latestAt = runAt;
        }
        if (!current.sampleMessage && summary.message) {
          current.sampleMessage = summary.message;
        }
      }

      return Array.from(clusters.values())
        .sort((left, right) => {
          if (right.count !== left.count) {
            return right.count - left.count;
          }
          return right.latestAt.localeCompare(left.latestAt);
        })
        .map(cluster => ({
          ...cluster,
          sourceTypes: Object.entries(cluster.sourceTypeCounts)
            .sort((left, right) => right[1] - left[1])
            .map(([sourceType, count]) => `${sourceType} (${count})`)
        }));
    },
    [anomalyRunsQuery.data]
  );

  const sourceFamilyHotspot = useMemo(() => {
    const sourceFamilyEntries = Object.entries(runSummaryBySourceFamily ?? {}).filter(
      ([, stats]) => stats.failedRuns > 0 || stats.runsWithBoundaryHit > 0
    );

    if (sourceFamilyEntries.length === 0) {
      return null;
    }

    const [family, stats] = sourceFamilyEntries.sort((left, right) => {
      if (right[1].failedRuns !== left[1].failedRuns) {
        return right[1].failedRuns - left[1].failedRuns;
      }

      if (right[1].runsWithBoundaryHit !== left[1].runsWithBoundaryHit) {
        return right[1].runsWithBoundaryHit - left[1].runsWithBoundaryHit;
      }

      return right[1].totalRuns - left[1].totalRuns;
    })[0];

    return {
      family,
      stats
    };
  }, [runSummaryBySourceFamily]);

  const snapshotWindowSourceFamilyDrilldown = useMemo(() => {
    if (snapshotWindowDiffQuery.data?.mode !== "snapshot") {
      return null;
    }

    const deltas = snapshotWindowDiffQuery.data.sourceFamilyDeltas ?? [];
    if (deltas.length === 0) {
      return null;
    }

    const getDeltaImpact = (delta: KnowledgeBaseDocumentRunComparisonSourceFamilyDelta) =>
      Math.abs(delta.deltas.failedRuns) +
      Math.abs(delta.deltas.runsWithBoundaryHit) +
      Math.abs(delta.deltas.retryableFailures) +
      Math.abs(delta.deltas.nonRetryableFailures);

    let driver: KnowledgeBaseDocumentRunComparisonSourceFamilyDelta | null = null;
    let driverImpact = Number.NEGATIVE_INFINITY;
    let driverTotalRunDelta = Number.NEGATIVE_INFINITY;

    for (const delta of deltas) {
      const deltaImpact = getDeltaImpact(delta);
      const totalRunDelta = Math.abs(delta.deltas.totalRuns);

      if (deltaImpact > driverImpact || (deltaImpact === driverImpact && totalRunDelta > driverTotalRunDelta)) {
        driver = delta;
        driverImpact = deltaImpact;
        driverTotalRunDelta = totalRunDelta;
      }
    }

    if (!driver) {
      return null;
    }

    return {
      sourceFamily: driver.sourceFamily,
      failedDelta: driver.deltas.failedRuns,
      boundaryDelta: driver.deltas.runsWithBoundaryHit,
      retryableDelta: driver.deltas.retryableFailures,
      nonRetryableDelta: driver.deltas.nonRetryableFailures,
      leftWindowLabel: snapshotWindowDiffQuery.data.left.sinceHours,
      rightWindowLabel: snapshotWindowDiffQuery.data.right.sinceHours
    };
  }, [snapshotWindowDiffQuery.data]);

  const snapshotWindowIssueSlice = useMemo(() => {
    if (snapshotWindowDiffQuery.data?.mode !== "snapshot") {
      return null;
    }

    return {
      leftWindowLabel: snapshotWindowDiffQuery.data.left.sinceHours,
      rightWindowLabel: snapshotWindowDiffQuery.data.right.sinceHours,
      slice: snapshotWindowDiffQuery.data.issueHotspotSlice ?? null
    };
  }, [snapshotWindowDiffQuery.data]);

  const topAlert = alertItems[0] ?? null;
  const scanSummaryItems = useMemo(
    () => [
      {
        key: "priority",
        label: locale === "zh" ? "优先信号" : "Priority signal",
        value: topAlert?.title ?? (locale === "zh" ? "当前无活跃告警" : "No active alerts"),
        copy: topAlert?.detail ??
          (locale === "zh"
            ? "继续看趋势、异常聚类和 source-family 热点。"
            : "Continue with trend view, anomaly clusters, and source-family hotspot.")
      },
      {
        key: "hotspot",
        label: locale === "zh" ? "当前热点" : "Current hotspot",
        value: sourceFamilyHotspot?.family ?? (locale === "zh" ? "暂无 source-family 热点" : "No source-family hotspot"),
        copy: sourceFamilyHotspot
          ? locale === "zh"
            ? `失败 ${sourceFamilyHotspot.stats.failedRuns} · 边界 ${sourceFamilyHotspot.stats.runsWithBoundaryHit} · 总运行 ${sourceFamilyHotspot.stats.totalRuns}`
            : `Failed ${sourceFamilyHotspot.stats.failedRuns} · Boundary ${sourceFamilyHotspot.stats.runsWithBoundaryHit} · Total ${sourceFamilyHotspot.stats.totalRuns}`
          : locale === "zh"
            ? "最近 24h 没有读得出的 source-family 压力点。"
            : "No readable source-family pressure point in the last 24h."
      },
      {
        key: "next-step",
        label: locale === "zh" ? "下一步" : "Next step",
        value: topAlert?.actionLabel ?? (locale === "zh" ? "继续观察 P6 面板" : "Continue scanning P6 panels"),
        copy: topAlert
          ? locale === "zh"
            ? `建议先进入 ${topAlert.actionTo === "/traces" ? "Trace" : "Knowledge base"} 路由。`
            : `Suggested first route: ${topAlert.actionTo === "/traces" ? "Trace" : "Knowledge base"}.`
          : locale === "zh"
            ? "如果趋势、差异和热点都平稳，当前工作区基本可继续使用。"
            : "If trend, diff, and hotspot panels stay calm, the workspace is generally ready to use."
      }
    ],
    [locale, sourceFamilyHotspot, topAlert]
  );

  return (
    <div className="flex flex-col gap-4">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split">
          <div className="workspace-hero-copy">
            <div className="workspace-hero-kicker">{locale === "zh" ? "桌面端使用统计" : "Desktop usage"}</div>
            <h1 className="mt-1 font-['Space_Grotesk'] text-3xl font-semibold tracking-[-0.03em] text-[var(--app-text)]">
              {locale === "zh" ? "使用统计" : "Usage"}
            </h1>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {locale === "zh"
                ? "只展示当前前端已经拿到的真实工作区数据，不伪造任何统计项。"
                : "Show only real workspace data already available to the frontend, with no fabricated metrics."}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge color={processingDocuments > 0 ? "yellow" : "indigo"} radius="sm" variant="light">
              {processingDocuments > 0
                ? locale === "zh"
                  ? `处理中 ${processingDocuments}`
                  : `${processingDocuments} processing`
                : locale === "zh"
                  ? "桌面视图"
                  : "Desktop view"}
            </Badge>
            <p className="max-w-sm text-right text-[13px] leading-6 text-[var(--app-text-muted)]">
              {locale === "zh"
                ? "这里聚合知识库、文档、助手和会话的当前真实数据，作为独立于“知识库”的唯一路由页面。"
                : "This page aggregates current real knowledge-base, document, assistant, and conversation data on a dedicated route separate from the knowledge base."}
            </p>
          </div>
        </div>
      </Paper>

      {hasError ? (
        <StatePanel
          description={
            (knowledgeBasesQuery.error instanceof Error && knowledgeBasesQuery.error.message) ||
            (assistantsQuery.error instanceof Error && assistantsQuery.error.message) ||
            (conversationsQuery.error instanceof Error && conversationsQuery.error.message) ||
            (documentsQuery.error instanceof Error && documentsQuery.error.message) ||
            undefined
          }
          title={locale === "zh" ? "统计数据加载失败" : "Failed to load usage data"}
          tone="error"
        />
      ) : null}

      {isUsageLoading ? (
        <div aria-live="polite" className="workspace-loading-grid metrics" role="status">
          {Array.from({ length: 6 }).map((_, index) => (
            <Paper className="workspace-metric-card workspace-skeleton-panel" key={index} p="lg" radius="xl">
              <div className="workspace-skeleton-line short" />
              <div className="mt-6 workspace-skeleton-line metric" />
            </Paper>
          ))}
          <span className="sr-only">{locale === "zh" ? "加载统计中" : "Loading usage"}</span>
        </div>
      ) : null}

      {!hasError && !isUsageLoading ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {metrics.map(metric => (
              <Paper className="workspace-metric-card" key={metric.label} p="lg" radius="xl">
                <div className="workspace-section-heading">{metric.label}</div>
                <div className="mt-3 font-['Space_Grotesk'] text-3xl font-semibold text-[var(--app-text)]">
                  {metric.value}
                </div>
              </Paper>
            ))}
          </div>

          {!hasActiveKnowledgeBase ? (
            <StatePanel
              action={
                <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/knowledge-base" variant="light">
                  {locale === "zh" ? "先创建知识库" : "Create a knowledge base first"}
                </Button>
              }
              description={
                locale === "zh"
                  ? "当前没有可用知识库，Usage 页保持 scan-first：请先在 Knowledge base 页面创建一个知识库，再查看语料状态与 P6 信号。"
                  : "No active knowledge base yet. Usage stays scan-first: create one in the knowledge base page before scanning corpus state and P6 signals."
              }
              title={locale === "zh" ? "还没有可扫描的知识库" : "No active knowledge base to scan"}
            />
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            {hasActiveKnowledgeBase ? (
              <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="workspace-section-heading">{locale === "zh" ? "当前语料状态" : "Current corpus state"}</div>
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                      {locale === "zh"
                        ? "使用当前知识库下的真实文档状态，帮助判断桌面端工作区是否处于可检索状态。"
                        : "Use the real document states under the current knowledge base to understand desktop workspace readiness."}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="workspace-subpanel rounded-[20px] p-4">
                      <div className="workspace-section-heading">{locale === "zh" ? "就绪" : "Ready"}</div>
                      <div className="mt-2 text-2xl font-semibold text-[var(--app-text)]">{readyDocuments}</div>
                    </div>
                    <div className="workspace-subpanel rounded-[20px] p-4">
                      <div className="workspace-section-heading">{locale === "zh" ? "处理中" : "Processing"}</div>
                      <div className="mt-2 text-2xl font-semibold text-[var(--app-text)]">{processingDocuments}</div>
                    </div>
                    <div className="workspace-subpanel rounded-[20px] p-4">
                      <div className="workspace-section-heading">{locale === "zh" ? "失败" : "Failed"}</div>
                      <div className="mt-2 text-2xl font-semibold text-[var(--app-text)]">{failedDocuments}</div>
                    </div>
                  </div>
                </div>
              </Paper>
            ) : (
              <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
                <div className="flex h-full items-center justify-center text-center text-sm text-[var(--app-text-muted)]">
                  {locale === "zh"
                    ? "创建知识库后，这里会显示当前语料状态。"
                    : "Current corpus state will appear here after a knowledge base is created."}
                </div>
              </Paper>
            )}

            <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
              <div className="flex flex-col gap-4">
                <div className="workspace-section-heading">{locale === "zh" ? "桌面端入口" : "Desktop entry points"}</div>
                <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/knowledge-base" variant="light">
                  {locale === "zh" ? "打开知识库" : "Open knowledge base"}
                </Button>
                <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/documents" variant="light">
                  {locale === "zh" ? "打开文档" : "Open documents"}
                </Button>
                <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/assistant" variant="light">
                  {locale === "zh" ? "打开助手配置" : "Open assistant"}
                </Button>
              </div>
            </Paper>
          </div>

          <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="workspace-section-heading">{locale === "zh" ? "P5 v1 报告中心" : "P5 v1 report center"}</div>
                <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                  {locale === "zh"
                    ? "评测输出和质量汇总已收敛到独立报告页，保持这里的 scan-first 使用页边界，避免扩展成通用仪表盘。"
                    : "Eval outputs and quality summaries now live in a dedicated report page, keeping this usage route scan-first instead of becoming a generic dashboard surface."}
                </p>
              </div>
              <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/reports" variant="light">
                {locale === "zh" ? "打开报告中心" : "Open report center"}
              </Button>
            </div>
          </Paper>

          {hasActiveKnowledgeBase ? (
            <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
              <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="workspace-section-heading">{locale === "zh" ? "P6 v1 健康看板" : "P6 v1 health dashboard"}</div>
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                    {locale === "zh"
                      ? "聚合 API 存活、文档运行摘要和问题事件，提供 scan-first 的工作区可运行性快速判断。"
                      : "Combine API heartbeat, document-run summary, and issue events into one scan-first operational check for workspace readiness."}
                  </p>
                </div>
                <Badge color={healthPanelErrorMessage ? "red" : "indigo"} radius="sm" variant="light">
                  {healthPanelErrorMessage
                    ? locale === "zh"
                      ? "部分信号加载失败"
                      : "partial signal load failure"
                    : locale === "zh"
                      ? "轻量运行视图"
                      : "light operational view"}
                </Badge>
              </div>

              {healthPanelErrorMessage ? (
                <StatePanel
                  description={healthPanelErrorMessage}
                  title={locale === "zh" ? "健康看板信号加载失败" : "Failed to load health dashboard signals"}
                  tone="error"
                />
              ) : null}

              {showP6PreRunGuidance ? (
                <div className="flex flex-col gap-3" data-testid="usage-p6-pre-run-guidance">
                  <StatePanel
                    action={
                      <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/knowledge-base" variant="light">
                        {locale === "zh" ? "先跑一次扫描" : "Start with one scan-first run"}
                      </Button>
                    }
                    description={
                      locale === "zh"
                        ? "当前知识库还没有文档运行记录。先在 Knowledge base 页触发一次文档扫描/重跑，再回到这里查看 P6 健康信号。首轮运行完成前，这里的趋势/告警/异常/差异/热点面板会保持收起，避免误读。"
                        : "This knowledge base has no document-run history yet. Trigger one document scan/re-run in the knowledge base page before reading P6 health signals here. Until the first run lands, trend/alert/anomaly/diff/hotspot panels stay collapsed to avoid false zero-signal reading."
                    }
                    title={locale === "zh" ? "P6 预运行引导（scan-first）" : "P6 pre-run guidance (scan-first)"}
                  />
                  <p className="text-xs text-[var(--app-text-muted)]" data-testid="usage-p6-pre-run-path">
                    {locale === "zh"
                      ? "scan path：Knowledge base（触发扫描）→ Usage（回看 P6 信号）。"
                      : "scan path: Knowledge base (trigger scan) → Usage (review P6 signals)."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="workspace-scan-grid">
                    {scanSummaryItems.map(item => (
                      <div className="workspace-scan-card" key={item.key}>
                        <span className="workspace-scan-label">{item.label}</span>
                        <span className="workspace-scan-value">{item.value}</span>
                        <span className="workspace-scan-copy">{item.copy}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {healthSignals.map(signal => (
                      <div className="workspace-subpanel rounded-[20px] p-4" key={signal.label}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="workspace-section-heading">{signal.label}</div>
                          <Badge color={signal.tone} radius="sm" variant="light">
                            {signal.value}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                <div className="workspace-subpanel rounded-[20px] p-4">
                  <div className="workspace-section-heading">{locale === "zh" ? "P6 v1 趋势视图" : "P6 v1 trend view"}</div>
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                    {locale === "zh"
                      ? "按 1h / 6h / 24h 时间窗查看关键健康与失败指标的变化。"
                      : "Track how key health and failure metrics move across 1h / 6h / 24h windows."}
                  </p>

                  {trendPanelErrorMessage ? (
                    <StatePanel
                      description={trendPanelErrorMessage}
                      title={locale === "zh" ? "趋势视图信号加载失败" : "Failed to load trend-view signals"}
                      tone="error"
                    />
                  ) : isTrendLoading ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">{locale === "zh" ? "加载中…" : "Loading..."}</p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-2 text-sm">
                      {trendMetrics.map(metric => (
                        <li className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3" key={metric.key}>
                          <div className="font-medium text-[var(--app-text)]">{metric.label}</div>
                          <div className="mt-1 text-[var(--app-text-muted)]">
                            1h: {metric.values[0]} · 6h: {metric.values[1]} · 24h: {metric.values[2]}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="workspace-subpanel rounded-[20px] p-4">
                  <div className="workspace-section-heading">{locale === "zh" ? "P6 v1 告警视图" : "P6 v1 alert view"}</div>
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                    {locale === "zh"
                      ? "把重要 warning 与阈值问题收敛在一个列表里，便于快速排查。"
                      : "Keep important warnings and threshold issues in one scan-first list."}
                  </p>
                  {runSummaryQuery.isLoading || apiHealthQuery.isLoading ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">{locale === "zh" ? "加载中…" : "Loading..."}</p>
                  ) : alertItems.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                      {locale === "zh" ? "当前没有活跃告警。" : "No active alerts right now."}
                    </p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-2 text-sm">
                      {alertItems.map(alert => (
                        <li className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3" key={alert.id}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge color={alert.tone} radius="sm" variant="light">
                              {alert.tone === "red"
                                ? locale === "zh"
                                  ? "高优先级"
                                  : "high"
                                : alert.tone === "orange"
                                  ? locale === "zh"
                                    ? "警告"
                                    : "warning"
                                  : locale === "zh"
                                    ? "关注"
                                    : "watch"}
                            </Badge>
                            <span className="font-medium text-[var(--app-text)]">{alert.title}</span>
                          </div>
                          <p className="mt-1 text-[var(--app-text-muted)]">{alert.detail}</p>
                          <Link className="mt-1 inline-block text-[13px] font-medium text-[var(--app-accent)]" to={alert.actionTo}>
                            {alert.actionLabel}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="workspace-subpanel rounded-[20px] p-4">
                  <div className="workspace-section-heading">
                    {locale === "zh" ? "最近问题事件（24h）" : "Recent issue events (24h)"}
                  </div>
                  {auditEventsQuery.isLoading ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">{locale === "zh" ? "加载中…" : "Loading..."}</p>
                  ) : recentIssueCount === 0 ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                      {locale === "zh" ? "最近 24 小时没有新的问题事件。" : "No issue events in the last 24 hours."}
                    </p>
                  ) : (
                    <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm text-[var(--app-text-muted)]">
                      {(auditEventsQuery.data ?? []).map(event => (
                        <li key={event.id}>
                          <span className="font-medium text-[var(--app-text)]">{event.event}</span>
                          {" · "}
                          {event.summary ?? event.entityId}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="workspace-subpanel rounded-[20px] p-4 xl:col-span-3">
                  <div className="workspace-section-heading">
                    {locale === "zh" ? "P6 v1 异常聚类视图" : "P6 v1 anomaly clustering view"}
                  </div>
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                    {locale === "zh"
                      ? "按阶段与错误码聚合同类失败，让重复模式更容易被扫描出来。"
                      : "Group related failures by stage and code so repeated patterns stand out quickly."}
                  </p>

                  {anomalyPanelErrorMessage ? (
                    <StatePanel
                      description={anomalyPanelErrorMessage}
                      title={locale === "zh" ? "异常聚类信号加载失败" : "Failed to load anomaly clustering signals"}
                      tone="error"
                    />
                  ) : anomalyRunsQuery.isLoading ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">{locale === "zh" ? "加载中…" : "Loading..."}</p>
                  ) : anomalyClusters.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                      {locale === "zh" ? "最近 24 小时没有可聚类的失败模式。" : "No clusterable failure patterns in the last 24 hours."}
                    </p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-2 text-sm">
                      {anomalyClusters.slice(0, 6).map(cluster => (
                        <li className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3" key={`${cluster.failedStage}-${cluster.code}-${cluster.retryable ? "retryable" : "non-retryable"}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge color={cluster.retryable ? "yellow" : "red"} radius="sm" variant="light">
                              {cluster.retryable
                                ? locale === "zh"
                                  ? "可重试"
                                  : "retryable"
                                : locale === "zh"
                                  ? "不可重试"
                                  : "non-retryable"}
                            </Badge>
                            <span className="font-medium text-[var(--app-text)]">{cluster.code}</span>
                            <Badge color="indigo" radius="sm" variant="light">
                              {locale === "zh"
                                ? `重复 ${cluster.count} 次`
                                : `${cluster.count} repeated runs`}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[var(--app-text-muted)]" data-testid="failure-pattern-cluster">
                            {locale === "zh"
                              ? `阶段：${cluster.failedStage} · 来源：${cluster.sourceTypes.join("，")}`
                              : `Stage: ${cluster.failedStage} · Sources: ${cluster.sourceTypes.join(", ")}`}
                          </p>
                          {cluster.sampleMessage ? <p className="mt-1 line-clamp-2 text-[var(--app-text-muted)]">{cluster.sampleMessage}</p> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="workspace-subpanel rounded-[20px] p-4 xl:col-span-3">
                  <div className="workspace-section-heading">
                    {locale === "zh" ? "P6 v1 回归差异视图" : "P6 v1 regression diff view"}
                  </div>
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                    {locale === "zh"
                      ? "对比最近两次问题 run，快速查看状态/阶段/错误码变化。"
                      : "Compare the latest two issue runs and scan status/stage/failure-code shifts quickly."}
                  </p>

                  {runDiffPanelErrorMessage ? (
                    <StatePanel
                      description={runDiffPanelErrorMessage}
                      title={locale === "zh" ? "回归差异信号加载失败" : "Failed to load regression diff signals"}
                      tone="error"
                    />
                  ) : anomalyRunsQuery.isLoading ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">{locale === "zh" ? "加载中…" : "Loading..."}</p>
                  ) : !latestIssueRunPair ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                      {locale === "zh"
                        ? "至少需要两次问题 run 才能显示差异。"
                        : "At least two issue runs are required to render a diff."}
                    </p>
                  ) : runDiffQuery.isLoading ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">{locale === "zh" ? "加载中…" : "Loading..."}</p>
                  ) : runDiffQuery.data?.mode !== "run" ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                      {locale === "zh" ? "当前差异视图仅展示 run 对比模式。" : "This view currently renders run comparison mode only."}
                    </p>
                  ) : runDiffQuery.data.meaningfulDifferences.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]" data-testid="regression-diff-row">
                      {locale === "zh"
                        ? "最近两次问题 run 未检测到关键差异。"
                        : "No meaningful differences detected between the latest two issue runs."}
                    </p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-2 text-sm">
                      {runDiffQuery.data.meaningfulDifferences.slice(0, 5).map((diff: KnowledgeBaseDocumentRunComparisonRunDifference) => (
                        <li className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3" key={diff.metric}>
                          <div className="font-medium text-[var(--app-text)]">{diff.summary}</div>
                          <div className="mt-1 text-[var(--app-text-muted)]" data-testid="regression-diff-row">
                            {locale === "zh"
                              ? `指标：${diff.metric} · ${String(diff.left)} → ${String(diff.right)}`
                              : `Metric: ${diff.metric} · ${String(diff.left)} → ${String(diff.right)}`}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="workspace-subpanel rounded-[20px] p-4 xl:col-span-3">
                  <div className="workspace-section-heading">
                    {locale === "zh" ? "P6 v1 快照窗口差异" : "P6 v1 snapshot window diff"}
                  </div>
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                    {locale === "zh"
                      ? "对比最近 6h 与 24h 的 issue snapshot，快速识别失败与边界趋势变化。"
                      : "Compare 6h vs 24h issue snapshots to quickly spot failure and boundary trend shifts."}
                  </p>

                  {snapshotWindowDiffPanelErrorMessage ? (
                    <StatePanel
                      description={snapshotWindowDiffPanelErrorMessage}
                      title={locale === "zh" ? "快照窗口差异信号加载失败" : "Failed to load snapshot-window diff signals"}
                      tone="error"
                    />
                  ) : snapshotWindowDiffQuery.isLoading ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">{locale === "zh" ? "加载中…" : "Loading..."}</p>
                  ) : snapshotWindowDiffQuery.data?.mode !== "snapshot" ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]" data-testid="snapshot-window-diff-row">
                      {locale === "zh"
                        ? "当前差异视图仅展示快照对比模式。"
                        : "This view currently renders snapshot comparison mode only."}
                    </p>
                  ) : snapshotWindowDiffQuery.data.meaningfulDifferences.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]" data-testid="snapshot-window-diff-row">
                      {locale === "zh"
                        ? "最近 6h 与 24h 快照未检测到关键差异。"
                        : "No meaningful differences detected between 6h and 24h snapshots."}
                    </p>
                  ) : (
                    <>
                      <ul className="mt-3 flex flex-col gap-2 text-sm">
                        {snapshotWindowDiffQuery.data.meaningfulDifferences.slice(0, 5).map((diff: KnowledgeBaseDocumentRunComparisonSnapshotDifference) => (
                          <li className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3" key={diff.metric}>
                            <div className="font-medium text-[var(--app-text)]">{diff.summary}</div>
                            <div className="mt-1 text-[var(--app-text-muted)]" data-testid="snapshot-window-diff-row">
                              {locale === "zh"
                                ? `指标：${diff.metric} · Δ ${diff.delta} (${diff.left} → ${diff.right})`
                                : `Metric: ${diff.metric} · Δ ${diff.delta} (${diff.left} → ${diff.right})`}
                            </div>
                          </li>
                        ))}
                      </ul>

                      {snapshotWindowSourceFamilyDrilldown ? (
                        <div
                          className="mt-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-sm text-[var(--app-text-muted)]"
                          data-testid="snapshot-window-source-family-drilldown"
                        >
                          <span className="font-medium text-[var(--app-text)]">
                            {locale === "zh" ? "source-family 驱动" : "source-family driver"}
                          </span>
                          {locale === "zh"
                            ? `：${snapshotWindowSourceFamilyDrilldown.sourceFamily}（${snapshotWindowSourceFamilyDrilldown.leftWindowLabel}h → ${snapshotWindowSourceFamilyDrilldown.rightWindowLabel}h）失败 Δ ${snapshotWindowSourceFamilyDrilldown.failedDelta}，边界命中 Δ ${snapshotWindowSourceFamilyDrilldown.boundaryDelta}，可重试 Δ ${snapshotWindowSourceFamilyDrilldown.retryableDelta}，不可重试 Δ ${snapshotWindowSourceFamilyDrilldown.nonRetryableDelta}。`
                            : `: ${snapshotWindowSourceFamilyDrilldown.sourceFamily} (${snapshotWindowSourceFamilyDrilldown.leftWindowLabel}h → ${snapshotWindowSourceFamilyDrilldown.rightWindowLabel}h) with failed-runs Δ ${snapshotWindowSourceFamilyDrilldown.failedDelta}, boundary-hits Δ ${snapshotWindowSourceFamilyDrilldown.boundaryDelta}, retryable Δ ${snapshotWindowSourceFamilyDrilldown.retryableDelta}, and non-retryable Δ ${snapshotWindowSourceFamilyDrilldown.nonRetryableDelta}.`}
                        </div>
                      ) : null}

                      {snapshotWindowIssueSlice?.slice ? (
                        <div
                          className="mt-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-sm text-[var(--app-text-muted)]"
                          data-testid="snapshot-window-issue-slice"
                        >
                          <span className="font-medium text-[var(--app-text)]">
                            {locale === "zh" ? "issue-window 切片" : "issue-window slice"}
                          </span>

                          {snapshotWindowIssueSlice.slice.leftHotspot ? (
                            <div className="mt-1" data-testid="snapshot-window-issue-left-hotspot">
                              {locale === "zh"
                                ? `左窗口 (${snapshotWindowIssueSlice.leftWindowLabel}h) 热点：${snapshotWindowIssueSlice.slice.leftHotspot.sourceFamily}，issue signal ${snapshotWindowIssueSlice.slice.leftHotspot.issueSignalScore} / total ${snapshotWindowIssueSlice.slice.leftHotspot.totalRuns}。`
                                : `Left window (${snapshotWindowIssueSlice.leftWindowLabel}h) hotspot: ${snapshotWindowIssueSlice.slice.leftHotspot.sourceFamily} with issue signal ${snapshotWindowIssueSlice.slice.leftHotspot.issueSignalScore} / total ${snapshotWindowIssueSlice.slice.leftHotspot.totalRuns}.`}
                            </div>
                          ) : (
                            <div className="mt-1" data-testid="snapshot-window-issue-left-hotspot-empty">
                              {locale === "zh"
                                ? `左窗口 (${snapshotWindowIssueSlice.leftWindowLabel}h) 未检测到热点。`
                                : `No left-window hotspot detected for ${snapshotWindowIssueSlice.leftWindowLabel}h.`}
                            </div>
                          )}

                          {snapshotWindowIssueSlice.slice.rightHotspot ? (
                            <div className="mt-1" data-testid="snapshot-window-issue-right-hotspot">
                              {locale === "zh"
                                ? `右窗口 (${snapshotWindowIssueSlice.rightWindowLabel}h) 热点：${snapshotWindowIssueSlice.slice.rightHotspot.sourceFamily}，issue signal ${snapshotWindowIssueSlice.slice.rightHotspot.issueSignalScore} / total ${snapshotWindowIssueSlice.slice.rightHotspot.totalRuns}。`
                                : `Right window (${snapshotWindowIssueSlice.rightWindowLabel}h) hotspot: ${snapshotWindowIssueSlice.slice.rightHotspot.sourceFamily} with issue signal ${snapshotWindowIssueSlice.slice.rightHotspot.issueSignalScore} / total ${snapshotWindowIssueSlice.slice.rightHotspot.totalRuns}.`}
                            </div>
                          ) : (
                            <div className="mt-1" data-testid="snapshot-window-issue-right-hotspot-empty">
                              {locale === "zh"
                                ? `右窗口 (${snapshotWindowIssueSlice.rightWindowLabel}h) 未检测到热点。`
                                : `No right-window hotspot detected for ${snapshotWindowIssueSlice.rightWindowLabel}h.`}
                            </div>
                          )}

                          {snapshotWindowIssueSlice.slice.dominantShift ? (
                            <div className="mt-1" data-testid="snapshot-window-issue-dominant-shift">
                              {locale === "zh"
                                ? `主变化项：${snapshotWindowIssueSlice.slice.dominantShift.sourceFamily}，issue concentration Δ ${snapshotWindowIssueSlice.slice.dominantShift.issueConcentrationDelta.toFixed(2)}，issue signal Δ ${snapshotWindowIssueSlice.slice.dominantShift.issueSignalDelta}。`
                                : `Dominant shift: ${snapshotWindowIssueSlice.slice.dominantShift.sourceFamily}, issue concentration Δ ${snapshotWindowIssueSlice.slice.dominantShift.issueConcentrationDelta.toFixed(2)}, issue signal Δ ${snapshotWindowIssueSlice.slice.dominantShift.issueSignalDelta}.`}
                            </div>
                          ) : (
                            <div className="mt-1" data-testid="snapshot-window-issue-dominant-shift-empty">
                              {locale === "zh"
                                ? "当前窗口未形成可读主变化项。"
                                : "No readable dominant shift is available for this window pair."}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="workspace-subpanel rounded-[20px] p-4 xl:col-span-3">
                  <div className="workspace-section-heading">
                    {locale === "zh" ? "P6 v1 source-family 热点" : "P6 v1 source-family hotspot"}
                  </div>
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                    {locale === "zh"
                      ? "基于 bySourceFamily 摘要，优先标出当前失败/边界命中最高的 source family。"
                      : "Use bySourceFamily summary data to highlight the source family with the highest failure/boundary-hit pressure."}
                  </p>

                  {runSummaryQuery.isLoading ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">{locale === "zh" ? "加载中…" : "Loading..."}</p>
                  ) : !sourceFamilyHotspot ? (
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]" data-testid="source-family-hotspot-row">
                      {locale === "zh"
                        ? "最近 24 小时未发现 source-family 级失败或边界命中热点。"
                        : "No source-family hotspot for failures or boundary hits in the last 24 hours."}
                    </p>
                  ) : (
                    <div
                      className="mt-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-sm"
                      data-testid="source-family-hotspot-row"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge color="orange" radius="sm" variant="light">
                          {locale === "zh" ? "当前热点" : "current hotspot"}
                        </Badge>
                        <span className="font-medium text-[var(--app-text)]">{sourceFamilyHotspot.family}</span>
                      </div>
                      <p className="mt-1 text-[var(--app-text-muted)]">
                        {locale === "zh"
                          ? `失败 ${sourceFamilyHotspot.stats.failedRuns} · 边界命中 ${sourceFamilyHotspot.stats.runsWithBoundaryHit} · 总运行 ${sourceFamilyHotspot.stats.totalRuns}`
                          : `Failed runs ${sourceFamilyHotspot.stats.failedRuns} · Boundary hits ${sourceFamilyHotspot.stats.runsWithBoundaryHit} · Total runs ${sourceFamilyHotspot.stats.totalRuns}`}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 xl:col-span-3 xl:flex-row">
                  <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/traces" variant="light">
                    {locale === "zh" ? "查看 Trace" : "Open traces"}
                  </Button>
                  <Button
                    className="workspace-button"
                    color="indigo"
                    component={Link}
                    radius="xl"
                    to="/knowledge-base"
                    variant="light"
                  >
                    {locale === "zh" ? "查看运行摘要" : "Open run summary"}
                  </Button>
                </div>
                  </div>
                </>
              )}
              </div>
            </Paper>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
