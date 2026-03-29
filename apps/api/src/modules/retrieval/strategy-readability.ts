import type { TraceSummary } from "@rag-system/shared";

export function buildStrategyReadabilityLabel(input: {
  retrievalMode: TraceSummary["retrievalMode"];
  retrievalQuerySource: TraceSummary["retrievalQuerySource"];
  fallbackReason: TraceSummary["fallbackReason"];
  strategyUsedFallback: TraceSummary["strategySummary"]["usedFallback"];
}): TraceSummary["strategyReadabilityLabel"] {
  const retrievalModeLabel = input.retrievalMode ?? "unknown mode";
  const querySourceLabel = input.retrievalQuerySource ?? "unknown query source";
  const fallbackLabel = input.fallbackReason
    ?? (input.strategyUsedFallback === true ? "unspecified" : "none");
  const fallbackUsageLabel = input.strategyUsedFallback == null
    ? "unknown"
    : input.strategyUsedFallback
      ? "yes"
      : "no";

  return `${retrievalModeLabel} retrieval via ${querySourceLabel}; fallback: ${fallbackLabel}; fallback used: ${fallbackUsageLabel}.`;
}

export function buildRetrievalModeProvenanceSentence(input: {
  retrievalMode: TraceSummary["retrievalMode"];
  strategyUsedFallback: TraceSummary["strategySummary"]["usedFallback"];
  fallbackReason: TraceSummary["fallbackReason"];
}): TraceSummary["retrievalModeProvenanceSentence"] {
  const retrievalModeLabel = input.retrievalMode ?? "unknown";

  if (input.strategyUsedFallback === true) {
    if (input.fallbackReason == null) {
      return `Resolved retrieval mode is ${retrievalModeLabel}; fallback was used (reason unspecified).`;
    }

    return `Resolved retrieval mode is ${retrievalModeLabel}; fallback was used due to ${input.fallbackReason}.`;
  }

  if (input.strategyUsedFallback === false) {
    return `Resolved retrieval mode is ${retrievalModeLabel}; fallback was not used.`;
  }

  return `Resolved retrieval mode is ${retrievalModeLabel}; fallback usage is unknown.`;
}

export function buildRewriteReadabilityLabel(input: {
  rewriteEnabled: TraceSummary["strategySummary"]["rewriteEnabled"];
  rewriteApplied: TraceSummary["strategySummary"]["rewriteApplied"];
  rewriteUsedFallback: TraceSummary["strategySummary"]["rewriteUsedFallback"];
  rewritePromptId: TraceSummary["strategySummary"]["rewritePromptId"];
}): TraceSummary["rewriteReadabilityLabel"] {
  const rewriteEnabledLabel = input.rewriteEnabled ? "enabled" : "disabled";
  const rewriteAppliedLabel = input.rewriteApplied ? "yes" : "no";
  const rewriteFallbackLabel = input.rewriteUsedFallback == null
    ? "unknown"
    : input.rewriteUsedFallback
      ? "yes"
      : "no";
  const rewritePromptLabel = input.rewritePromptId ?? "unknown";
  return `rewrite ${rewriteEnabledLabel}; rewrite applied: ${rewriteAppliedLabel}; rewrite fallback: ${rewriteFallbackLabel}; rewrite prompt: ${rewritePromptLabel}.`;
}
