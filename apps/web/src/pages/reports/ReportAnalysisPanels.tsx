import { Badge, Button, Paper, Stack, Text } from '@mantine/core';
import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import type {
  EvalQuestionSetFailureDrilldownItem,
  EvalQuestionSetRunQualityGate,
  EvalQuestionSetRunResult
} from '../../types/api';

const ReportCharts = lazy(async () => {
  const module = await import('./ReportCharts');
  return { default: module.ReportCharts };
});

type QualitySummaryRow = { quality: string; count: number };
type RunDiffSummary = NonNullable<
  NonNullable<EvalQuestionSetRunResult['baselineComparison']>['diffSummary']
>;
type QualityGatePresentation = {
  color: string;
  detail: string;
  label: string;
} | null;
type TopBreachedMetric =
  | NonNullable<EvalQuestionSetRunQualityGate['breachedMetrics']>[number]
  | null;

type ReportAnalysisPanelsProps = {
  answerStatusDistribution: Array<{ status: string; count: number }>;
  buildTraceReviewLink: (args: {
    traceId: string;
    question: string;
    handlingTitle: string;
    priorityLabel: string;
  }) => string;
  downloadReport: (format: 'markdown' | 'json' | 'html') => Promise<void>;
  errorTypeDistribution: Array<{ code: string; count: number }>;
  exporting: string | null;
  formatBaselineMetadataValue: (
    value: string | number | null | undefined,
    placeholder: string
  ) => string;
  formatDateTime: (value: string) => string;
  getQualityGateMetricLabel: (
    metric: NonNullable<
      EvalQuestionSetRunQualityGate['breachedMetrics']
    >[number]['metric'],
    locale: 'zh' | 'en'
  ) => string;
  getQualityGateMetricStrategy: (args: {
    metric: NonNullable<
      EvalQuestionSetRunQualityGate['breachedMetrics']
    >[number]['metric'];
    limitType: 'min' | 'max';
    locale: 'zh' | 'en';
  }) => string;
  getRegressionReasonLabel: (code: string, locale: 'zh' | 'en') => string;
  focusRunItem: (index: number, question: string) => void;
  getEvalItemKey: (index: number, question: string) => string;
  locale: 'zh' | 'en';
  qualityDistributionData: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  qualityGate: EvalQuestionSetRunQualityGate | undefined;
  qualityGatePresentation: QualityGatePresentation;
  qualitySummaryRows: QualitySummaryRow[];
  radarData: Array<{ subject: string; A: number; fullMark: number }>;
  regressionDrilldownItems: EvalQuestionSetFailureDrilldownItem[];
  runDiffSummary: RunDiffSummary | undefined;
  runEvalData: EvalQuestionSetRunResult;
  runItemsByKey: Map<string, EvalQuestionSetRunResult['items'][number]>;
  topBreachedMetric: TopBreachedMetric;
};

function ReportChartFallback({
  heightClassName,
  locale
}: {
  heightClassName: string;
  locale: 'zh' | 'en';
}) {
  return (
    <div
      className={`${heightClassName} flex items-center justify-center rounded-[18px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.015)]`}
    >
      <Text c="var(--app-text-muted)" size="sm">
        {locale === 'zh' ? '正在加载图表...' : 'Loading charts...'}
      </Text>
    </div>
  );
}

export function ReportAnalysisPanels(props: ReportAnalysisPanelsProps) {
  const {
    answerStatusDistribution,
    buildTraceReviewLink,
    downloadReport,
    errorTypeDistribution,
    exporting,
    formatBaselineMetadataValue,
    formatDateTime,
    getQualityGateMetricLabel,
    getQualityGateMetricStrategy,
    getRegressionReasonLabel,
    focusRunItem,
    getEvalItemKey,
    locale,
    qualityDistributionData,
    qualityGate,
    qualityGatePresentation,
    qualitySummaryRows,
    radarData,
    regressionDrilldownItems,
    runDiffSummary,
    runEvalData,
    runItemsByKey,
    topBreachedMetric
  } = props;

  const copy =
    locale === 'zh'
      ? {
          chartLoading: '正在加载图表...',
          baselineSnapshotPlaceholder: '本次质量检查未绑定 baseline snapshot',
          baselineVersionPlaceholder:
            'baseline version 暂不可读（需先绑定 baseline snapshot）',
          qualityOverviewRadar: '质量概览雷达图',
          qualityDistribution: '质量分布',
          noQualityResults: '暂时还没有可汇总的质量结果。',
          answerStatusDistribution: '回答状态分布',
          issueTypeDistribution: '问题类型分布',
          qualityGate: '质量门槛',
          runDiffSummary: '运行差异摘要',
          runDiffUnavailable:
            '当前检查缺少可用差异摘要（通常需 baseline 对照已就绪）。',
          regressionWeakestItems: '回归弱项聚焦',
          regressionWeakestItemsDescription:
            '按严重程度列出最需要优先复盘的问题。',
          noPerQuestionRegressions: '当前检查未检测到题目级回归。',
          perQuestionUnavailable:
            '当前 baseline 缺少题目级对照数据（通常需在最新格式 baseline 初始化后可用）。',
          runContext: '运行上下文',
          reportExport: '报告导出',
          reportExportDescription:
            '把这次质量检查结果导出为可复用文件，便于存档和分享。'
        }
      : {
          chartLoading: 'Loading charts...',
          baselineSnapshotPlaceholder:
            'This quality check is not linked to a baseline snapshot',
          baselineVersionPlaceholder:
            'Baseline version is unavailable until a baseline snapshot is linked',
          qualityOverviewRadar: 'Quality overview radar',
          qualityDistribution: 'Quality distribution',
          noQualityResults: 'No quality results are available yet.',
          answerStatusDistribution: 'Answer status distribution',
          issueTypeDistribution: 'Issue type distribution',
          qualityGate: 'Quality gate',
          runDiffSummary: 'Run diff summary',
          runDiffUnavailable:
            'Run diff summary is unavailable for this comparison (baseline delta not ready).',
          regressionWeakestItems: 'Regression weakest items',
          regressionWeakestItemsDescription:
            'Prioritize per-question regressions so review can focus on the weakest items first.',
          noPerQuestionRegressions:
            'No per-question regressions were detected in this check.',
          perQuestionUnavailable:
            'Per-question drilldown is unavailable for this baseline (initialize the baseline with the latest run format).',
          runContext: 'Run context',
          reportExport: 'Export reports',
          reportExportDescription:
            'Export this quality check into reusable files for storage and sharing.'
        };

  const baselineSnapshotPlaceholder = copy.baselineSnapshotPlaceholder;
  const baselineVersionPlaceholder = copy.baselineVersionPlaceholder;

  return (
    <>
      {runEvalData.summary && (
        <Paper
          className="workspace-panel-hover workspace-panel-muted border border-[var(--app-border)] shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
          p="lg"
          radius="lg"
        >
          <Stack gap="sm">
            <div className="workspace-section-heading">
              {copy.qualityOverviewRadar}
            </div>
            <Suspense
              fallback={
                <ReportChartFallback heightClassName="h-80" locale={locale} />
              }
            >
              <ReportCharts
                locale={locale}
                qualityDistributionData={[]}
                radarData={radarData}
              />
            </Suspense>
          </Stack>
        </Paper>
      )}

      <Paper
        className="workspace-panel-hover workspace-panel-muted border border-[var(--app-border)] shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
        p="lg"
        radius="lg"
      >
        <Stack gap="sm">
          <div className="workspace-section-heading">
            {copy.qualityDistribution}
          </div>
          {qualitySummaryRows.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
              <div>
                {qualitySummaryRows.map((row) => (
                  <div
                    className="workspace-meta-row workspace-table-number rounded-[14px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.015)] px-3 py-2"
                    key={row.quality}
                  >
                    <span className="workspace-meta-label">{row.quality}</span>
                    <span className="workspace-meta-value">{row.count}</span>
                  </div>
                ))}
              </div>
              <Suspense
                fallback={
                  <ReportChartFallback heightClassName="h-64" locale={locale} />
                }
              >
                <ReportCharts
                  locale={locale}
                  qualityDistributionData={qualityDistributionData}
                  radarData={[]}
                />
              </Suspense>
            </div>
          ) : (
            <Text c="var(--app-text-muted)" size="sm">
              {copy.noQualityResults}
            </Text>
          )}
        </Stack>
      </Paper>

      {answerStatusDistribution.length > 0 && (
        <Paper
          className="workspace-panel-hover workspace-panel-muted border border-[var(--app-border)] shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
          p="lg"
          radius="lg"
        >
          <Stack gap="sm">
            <div className="workspace-section-heading">
              {copy.answerStatusDistribution}
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {answerStatusDistribution.map((item) => (
                <div
                  className="workspace-meta-row workspace-table-number"
                  key={item.status}
                >
                  <span className="workspace-meta-label">{item.status}</span>
                  <span className="workspace-meta-value">{item.count}</span>
                </div>
              ))}
            </div>
          </Stack>
        </Paper>
      )}

      {errorTypeDistribution.length > 0 && (
        <Paper
          className="workspace-panel-hover workspace-panel-muted border border-[var(--app-border)] shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
          p="lg"
          radius="lg"
        >
          <Stack gap="sm">
            <div className="workspace-section-heading">
              {copy.issueTypeDistribution}
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {errorTypeDistribution.map((item) => (
                <div
                  className="workspace-meta-row workspace-table-number"
                  key={item.code}
                >
                  <span className="workspace-meta-label">{item.code}</span>
                  <span className="workspace-meta-value">{item.count}</span>
                </div>
              ))}
            </div>
          </Stack>
        </Paper>
      )}

      {qualityGate && (
        <Paper
          className="workspace-panel-hover workspace-panel-muted border border-[var(--app-border)] shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
          p="lg"
          radius="lg"
        >
          <Stack gap="sm">
            <div className="workspace-section-heading">{copy.qualityGate}</div>
            {qualityGatePresentation ? (
              <Paper className="workspace-subpanel" p="md" radius="lg">
                <Stack gap="xs">
                  <Badge
                    color={qualityGatePresentation.color}
                    variant="light"
                    w="fit-content"
                  >
                    {qualityGatePresentation.label}
                  </Badge>
                  <Text c="var(--app-text-muted)" size="sm">
                    {qualityGatePresentation.detail}
                  </Text>
                  {topBreachedMetric ? (
                    <div className="workspace-meta-row">
                      <span className="workspace-meta-label">
                        {copy.qualityGate === '质量门槛'
                          ? locale === 'zh'
                            ? '优先修复指标'
                            : 'Fix first'
                          : locale === 'zh'
                            ? '优先修复指标'
                            : 'Fix first'}
                      </span>
                      <span className="workspace-meta-value text-right">
                        {getQualityGateMetricLabel(
                          topBreachedMetric.metric,
                          locale
                        )}{' '}
                        ·{' '}
                        {getQualityGateMetricStrategy({
                          metric: topBreachedMetric.metric,
                          limitType: topBreachedMetric.limitType,
                          locale
                        })}
                      </span>
                    </div>
                  ) : null}
                </Stack>
              </Paper>
            ) : null}
            <div className="grid gap-2 md:grid-cols-2">
              <div className="workspace-meta-row">
                <span className="workspace-meta-label">
                  {locale === 'zh' ? '模式' : 'Mode'}
                </span>
                <span className="workspace-meta-value">{qualityGate.mode}</span>
              </div>
              <div className="workspace-meta-row">
                <span className="workspace-meta-label">
                  {locale === 'zh' ? '状态' : 'Status'}
                </span>
                <span className="workspace-meta-value">
                  {qualityGate.status}
                </span>
              </div>
              <div className="workspace-meta-row">
                <span className="workspace-meta-label">
                  {locale === 'zh' ? '限制版本' : 'Limit version'}
                </span>
                <span className="workspace-meta-value">
                  {qualityGate.limitVersion}
                </span>
              </div>
              <div className="workspace-meta-row">
                <span className="workspace-meta-label">
                  {locale === 'zh' ? '违规指标数' : 'Breached metrics'}
                </span>
                <span className="workspace-meta-value">
                  {qualityGate.breachedMetricCount}
                </span>
              </div>
            </div>
            <Text c="var(--app-text-muted)" size="sm">
              {qualityGate.message}
            </Text>
            {qualityGate.breachedMetrics?.length ? (
              <div className="grid gap-2 mt-1">
                {qualityGate.breachedMetrics.map((metric, index) => (
                  <div className="workspace-meta-row" key={index}>
                    <span className="workspace-meta-label">
                      {getQualityGateMetricLabel(metric.metric, locale)}
                    </span>
                    <span className="workspace-meta-value">
                      {metric.current} vs {metric.limit} ({metric.limitType})
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </Stack>
        </Paper>
      )}

      <Paper
        className="workspace-panel-hover workspace-panel-muted border border-[var(--app-border)] shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
        p="lg"
        radius="lg"
      >
        <Stack gap="sm">
          <div className="workspace-section-heading">{copy.runDiffSummary}</div>
          {runDiffSummary ? (
            <>
              <Text c="var(--app-text-muted)" size="sm">
                {runDiffSummary.headline}
              </Text>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">regressedMetrics</span>
                  <span className="workspace-meta-value">
                    {runDiffSummary.regressedMetricCount}
                  </span>
                </div>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">improvedMetrics</span>
                  <span className="workspace-meta-value">
                    {runDiffSummary.improvedMetricCount}
                  </span>
                </div>
              </div>
              {runDiffSummary.topRegressionReasons.length > 0 ? (
                <div className="grid gap-2">
                  {runDiffSummary.topRegressionReasons.map((reason) => (
                    <div className="workspace-meta-row" key={reason.reasonCode}>
                      <span className="workspace-meta-label">
                        {getRegressionReasonLabel(reason.reasonCode, locale)}
                      </span>
                      <span className="workspace-meta-value">
                        {reason.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <Text c="var(--app-text-muted)" size="sm">
              {locale === 'zh'
                ? '当前检查缺少可用差异摘要（通常需 baseline 对照已就绪）。'
                : 'Run diff summary is unavailable for this comparison (baseline delta not ready).'}
            </Text>
          )}
        </Stack>
      </Paper>

      <Paper
        className="workspace-panel-hover workspace-panel-muted border border-[var(--app-border)] shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
        p="lg"
        radius="lg"
      >
        <Stack gap="sm">
          <div className="workspace-section-heading">
            {copy.regressionWeakestItems}
          </div>
          <Text c="var(--app-text-muted)" size="sm">
            {locale === 'zh'
              ? '按严重程度列出最需要优先复盘的问题。'
              : 'Prioritize per-question regressions so review can focus on the weakest items first.'}
          </Text>
          {runEvalData.baselineComparison?.failureDrilldown ? (
            <>
              <div className="workspace-meta-row">
                <span className="workspace-meta-label">
                  regressedQuestionCount
                </span>
                <span className="workspace-meta-value">
                  {
                    runEvalData.baselineComparison.failureDrilldown
                      .regressedQuestionCount
                  }
                </span>
              </div>
              {regressionDrilldownItems.length > 0 ? (
                <div className="grid gap-2">
                  {regressionDrilldownItems.map((item) => (
                    <div
                      className="workspace-meta-row"
                      key={`${item.index}-${item.question}`}
                    >
                      <div className="min-w-0">
                        <span className="workspace-meta-label">
                          #{item.index} · {item.severity}
                        </span>
                        <div className="mt-1 text-xs text-[var(--app-text-muted)] line-clamp-2">
                          {item.question}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-right">
                        <span className="workspace-meta-value text-right">
                          {item.reasonCodes
                            .map((code) =>
                              getRegressionReasonLabel(code, locale)
                            )
                            .join('; ')}
                        </span>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            className="workspace-button"
                            color="indigo"
                            onClick={() =>
                              focusRunItem(item.index, item.question)
                            }
                            radius="lg"
                            size="xs"
                            variant="subtle"
                          >
                            {locale === 'zh' ? '定位结果行' : 'Focus row'}
                          </Button>
                          {runItemsByKey.get(
                            getEvalItemKey(item.index, item.question)
                          )?.traceId ? (
                            <Button
                              className="workspace-button"
                              color="indigo"
                              component={Link}
                              radius="lg"
                              size="xs"
                              to={buildTraceReviewLink({
                                traceId:
                                  runItemsByKey.get(
                                    getEvalItemKey(item.index, item.question)
                                  )?.traceId ?? '',
                                question: item.question,
                                handlingTitle:
                                  locale === 'zh'
                                    ? '回归弱项复盘'
                                    : 'Weakest-item review',
                                priorityLabel:
                                  locale === 'zh'
                                    ? `回归弱项 #${item.index}`
                                    : `Weakest item #${item.index}`
                              })}
                              variant="subtle"
                            >
                              {locale === 'zh'
                                ? '打开诊断'
                                : 'Open diagnostics'}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Text c="var(--app-text-muted)" size="sm">
                  {copy.noPerQuestionRegressions}
                </Text>
              )}
            </>
          ) : (
            <Text c="var(--app-text-muted)" size="sm">
              {locale === 'zh'
                ? '当前 baseline 缺少题目级对照数据（通常需在最新格式 baseline 初始化后可用）。'
                : 'Per-question drilldown is unavailable for this baseline (initialize the baseline with the latest run format).'}
            </Text>
          )}
        </Stack>
      </Paper>

      <Paper
        className="workspace-panel-hover workspace-panel-muted border border-[var(--app-border)] shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
        p="lg"
        radius="lg"
      >
        <Stack gap="sm">
          <div className="workspace-section-heading">{copy.runContext}</div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="workspace-meta-row">
              <span className="workspace-meta-label">Question set</span>
              <span className="workspace-meta-value">
                {runEvalData.questionSetId}
              </span>
            </div>
            <div className="workspace-meta-row">
              <span className="workspace-meta-label">Assistant</span>
              <span className="workspace-meta-value">
                {runEvalData.assistantId}
              </span>
            </div>
            <div className="workspace-meta-row">
              <span className="workspace-meta-label">Baseline snapshot</span>
              <span className="workspace-meta-value">
                {formatBaselineMetadataValue(
                  runEvalData.baselineSnapshotId,
                  baselineSnapshotPlaceholder
                )}
              </span>
            </div>
            <div className="workspace-meta-row">
              <span className="workspace-meta-label">Baseline version</span>
              <span className="workspace-meta-value">
                {formatBaselineMetadataValue(
                  runEvalData.baselineVersion,
                  baselineVersionPlaceholder
                )}
              </span>
            </div>
            <div className="workspace-meta-row">
              <span className="workspace-meta-label">startedAt</span>
              <span className="workspace-meta-value">
                {formatDateTime(runEvalData.startedAt)}
              </span>
            </div>
            <div className="workspace-meta-row">
              <span className="workspace-meta-label">finishedAt</span>
              <span className="workspace-meta-value">
                {formatDateTime(runEvalData.finishedAt)}
              </span>
            </div>
          </div>
        </Stack>
      </Paper>

      <Paper
        className="workspace-panel-hover workspace-panel-muted border border-[var(--app-border)] shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
        p="lg"
        radius="lg"
      >
        <Stack gap="sm">
          <div className="workspace-section-heading">{copy.reportExport}</div>
          <Text c="var(--app-text-muted)" size="sm">
            {locale === 'zh'
              ? '把这次质量检查结果导出为可复用文件，便于存档和分享。'
              : 'Export this quality check into reusable files for storage and sharing.'}
          </Text>
          <div className="flex flex-wrap gap-2">
            <Button
              className="workspace-button"
              color="indigo"
              loading={exporting === 'markdown'}
              onClick={() => void downloadReport('markdown')}
              radius="lg"
              size="xs"
              variant="light"
            >
              Markdown
            </Button>
            <Button
              className="workspace-button"
              color="indigo"
              loading={exporting === 'json'}
              onClick={() => void downloadReport('json')}
              radius="lg"
              size="xs"
              variant="light"
            >
              JSON
            </Button>
            <Button
              className="workspace-button"
              color="indigo"
              loading={exporting === 'html'}
              onClick={() => void downloadReport('html')}
              radius="lg"
              size="xs"
              variant="light"
            >
              HTML
            </Button>
          </div>
        </Stack>
      </Paper>
    </>
  );
}
