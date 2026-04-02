import type {
  JsonValue,
  DocumentRunRecord,
  KnowledgeBaseDocumentRunRecord
} from "../../types/api";

type RunLike = Pick<
  DocumentRunRecord,
  "trigger" | "status" | "failedStage" | "startedAt" | "finishedAt"
> & {
  diagnosticsJson?: JsonValue | null;
  document?: Pick<KnowledgeBaseDocumentRunRecord["document"], "sourceType" | "sourceName" | "title">;
};

type DiagnosticsObject = Record<string, JsonValue>;

function asDiagnosticsObject(value: JsonValue | null | undefined): DiagnosticsObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as DiagnosticsObject;
}

function toTitleCase(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatRunTriggerLabel(trigger: string) {
  return toTitleCase(trigger.replace(/_/g, " "));
}

export function formatRunSourceTypeLabel(sourceType: string) {
  return toTitleCase(sourceType.replace(/[_-]/g, " "));
}

export function formatRunFailedStageLabel(failedStage: string | null | undefined) {
  if (!failedStage) {
    return null;
  }

  return toTitleCase(failedStage.replace(/_/g, " "));
}

export function getRunFailureMessage(diagnosticsJson: JsonValue | null | undefined) {
  const diagnostics = asDiagnosticsObject(diagnosticsJson);
  const message = diagnostics?.message;
  return typeof message === "string" ? message : null;
}

export function buildRunDiagnosticsHighlights(diagnosticsJson: JsonValue | null | undefined) {
  const diagnostics = asDiagnosticsObject(diagnosticsJson);
  if (!diagnostics) {
    return [];
  }

  const candidates: Array<[string, keyof DiagnosticsObject]> = [
    ["code", "code"],
    ["retryable", "retryable"],
    ["partial", "partial"],
    ["failedPages", "failedPageCount"],
    ["failedChildSitemaps", "failedChildSitemapCount"],
    ["failedEntries", "failedEntryCount"],
    ["attemptedPages", "attemptedPageCount"],
    ["attemptedEntries", "attemptedEntryCount"]
  ];

  return candidates.flatMap(([key, sourceKey]) => {
    const value = diagnostics[sourceKey];
    if (typeof value === "string" || typeof value === "number") {
      return [{ key, value: String(value) }];
    }

    if (typeof value === "boolean") {
      return [{ key, value: value ? "yes" : "no" }];
    }

    return [];
  });
}

export function describeRunMeta(run: RunLike) {
  return {
    triggerLabel: formatRunTriggerLabel(run.trigger),
    sourceTypeLabel: run.document ? formatRunSourceTypeLabel(run.document.sourceType) : null,
    failedStageLabel: formatRunFailedStageLabel(run.failedStage),
    failureMessage: getRunFailureMessage(run.diagnosticsJson),
    startedAt: run.startedAt,
    finishedAt: run.finishedAt
  };
}

export function buildRunSummaryText(run: RunLike, locale: string) {
  const failedStageLabel = formatRunFailedStageLabel(run.failedStage);

  if (run.status === "ready") {
    if (failedStageLabel) {
      return locale === "zh"
        ? `运行完成，但在 ${failedStageLabel} 存在异常。`
        : `Run completed with issues during ${failedStageLabel}.`;
    }

    return locale === "zh" ? "运行完成，未发现异常。" : "Run completed successfully.";
  }

  if (run.status === "failed") {
    if (failedStageLabel) {
      return locale === "zh" ? `运行失败，阶段：${failedStageLabel}。` : `Run failed during ${failedStageLabel}.`;
    }

    return locale === "zh" ? "运行失败。" : "Run failed.";
  }

  if (run.status === "skipped") {
    return locale === "zh" ? "运行已跳过。" : "Run was skipped.";
  }

  return locale === "zh" ? "运行进行中。" : "Run is in progress.";
}
