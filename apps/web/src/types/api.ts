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
  TraceMissingInformationSource,
  TracePrimaryIssue,
  TraceQualityOverall,
  RetrievalStrategySummary,
  TraceResolvedLanguage,
  TraceRetrievalMode,
  TraceRetrievalQuerySource,
  TraceSummary
} from "@rag-system/shared";

export type AuthIdentity = {
  userId: string;
  tenantId: string;
  role: string;
  sessionId: string | null;
  authSource: string;
};

export type AuthMeResponse = {
  identity: AuthIdentity | null;
  currentIdentity: AuthIdentity;
};

export type HealthResponse = {
  status: "ok";
};

export type AuditEventRecord = {
  id: string;
  kind: "trace" | "document_run";
  entityId: string;
  event: string;
  status: string;
  occurredAt: string;
  summary: string | null;
  details: Record<string, unknown>;
};

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
  bySourceFamily: Record<
    string,
    {
      totalRuns: number;
      failedRuns: number;
      retryableFailures: number;
      nonRetryableFailures: number;
      runsWithBoundaryHit: number;
    }
  >;
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

export type KnowledgeBaseDocumentRunComparisonRunSnapshot = {
  runId: string;
  documentId: string;
  version: number;
  trigger: DocumentRunTrigger;
  status: DocumentRunStatus;
  failedStage: DocumentRunFailedStage;
  failureSummary: KnowledgeBaseDocumentRunFailureSummary | null;
  sourceType: string;
  sourceName: string;
  boundarySummary: KnowledgeBaseDocumentRunBoundarySummary | null;
  startedAt: string;
  finishedAt: string | null;
};

export type KnowledgeBaseDocumentRunComparisonRunDifference = {
  metric: string;
  left: string | number | boolean | null;
  right: string | number | boolean | null;
  summary: string;
};

export type KnowledgeBaseDocumentRunComparisonSnapshotDifference = {
  metric: string;
  left: number;
  right: number;
  delta: number;
  trend: "up" | "down";
  summary: string;
};

export type KnowledgeBaseDocumentRunComparison =
  | {
      mode: "run";
      left: KnowledgeBaseDocumentRunComparisonRunSnapshot;
      right: KnowledgeBaseDocumentRunComparisonRunSnapshot;
      meaningfulDifferences: KnowledgeBaseDocumentRunComparisonRunDifference[];
    }
  | {
      mode: "snapshot";
      left: {
        sinceHours: number;
        summary: KnowledgeBaseDocumentRunSummary;
      };
      right: {
        sinceHours: number;
        summary: KnowledgeBaseDocumentRunSummary;
      };
      meaningfulDifferences: KnowledgeBaseDocumentRunComparisonSnapshotDifference[];
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
  grounding: "grounded" | "partially_grounded" | "ungrounded";
  completeness: "complete" | "partial" | "insufficient";
  primaryIssue: TracePrimaryIssue;
  flags: string[];
  summary: string;
};

export type EvalQuestionSetRunItem = {
  index: number;
  question: string;
  status: "succeeded" | "failed";
  traceId: string | null;
  conversationId: string | null;
  answerStatus: string | null;
  qualityOverall: string | null;
  qualityPrimaryIssue: string | null;
  citationCount: number;
  usedFallback: boolean | null;
  error: {
    message: string;
    code: string | null;
  } | null;
};

export type EvalQuestionSetRunSummary = {
  total: number;
  succeeded: number;
  failed: number;
  successRate: number;
  groundedRate: number;
  strongRate: number;
  fallbackRate: number;
  averageCitationCount: number;
};

export type EvalQuestionSetRunComparisonMetric = {
  metric:
    | "succeeded"
    | "failed"
    | "successRate"
    | "groundedRate"
    | "strongRate"
    | "fallbackRate"
    | "averageCitationCount";
  current: number;
  baseline: number;
  delta: number;
};

export type EvalQuestionSetRunQualityGateMode = "warn" | "fail";

export type EvalQuestionSetRunQualityGate = {
  mode: EvalQuestionSetRunQualityGateMode;
  status: "passed" | "warning" | "failed";
  limitVersion: string;
  breachedMetricCount: number;
  breachedMetrics: Array<{
    metric: "successRate" | "groundedRate" | "strongRate" | "fallbackRate" | "averageCitationCount";
    limitType: "min" | "max";
    limit: number;
    current: number;
    delta: number;
  }>;
  message: string;
};

export type EvalQuestionSetFailureDrilldownItem = {
  index: number;
  question: string;
  severity: "critical" | "high" | "medium";
  reasonCodes: Array<
    "became_failed" | "became_insufficient_context" | "quality_degraded" | "fallback_introduced" | "citations_decreased"
  >;
  baseline: {
    status: "succeeded" | "failed";
    answerStatus: string | null;
    qualityOverall: string | null;
    qualityPrimaryIssue: string | null;
    citationCount: number;
    usedFallback: boolean | null;
  };
  current: {
    status: "succeeded" | "failed";
    answerStatus: string | null;
    qualityOverall: string | null;
    qualityPrimaryIssue: string | null;
    citationCount: number;
    usedFallback: boolean | null;
    error: {
      message: string;
      code: string | null;
    } | null;
  };
};

export type EvalQuestionSetRunResult = {
  questionSetId: string;
  baselineSnapshotId: string;
  baselineVersion: number;
  assistantId: string;
  startedAt: string;
  finishedAt: string;
  totals: {
    total: number;
    succeeded: number;
    failed: number;
  };
  items: EvalQuestionSetRunItem[];
  summary?: EvalQuestionSetRunSummary;
  qualityGate?: EvalQuestionSetRunQualityGate;
  baselineComparison?: {
    hasPinnedBaselineEvalResult: boolean;
    baselineCapturedAt: string | null;
    baselineInitialized: boolean;
    comparisonMeaningful: boolean;
    questionSetDrift: {
      hasDrift: boolean;
      currentQuestionCount: number;
      baselineQuestionCount: number;
      addedQuestionCount: number;
      removedQuestionCount: number;
      unchangedQuestionCount: number;
    };
    deltas?: {
      metrics: EvalQuestionSetRunComparisonMetric[];
      meaningfulDeltas: EvalQuestionSetRunComparisonMetric[];
    };
    failureDrilldown?: {
      regressedQuestionCount: number;
      weakestItems: EvalQuestionSetFailureDrilldownItem[];
    };
    diffSummary?: {
      headline: string;
      regressedMetricCount: number;
      improvedMetricCount: number;
      unchangedMetricCount: number;
      regressedQuestionCount: number;
      regressedMetrics: EvalQuestionSetRunComparisonMetric[];
      improvedMetrics: EvalQuestionSetRunComparisonMetric[];
      topRegressionReasons: Array<{
        reasonCode:
          | "became_failed"
          | "became_insufficient_context"
          | "quality_degraded"
          | "fallback_introduced"
          | "citations_decreased";
        count: number;
      }>;
    };
  };
  reportExports?: {
    markdown: {
      format: "markdown";
      fileName: string;
      mimeType: string;
      content: string;
    };
    json: {
      format: "json";
      fileName: string;
      mimeType: string;
      content: string;
    };
    html: {
      format: "html";
      fileName: string;
      mimeType: string;
      content: string;
    };
  };
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
  rewriteReadabilityLabel?: TraceSummary["rewriteReadabilityLabel"];
  retrievalMetadata?: AskRetrievalMetadata;
  answerAttributionSummary?: TraceAnswerAttributionSummary;
  answerAttributionReadabilitySentence?: TraceSummary["answerAttributionReadabilitySentence"];
  answerAttribution?: TraceCitationAttribution | null;
  answerAttributionSource?: TraceCitationSelectionSource | null;
  answerEvidenceSource?: TraceCitationSelectionSource | null;
  answerEvidenceSourceReadabilityLabel?: TraceSummary["answerEvidenceSourceReadabilityLabel"];
  answerEvidenceSourceReadabilitySentence?: TraceSummary["answerEvidenceSourceReadabilitySentence"];
  answerTextSource?: TraceAnswerTextSource | null;
  answerTextSourceReadabilityLabel?: TraceSummary["answerTextSourceReadabilityLabel"];
  answerTextSourceReadabilitySentence?: TraceSummary["answerTextSourceReadabilitySentence"];
  answerStatusSource?: TraceAnswerStatusSource | null;
  answerStatusSourceReadabilityLabel?: TraceSummary["answerStatusSourceReadabilityLabel"];
  answerStatusSourceReadabilitySentence?: TraceSummary["answerStatusSourceReadabilitySentence"];
  answerProvenanceSentence?: TraceSummary["answerProvenanceSentence"];
  answerProvenanceReadabilitySentence?: TraceSummary["answerProvenanceReadabilitySentence"];
  missingInformationSource?: TraceSummary["missingInformationSource"];
  missingInformationProvenanceSentence?: TraceSummary["missingInformationProvenanceSentence"];
  missingInformationSourceReadabilityLabel?: TraceSummary["missingInformationSourceReadabilityLabel"];
  answeringMetadata?: AskAnsweringMetadata;
  answerStatus?: TraceAnswerStatus;
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
  TraceMissingInformationSource,
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
