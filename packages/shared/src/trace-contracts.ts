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

export const TRACE_ROUTE_TYPE_LABELS = {
  knowledge_base: 'Knowledge base',
  policy_reply: 'Policy reply',
  external_source: 'External source'
} satisfies Record<TraceRouteType, string>;

export const TRACE_ROUTE_REASON_LABELS = {
  default_kb_ask: 'Default KB ask',
  policy_question: 'Policy question',
  explicit_source_url: 'Explicit source URL',
  explicit_source_urls: 'Explicit source URLs'
} satisfies Record<TraceRouteReason, string>;

export function buildTraceRouteTypeReadabilityLabel(
  routeType: TraceRouteType | null
) {
  return routeType == null
    ? 'no route type'
    : TRACE_ROUTE_TYPE_LABELS[routeType];
}

export function buildTraceRouteReasonReadabilityLabel(
  routeReason: TraceRouteReason | null
) {
  return routeReason == null
    ? 'no route reason'
    : TRACE_ROUTE_REASON_LABELS[routeReason];
}

export function buildTraceRouteDecisionReadabilityLabel(
  routeType: TraceRouteType | null,
  routeReason: TraceRouteReason | null
) {
  if (routeType == null && routeReason == null) {
    return 'no route decision';
  }

  const routeTypeLabel = buildTraceRouteTypeReadabilityLabel(routeType);
  const routeReasonLabel = buildTraceRouteReasonReadabilityLabel(routeReason);
  return `${routeTypeLabel} - ${routeReasonLabel}`;
}

export function buildTraceRouteDecisionReadabilitySentence(
  routeType: TraceRouteType | null,
  routeReason: TraceRouteReason | null
) {
  return routeType == null && routeReason == null
    ? 'Route decision is unavailable.'
    : `Route decision is ${buildTraceRouteDecisionReadabilityLabel(routeType, routeReason)}.`;
}

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

export const TRACE_EXECUTION_TOOL_NAMES = [
  'knowledge_base_search',
  'external_source_fetch',
  'policy_reply'
] as const satisfies TraceExecutionToolName[];

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
  TRACE_EXECUTION_TOOL_NAMES
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

export type TraceExecutionMode = 'manual' | 'workflow';

export const TRACE_EXECUTION_MODES = [
  'manual',
  'workflow'
] as const satisfies TraceExecutionMode[];

export const TRACE_EXECUTION_MODE_LABELS = {
  manual: 'manual',
  workflow: 'workflow'
} satisfies Record<TraceExecutionMode, string>;

const TRACE_EXECUTION_MODE_VALUES = new Set<TraceExecutionMode>(
  TRACE_EXECUTION_MODES
);

export function readTraceExecutionMode(
  value: unknown
): TraceExecutionMode | null {
  return typeof value === 'string' &&
    TRACE_EXECUTION_MODE_VALUES.has(value as TraceExecutionMode)
    ? (value as TraceExecutionMode)
    : null;
}

export function buildTraceExecutionModeReadabilityLabel(
  executionMode: TraceExecutionMode | null
) {
  return executionMode == null
    ? 'no execution mode'
    : TRACE_EXECUTION_MODE_LABELS[executionMode];
}

export function buildTraceExecutionModeReadabilitySentence(
  executionMode: TraceExecutionMode | null
) {
  return executionMode == null
    ? 'Execution mode is unavailable.'
    : `Execution mode is ${buildTraceExecutionModeReadabilityLabel(executionMode)}.`;
}

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

export type TraceKnowledgeBaseMultiStepSummary = {
  retrievalPasses: 1 | 2;
  selectedPass: 'primary' | 'secondary';
  selectionReason:
    | 'primary_stronger'
    | 'secondary_stronger'
    | 'tie_keep_primary';
};

export type TraceExecutionPlan = {
  executionMode: TraceExecutionMode;
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

export type TraceMetadataCanonicalSurface = {
  routeType: TraceRouteType;
  routeReason: TraceRouteReason;
  routeDecision: TraceRouteDecisionSummary;
  executionPlan: TraceExecutionPlan;
  executionMode: TraceExecutionMode;
  executionToolNames: TraceExecutionToolName[];
};

export function buildTraceExecutionPlan(input: {
  routeType: TraceRouteType;
  routeReason: TraceRouteReason;
  sourceCount?: number;
  knowledgeBaseMultiStep?: TraceKnowledgeBaseMultiStepSummary;
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
    executionMode:
      input.knowledgeBaseMultiStep?.retrievalPasses === 2
        ? 'workflow'
        : 'manual',
    steps:
      input.knowledgeBaseMultiStep?.retrievalPasses === 2
        ? [
            routeStep,
            buildStep({
              key: 'retrieval_primary',
              id: 'retrieval_primary',
              kind: 'retrieval',
              toolName: resolveTraceExecutionToolName('knowledge_base'),
              label: 'Retrieval (rewritten query)',
              detail: 'primary pass'
            }),
            buildStep({
              key: 'retrieval_secondary',
              id: 'retrieval_secondary',
              kind: 'retrieval',
              toolName: resolveTraceExecutionToolName('knowledge_base'),
              label: 'Retrieval (original query)',
              detail: `${input.knowledgeBaseMultiStep.selectedPass} selected (${input.knowledgeBaseMultiStep.selectionReason})`
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
        : [
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

  const toolNames = new Set<TraceExecutionToolName>();
  for (const step of plan.steps) {
    const toolName = readTraceExecutionToolName(step.toolName);
    if (toolName != null) {
      toolNames.add(toolName);
    }
  }

  return TRACE_EXECUTION_TOOL_NAMES.filter((toolName) =>
    toolNames.has(toolName)
  );
}

export function buildTraceMetadataCanonicalSurface(input: {
  routeDecision: TraceRouteDecisionSummary;
  executionPlan: TraceExecutionPlan;
}): TraceMetadataCanonicalSurface {
  return {
    routeType: input.routeDecision.routeType,
    routeReason: input.routeDecision.routeReason,
    routeDecision: input.routeDecision,
    executionPlan: input.executionPlan,
    executionMode: input.executionPlan.executionMode,
    executionToolNames: collectTraceExecutionToolNames(input.executionPlan)
  };
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

export function buildTraceExecutionToolNamesReadabilitySentence(
  toolNames: TraceExecutionToolName[]
) {
  return toolNames.length === 0
    ? 'Execution tool names are unavailable.'
    : `Execution tool names are ${buildTraceExecutionToolNamesLabel(toolNames)}.`;
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
  routeTypeReadabilityLabel: string;
  routeReasonReadabilityLabel: string;
  routeDecisionReadabilityLabel: string;
  routeDecisionReadabilitySentence: string;
  executionPlan: TraceExecutionPlan | null;
  executionMode: TraceExecutionMode | null;
  executionModeReadabilityLabel: string;
  executionModeReadabilitySentence: string;
  executionToolNames: TraceExecutionToolName[];
  executionToolNamesReadabilityLabel: string;
  executionToolNamesReadabilitySentence: string;
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
