export type EvalRunParams = {
  questionSetId: string;
  assistantId: string;
  baselineSnapshotId?: string;
};

export function normalizeEvalRunParams(params: {
  questionSetId: string;
  assistantId: string;
  baselineSnapshotId: string;
}): EvalRunParams | null {
  const questionSetId = params.questionSetId.trim();
  const assistantId = params.assistantId.trim();
  const baselineSnapshotId = params.baselineSnapshotId.trim();

  if (!questionSetId || !assistantId) {
    return null;
  }

  return {
    questionSetId,
    assistantId,
    ...(baselineSnapshotId ? { baselineSnapshotId } : {})
  };
}

export function createEvalRunSearchParams(params: EvalRunParams): URLSearchParams {
  const nextSearchParams = new URLSearchParams();
  nextSearchParams.set("questionSetId", params.questionSetId);
  nextSearchParams.set("assistantId", params.assistantId);
  if (params.baselineSnapshotId) {
    nextSearchParams.set("baselineSnapshotId", params.baselineSnapshotId);
  }
  return nextSearchParams;
}

export function readEvalRunParamsFromSearchParams(searchParams: URLSearchParams) {
  return {
    questionSetId: searchParams.get("questionSetId") ?? "",
    assistantId: searchParams.get("assistantId") ?? "",
    baselineSnapshotId: searchParams.get("baselineSnapshotId") ?? ""
  };
}

const EVAL_RUN_SEARCH_PARAM_KEYS = ["questionSetId", "assistantId", "baselineSnapshotId"] as const;

export function mergeSearchParamsWithEvalRunParams(
  currentSearchParams: URLSearchParams,
  evalRunParams: EvalRunParams | null
) {
  const nextSearchParams = new URLSearchParams(currentSearchParams);

  for (const key of EVAL_RUN_SEARCH_PARAM_KEYS) {
    nextSearchParams.delete(key);
  }

  if (evalRunParams) {
    for (const [key, value] of createEvalRunSearchParams(evalRunParams).entries()) {
      nextSearchParams.set(key, value);
    }
  }

  return nextSearchParams;
}

export function getRunContextLabel(field: "questionSetId" | "baselineSnapshotId" | "baselineVersion" | "assistantId", locale: "zh" | "en") {
  if (locale === "zh") {
    if (field === "questionSetId") return "Question set";
    if (field === "baselineSnapshotId") return "Baseline snapshot";
    if (field === "baselineVersion") return "Baseline version";
    return "Assistant";
  }

  if (field === "questionSetId") return "Question set";
  if (field === "baselineSnapshotId") return "Baseline snapshot";
  if (field === "baselineVersion") return "Baseline version";
  return "Assistant";
}

export function formatBaselineMetadataValue(
  value: string | number | null | undefined,
  placeholder: string
) {
  if (value == null) {
    return placeholder;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : placeholder;
}

export function getRegressionReasonLabel(reasonCode: string, locale: "zh" | "en") {
  if (locale === "zh") {
    if (reasonCode === "became_failed") return "由成功变为失败";
    if (reasonCode === "became_insufficient_context") return "由 grounded 变为 insufficient_context";
    if (reasonCode === "quality_degraded") return "质量等级下降";
    if (reasonCode === "fallback_introduced") return "新增 fallback 依赖";
    if (reasonCode === "citations_decreased") return "引用数量下降";
    return reasonCode;
  }

  if (reasonCode === "became_failed") return "Succeeded -> failed";
  if (reasonCode === "became_insufficient_context") return "Grounded -> insufficient_context";
  if (reasonCode === "quality_degraded") return "Quality degraded";
  if (reasonCode === "fallback_introduced") return "Fallback introduced";
  if (reasonCode === "citations_decreased") return "Citation count decreased";
  return reasonCode;
}
