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
