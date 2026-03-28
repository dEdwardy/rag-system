import type {
  TraceAnswerAttributionSummary,
  TraceCitationAttribution,
  TraceCitationSelectionSource
} from "@rag-system/shared";

export function buildAnswerAttributionSummary(input: {
  attribution: TraceCitationAttribution | null;
  source: TraceCitationSelectionSource | null;
}): TraceAnswerAttributionSummary {
  const { attribution, source } = input;
  const attributionLabel = attribution == null
    ? null
    : attribution === "none"
      ? "no attribution"
      : `${attribution} attribution`;
  const sourceLabel = source == null
    ? null
    : source === "none"
      ? "no source evidence"
      : source === "inline_markers"
        ? "inline-marker source"
        : `${source} source`;
  const readabilityLabel = attributionLabel != null && sourceLabel != null
    ? `${attributionLabel} via ${sourceLabel}`
    : null;
  const readabilityHint = readabilityLabel
    ?? (attributionLabel != null
      ? `${attributionLabel} via unknown source`
      : sourceLabel != null
        ? `unknown attribution via ${sourceLabel}`
        : null);

  return {
    attribution,
    source,
    readability: attribution != null && source != null
      ? `${attribution}:${source}`
      : null,
    attributionLabel,
    sourceLabel,
    readabilityLabel,
    readabilityHint,
    readabilityResolvedLabel: `${attributionLabel ?? "unknown attribution"} via ${sourceLabel ?? "unknown source"}`,
    readabilitySentence: `Answer attribution is ${attribution ?? "unknown"}; source evidence is ${source ?? "unknown"}.`
  };
}
