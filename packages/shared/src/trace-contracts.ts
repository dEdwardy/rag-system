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

export type TraceInsufficientContextReason = "no_retrieval_hits" | "retrieved_context_insufficient";

export type TraceAnswerTextSource = "model" | "deterministic_policy";

export type TraceAnswerStatusSource = "model" | "inferred_from_retrieval" | "deterministic_policy";

export type TraceMissingInformationSource = "none" | "model" | "deterministic_default" | "suppressed_by_policy";

export type TraceFailedStage = "retrieval" | "answering";

export type TraceSummary = {
  answerStatus: TraceAnswerStatus | null;
  qualityOverall: TraceQualityOverall | null;
  primaryIssue: TracePrimaryIssue | null;
  retrievalMode: TraceRetrievalMode | null;
  retrievalQuerySource: TraceRetrievalQuerySource | null;
  generationMode: TraceGenerationMode | null;
  contextMode: TraceContextMode | null;
  rewriteApplied: boolean;
  fallbackReason: TraceFallbackReason | null;
  resolvedLanguage: TraceResolvedLanguage | null;
  citationAttribution: TraceCitationAttribution | null;
  citationSelectionSource: TraceCitationSelectionSource | null;
  missingInformationCount: number;
  missingInformationSource: TraceMissingInformationSource | null;
  insufficientContextReason: TraceInsufficientContextReason | null;
  answerTextSource: TraceAnswerTextSource | null;
  answerStatusSource: TraceAnswerStatusSource | null;
  failedStage: TraceFailedStage | null;
  failureMessage: string | null;
  candidateLimit: number;
  vectorCandidateCount: number;
  lexicalCandidateCount: number;
  mergedCandidateCount: number;
  rankedCandidateCount: number;
  vectorCandidateLimitHit: boolean;
  lexicalCandidateLimitHit: boolean;
  rankingTopKHit: boolean;
  retrievedChunkCount: number;
  promptContextCount: number;
  citationCount: number;
  citationCountBeforeLimit: number;
  citationLimitHit: boolean;
  usedFallback: boolean;
};
