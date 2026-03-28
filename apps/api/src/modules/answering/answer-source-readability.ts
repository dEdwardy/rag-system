import type { TraceSummary } from "@rag-system/shared";

export function buildAnswerTextSourceReadabilityLabel(input: {
  answerTextSource: TraceSummary["answerTextSource"];
  rawAnswerTextSource: string | null;
}): TraceSummary["answerTextSourceReadabilityLabel"] {
  if (input.answerTextSource === "model") {
    return "model-generated answer text";
  }

  if (input.answerTextSource === "deterministic_policy") {
    return "deterministic policy answer text";
  }

  if (input.rawAnswerTextSource != null) {
    return `unknown answer text source (${input.rawAnswerTextSource})`;
  }

  return "unknown answer text source";
}

export function buildAnswerStatusSourceReadabilityLabel(input: {
  answerStatusSource: TraceSummary["answerStatusSource"];
  rawAnswerStatusSource: string | null;
}): TraceSummary["answerStatusSourceReadabilityLabel"] {
  if (input.answerStatusSource === "model") {
    return "model-decided answer status";
  }

  if (input.answerStatusSource === "inferred_from_retrieval") {
    return "retrieval-inferred answer status";
  }

  if (input.answerStatusSource === "deterministic_policy") {
    return "deterministic policy answer status";
  }

  if (input.rawAnswerStatusSource != null) {
    return `unknown answer status source (${input.rawAnswerStatusSource})`;
  }

  return "unknown answer status source";
}

export function buildAnswerTextSourceReadabilitySentence(
  answerTextSourceReadabilityLabel: TraceSummary["answerTextSourceReadabilityLabel"]
): TraceSummary["answerTextSourceReadabilitySentence"] {
  return `Answer text source is ${answerTextSourceReadabilityLabel}.`;
}

export function buildAnswerStatusSourceReadabilitySentence(
  answerStatusSourceReadabilityLabel: TraceSummary["answerStatusSourceReadabilityLabel"]
): TraceSummary["answerStatusSourceReadabilitySentence"] {
  return `Answer status source is ${answerStatusSourceReadabilityLabel}.`;
}

export function buildAnswerSourceReadability(input: {
  answerTextSource: TraceSummary["answerTextSource"];
  rawAnswerTextSource: string | null;
  answerStatusSource: TraceSummary["answerStatusSource"];
  rawAnswerStatusSource: string | null;
}): {
  answerTextSourceReadabilityLabel: TraceSummary["answerTextSourceReadabilityLabel"];
  answerTextSourceReadabilitySentence: TraceSummary["answerTextSourceReadabilitySentence"];
  answerStatusSourceReadabilityLabel: TraceSummary["answerStatusSourceReadabilityLabel"];
  answerStatusSourceReadabilitySentence: TraceSummary["answerStatusSourceReadabilitySentence"];
} {
  const answerTextSourceReadabilityLabel = buildAnswerTextSourceReadabilityLabel({
    answerTextSource: input.answerTextSource,
    rawAnswerTextSource: input.rawAnswerTextSource
  });
  const answerStatusSourceReadabilityLabel = buildAnswerStatusSourceReadabilityLabel({
    answerStatusSource: input.answerStatusSource,
    rawAnswerStatusSource: input.rawAnswerStatusSource
  });

  return {
    answerTextSourceReadabilityLabel,
    answerTextSourceReadabilitySentence: buildAnswerTextSourceReadabilitySentence(answerTextSourceReadabilityLabel),
    answerStatusSourceReadabilityLabel,
    answerStatusSourceReadabilitySentence: buildAnswerStatusSourceReadabilitySentence(answerStatusSourceReadabilityLabel)
  };
}

export function buildAnswerProvenanceSentence(input: {
  answerTextSource: TraceSummary["answerTextSource"];
  answerStatusSource: TraceSummary["answerStatusSource"];
  answerAttributionReadabilityResolvedLabel: TraceSummary["answerAttributionSummary"]["readabilityResolvedLabel"];
}): TraceSummary["answerProvenanceSentence"] {
  const textSourceValue = input.answerTextSource ?? "unknown";
  const statusSourceValue = input.answerStatusSource ?? "unknown";
  return `Answer text source is ${textSourceValue}; status source is ${statusSourceValue}; attribution summary is ${input.answerAttributionReadabilityResolvedLabel}.`;
}

export function buildAnswerProvenanceReadabilitySentence(input: {
  answerTextSourceReadabilityLabel: TraceSummary["answerTextSourceReadabilityLabel"];
  answerStatusSourceReadabilityLabel: TraceSummary["answerStatusSourceReadabilityLabel"];
  answerAttributionReadabilitySentence: TraceSummary["answerAttributionReadabilitySentence"];
}): TraceSummary["answerProvenanceReadabilitySentence"] {
  return `Answer text source is ${input.answerTextSourceReadabilityLabel}; answer status source is ${input.answerStatusSourceReadabilityLabel}; ${input.answerAttributionReadabilitySentence}`;
}
