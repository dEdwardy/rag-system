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
