import { Badge, Button, Paper, Select, Stack } from '@mantine/core';
import {
  lazy,
  Suspense,
  useDeferredValue,
  useMemo,
  useState,
  useTransition
} from 'react';
import { Link } from 'react-router-dom';
import { StatePanel } from '../../components/StatePanel';
import {
  useApiHealth,
  useAssistants,
  useAuditEvents,
  useConversations,
  useKnowledgeBaseDocumentSummary,
  useKnowledgeBaseDocumentRuns,
  useKnowledgeBaseDocumentRunComparison,
  useKnowledgeBaseDocumentRunSummary,
  useKnowledgeBases
} from '../../features/api/hooks';
import { getPrimaryKnowledgeBase } from '../../features/api/workspace-selection';
import { useI18n } from '../../i18n/I18nProvider';
import {
  buildRunSummaryActionTarget,
  generateHealthSignals,
  generateAlertItems
} from './usage-page-helpers';
import type {
  KnowledgeBaseDocumentRunComparisonRunDifference,
  KnowledgeBaseDocumentRunComparisonSnapshotDifference,
  KnowledgeBaseDocumentRunComparisonSourceFamilyDelta
} from '../../types/api';

const UsageHealthBoard = lazy(async () => {
  const module = await import('./UsageHealthBoard');

  return { default: module.UsageHealthBoard };
});

export function UsagePage() {
  const [timeRange, setTimeRange] = useState<number>(24); // 默认24小时
  const [isTimeRangePending, startTimeRangeTransition] = useTransition();
  const deferredTimeRange = useDeferredValue(timeRange);

  const knowledgeBasesQuery = useKnowledgeBases();
  const assistantsQuery = useAssistants();
  const conversationsQuery = useConversations();
  const apiHealthQuery = useApiHealth();
  const auditEventsQuery = useAuditEvents({
    issueOnly: true,
    sinceHours: deferredTimeRange,
    limit: 5
  });
  const issueTrend1hQuery = useAuditEvents({
    issueOnly: true,
    sinceHours: 1,
    limit: 100
  });
  const issueTrend6hQuery = useAuditEvents({
    issueOnly: true,
    sinceHours: 6,
    limit: 100
  });
  const issueTrend24hQuery = useAuditEvents({
    issueOnly: true,
    sinceHours: 24,
    limit: 100
  });
  const activeKnowledgeBase = getPrimaryKnowledgeBase(knowledgeBasesQuery.data);
  const hasActiveKnowledgeBase = activeKnowledgeBase != null;
  const documentsSummaryQuery = useKnowledgeBaseDocumentSummary(
    activeKnowledgeBase?.id ?? '',
    hasActiveKnowledgeBase
  );
  const runSummary1hQuery = useKnowledgeBaseDocumentRunSummary(
    activeKnowledgeBase?.id ?? null,
    { sinceHours: 1 }
  );
  const runSummary6hQuery = useKnowledgeBaseDocumentRunSummary(
    activeKnowledgeBase?.id ?? null,
    { sinceHours: 6 }
  );
  const runSummaryQuery = useKnowledgeBaseDocumentRunSummary(
    activeKnowledgeBase?.id ?? null,
    { sinceHours: deferredTimeRange }
  );
  const anomalyRunsQuery = useKnowledgeBaseDocumentRuns(
    activeKnowledgeBase?.id ?? null,
    {
      issueOnly: true,
      sinceHours: deferredTimeRange,
      limit: 100
    }
  );
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
      leftRunId: '',
      rightRunId: ''
    },
    latestIssueRunPair != null
  );
  const snapshotWindowDiffQuery = useKnowledgeBaseDocumentRunComparison(
    activeKnowledgeBase?.id ?? null,
    {
      issueOnly: true,
      leftSinceHours: 6,
      rightSinceHours: 24
    }
  );
  const { locale, t } = useI18n();

  const documentsSummary = documentsSummaryQuery.data;
  const assistants = assistantsQuery.data ?? [];
  const conversations = conversationsQuery.data ?? [];
  const totalDocuments = documentsSummary?.totalDocuments ?? 0;
  const readyDocuments = documentsSummary?.readyDocuments ?? 0;
  const processingDocuments = documentsSummary?.processingDocuments ?? 0;
  const failedDocuments = documentsSummary?.failedDocuments ?? 0;
  const totalChunks = documentsSummary?.totalChunks ?? 0;

  // 生成指标数据
  const metrics = useMemo(
    () => [
      {
        label: locale === 'zh' ? '资料库' : 'Libraries',
        value: knowledgeBasesQuery.data?.length ?? 0
      },
      {
        label: locale === 'zh' ? '资料' : 'Library items',
        value: totalDocuments
      },
      { label: locale === 'zh' ? 'Chunk' : 'Chunks', value: totalChunks },
      {
        label: locale === 'zh' ? '助手' : 'Assistants',
        value: assistants.length
      },
      {
        label: locale === 'zh' ? '会话' : 'Conversations',
        value: conversations.length
      },
      {
        label: locale === 'zh' ? '可用资料' : 'Ready items',
        value: readyDocuments
      }
    ],
    [
      assistants.length,
      conversations.length,
      knowledgeBasesQuery.data?.length,
      locale,
      readyDocuments,
      totalDocuments,
      totalChunks
    ]
  );

  const usageErrorMessage =
    (knowledgeBasesQuery.error instanceof Error &&
      knowledgeBasesQuery.error.message) ||
    (assistantsQuery.error instanceof Error && assistantsQuery.error.message) ||
    (conversationsQuery.error instanceof Error &&
      conversationsQuery.error.message) ||
    (documentsSummaryQuery.error instanceof Error &&
      documentsSummaryQuery.error.message) ||
    (locale === 'zh'
      ? '加载数据时发生未知错误'
      : 'An unknown error occurred while loading data');

  const hasError = useMemo(
    () =>
      knowledgeBasesQuery.isError ||
      assistantsQuery.isError ||
      conversationsQuery.isError ||
      documentsSummaryQuery.isError,
    [
      assistantsQuery.isError,
      conversationsQuery.isError,
      documentsSummaryQuery.isError,
      knowledgeBasesQuery.isError
    ]
  );
  const isUsageLoading = useMemo(
    () =>
      !hasError &&
      (knowledgeBasesQuery.isLoading ||
        assistantsQuery.isLoading ||
        conversationsQuery.isLoading ||
        documentsSummaryQuery.isLoading),
    [
      assistantsQuery.isLoading,
      conversationsQuery.isLoading,
      documentsSummaryQuery.isLoading,
      hasError,
      knowledgeBasesQuery.isLoading
    ]
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
    (runSummary?.byStatus.pending ?? 0) +
    (runSummary?.byStatus.processing ?? 0);
  const recentIssueCount = auditEventsQuery.data?.length ?? 0;
  const issueTrend1h = issueTrend1hQuery.data?.length ?? 0;
  const issueTrend6h = issueTrend6hQuery.data?.length ?? 0;
  const issueTrend24h = issueTrend24hQuery.data?.length ?? 0;
  const isApiHealthy = apiHealthQuery.data?.status === 'ok';
  const retryableFailureCount = runSummary?.retryableFailures ?? 0;
  const nonRetryableFailureCount = runSummary?.nonRetryableFailures ?? 0;
  const hasRecentFailure = retryableFailureCount + nonRetryableFailureCount > 0;
  const hasDocumentRunHistory = (runSummary?.totalRuns ?? 0) > 0;
  const boundaryHitCount = runSummary?.boundaryStats.runsWithBoundaryHit ?? 0;
  const latestFailureAnchor = runSummary?.latestFailure ?? null;

  const runSummaryActionTarget = buildRunSummaryActionTarget({
    locale,
    latestFailureDocumentId: latestFailureAnchor?.documentId
  });

  const healthSignals = useMemo(
    () =>
      generateHealthSignals({
        isApiHealthy,
        apiHealthQueryLoading: apiHealthQuery.isLoading,
        pendingRunCount,
        recentIssueCount,
        hasRecentFailure,
        retryableFailureCount,
        nonRetryableFailureCount,
        timeRange,
        locale
      }),
    [
      apiHealthQuery.isLoading,
      hasRecentFailure,
      isApiHealthy,
      locale,
      pendingRunCount,
      recentIssueCount,
      nonRetryableFailureCount,
      retryableFailureCount,
      timeRange
    ]
  );

  const alertItems = useMemo(
    () =>
      generateAlertItems({
        apiHealthQueryLoading: apiHealthQuery.isLoading,
        isApiHealthy,
        nonRetryableFailureCount,
        pendingRunCount,
        retryableFailureCount,
        recentIssueCount,
        boundaryHitCount,
        timeRange,
        runSummaryActionTarget,
        locale
      }),
    [
      apiHealthQuery.isLoading,
      boundaryHitCount,
      isApiHealthy,
      locale,
      nonRetryableFailureCount,
      pendingRunCount,
      recentIssueCount,
      runSummaryActionTarget,
      retryableFailureCount,
      timeRange
    ]
  );

  const healthPanelErrorMessage =
    (apiHealthQuery.error instanceof Error && apiHealthQuery.error.message) ||
    (runSummaryQuery.error instanceof Error && runSummaryQuery.error.message) ||
    (auditEventsQuery.error instanceof Error &&
      auditEventsQuery.error.message) ||
    null;
  const showP6PreRunGuidance =
    !healthPanelErrorMessage &&
    !runSummaryQuery.isLoading &&
    runSummary != null &&
    !hasDocumentRunHistory;

  const trendPanelErrorMessage =
    (runSummary1hQuery.error instanceof Error &&
      runSummary1hQuery.error.message) ||
    (runSummary6hQuery.error instanceof Error &&
      runSummary6hQuery.error.message) ||
    (runSummaryQuery.error instanceof Error && runSummaryQuery.error.message) ||
    (issueTrend1hQuery.error instanceof Error &&
      issueTrend1hQuery.error.message) ||
    (issueTrend6hQuery.error instanceof Error &&
      issueTrend6hQuery.error.message) ||
    (issueTrend24hQuery.error instanceof Error &&
      issueTrend24hQuery.error.message) ||
    null;

  const trendMetrics = useMemo(
    () => [
      {
        key: 'failed-runs',
        label: locale === 'zh' ? '失败运行' : 'Failed runs',
        values: [
          runSummary1h?.byStatus.failed ?? 0,
          runSummary6h?.byStatus.failed ?? 0,
          runSummary?.byStatus.failed ?? 0
        ]
      },
      {
        key: 'retryable-failures',
        label: locale === 'zh' ? '可重试失败' : 'Retryable failures',
        values: [
          runSummary1h?.retryableFailures ?? 0,
          runSummary6h?.retryableFailures ?? 0,
          runSummary?.retryableFailures ?? 0
        ]
      },
      {
        key: 'non-retryable-failures',
        label: locale === 'zh' ? '不可重试失败' : 'Non-retryable failures',
        values: [
          runSummary1h?.nonRetryableFailures ?? 0,
          runSummary6h?.nonRetryableFailures ?? 0,
          runSummary?.nonRetryableFailures ?? 0
        ]
      },
      {
        key: 'boundary-hits',
        label: locale === 'zh' ? '边界命中' : 'Boundary hits',
        values: [
          runSummary1h?.boundaryStats.runsWithBoundaryHit ?? 0,
          runSummary6h?.boundaryStats.runsWithBoundaryHit ?? 0,
          runSummary?.boundaryStats.runsWithBoundaryHit ?? 0
        ]
      },
      {
        key: 'issue-events',
        label: locale === 'zh' ? '问题事件' : 'Issue events',
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
    (anomalyRunsQuery.error instanceof Error &&
      anomalyRunsQuery.error.message) ||
    null;
  const runDiffPanelErrorMessage =
    (runDiffQuery.error instanceof Error && runDiffQuery.error.message) || null;
  const snapshotWindowDiffPanelErrorMessage =
    (snapshotWindowDiffQuery.error instanceof Error &&
      snapshotWindowDiffQuery.error.message) ||
    null;

  const anomalyClusters = useMemo(() => {
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

      const failedStage = summary.failedStage ?? run.failedStage ?? 'unknown';
      const code = summary.code ?? 'UNKNOWN_FAILURE';
      const retryable = summary.retryable;
      const sourceType = run.document.sourceType || 'unknown';
      const clusterKey = `${failedStage}::${code}::${retryable ? 'retryable' : 'non_retryable'}`;

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
      current.sourceTypeCounts[sourceType] =
        (current.sourceTypeCounts[sourceType] ?? 0) + 1;
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
      .map((cluster) => ({
        ...cluster,
        sourceTypes: Object.entries(cluster.sourceTypeCounts)
          .sort((left, right) => right[1] - left[1])
          .map(([sourceType, count]) => `${sourceType} (${count})`)
      }));
  }, [anomalyRunsQuery.data]);

  const sourceFamilyHotspot = useMemo(() => {
    const sourceFamilyEntries = Object.entries(
      runSummaryBySourceFamily ?? {}
    ).filter(
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
    if (snapshotWindowDiffQuery.data?.mode !== 'snapshot') {
      return null;
    }

    const deltas = snapshotWindowDiffQuery.data.sourceFamilyDeltas ?? [];
    if (deltas.length === 0) {
      return null;
    }

    const getDeltaImpact = (
      delta: KnowledgeBaseDocumentRunComparisonSourceFamilyDelta
    ) =>
      Math.abs(delta.deltas.failedRuns) +
      Math.abs(delta.deltas.runsWithBoundaryHit) +
      Math.abs(delta.deltas.retryableFailures) +
      Math.abs(delta.deltas.nonRetryableFailures);

    let driver: KnowledgeBaseDocumentRunComparisonSourceFamilyDelta | null =
      null;
    let driverImpact = Number.NEGATIVE_INFINITY;
    let driverTotalRunDelta = Number.NEGATIVE_INFINITY;

    for (const delta of deltas) {
      const deltaImpact = getDeltaImpact(delta);
      const totalRunDelta = Math.abs(delta.deltas.totalRuns);

      if (
        deltaImpact > driverImpact ||
        (deltaImpact === driverImpact && totalRunDelta > driverTotalRunDelta)
      ) {
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
    if (snapshotWindowDiffQuery.data?.mode !== 'snapshot') {
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
        key: 'priority',
        label: locale === 'zh' ? '优先信号' : 'Priority signal',
        value:
          topAlert?.title ??
          (locale === 'zh' ? '当前无活跃告警' : 'No active alerts'),
        copy:
          topAlert?.detail ??
          (locale === 'zh'
            ? '按趋势、告警、异常、差异和热点的顺序继续扫读。'
            : 'Scan trend, alert, anomaly, diff, and hotspot panels in that order.')
      },
      {
        key: 'hotspot',
        label: locale === 'zh' ? '当前热点' : 'Current hotspot',
        value:
          sourceFamilyHotspot?.family ??
          (locale === 'zh'
            ? '暂无 source-family 热点'
            : 'No source-family hotspot'),
        copy: sourceFamilyHotspot
          ? locale === 'zh'
            ? `失败 ${sourceFamilyHotspot.stats.failedRuns} · 边界 ${sourceFamilyHotspot.stats.runsWithBoundaryHit} · 总运行 ${sourceFamilyHotspot.stats.totalRuns}`
            : `Failed ${sourceFamilyHotspot.stats.failedRuns} · Boundary ${sourceFamilyHotspot.stats.runsWithBoundaryHit} · Total ${sourceFamilyHotspot.stats.totalRuns}`
          : locale === 'zh'
            ? '最近 24h 没有读得出的 source-family 压力点。'
            : 'No readable source-family pressure point in the last 24h.'
      },
      {
        key: 'next-step',
        label: locale === 'zh' ? '下一步' : 'Next step',
        value:
          topAlert?.actionLabel ??
          (locale === 'zh'
            ? '继续观察 P6 面板'
            : 'Continue scanning P6 panels'),
        copy: topAlert
          ? locale === 'zh'
            ? `建议先进入 ${topAlert.actionTo === '/traces' ? 'Trace' : topAlert.actionTo.startsWith('/documents/') ? '失败文档' : 'Knowledge base'} 路由。`
            : `Suggested first route: ${topAlert.actionTo === '/traces' ? 'Trace' : topAlert.actionTo.startsWith('/documents/') ? 'failed document' : 'Knowledge base'}.`
          : locale === 'zh'
            ? '如果趋势、差异和热点都平稳，当前工作区基本可继续使用。'
            : 'If trend, diff, and hotspot panels stay calm, the workspace is generally ready to use.'
      }
    ],
    [locale, sourceFamilyHotspot, topAlert]
  );
  const runDiffs: KnowledgeBaseDocumentRunComparisonRunDifference[] =
    runDiffQuery.data?.mode === 'run'
      ? runDiffQuery.data.meaningfulDifferences
      : [];
  const snapshotWindowDiffs: KnowledgeBaseDocumentRunComparisonSnapshotDifference[] =
    snapshotWindowDiffQuery.data?.mode === 'snapshot'
      ? snapshotWindowDiffQuery.data.meaningfulDifferences
      : [];

  return (
    <Stack
      className="container mx-auto px-4 py-6"
      data-testid="usage-page"
      gap="sm"
    >
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="workspace-hero-copy">
            <Link className="workspace-link text-sm" to="/workbench">
              {locale === 'zh'
                ? '返回工作台概览'
                : 'Back to workbench overview'}
            </Link>
            <div className="workspace-hero-kicker">
              {locale === 'zh' ? '管理工作台' : 'Workbench'}
            </div>
            <h1 className="mt-1 font-['Space_Grotesk'] text-3xl font-semibold tracking-normal text-[var(--app-text)]">
              {locale === 'zh' ? '运行概览' : 'Operations overview'}
            </h1>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {locale === 'zh'
                ? '这里汇总管理侧需要快速扫读的真实运行信号，不把它混进普通用户主路径。'
                : 'This view groups real operational signals for the workbench without mixing them into the primary user path.'}
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-3 w-full md:w-auto">
            <div className="w-full md:w-auto">
              <Select
                value={timeRange.toString()}
                onChange={(value) => {
                  const nextValue = parseInt(value || '24');
                  startTimeRangeTransition(() => {
                    setTimeRange(nextValue);
                  });
                }}
                data={[
                  { value: '1', label: locale === 'zh' ? '1小时' : '1h' },
                  { value: '6', label: locale === 'zh' ? '6小时' : '6h' },
                  { value: '24', label: locale === 'zh' ? '24小时' : '24h' },
                  { value: '72', label: locale === 'zh' ? '3天' : '3d' },
                  { value: '168', label: locale === 'zh' ? '7天' : '7d' }
                ]}
                className="w-full md:w-40 workspace-input"
                label={locale === 'zh' ? '时间范围' : 'Time range'}
                rightSection={
                  isTimeRangePending ? (
                    <span className="h-3 w-3 animate-spin rounded-full border border-[var(--app-border)] border-t-[var(--app-accent)]" />
                  ) : null
                }
              />
            </div>
            <Badge
              color={processingDocuments > 0 ? 'yellow' : 'indigo'}
              radius="sm"
              variant="light"
            >
              {processingDocuments > 0
                ? locale === 'zh'
                  ? `处理中 ${processingDocuments}`
                  : `${processingDocuments} processing`
                : locale === 'zh'
                  ? '工作台视图'
                  : 'Workbench view'}
            </Badge>
            <p className="max-w-sm text-sm leading-6 text-[var(--app-text-muted)] md:text-right">
              {locale === 'zh'
                ? '这是从工作台概览进入的运行观察页，用来集中查看资料状态、趋势和健康信号。'
                : 'This operations page is entered from the workbench overview so state, trends, and health signals stay grouped together.'}
            </p>
          </div>
        </div>
      </Paper>

      {hasError ? (
        <StatePanel
          action={
            <Button
              className="workspace-button"
              color="indigo"
              radius="xl"
              variant="light"
              onClick={() => {
                knowledgeBasesQuery.refetch();
                assistantsQuery.refetch();
                conversationsQuery.refetch();
                documentsSummaryQuery.refetch();
              }}
            >
              {locale === 'zh' ? '重试' : 'Retry'}
            </Button>
          }
          description={`${usageErrorMessage}

${locale === 'zh' ? '请检查网络连接或稍后再试。' : 'Please check your network connection or try again later.'}`}
          title={
            locale === 'zh'
              ? '运行数据加载失败'
              : 'Failed to load operations data'
          }
          tone="error"
        />
      ) : null}

      {isUsageLoading ? (
        <div
          aria-live="polite"
          className="workspace-loading-grid metrics mt-1"
          role="status"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <Paper
              className="workspace-skeleton-panel"
              key={index}
              p="lg"
              radius="xl"
            >
              <div className="workspace-skeleton-line short" />
              <div className="mt-6 workspace-skeleton-line metric" />
            </Paper>
          ))}
          <div className="flex justify-center mt-4">
            <div className="animate-pulse text-sm text-[var(--app-text-muted)]">
              {t('appShell.copy.loadingOperationsData')}
            </div>
          </div>
          <span className="sr-only">
            {t('appShell.copy.loadingOperations')}
          </span>
        </div>
      ) : null}

      {!hasError && !isUsageLoading ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mt-1">
            {metrics.map((metric) => (
              <Paper
                className="workspace-metric-card"
                key={metric.label}
                p="lg"
                radius="xl"
              >
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
                <Button
                  className="workspace-button"
                  color="indigo"
                  component={Link}
                  radius="xl"
                  to="/knowledge-base"
                  variant="light"
                >
                  {locale === 'zh'
                    ? '先创建工作区资料库'
                    : 'Create a workspace library first'}
                </Button>
              }
              description={
                locale === 'zh'
                  ? '当前还没有可用的工作区资料库。先在工作区设置里创建资料归属，再回来查看运行信号。'
                  : 'There is no active workspace library yet. Create one in workspace settings before scanning operational signals here.'
              }
              title={
                locale === 'zh'
                  ? '还没有可观察的工作区资料库'
                  : 'No active workspace library to inspect'
              }
            />
          ) : null}

          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] mt-1">
            {hasActiveKnowledgeBase ? (
              <Paper
                className="workspace-panel-hover workspace-panel-strong"
                p="lg"
                radius="xl"
              >
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="workspace-section-heading">
                      {locale === 'zh'
                        ? '当前资料状态'
                        : 'Current library state'}
                    </div>
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                      {locale === 'zh'
                        ? '基于当前工作区资料库里的真实资料状态，快速判断这个工作区是否适合继续使用。'
                        : 'Use the real item states under the current workspace library to judge whether the workspace is ready for normal use.'}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="workspace-subpanel rounded-[20px] p-4">
                      <div className="workspace-section-heading">
                        {locale === 'zh' ? '就绪' : 'Ready'}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-[var(--app-text)]">
                        {readyDocuments}
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-[var(--app-border)]">
                        <div
                          className="h-2 rounded-full bg-green-500 transition-all duration-300 ease-in-out"
                          style={{
                            width: `${totalDocuments > 0 ? (readyDocuments / totalDocuments) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </div>
                    <div className="workspace-subpanel rounded-[20px] p-4">
                      <div className="workspace-section-heading">
                        {locale === 'zh' ? '处理中' : 'Processing'}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-[var(--app-text)]">
                        {processingDocuments}
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-[var(--app-border)]">
                        <div
                          className="h-2 rounded-full bg-yellow-500 transition-all duration-300 ease-in-out"
                          style={{
                            width: `${totalDocuments > 0 ? (processingDocuments / totalDocuments) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </div>
                    <div className="workspace-subpanel rounded-[20px] p-4">
                      <div className="workspace-section-heading">
                        {locale === 'zh' ? '失败' : 'Failed'}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-[var(--app-text)]">
                        {failedDocuments}
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-[var(--app-border)]">
                        <div
                          className="h-2 rounded-full bg-red-500 transition-all duration-300 ease-in-out"
                          style={{
                            width: `${totalDocuments > 0 ? (failedDocuments / totalDocuments) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Paper>
            ) : (
              <Paper
                className="workspace-panel-hover workspace-panel-muted"
                p="lg"
                radius="xl"
              >
                <div className="flex h-full items-center justify-center text-center text-sm text-[var(--app-text-muted)]">
                  {locale === 'zh'
                    ? '创建工作区资料库后，这里会显示当前资料状态。'
                    : 'Current library state will appear here after a workspace library is created.'}
                </div>
              </Paper>
            )}

            <Paper
              className="workspace-panel-hover workspace-panel-muted"
              p="lg"
              radius="xl"
            >
              <div className="flex flex-col gap-4">
                <div className="workspace-section-heading">
                  {locale === 'zh' ? '工作台快捷入口' : 'Workbench shortcuts'}
                </div>
                <Button
                  className="workspace-button w-full"
                  color="indigo"
                  component={Link}
                  radius="xl"
                  to="/knowledge-base"
                  variant="light"
                >
                  {locale === 'zh'
                    ? '打开工作区设置'
                    : 'Open workspace settings'}
                </Button>
                <Button
                  className="workspace-button w-full"
                  color="indigo"
                  component={Link}
                  radius="xl"
                  to="/documents"
                  variant="light"
                >
                  {locale === 'zh' ? '打开资料库' : 'Open library'}
                </Button>
                <Button
                  className="workspace-button w-full"
                  color="indigo"
                  component={Link}
                  radius="xl"
                  to="/assistant"
                  variant="light"
                >
                  {locale === 'zh' ? '打开回答设置' : 'Open answer settings'}
                </Button>
              </div>
            </Paper>
          </div>

          <Paper
            className="workspace-panel-hover workspace-panel-strong mt-1"
            p="lg"
            radius="xl"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="workspace-section-heading">
                  {locale === 'zh' ? '质量报告' : 'Quality reports'}
                </div>
                <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                  {locale === 'zh'
                    ? '评测输出和质量汇总放在独立报告页里，当前页只保留运行观察，不扩成通用大盘。'
                    : 'Evaluation output and quality summaries live in a dedicated report page so this screen can stay focused on operations.'}
                </p>
              </div>
              <Button
                className="workspace-button"
                color="indigo"
                component={Link}
                radius="xl"
                to="/reports"
                variant="light"
              >
                {locale === 'zh' ? '打开质量报告' : 'Open quality reports'}
              </Button>
            </div>
          </Paper>

          {hasActiveKnowledgeBase ? (
            <Suspense fallback={<UsageHealthBoardFallback locale={locale} />}>
              <UsageHealthBoard
                alertItems={alertItems}
                anomalyClusters={anomalyClusters}
                anomalyPanelErrorMessage={anomalyPanelErrorMessage}
                auditEvents={auditEventsQuery.data ?? []}
                hasLatestIssueRunPair={latestIssueRunPair != null}
                healthPanelErrorMessage={healthPanelErrorMessage}
                healthSignals={healthSignals}
                isAnomalyRunsLoading={anomalyRunsQuery.isLoading}
                isApiHealthLoading={apiHealthQuery.isLoading}
                isAuditEventsLoading={auditEventsQuery.isLoading}
                isRunDiffLoading={runDiffQuery.isLoading}
                isRunSummaryLoading={runSummaryQuery.isLoading}
                isSnapshotWindowDiffLoading={snapshotWindowDiffQuery.isLoading}
                isTrendLoading={isTrendLoading}
                latestFailureAnchor={latestFailureAnchor}
                locale={locale}
                recentIssueCount={recentIssueCount}
                runDiffMode={runDiffQuery.data?.mode}
                runDiffPanelErrorMessage={runDiffPanelErrorMessage}
                runDiffs={runDiffs}
                scanSummaryItems={scanSummaryItems}
                showP6PreRunGuidance={showP6PreRunGuidance}
                snapshotWindowDiffMode={snapshotWindowDiffQuery.data?.mode}
                snapshotWindowDiffPanelErrorMessage={
                  snapshotWindowDiffPanelErrorMessage
                }
                snapshotWindowDiffs={snapshotWindowDiffs}
                snapshotWindowIssueSlice={snapshotWindowIssueSlice}
                snapshotWindowSourceFamilyDrilldown={
                  snapshotWindowSourceFamilyDrilldown
                }
                sourceFamilyHotspot={sourceFamilyHotspot}
                trendMetrics={trendMetrics}
                trendPanelErrorMessage={trendPanelErrorMessage}
              />
            </Suspense>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}

function UsageHealthBoardFallback({ locale }: { locale: 'zh' | 'en' }) {
  return (
    <Paper
      className="workspace-panel-hover workspace-panel-strong"
      p="lg"
      radius="xl"
    >
      <div className="flex flex-col gap-2">
        <div className="workspace-section-heading">
          {locale === 'zh'
            ? '正在加载运行健康看板'
            : 'Loading operations health board'}
        </div>
        <p className="text-sm text-[var(--app-text-muted)]">
          {locale === 'zh'
            ? '正在准备趋势、告警与异常面板...'
            : 'Preparing trend, alert, and anomaly panels...'}
        </p>
      </div>
    </Paper>
  );
}
