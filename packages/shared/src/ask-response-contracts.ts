import type { AgentStep } from './ask-contracts.js';
import type {
  RetrievalStrategySummary,
  TraceAnswerAttributionSummary,
  TraceAnswerStatus,
  TraceAnswerStatusSource,
  TraceAnswerTextSource,
  TraceCitationAttribution,
  TraceCitationSelectionSource,
  TraceContextMode,
  TraceFallbackReason,
  TraceGenerationMode,
  TraceInsufficientContextReason,
  TraceMissingInformationSource,
  TracePrimaryIssue,
  TraceQualityOverall,
  TraceResolvedLanguage,
  TraceRetrievalMode,
  TraceRetrievalQuerySource,
  TraceSummary
} from './trace-contracts.js';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type StringIncludeExcludeFilter = {
  include?: string[];
  exclude?: string[];
};

export type StringStrategyFilter = StringIncludeExcludeFilter & {
  contains?: string[];
};

export type NumberIncludeExcludeFilter = {
  include?: number[];
  exclude?: number[];
};

export type NumberStrategyFilter = NumberIncludeExcludeFilter & {
  min?: number;
  max?: number;
};

export type RetrievalProfileFilters = {
  documentIds?: StringIncludeExcludeFilter;
  sectionTitles?: StringStrategyFilter;
  pageNumbers?: NumberStrategyFilter;
};

export type AnswerPolicy = {
  responseStyle: 'concise' | 'balanced' | 'detailed';
  tone?: 'neutral' | 'friendly' | 'direct';
  outputFormat?: 'paragraph' | 'bullets' | 'markdown';
  language?: 'auto' | 'same_as_question' | 'zh' | 'en';
  citationMode: 'required' | 'optional';
  maxCitations: number;
  noAnswerBehavior: 'say_insufficient_context' | 'best_effort';
  includeMissingInformation?: boolean;
};

export type RetrievalMode = 'vector' | 'hybrid' | 'lexical';

export type RetrievalStrategy = {
  queryRewrite?: {
    enabled?: boolean;
  };
  candidateSelection?: {
    mode?: RetrievalMode;
    candidateMultiplier?: number;
    minCandidates?: number;
  };
  hybrid?: {
    vectorWeight?: number;
    lexicalWeight?: number;
  };
  rerank?: {
    enabled?: boolean;
  };
};

export type Citation = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  pageNo: number | null;
  sectionTitle: string | null;
  snippet: string;
};

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex?: number;
  content: string;
  score: number;
  isPrimary?: boolean;
  pageNo: number | null;
  sectionTitle: string | null;
};

export type ContextGroup = {
  documentId: string;
  documentTitle: string;
  startChunkIndex: number;
  endChunkIndex: number;
  chunkIds: string[];
  primaryChunkIds: string[];
  mergedContent: string;
  pageNumbers: number[];
  sectionTitles: string[];
};

export type AskRetrievalMetadata = {
  strategy: RetrievalStrategy;
  filters: RetrievalProfileFilters | null;
  strategySummary?: RetrievalStrategySummary;
  externalSource?: {
    url: string;
    kind: string;
    kindLabel?: string;
    title: string | null;
    diagnostics: JsonValue | null;
  } | null;
  externalSources?: Array<{
    url: string;
    kind: string;
    kindLabel?: string;
    title: string | null;
    diagnostics: JsonValue | null;
  }>;
  queryRewrite: {
    enabled: boolean;
    applied: boolean;
    finalQuerySource: TraceRetrievalQuerySource;
    usedFallback: boolean | null;
    modelName: string | null;
    promptId: string | null;
  };
  execution: {
    retrievalQuery: string;
    topK: number;
    scoreThreshold: number;
    chunkWindow: number;
    actualMode: TraceRetrievalMode;
    usedFallback: boolean;
    fallbackReason: TraceFallbackReason | null;
    rerankApplied: boolean;
    chunkWindowApplied: boolean;
    vectorSearchAttempted: boolean;
    lexicalSearchAttempted: boolean;
    vectorCandidateLimitHit: boolean;
    lexicalCandidateLimitHit: boolean;
    rankingTopKHit: boolean;
    candidateLimit: number;
    vectorCandidateCount: number;
    lexicalCandidateCount: number;
    mergedCandidateCount: number;
    rankedCandidateCount: number;
    retrievedChunkCount: number;
    contextGroupCount: number;
    primaryChunkCount: number;
    neighborChunkCount: number;
  };
};

export type AskAnsweringMetadata = {
  promptId: string;
  usedFallback: boolean;
  promptSnapshot?: {
    systemPrompt: string;
    userPrompt: string;
  };
  answerPolicy: AnswerPolicy;
  resolvedLanguage: TraceResolvedLanguage;
  generationMode: TraceGenerationMode;
  contextMode: TraceContextMode;
  inputChunkCount: number;
  promptContextCount: number;
  contextGroupCount: number;
  citationCountBeforeLimit: number;
  citationCount: number;
  citationLimitHit: boolean;
  citationAttribution: TraceCitationAttribution;
  citationSelectionSource: TraceCitationSelectionSource;
  missingInformationCount: number;
  missingInformationSource: TraceMissingInformationSource;
  answerTextSource: TraceAnswerTextSource;
  insufficientContextReason: TraceInsufficientContextReason | null;
  answerStatusSource: TraceAnswerStatusSource;
  answerStatus: TraceAnswerStatus;
};

export type AskQualityEvaluation = {
  overall: TraceQualityOverall;
  grounding: 'grounded' | 'partially_grounded' | 'ungrounded';
  completeness: 'complete' | 'partial' | 'insufficient';
  primaryIssue: TracePrimaryIssue;
  flags: string[];
  summary: string;
};

export type AskResponse = {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  traceId: string;
  modelName: string;
  answer: string;
  citations: Citation[];
  retrievedChunks: RetrievedChunk[];
  contextGroups?: ContextGroup[];
  strategySummary?: RetrievalStrategySummary;
  strategyReadabilityLabel?: TraceSummary['strategyReadabilityLabel'];
  retrievalModeProvenanceSentence?: TraceSummary['retrievalModeProvenanceSentence'];
  rewriteReadabilityLabel?: TraceSummary['rewriteReadabilityLabel'];
  retrievalMetadata?: AskRetrievalMetadata;
  timingSummary?: TraceSummary['timingSummary'];
  timingReadabilitySentence?: TraceSummary['timingReadabilitySentence'];
  answerAttributionSummary?: TraceAnswerAttributionSummary;
  answerAttributionReadabilitySentence?: TraceSummary['answerAttributionReadabilitySentence'];
  answerAttribution?: TraceCitationAttribution | null;
  answerAttributionSource?: TraceCitationSelectionSource | null;
  answerEvidenceSource?: TraceCitationSelectionSource | null;
  answerEvidenceSourceReadabilityLabel?: TraceSummary['answerEvidenceSourceReadabilityLabel'];
  answerEvidenceSourceReadabilitySentence?: TraceSummary['answerEvidenceSourceReadabilitySentence'];
  answerTextSource?: TraceAnswerTextSource | null;
  answerTextSourceReadabilityLabel?: TraceSummary['answerTextSourceReadabilityLabel'];
  answerTextSourceReadabilitySentence?: TraceSummary['answerTextSourceReadabilitySentence'];
  answerStatusSource?: TraceAnswerStatusSource | null;
  answerStatusSourceReadabilityLabel?: TraceSummary['answerStatusSourceReadabilityLabel'];
  answerStatusSourceReadabilitySentence?: TraceSummary['answerStatusSourceReadabilitySentence'];
  failureReadabilitySentence?: TraceSummary['failureReadabilitySentence'];
  answerProvenanceSentence?: TraceSummary['answerProvenanceSentence'];
  answerProvenanceReadabilitySentence?: TraceSummary['answerProvenanceReadabilitySentence'];
  missingInformationSource?: TraceSummary['missingInformationSource'];
  missingInformationProvenanceSentence?: TraceSummary['missingInformationProvenanceSentence'];
  missingInformationSourceReadabilityLabel?: TraceSummary['missingInformationSourceReadabilityLabel'];
  answeringMetadata?: AskAnsweringMetadata;
  answerStatus?: TraceAnswerStatus;
  missingInformation?: string[];
  qualityEvaluation?: AskQualityEvaluation;
};

export type AgentExecution = {
  routeDecision: JsonValue | null;
  steps: AgentStep[];
};

export type AskStreamFinalData = Pick<
  AskResponse,
  | 'conversationId'
  | 'assistantMessageId'
  | 'traceId'
  | 'answer'
  | 'citations'
  | 'modelName'
> &
  Partial<AskResponse> & {
    agent?: AgentExecution;
  };

export type AskStreamEvent =
  | {
      type: 'status';
      phase: 'started' | 'retrieving' | 'generating';
    }
  | {
      type: 'step';
      step: AgentStep;
    }
  | {
      type: 'answer_delta';
      delta: string;
    }
  | {
      type: 'final';
      data: AskStreamFinalData & { agent?: AgentExecution };
    }
  | {
      type: 'error';
      message: string;
      code?: string;
      traceId?: string | null;
      details?: JsonValue | null;
      retryable?: boolean;
    };
