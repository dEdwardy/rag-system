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

export function buildEvalRunCarryThroughPreview(params: {
  questionSetId: string;
  assistantId: string;
  baselineSnapshotId: string;
}) {
  const normalizedParams = normalizeEvalRunParams(params);
  return {
    normalizedParams,
    searchParams: normalizedParams ? createEvalRunSearchParams(normalizedParams) : null
  };
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
    if (reasonCode === "became_failed") return "回答由可用变为失败";
    if (reasonCode === "became_insufficient_context") return "回答失去 grounded（上下文不足）";
    if (reasonCode === "quality_degraded") return "回答质量等级下降";
    if (reasonCode === "fallback_introduced") return "回答开始依赖 fallback";
    if (reasonCode === "citations_decreased") return "回答引用数量减少";
    return reasonCode;
  }

  if (reasonCode === "became_failed") return "Answer changed from success to failure";
  if (reasonCode === "became_insufficient_context") return "Answer lost grounding (insufficient context)";
  if (reasonCode === "quality_degraded") return "Answer quality rating dropped";
  if (reasonCode === "fallback_introduced") return "Answer now depends on fallback";
  if (reasonCode === "citations_decreased") return "Answer citation count dropped";
  return reasonCode;
}

export function getReportCenterResultNextAction(args: {
  locale: "zh" | "en";
  hasRunDiffSummary: boolean;
  hasWeakestItems: boolean;
  hasRunItems: boolean;
}) {
  if (args.locale === "zh") {
    if (!args.hasRunItems) {
      return "下一步：当前 run 暂无题目结果，先确认输入参数后重跑。";
    }
    if (args.hasRunDiffSummary && args.hasWeakestItems) {
      return "下一步：先看 Run 差异摘要，再按回归弱项顺序复盘题目。";
    }
    if (args.hasRunDiffSummary) {
      return "下一步：先看 Run 差异摘要，再进入题目明细表定位问题。";
    }
    if (args.hasWeakestItems) {
      return "下一步：baseline 差异暂不可读，先按回归弱项顺序复盘，再进入题目明细表。";
    }
    return "下一步：先扫读质量摘要，再进入题目明细表。";
  }

  if (!args.hasRunItems) {
    return "Next action: this run has no items yet; verify inputs and rerun.";
  }
  if (args.hasRunDiffSummary && args.hasWeakestItems) {
    return "Next action: review Run diff summary first, then replay Regression weakest items in order.";
  }
  if (args.hasRunDiffSummary) {
    return "Next action: review Run diff summary first, then inspect the item table.";
  }
  if (args.hasWeakestItems) {
    return "Next action: baseline diff is unavailable; replay Regression weakest items first, then inspect the item table.";
  }
  return "Next action: scan quality summary first, then inspect the item table.";
}
