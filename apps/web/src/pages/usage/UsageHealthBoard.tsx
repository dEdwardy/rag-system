import { Badge, Button, Paper } from "@mantine/core";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import type { AlertItem, HealthSignal } from "./usage-page-helpers";
import type {
  AuditEventRecord,
  KnowledgeBaseDocumentRunComparisonRunDifference,
  KnowledgeBaseDocumentRunComparisonSnapshotDifference
} from "../../types/api";

type ScanSummaryItem = {
  key: string;
  label: string;
  value: string;
  copy: string;
};

type AnomalyCluster = {
  count: number;
  failedStage: string;
  code: string;
  retryable: boolean;
  sourceTypes: string[];
  sampleMessage: string | null;
};

type LatestFailureAnchor = {
  documentId: string;
  sourceType: string;
  message?: string | null;
};

type SourceFamilyHotspot = {
  family: string;
  stats: {
    failedRuns: number;
    runsWithBoundaryHit: number;
    totalRuns: number;
  };
};

type SnapshotWindowSourceFamilyDrilldown = {
  sourceFamily: string;
  failedDelta: number;
  boundaryDelta: number;
  retryableDelta: number;
  nonRetryableDelta: number;
  leftWindowLabel: number;
  rightWindowLabel: number;
};

type SnapshotWindowIssueSlice = {
  leftWindowLabel: number;
  rightWindowLabel: number;
  slice: {
    leftHotspot?: {
      sourceFamily: string;
      issueSignalScore: number;
      totalRuns: number;
    } | null;
    rightHotspot?: {
      sourceFamily: string;
      issueSignalScore: number;
      totalRuns: number;
    } | null;
    dominantShift?: {
      sourceFamily: string;
      issueConcentrationDelta: number;
      issueSignalDelta: number;
    } | null;
  } | null;
};

type TrendMetric = {
  key: string;
  label: string;
  values: number[];
};

type UsageHealthBoardProps = {
  locale: "zh" | "en";
  healthPanelErrorMessage: string | null;
  showP6PreRunGuidance: boolean;
  scanSummaryItems: ScanSummaryItem[];
  healthSignals: HealthSignal[];
  alertItems: AlertItem[];
  latestFailureAnchor: LatestFailureAnchor | null;
  isRunSummaryLoading: boolean;
  isApiHealthLoading: boolean;
  trendPanelErrorMessage: string | null;
  isTrendLoading: boolean;
  trendMetrics: TrendMetric[];
  recentIssueCount: number;
  isAuditEventsLoading: boolean;
  auditEvents: AuditEventRecord[];
  anomalyPanelErrorMessage: string | null;
  isAnomalyRunsLoading: boolean;
  anomalyClusters: AnomalyCluster[];
  runDiffPanelErrorMessage: string | null;
  hasLatestIssueRunPair: boolean;
  isRunDiffLoading: boolean;
  runDiffMode: string | undefined;
  runDiffs: KnowledgeBaseDocumentRunComparisonRunDifference[];
  snapshotWindowDiffPanelErrorMessage: string | null;
  isSnapshotWindowDiffLoading: boolean;
  snapshotWindowDiffMode: string | undefined;
  snapshotWindowDiffs: KnowledgeBaseDocumentRunComparisonSnapshotDifference[];
  snapshotWindowSourceFamilyDrilldown: SnapshotWindowSourceFamilyDrilldown | null;
  snapshotWindowIssueSlice: SnapshotWindowIssueSlice | null;
  sourceFamilyHotspot: SourceFamilyHotspot | null;
};

export function UsageHealthBoard(props: UsageHealthBoardProps) {
  const {
    locale,
    healthPanelErrorMessage,
    showP6PreRunGuidance,
    scanSummaryItems,
    healthSignals,
    alertItems,
    latestFailureAnchor,
    isRunSummaryLoading,
    isApiHealthLoading,
    trendPanelErrorMessage,
    isTrendLoading,
    trendMetrics,
    recentIssueCount,
    isAuditEventsLoading,
    auditEvents,
    anomalyPanelErrorMessage,
    isAnomalyRunsLoading,
    anomalyClusters,
    runDiffPanelErrorMessage,
    hasLatestIssueRunPair,
    isRunDiffLoading,
    runDiffMode,
    runDiffs,
    snapshotWindowDiffPanelErrorMessage,
    isSnapshotWindowDiffLoading,
    snapshotWindowDiffMode,
    snapshotWindowDiffs,
    snapshotWindowSourceFamilyDrilldown,
    snapshotWindowIssueSlice,
    sourceFamilyHotspot
  } = props;

  return (
    <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="workspace-section-heading">{locale === "zh" ? "运行健康看板" : "Operations health board"}</div>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {locale === "zh"
                ? "把 API 状态、资料更新摘要和问题事件收在一起，方便管理侧快速判断工作区是否稳定。"
                : "Combine API status, library-update summary, and issue events into one quick operational check for workspace stability."}
            </p>
          </div>
          <Badge color={healthPanelErrorMessage ? "red" : "indigo"} radius="sm" variant="light">
            {healthPanelErrorMessage
              ? locale === "zh"
                ? "部分信号加载失败"
                : "partial signal load failure"
              : locale === "zh"
                ? "轻量观察视图"
                : "light operations view"}
          </Badge>
        </div>

        {healthPanelErrorMessage ? (
          <StatePanel
            description={healthPanelErrorMessage}
            title={locale === "zh" ? "运行健康信号加载失败" : "Failed to load operations health signals"}
            tone="error"
          />
        ) : null}

        {showP6PreRunGuidance ? (
          <div className="flex flex-col gap-3" data-testid="usage-p6-pre-run-guidance">
            <StatePanel
              action={
                <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/knowledge-base" variant="light">
                  {locale === "zh" ? "先跑一次资料更新" : "Start with one library update run"}
                </Button>
              }
              description={
                locale === "zh"
                  ? "当前工作区资料库还没有更新记录。先在工作区设置或资料库里触发一次资料导入/重跑，再回到这里查看运行健康信号。首轮运行完成前，这里的趋势、告警和异常面板会保持收起，避免误读。"
                  : "This workspace library has no update history yet. Trigger one add or re-run flow from workspace settings or the library before reading the operations health signals here. Until the first run lands, the trend, alert, and anomaly panels stay collapsed to avoid false zero-signal reading."
              }
              title={locale === "zh" ? "预运行引导" : "Pre-run guidance"}
            />
            <p className="text-xs text-[var(--app-text-muted)]" data-testid="usage-p6-pre-run-path">
              {locale === "zh"
                ? "建议路径：工作区设置/资料库（触发更新）→ Workbench（回看运行信号）。"
                : "Suggested path: workspace settings/library (trigger an update) -> workbench (review operational signals)."}
            </p>
          </div>
        ) : (
          <>
            <div className="workspace-scan-grid grid gap-4 md:grid-cols-3">
              {scanSummaryItems.map(item => (
                <div className="workspace-scan-card" key={item.key}>
                  <span className="workspace-scan-label">{item.label}</span>
                  <span className="workspace-scan-value">{item.value}</span>
                  <span className="workspace-scan-copy">{item.copy}</span>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
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

            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
              <div className="workspace-subpanel rounded-[20px] p-4">
                <div className="workspace-section-heading">{locale === "zh" ? "趋势视图" : "Trend view"}</div>
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
                    {trendMetrics.map(metric => {
                      const trend = metric.values[2] - metric.values[0];
                      const trendClass = trend > 0 ? "text-red-500" : trend < 0 ? "text-green-500" : "text-gray-500";
                      const trendIcon = trend > 0 ? "↑" : trend < 0 ? "↓" : "→";

                      return (
                        <li className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3" key={metric.key}>
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-[var(--app-text)]">{metric.label}</div>
                            <span className={`${trendClass} font-medium`}>{trendIcon} {Math.abs(trend)}</span>
                          </div>
                          <div className="mt-1 text-[var(--app-text-muted)]">
                            1h: {metric.values[0]} · 6h: {metric.values[1]} · 24h: {metric.values[2]}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="workspace-subpanel rounded-[20px] p-4">
                <div className="workspace-section-heading">{locale === "zh" ? "告警视图" : "Alert view"}</div>
                <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                  {locale === "zh"
                    ? "把重要 warning 与阈值问题收敛在一个列表里，便于快速排查。"
                    : "Keep important warnings and threshold issues in one quick-scan list."}
                </p>
                {latestFailureAnchor ? (
                  <div className="mt-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color="red" radius="sm" variant="light">
                        {locale === "zh" ? "最新失败锚点" : "Latest failure anchor"}
                      </Badge>
                      <span className="font-medium text-[var(--app-text)]">{latestFailureAnchor.sourceType}</span>
                    </div>
                    <p className="mt-1 text-[var(--app-text-muted)]">
                      {latestFailureAnchor.message ??
                        (locale === "zh" ? "最近失败运行未记录 message。" : "The latest failed run does not include a failure message.")}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3">
                      <Link className="inline-block text-[13px] font-medium text-[var(--app-accent)]" to={`/documents/${latestFailureAnchor.documentId}`}>
                        {locale === "zh" ? "打开对应文档" : "Open related document"}
                      </Link>
                      <Link className="inline-block text-[13px] font-medium text-[var(--app-accent)]" to="/traces">
                        {locale === "zh" ? "继续诊断路径" : "Continue to diagnostics"}
                      </Link>
                    </div>
                    <p className="mt-2 text-xs text-[var(--app-text-muted)]">
                      {locale === "zh"
                        ? "按同一路径：文档详情 -> 运行失败摘要 -> 诊断详情。"
                        : "Follow one path: Document Detail -> Run failure summary -> Diagnostics."}
                    </p>
                  </div>
                ) : null}
                {isRunSummaryLoading || isApiHealthLoading ? (
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
                <div className="workspace-section-heading">{locale === "zh" ? "最近问题事件（24h）" : "Recent issue events (24h)"}</div>
                {isAuditEventsLoading ? (
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">{locale === "zh" ? "加载中…" : "Loading..."}</p>
                ) : recentIssueCount === 0 ? (
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                    {locale === "zh" ? "最近 24 小时没有新的问题事件。" : "No issue events in the last 24 hours."}
                  </p>
                ) : (
                  <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm text-[var(--app-text-muted)]">
                    {auditEvents.map(event => (
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
                <div className="workspace-section-heading">{locale === "zh" ? "异常聚类视图" : "Anomaly clustering view"}</div>
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
                ) : isAnomalyRunsLoading ? (
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
                            {locale === "zh" ? `重复 ${cluster.count} 次` : `${cluster.count} repeated runs`}
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
                <div className="workspace-section-heading">{locale === "zh" ? "回归差异视图" : "Regression diff view"}</div>
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
                ) : isAnomalyRunsLoading ? (
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">{locale === "zh" ? "加载中…" : "Loading..."}</p>
                ) : !hasLatestIssueRunPair ? (
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                    {locale === "zh" ? "至少需要两次问题 run 才能显示差异。" : "At least two issue runs are required to render a diff."}
                  </p>
                ) : isRunDiffLoading ? (
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">{locale === "zh" ? "加载中…" : "Loading..."}</p>
                ) : runDiffMode !== "run" ? (
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                    {locale === "zh" ? "当前差异视图仅展示 run 对比模式。" : "This view currently renders run comparison mode only."}
                  </p>
                ) : runDiffs.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]" data-testid="regression-diff-row">
                    {locale === "zh" ? "最近两次问题 run 未检测到关键差异。" : "No meaningful differences detected between the latest two issue runs."}
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2 text-sm">
                    {runDiffs.slice(0, 5).map(diff => (
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
                <div className="workspace-section-heading">{locale === "zh" ? "快照窗口差异" : "Snapshot window diff"}</div>
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
                ) : isSnapshotWindowDiffLoading ? (
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">{locale === "zh" ? "加载中…" : "Loading..."}</p>
                ) : snapshotWindowDiffMode !== "snapshot" ? (
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]" data-testid="snapshot-window-diff-row">
                    {locale === "zh" ? "当前差异视图仅展示快照对比模式。" : "This view currently renders snapshot comparison mode only."}
                  </p>
                ) : snapshotWindowDiffs.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]" data-testid="snapshot-window-diff-row">
                    {locale === "zh" ? "最近 6h 与 24h 快照未检测到关键差异。" : "No meaningful differences detected between 6h and 24h snapshots."}
                  </p>
                ) : (
                  <>
                    <ul className="mt-3 flex flex-col gap-2 text-sm">
                      {snapshotWindowDiffs.slice(0, 5).map(diff => (
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
                      <div className="mt-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-sm text-[var(--app-text-muted)]" data-testid="snapshot-window-source-family-drilldown">
                        <span className="font-medium text-[var(--app-text)]">{locale === "zh" ? "source-family 驱动" : "source-family driver"}</span>
                        {locale === "zh"
                          ? `：${snapshotWindowSourceFamilyDrilldown.sourceFamily}（${snapshotWindowSourceFamilyDrilldown.leftWindowLabel}h → ${snapshotWindowSourceFamilyDrilldown.rightWindowLabel}h）失败 Δ ${snapshotWindowSourceFamilyDrilldown.failedDelta}，边界命中 Δ ${snapshotWindowSourceFamilyDrilldown.boundaryDelta}，可重试 Δ ${snapshotWindowSourceFamilyDrilldown.retryableDelta}，不可重试 Δ ${snapshotWindowSourceFamilyDrilldown.nonRetryableDelta}。`
                          : `: ${snapshotWindowSourceFamilyDrilldown.sourceFamily} (${snapshotWindowSourceFamilyDrilldown.leftWindowLabel}h → ${snapshotWindowSourceFamilyDrilldown.rightWindowLabel}h) with failed-runs Δ ${snapshotWindowSourceFamilyDrilldown.failedDelta}, boundary-hits Δ ${snapshotWindowSourceFamilyDrilldown.boundaryDelta}, retryable Δ ${snapshotWindowSourceFamilyDrilldown.retryableDelta}, and non-retryable Δ ${snapshotWindowSourceFamilyDrilldown.nonRetryableDelta}.`}
                      </div>
                    ) : null}

                    {snapshotWindowIssueSlice?.slice ? (
                      <div className="mt-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-sm text-[var(--app-text-muted)]" data-testid="snapshot-window-issue-slice">
                        <span className="font-medium text-[var(--app-text)]">{locale === "zh" ? "issue-window 切片" : "issue-window slice"}</span>

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
                            {locale === "zh" ? "当前窗口未形成可读主变化项。" : "No readable dominant shift is available for this window pair."}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div className="workspace-subpanel rounded-[20px] p-4 xl:col-span-3">
                <div className="workspace-section-heading">{locale === "zh" ? "source-family 热点" : "Source-family hotspot"}</div>
                <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                  {locale === "zh"
                    ? "基于 bySourceFamily 摘要，优先标出当前失败/边界命中最高的 source family。"
                    : "Use bySourceFamily summary data to highlight the source family with the highest failure/boundary-hit pressure."}
                </p>

                {isRunSummaryLoading ? (
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">{locale === "zh" ? "加载中…" : "Loading..."}</p>
                ) : !sourceFamilyHotspot ? (
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]" data-testid="source-family-hotspot-row">
                    {locale === "zh"
                      ? "最近 24 小时未发现 source-family 级失败或边界命中热点。"
                      : "No source-family hotspot for failures or boundary hits in the last 24 hours."}
                  </p>
                ) : (
                  <div className="mt-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-sm" data-testid="source-family-hotspot-row">
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
                  {locale === "zh" ? "打开诊断" : "Open diagnostics"}
                </Button>
                <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/knowledge-base" variant="light">
                  {locale === "zh" ? "查看运行摘要" : "Open run summary"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Paper>
  );
}
