export type FailureTaxonomyKey = "no_hit" | "fallback" | "slow_path" | "timeout" | "source_failure";

const SLOW_PATH_LATENCY_MS = 10_000;

export function buildFailureTaxonomy(trace: {
  status: "success" | "failed";
  latencyMs: number | null;
  errorMessage: string | null;
  traceSummary?: {
    primaryIssue: string | null;
    insufficientContextReason: string | null;
    usedFallback: boolean;
    strategySummary: {
      usedFallback: boolean | null;
    };
    retrievedChunkCount: number;
    failureMessage: string | null;
    failureReadabilitySentence: string;
  } | null;
}): FailureTaxonomyKey[] {
  const taxonomy: FailureTaxonomyKey[] = [];
  const summary = trace.traceSummary ?? null;
  const diagnosticsText = [trace.errorMessage, summary?.failureMessage, summary?.failureReadabilitySentence]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  const noHitDetected =
    summary?.primaryIssue === "no_retrieval_hits" ||
    summary?.insufficientContextReason === "no_retrieval_hits" ||
    summary?.retrievedChunkCount === 0;
  if (noHitDetected) {
    taxonomy.push("no_hit");
  }

  const fallbackDetected = Boolean(summary?.usedFallback || summary?.strategySummary.usedFallback || summary?.primaryIssue === "fallback_generation");
  if (fallbackDetected) {
    taxonomy.push("fallback");
  }

  const slowPathDetected = (trace.latencyMs ?? 0) >= SLOW_PATH_LATENCY_MS;
  if (slowPathDetected) {
    taxonomy.push("slow_path");
  }

  const timeoutDetected =
    trace.status === "failed" &&
    ["timeout", "timed out", "abort", "aborted", "deadline exceeded"].some(keyword => diagnosticsText.includes(keyword));
  if (timeoutDetected) {
    taxonomy.push("timeout");
  }

  const sourceFailureDetected =
    trace.status === "failed" &&
    ["source", "fetch", "web page", "feed", "sitemap", "content-type", "redirect", "external"].some(keyword =>
      diagnosticsText.includes(keyword)
    );
  if (sourceFailureDetected) {
    taxonomy.push("source_failure");
  }

  return taxonomy;
}

export function getFailureTaxonomyLabel(key: FailureTaxonomyKey, locale: "zh" | "en") {
  if (key === "no_hit") {
    return locale === "zh" ? "无命中检索（no-hit）" : "No-hit retrieval";
  }
  if (key === "fallback") {
    return locale === "zh" ? "回退路径（fallback）" : "Fallback path";
  }
  if (key === "slow_path") {
    return locale === "zh" ? "慢路径（slow-path）" : "Slow path";
  }
  if (key === "timeout") {
    return locale === "zh" ? "超时（timeout）" : "Timeout";
  }

  return locale === "zh" ? "来源失败（source-failure）" : "Source failure";
}

export function getFailureTaxonomyColor(key: FailureTaxonomyKey) {
  if (key === "no_hit") {
    return "gray";
  }
  if (key === "fallback") {
    return "yellow";
  }
  if (key === "slow_path") {
    return "orange";
  }
  if (key === "timeout") {
    return "red";
  }

  return "pink";
}

export function buildRawPayload(trace: {
  retrievedChunkIdsJson: unknown;
  retrievalScoresJson: unknown;
  citationsJson: unknown;
}): Record<string, unknown> {
  return {
    retrievedChunkIdsJson: trace.retrievedChunkIdsJson,
    retrievalScoresJson: trace.retrievalScoresJson,
    citationsJson: trace.citationsJson
  };
}

export function buildDocumentChunkLink(
  documentId: string,
  chunkId: string,
  context?: {
    traceId?: string;
    rank?: number;
    isPrimary?: boolean | null;
    isCited?: boolean;
    score?: number | null;
  }
) {
  const searchParams = new URLSearchParams({
    chunkId
  });

  if (context?.traceId) {
    searchParams.set("fromTrace", context.traceId);
  }
  if (context?.rank != null) {
    searchParams.set("rank", String(context.rank));
  }
  if (context?.isPrimary != null) {
    searchParams.set("isPrimary", context.isPrimary ? "1" : "0");
  }
  if (context?.isCited) {
    searchParams.set("isCited", "1");
  }
  if (context?.score != null) {
    searchParams.set("score", context.score.toFixed(4));
  }

  return `/documents/${documentId}?${searchParams.toString()}`;
}