export type TraceAnswerStatus = "grounded" | "insufficient_context";

export type TraceQualityOverall = "strong" | "partial" | "weak";

export type TracePrimaryIssue =
  | "none"
  | "no_retrieval_hits"
  | "insufficient_context"
  | "missing_information"
  | "low_retrieval_score"
  | "fallback_generation"
  | "other";

export type TraceRetrievalMode = "vector" | "hybrid" | "lexical";

export type TraceRetrievalQuerySource = "rewritten" | "original_disabled" | "original_unchanged";

export type TraceGenerationMode = "generated" | "deterministic_bypass";

export type TraceContextMode = "chunks" | "context_groups";

export type TraceFallbackReason = "vector_error" | "no_ranked_candidates";

export type TraceResolvedLanguage = "zh" | "en";

export type TraceCitationAttribution = "explicit" | "heuristic" | "none";

export type TraceCitationSelectionSource = "structured" | "inline_markers" | "heuristic" | "none";

export type TraceAnswerAttributionReadability = `${TraceCitationAttribution}:${TraceCitationSelectionSource}`;

export type TraceAnswerAttributionSummary = {
  attribution: TraceCitationAttribution | null;
  source: TraceCitationSelectionSource | null;
  readability: TraceAnswerAttributionReadability | null;
  attributionLabel: string | null;
  // Uses the same "<kind> evidence source" wording as answerEvidenceSourceReadabilityLabel.
  sourceLabel: string | null;
  readabilityLabel: string | null;
  readabilityHint: string | null;
  readabilityResolvedLabel: string;
  readabilitySentence: string | null;
};

export type TraceInsufficientContextReason = "no_retrieval_hits" | "retrieved_context_insufficient";

export type TraceAnswerTextSource = "model" | "deterministic_policy";

export type TraceAnswerStatusSource = "model" | "inferred_from_retrieval" | "deterministic_policy";

export type TraceMissingInformationSource = "none" | "model" | "deterministic_default" | "suppressed_by_policy";

export type TraceFailedStage = "retrieval" | "answering";

export type RetrievalStrategySummary = {
  retrievalMode: TraceRetrievalMode | null;
  strategyMode: TraceRetrievalMode | null;
  retrievalQuerySource: TraceRetrievalQuerySource | null;
  rewriteEnabled: boolean;
  rewriteApplied: boolean;
  rewriteUsedFallback: boolean | null;
  rewritePromptId: string | null;
  rewriteModelName: string | null;
  fallbackReason: TraceFallbackReason | null;
  usedFallback: boolean | null;
};

export type TraceSummary = {
  promptId: string | null;
  answerStatus: TraceAnswerStatus | null;
  qualityOverall: TraceQualityOverall | null;
  primaryIssue: TracePrimaryIssue | null;
  retrievalMode: TraceRetrievalMode | null;
  retrievalQuerySource: TraceRetrievalQuerySource | null;
  strategyReadabilityLabel: string;
  rewriteReadabilityLabel: string;
  strategySummary: RetrievalStrategySummary;
  generationMode: TraceGenerationMode | null;
  contextMode: TraceContextMode | null;
  rewriteApplied: boolean;
  fallbackReason: TraceFallbackReason | null;
  resolvedLanguage: TraceResolvedLanguage | null;
  answerAttributionSummary: TraceAnswerAttributionSummary;
  answerAttributionReadabilitySentence: string;
  answerAttribution: TraceCitationAttribution | null;
  answerAttributionSource: TraceCitationSelectionSource | null;
  answerEvidenceSource: TraceCitationSelectionSource | null;
  answerEvidenceSourceReadabilityLabel: string;
  answerEvidenceSourceReadabilitySentence: string;
  citationAttribution: TraceCitationAttribution | null;
  citationSelectionSource: TraceCitationSelectionSource | null;
  missingInformationCount: number;
  missingInformationCountReadabilityLabel: string;
  missingInformationSource: TraceMissingInformationSource | null;
  insufficientContextReason: TraceInsufficientContextReason | null;
  missingInformationProvenanceSentence: string;
  answerTextSource: TraceAnswerTextSource | null;
  answerTextSourceReadabilityLabel: string;
  answerTextSourceReadabilitySentence: string;
  answerStatusSource: TraceAnswerStatusSource | null;
  answerStatusSourceReadabilityLabel: string;
  answerStatusSourceReadabilitySentence: string;
  answerProvenanceSentence: string;
  failedStage: TraceFailedStage | null;
  failedStageReadabilityLabel: string;
  failureMessage: string | null;
  failureReadabilitySentence: string;
  candidateLimit: number;
  vectorCandidateCount: number;
  lexicalCandidateCount: number;
  mergedCandidateCount: number;
  rankedCandidateCount: number;
  candidateCountReadabilityLabel: string;
  vectorCandidateLimitHit: boolean;
  lexicalCandidateLimitHit: boolean;
  rankingTopKHit: boolean;
  primaryChunkCount: number;
  neighborChunkCount: number;
  retrievedChunkCount: number;
  inputChunkCount: number;
  promptContextCount: number;
  contextGroupCount: number;
  citationCount: number;
  citationCountReadabilityLabel: string;
  citationCountBeforeLimit: number;
  citationLimitHit: boolean;
  usedFallback: boolean;
};
