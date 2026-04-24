export type TraceAnswerStatus = 'grounded' | 'insufficient_context';

export type TraceQualityOverall = 'strong' | 'partial' | 'weak';

export type TracePrimaryIssue =
  | 'none'
  | 'no_retrieval_hits'
  | 'insufficient_context'
  | 'missing_information'
  | 'low_retrieval_score'
  | 'fallback_generation'
  | 'other';

export type TraceRetrievalMode = 'vector' | 'hybrid' | 'lexical';
export type TraceRouteType =
  | 'knowledge_base'
  | 'policy_reply'
  | 'external_source';
export type TraceRouteReason =
  | 'default_kb_ask'
  | 'policy_question'
  | 'explicit_source_url'
  | 'explicit_source_urls';

export type TraceExecutionStepKind =
  | 'route_decision'
  | 'retrieval'
  | 'source_fetch'
  | 'answer_generation'
  | 'deterministic_reply';

export type TraceExecutionStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export type TraceExecutionStep = {
  key: string;
  id: string;
  kind: TraceExecutionStepKind;
  status: TraceExecutionStepStatus;
  label: string;
  detail: string | null;
  durationMs: number | null;
};

export type TraceExecutionPlan = {
  executionMode: 'manual' | 'workflow';
  steps: TraceExecutionStep[];
};

export type TraceRetrievalQuerySource =
  | 'rewritten'
  | 'original_disabled'
  | 'original_unchanged';
export type TraceRewriteSkippedReason =
  | 'disabled_by_default'
  | 'query_too_short'
  | 'not_summary_or_complex_question'
  | 'latency_budget_exceeded';

export type TraceGenerationMode = 'generated' | 'deterministic_bypass';

export type TraceContextMode = 'chunks' | 'context_groups';

export type TraceFallbackReason = 'vector_error' | 'no_ranked_candidates';

export type TraceResolvedLanguage = 'zh' | 'en';

export type TraceCitationAttribution = 'explicit' | 'heuristic' | 'none';

export type TraceCitationSelectionSource =
  | 'structured'
  | 'inline_markers'
  | 'heuristic'
  | 'none';

export type TraceAnswerAttributionReadability =
  `${TraceCitationAttribution}:${TraceCitationSelectionSource}`;

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

export type TraceInsufficientContextReason =
  | 'no_retrieval_hits'
  | 'retrieved_context_insufficient';

export type TraceAnswerTextSource = 'model' | 'deterministic_policy';

export type TraceAnswerStatusSource =
  | 'model'
  | 'inferred_from_retrieval'
  | 'deterministic_policy';

export type TraceMissingInformationSource =
  | 'none'
  | 'model'
  | 'deterministic_default'
  | 'suppressed_by_policy';

export type TraceFailedStage = 'retrieval' | 'answering';

export type RetrievalStrategySummary = {
  retrievalMode: TraceRetrievalMode | null;
  strategyMode: TraceRetrievalMode | null;
  retrievalQuerySource: TraceRetrievalQuerySource | null;
  rewriteEnabled: boolean;
  rewriteApplied: boolean;
  rewriteSkippedReason: TraceRewriteSkippedReason | null;
  rewriteUsedFallback: boolean | null;
  rewritePromptId: string | null;
  rewriteModelName: string | null;
  fallbackReason: TraceFallbackReason | null;
  usedFallback: boolean | null;
};

export type TraceRouteDecisionSummary = {
  routeType: TraceRouteType;
  routeReason: TraceRouteReason;
};

export function buildTraceExecutionPlan(input: {
  routeType: TraceRouteType;
  routeReason: TraceRouteReason;
  sourceCount?: number;
}): TraceExecutionPlan {
  const routeStep: TraceExecutionStep = {
    key: 'route_decision',
    id: 'route_decision',
    kind: 'route_decision',
    status: 'completed',
    label: 'Route decision',
    detail: `${input.routeType}:${input.routeReason}`,
    durationMs: null
  };

  if (input.routeType === 'policy_reply') {
    return {
      executionMode: 'manual',
      steps: [
        routeStep,
        {
          key: 'deterministic_reply',
          id: 'deterministic_reply',
          kind: 'deterministic_reply',
          status: 'completed',
          label: 'Deterministic reply',
          detail: null,
          durationMs: null
        }
      ]
    };
  }

  if (input.routeType === 'external_source') {
    return {
      executionMode: 'manual',
      steps: [
        routeStep,
        {
          key: 'source_fetch',
          id: 'source_fetch',
          kind: 'source_fetch',
          status: 'completed',
          label: 'Source fetch',
          detail:
            input.sourceCount != null ? `${input.sourceCount} source(s)` : null,
          durationMs: null
        },
        {
          key: 'answer_generation',
          id: 'answer_generation',
          kind: 'answer_generation',
          status: 'completed',
          label: 'Answer generation',
          detail: null,
          durationMs: null
        }
      ]
    };
  }

  return {
    executionMode: 'manual',
    steps: [
      routeStep,
      {
        key: 'retrieval',
        id: 'retrieval',
        kind: 'retrieval',
        status: 'completed',
        label: 'Retrieval',
        detail: null,
        durationMs: null
      },
      {
        key: 'answer_generation',
        id: 'answer_generation',
        kind: 'answer_generation',
        status: 'completed',
        label: 'Answer generation',
        detail: null,
        durationMs: null
      }
    ]
  };
}

export type TraceTimingSummary = {
  totalMs: number | null;
  firstTokenMs: number | null;
  preGenerationMs: number | null;
  llmFirstTokenMs: number | null;
  conversationLoadMs: number | null;
  userMessagePersistMs: number | null;
  rewriteMs: number | null;
  retrievalMs: number | null;
  traceCreateMs: number | null;
  answerGenerationMs: number | null;
  assistantMessagePersistMs: number | null;
  traceFinalizeMs: number | null;
  llmQueueWaitMs: number | null;
  retrievalQueueWaitMs: number | null;
};

export type TraceSummary = {
  routeType: TraceRouteType | null;
  routeReason: TraceRouteReason | null;
  executionPlan: TraceExecutionPlan | null;
  promptId: string | null;
  answerStatus: TraceAnswerStatus | null;
  qualityOverall: TraceQualityOverall | null;
  primaryIssue: TracePrimaryIssue | null;
  retrievalMode: TraceRetrievalMode | null;
  retrievalQuerySource: TraceRetrievalQuerySource | null;
  strategyReadabilityLabel: string;
  retrievalModeProvenanceSentence: string;
  rewriteReadabilityLabel: string;
  strategySummary: RetrievalStrategySummary;
  routeDecisionSummary: TraceRouteDecisionSummary | null;
  timingSummary: TraceTimingSummary;
  timingReadabilitySentence: string;
  generationMode: TraceGenerationMode | null;
  contextMode: TraceContextMode | null;
  rewriteApplied: boolean;
  rewriteSkippedReason: TraceRewriteSkippedReason | null;
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
  missingInformationSourceReadabilityLabel: string;
  insufficientContextReason: TraceInsufficientContextReason | null;
  missingInformationProvenanceSentence: string;
  answerTextSource: TraceAnswerTextSource | null;
  answerTextSourceReadabilityLabel: string;
  answerTextSourceReadabilitySentence: string;
  answerStatusSource: TraceAnswerStatusSource | null;
  answerStatusSourceReadabilityLabel: string;
  answerStatusSourceReadabilitySentence: string;
  answerProvenanceReadabilitySentence: string;
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
  candidateCountReadabilitySentence: string;
  vectorCandidateLimitHit: boolean;
  lexicalCandidateLimitHit: boolean;
  rankingTopKHit: boolean;
  primaryChunkCount: number;
  neighborChunkCount: number;
  retrievedChunkCount: number;
  inputChunkCount: number;
  promptContextCount: number;
  promptContextChars: number;
  promptContextApproxTokens: number;
  contextGroupCount: number;
  primaryChunkScoreAvg: number | null;
  primaryChunkScoreMin: number | null;
  contextGroupAvgLength: number | null;
  contextReadabilitySentence: string;
  citationCount: number;
  citationCountReadabilityLabel: string;
  citationCountReadabilitySentence: string;
  citationCountBeforeLimit: number;
  citationLimitHit: boolean;
  usedFallback: boolean;
};
