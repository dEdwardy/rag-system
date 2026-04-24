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

export type TraceExecutionToolName =
  | 'knowledge_base_search'
  | 'external_source_fetch'
  | 'policy_reply';

export type TraceExecutionToolCapability =
  | 'knowledge_base'
  | 'external_source'
  | 'policy_reply';

export const TRACE_EXECUTION_TOOL_REGISTRY = {
  knowledge_base: {
    toolName: 'knowledge_base_search',
    label: 'Knowledge base search'
  },
  external_source: {
    toolName: 'external_source_fetch',
    label: 'External source fetch'
  },
  policy_reply: {
    toolName: 'policy_reply',
    label: 'Policy reply'
  }
} satisfies Record<
  TraceExecutionToolCapability,
  {
    toolName: TraceExecutionToolName;
    label: string;
  }
>;

export const TRACE_EXECUTION_TOOL_LABELS = {
  [TRACE_EXECUTION_TOOL_REGISTRY.knowledge_base.toolName]:
    TRACE_EXECUTION_TOOL_REGISTRY.knowledge_base.label,
  [TRACE_EXECUTION_TOOL_REGISTRY.external_source.toolName]:
    TRACE_EXECUTION_TOOL_REGISTRY.external_source.label,
  [TRACE_EXECUTION_TOOL_REGISTRY.policy_reply.toolName]:
    TRACE_EXECUTION_TOOL_REGISTRY.policy_reply.label
} satisfies Record<TraceExecutionToolName, string>;

const TRACE_EXECUTION_TOOL_NAME_VALUES = new Set<TraceExecutionToolName>(
  Object.values(TRACE_EXECUTION_TOOL_REGISTRY).map((entry) => entry.toolName)
);

export function resolveTraceExecutionToolName(
  capability: TraceExecutionToolCapability
): TraceExecutionToolName {
  return TRACE_EXECUTION_TOOL_REGISTRY[capability].toolName;
}

export function readTraceExecutionToolName(
  value: unknown
): TraceExecutionToolName | null {
  return typeof value === 'string' &&
    TRACE_EXECUTION_TOOL_NAME_VALUES.has(value as TraceExecutionToolName)
    ? (value as TraceExecutionToolName)
    : null;
}

export function buildTraceExecutionToolLabel(
  toolName: TraceExecutionToolName | null
) {
  return toolName == null ? null : TRACE_EXECUTION_TOOL_LABELS[toolName];
}

export type TraceExecutionStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export type TraceExecutionStep = {
  key: string;
  id: string;
  kind: TraceExecutionStepKind;
  toolName: TraceExecutionToolName | null;
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
  const buildStep = (input: {
    key: string;
    id: string;
    kind: TraceExecutionStepKind;
    toolName: TraceExecutionToolName | null;
    label: string;
    detail: string | null;
  }): TraceExecutionStep => ({
    key: input.key,
    id: input.id,
    kind: input.kind,
    toolName: input.toolName,
    status: 'completed',
    label: input.label,
    detail: input.detail,
    durationMs: null
  });

  const routeStep = buildStep({
    key: 'route_decision',
    id: 'route_decision',
    kind: 'route_decision',
    toolName: null,
    label: 'Route decision',
    detail: `${input.routeType}:${input.routeReason}`
  });

  if (input.routeType === 'policy_reply') {
    return {
      executionMode: 'manual',
      steps: [
        routeStep,
        buildStep({
          key: 'deterministic_reply',
          id: 'deterministic_reply',
          kind: 'deterministic_reply',
          toolName: resolveTraceExecutionToolName('policy_reply'),
          label: 'Deterministic reply',
          detail: null
        })
      ]
    };
  }

  if (input.routeType === 'external_source') {
    return {
      executionMode:
        input.sourceCount != null && input.sourceCount > 1
          ? 'workflow'
          : 'manual',
      steps: [
        routeStep,
        buildStep({
          key: 'source_fetch',
          id: 'source_fetch',
          kind: 'source_fetch',
          toolName: resolveTraceExecutionToolName('external_source'),
          label: 'Source fetch',
          detail:
            input.sourceCount != null ? `${input.sourceCount} source(s)` : null
        }),
        buildStep({
          key: 'answer_generation',
          id: 'answer_generation',
          kind: 'answer_generation',
          toolName: null,
          label: 'Answer generation',
          detail: null
        })
      ]
    };
  }

  return {
    executionMode: 'manual',
    steps: [
      routeStep,
      buildStep({
        key: 'retrieval',
        id: 'retrieval',
        kind: 'retrieval',
        toolName: resolveTraceExecutionToolName('knowledge_base'),
        label: 'Retrieval',
        detail: null
      }),
      buildStep({
        key: 'answer_generation',
        id: 'answer_generation',
        kind: 'answer_generation',
        toolName: null,
        label: 'Answer generation',
        detail: null
      })
    ]
  };
}

export function collectTraceExecutionToolNames(
  plan: TraceExecutionPlan | null
): TraceExecutionToolName[] {
  if (plan == null) {
    return [];
  }

  return Array.from(
    new Set(
      plan.steps.flatMap((step) =>
        step.toolName == null ? [] : [step.toolName]
      )
    )
  );
}

export function buildTraceExecutionToolNamesLabel(
  toolNames: TraceExecutionToolName[]
) {
  if (toolNames.length === 0) {
    return 'no execution tools';
  }

  return toolNames
    .map((toolName) => TRACE_EXECUTION_TOOL_LABELS[toolName])
    .join(' + ');
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
  executionMode: TraceExecutionPlan['executionMode'] | null;
  executionModeReadabilityLabel: string;
  executionModeReadabilitySentence: string;
  executionToolNames: TraceExecutionToolName[];
  executionToolNamesReadabilityLabel: string;
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
