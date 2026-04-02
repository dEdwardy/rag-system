type Locale = "zh" | "en";

export type HealthSignal = {
  label: string;
  tone: "green" | "gray" | "red" | "yellow" | "orange";
  value: string;
};

export type AlertItem = {
  id: string;
  tone: "red" | "orange" | "yellow";
  title: string;
  detail: string;
  actionLabel: string;
  actionTo: string;
};

export type RunSummaryActionTarget = {
  label: string;
  to: string;
};

export function buildRunSummaryActionTarget(args: {
  locale: Locale;
  latestFailureDocumentId?: string | null;
}): RunSummaryActionTarget {
  if (args.latestFailureDocumentId) {
    return {
      label: args.locale === "zh" ? "打开失败文档" : "Open failed document",
      to: `/documents/${args.latestFailureDocumentId}`
    };
  }

  return {
    label: args.locale === "zh" ? "查看运行摘要" : "Open run summary",
    to: "/knowledge-base"
  };
}

export function generateHealthSignals(params: {
  isApiHealthy: boolean;
  apiHealthQueryLoading: boolean;
  pendingRunCount: number;
  recentIssueCount: number;
  hasRecentFailure: boolean;
  retryableFailureCount: number;
  nonRetryableFailureCount: number;
  timeRange: number;
  locale: Locale;
}): HealthSignal[] {
  const {
    isApiHealthy,
    apiHealthQueryLoading,
    pendingRunCount,
    recentIssueCount,
    hasRecentFailure,
    retryableFailureCount,
    nonRetryableFailureCount,
    timeRange,
    locale
  } = params;

  return [
    {
      label: locale === "zh" ? "API" : "API",
      tone: isApiHealthy ? "green" : apiHealthQueryLoading ? "gray" : "red",
      value: isApiHealthy
        ? locale === "zh"
          ? "正常"
          : "healthy"
        : apiHealthQueryLoading
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
      label: locale === "zh" ? `最近 ${timeRange}h 问题事件` : `Issue events (${timeRange}h)`,
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
  ];
}

export function generateAlertItems(params: {
  apiHealthQueryLoading: boolean;
  isApiHealthy: boolean;
  nonRetryableFailureCount: number;
  pendingRunCount: number;
  retryableFailureCount: number;
  recentIssueCount: number;
  boundaryHitCount: number;
  timeRange: number;
  runSummaryActionTarget: RunSummaryActionTarget;
  locale: Locale;
}): AlertItem[] {
  const {
    apiHealthQueryLoading,
    isApiHealthy,
    nonRetryableFailureCount,
    pendingRunCount,
    retryableFailureCount,
    recentIssueCount,
    boundaryHitCount,
    timeRange,
    runSummaryActionTarget,
    locale
  } = params;

  const alerts: AlertItem[] = [];

  if (!apiHealthQueryLoading && !isApiHealthy) {
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
          ? `最近 ${timeRange}h 有 ${nonRetryableFailureCount} 条不可重试失败运行。`
          : `${nonRetryableFailureCount} non-retryable failed runs in the last ${timeRange}h.`,
      actionLabel: runSummaryActionTarget.label,
      actionTo: runSummaryActionTarget.to
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
      actionLabel: runSummaryActionTarget.label,
      actionTo: runSummaryActionTarget.to
    });
  }

  if (retryableFailureCount >= 3) {
    alerts.push({
      id: "retryable-failure-threshold",
      tone: "orange",
      title: locale === "zh" ? "可重试失败超过阈值" : "Retryable-failure threshold reached",
      detail:
        locale === "zh"
          ? `最近 ${timeRange}h 可重试失败 ${retryableFailureCount} 条（阈值 >= 3）。`
          : `${retryableFailureCount} retryable failed runs in the last ${timeRange}h (threshold >= 3).`,
      actionLabel: runSummaryActionTarget.label,
      actionTo: runSummaryActionTarget.to
    });
  }

  if (recentIssueCount >= 5) {
    alerts.push({
      id: "issue-events-threshold",
      tone: "orange",
      title: locale === "zh" ? "问题事件超过阈值" : "Issue-event threshold reached",
      detail:
        locale === "zh"
          ? `最近 ${timeRange}h 问题事件 ${recentIssueCount} 条（阈值 >= 5）。`
          : `${recentIssueCount} issue events in the last ${timeRange}h (threshold >= 5).`,
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
          ? `最近 ${timeRange}h 有 ${boundaryHitCount} 次 source 边界命中。`
          : `${boundaryHitCount} source boundary-hit runs in the last ${timeRange}h.`,
      actionLabel: runSummaryActionTarget.label,
      actionTo: runSummaryActionTarget.to
    });
  }

  return alerts;
}
