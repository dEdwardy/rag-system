import type {
  TraceAnswerStatus,
  TraceAnswerStatusSource,
  TraceAnswerAttributionSummary,
  TraceAnswerTextSource,
  TraceCitationAttribution,
  TraceCitationSelectionSource,
  TraceContextMode,
  TraceFailedStage,
  TraceFallbackReason,
  TraceGenerationMode,
  TraceInsufficientContextReason,
  TracePrimaryIssue,
  TraceQualityOverall,
  RetrievalStrategySummary,
  TraceResolvedLanguage,
  TraceRetrievalMode,
  TraceRetrievalQuerySource,
  TraceSummary
} from "@rag-system/shared";

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

export type RetrievalMode = "vector" | "hybrid" | "lexical";

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

export type AnswerPolicy = {
  responseStyle: "concise" | "balanced" | "detailed";
  tone?: "neutral" | "friendly" | "direct";
  outputFormat?: "paragraph" | "bullets" | "markdown";
  language?: "auto" | "same_as_question" | "zh" | "en";
  citationMode: "required" | "optional";
  maxCitations: number;
  noAnswerBehavior: "say_insufficient_context" | "best_effort";
  includeMissingInformation?: boolean;
};

export type RetrievalProfile = {
  id: string;
  name: string;
  topK: number;
  chunkWindow: number;
  enableHybrid: boolean;
  enableRerank: boolean;
  scoreThreshold: number;
  filtersJson: RetrievalProfileFilters | null;
  strategyJson: RetrievalStrategy | null;
  createdAt: string;
  updatedAt: string;
};

export type Assistant = {
  id: string;
  tenantId: string;
  kbId: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  retrievalProfileId: string;
  answerPolicyJson: AnswerPolicy | null;
  status: "active" | "inactive";
  retrievalProfile?: RetrievalProfile;
};

export type KnowledgeBase = {
  id: string;
  tenantId: string;
  ownerId: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

export type DocumentRecord = {
  id: string;
  kbId: string;
  sourceType: string;
  sourceName: string;
  title: string;
  mimeType: string;
  storageKey: string;
  status: "pending" | "processing" | "ready" | "failed";
  processingStage: "uploaded" | "parsing" | "chunking" | "indexing" | "completed" | "failed";
  version: number;
  chunkCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentRunStatus = "pending" | "processing" | "ready" | "failed" | "skipped";

export type DocumentRunTrigger = "upload" | "reindex" | "external_resync";

export type DocumentRunFailedStage =
  | "source_fetch"
  | "parsing"
  | "chunking"
  | "indexing"
  | "stale_guard"
  | null;

export type DocumentRunRecord = {
  id: string;
  documentId: string;
  version: number;
  trigger: DocumentRunTrigger;
  status: DocumentRunStatus;
  failedStage: DocumentRunFailedStage;
  failureSummary?: {
    code: string | null;
    failedStage: DocumentRunFailedStage;
    retryable: boolean;
    message: string | null;
  } | null;
  diagnosticsJson: JsonValue | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeBaseDocumentRunRecord = {
  id: string;
  documentId: string;
  version: number;
  trigger: DocumentRunTrigger;
  status: DocumentRunStatus;
  failedStage: DocumentRunFailedStage;
  failureSummary?: {
    code: string | null;
    failedStage: DocumentRunFailedStage;
    retryable: boolean;
    message: string | null;
  } | null;
  diagnosticsJson?: JsonValue | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  document: {
    id: string;
    kbId: string;
    sourceType: string;
    sourceName: string;
    title: string;
    status: DocumentRecord["status"];
    processingStage: DocumentRecord["processingStage"];
    version: number;
  };
};

export type KnowledgeBaseDocumentRunFailureSummary = {
  code: string | null;
  failedStage: DocumentRunFailedStage;
  retryable: boolean;
  message: string | null;
};

export type KnowledgeBaseDocumentRunSummaryAnchor = {
  documentId: string;
  version: number;
  trigger: DocumentRunTrigger;
  failedStage: DocumentRunFailedStage;
  sourceType: string;
  sourceName: string;
  message: string | null;
  finishedAt: string | null;
  failureSummary: KnowledgeBaseDocumentRunFailureSummary | null;
};

export type KnowledgeBaseDocumentRunBoundarySummary = {
  reasons: string[];
  droppedPageUrlCount: number;
  droppedChildSitemapCount: number;
  droppedFeedEntryCount: number;
};

export type KnowledgeBaseDocumentRunBoundaryStats = {
  runsWithBoundaryHit: number;
  byReason: Record<string, number>;
  droppedPageUrlCount: number;
  droppedChildSitemapCount: number;
  droppedFeedEntryCount: number;
};

export type KnowledgeBaseDocumentRunSummary = {
  totalRuns: number;
  latestRunAt: string | null;
  latestFinishedAt: string | null;
  byStatus: Record<DocumentRunStatus, number>;
  byTrigger: Record<DocumentRunTrigger, number>;
  bySourceType: Record<string, number>;
  retryableFailures: number;
  nonRetryableFailures: number;
  failureByStage: Record<string, number>;
  boundaryStats: KnowledgeBaseDocumentRunBoundaryStats;
  latestRetryableFailure: KnowledgeBaseDocumentRunSummaryAnchor | null;
  latestPartialSourceFailure: KnowledgeBaseDocumentRunSummaryAnchor | null;
  latestBoundaryHit: (KnowledgeBaseDocumentRunSummaryAnchor & {
    boundarySummary: KnowledgeBaseDocumentRunBoundarySummary | null;
  }) | null;
  latestSkipped: KnowledgeBaseDocumentRunSummaryAnchor | null;
  latestFailure: KnowledgeBaseDocumentRunSummaryAnchor | null;
};

export type DocumentChunk = {
  id: string;
  documentId: string;
  kbId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  sectionTitle: string | null;
  pageNo: number | null;
  metadataJson: unknown;
  embeddingRef: string | null;
  createdAt: string;
  updatedAt: string;
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
  answerPolicy: AnswerPolicy;
  resolvedLanguage: "en" | "zh";
  generationMode: "generated" | "deterministic_bypass";
  contextMode: "chunks" | "context_groups";
  inputChunkCount: number;
  promptContextCount: number;
  contextGroupCount: number;
  citationCountBeforeLimit: number;
  citationCount: number;
  citationLimitHit: boolean;
  citationAttribution: "explicit" | "heuristic" | "none";
  citationSelectionSource: "structured" | "inline_markers" | "heuristic" | "none";
  missingInformationCount: number;
  missingInformationSource: "none" | "model" | "deterministic_default" | "suppressed_by_policy";
  answerTextSource: "model" | "deterministic_policy";
  insufficientContextReason: "no_retrieval_hits" | "retrieved_context_insufficient" | null;
  answerStatusSource: "model" | "inferred_from_retrieval" | "deterministic_policy";
  answerStatus: "grounded" | "insufficient_context";
};

export type AskQualityEvaluation = {
  overall: "strong" | "partial" | "weak";
  grounding: "grounded" | "partially_grounded" | "ungrounded";
  completeness: "complete" | "partial" | "insufficient";
  primaryIssue:
    | "none"
    | "no_retrieval_hits"
    | "insufficient_context"
    | "missing_information"
    | "low_retrieval_score"
    | "fallback_generation"
    | "other";
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
  strategyReadabilityLabel?: TraceSummary["strategyReadabilityLabel"];
  retrievalModeProvenanceSentence?: TraceSummary["retrievalModeProvenanceSentence"];
  retrievalMetadata?: AskRetrievalMetadata;
  answerAttributionSummary?: TraceAnswerAttributionSummary;
  answerAttributionReadabilitySentence?: TraceSummary["answerAttributionReadabilitySentence"];
  answerAttribution?: TraceCitationAttribution | null;
  answerAttributionSource?: TraceCitationSelectionSource | null;
  answerEvidenceSource?: TraceCitationSelectionSource | null;
  answerEvidenceSourceReadabilityLabel?: string;
  missingInformationSource?: TraceSummary["missingInformationSource"];
  missingInformationSourceReadabilityLabel?: TraceSummary["missingInformationSourceReadabilityLabel"];
  answeringMetadata?: AskAnsweringMetadata;
  answerStatus?: "grounded" | "insufficient_context";
  missingInformation?: string[];
  qualityEvaluation?: AskQualityEvaluation;
};

export type AskStreamFinalData = Pick<
  AskResponse,
  "conversationId" | "assistantMessageId" | "traceId" | "answer" | "citations" | "modelName"
> &
  Partial<AskResponse>;

export type AskStreamEvent =
  | {
      type: "status";
      phase: "started" | "retrieving" | "generating";
    }
  | {
      type: "answer_delta";
      delta: string;
    }
  | {
      type: "final";
      data: AskStreamFinalData;
    }
  | {
      type: "error";
      message: string;
      code?: string;
      traceId?: string | null;
      details?: JsonValue | null;
    };

export type Conversation = {
  id: string;
  tenantId: string;
  userId: string;
  assistantId: string;
  title: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  traceId: string | null;
  createdAt: string;
};

export type TraceRecord = {
  id: string;
  conversationId: string;
  assistantId: string;
  userMessageId: string | null;
  assistantMessageId: string | null;
  userQuery: string;
  rewrittenQuery: string | null;
  retrievedChunkIdsJson: string[] | null;
  retrievalScoresJson: Array<{
    chunkId: string;
    documentId?: string;
    documentTitle?: string;
    chunkIndex?: number;
    contentPreview?: string;
    isPrimary?: boolean;
    pageNo?: number | null;
    sectionTitle?: string | null;
    score: number;
    vectorScore?: number | null;
    lexicalScore?: number | null;
    hybridScore?: number | null;
    rerankScore?: number | null;
  }> | null;
  citationsJson: Citation[] | null;
  modelName: string | null;
  latencyMs: number | null;
  traceSummary: TraceSummary;
  status: "success" | "failed";
  errorMessage: string | null;
  createdAt: string;
};

export type {
  RetrievalStrategySummary,
  TraceAnswerStatus,
  TraceAnswerStatusSource,
  TraceAnswerAttributionSummary,
  TraceAnswerTextSource,
  TraceCitationAttribution,
  TraceCitationSelectionSource,
  TraceContextMode,
  TraceFailedStage,
  TraceFallbackReason,
  TraceGenerationMode,
  TraceInsufficientContextReason,
  TracePrimaryIssue,
  TraceQualityOverall,
  TraceResolvedLanguage,
  TraceRetrievalMode,
  TraceRetrievalQuerySource,
  TraceSummary
};

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
