import type {
  AgentStep,
  AskAnsweringMetadata,
  AskRetrievalMetadata,
  AnswerPolicy,
  Citation,
  JsonValue,
  RetrievalProfileFilters,
  RetrievalStrategy,
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
} from '@rag-system/shared';

export type {
  AgentExecution,
  AgentStep,
  AskAnsweringMetadata,
  AskQualityEvaluation,
  AskResponse,
  AskRetrievalMetadata,
  AskStreamEvent,
  AskStreamFinalData,
  AnswerPolicy,
  Citation,
  ContextGroup,
  JsonValue,
  MessageFeedbackInput,
  NumberIncludeExcludeFilter,
  NumberStrategyFilter,
  RetrievalMode,
  RetrievalProfileFilters,
  RetrievalStrategy,
  RetrievedChunk,
  StringIncludeExcludeFilter,
  StringStrategyFilter
} from '@rag-system/shared';

export type AuthIdentity = {
  userId: string;
  tenantId: string;
  role: string;
  sessionId: string | null;
  authSource: string;
};

export type AuthUser = {
  id: string;
  tenantId: string;
  role: string;
  name: string;
  displayName: string | null;
  email: string | null;
};

export type AuthMeResponse = {
  identity: AuthIdentity | null;
  currentIdentity: AuthIdentity;
  user?: AuthUser | null;
  loginProvenance: {
    type: 'local_session' | 'oauth_session';
    oauthProvider: 'github' | 'google' | 'oidc' | null;
  };
};

export type AuthLoginResponse = {
  identity: AuthIdentity;
  user: AuthUser;
  expiresAt: string;
  accessTokenExpiresAt: string;
};

export type AuthRefreshResponse = {
  ok: true;
  identity: AuthIdentity;
  user: AuthUser;
  expiresAt: string;
};

export type AuthProvidersResponse = {
  local: {
    enabled: true;
    defaultCredentials: {
      email: string;
      password: string;
    } | null;
  };
  oauth: {
    github: {
      configured: boolean;
      requiredEnv: string[];
    };
    google: {
      configured: boolean;
      requiredEnv: string[];
    };
    oidc: {
      configured: boolean;
      requiredEnv: string[];
    };
  };
};

export type HealthResponse = {
  status: 'ok';
};

export type AuditEventRecord = {
  id: string;
  kind: 'trace' | 'document_run';
  entityId: string;
  event: string;
  status: string;
  occurredAt: string;
  summary: string | null;
  details: Record<string, unknown>;
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
  status: 'active' | 'inactive';
  retrievalProfile?: RetrievalProfile;
};

export type KnowledgeBase = {
  id: string;
  tenantId: string;
  ownerId: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
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
  status: 'pending' | 'processing' | 'ready' | 'failed';
  processingStage:
    | 'uploaded'
    | 'parsing'
    | 'chunking'
    | 'indexing'
    | 'completed'
    | 'failed';
  version: number;
  chunkCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PagedDocumentRecords = {
  items: DocumentRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type KnowledgeBaseDocumentSummary = {
  totalDocuments: number;
  readyDocuments: number;
  processingDocuments: number;
  failedDocuments: number;
  totalChunks: number;
};

export type PagedConversations = {
  items: Conversation[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type DocumentRunStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'skipped';

export type DocumentRunTrigger = 'upload' | 'reindex' | 'external_resync';

export type DocumentRunFailedStage =
  | 'source_fetch'
  | 'parsing'
  | 'chunking'
  | 'indexing'
  | 'stale_guard'
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
    status: DocumentRecord['status'];
    processingStage: DocumentRecord['processingStage'];
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
  latestBoundaryHit:
    | (KnowledgeBaseDocumentRunSummaryAnchor & {
        boundarySummary: KnowledgeBaseDocumentRunBoundarySummary | null;
      })
    | null;
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
  trend: 'up' | 'down';
  summary: string;
};

export type KnowledgeBaseDocumentRunComparisonSourceFamilyDelta = {
  sourceFamily: string;
  left: {
    totalRuns: number;
    failedRuns: number;
    retryableFailures: number;
    nonRetryableFailures: number;
    runsWithBoundaryHit: number;
  };
  right: {
    totalRuns: number;
    failedRuns: number;
    retryableFailures: number;
    nonRetryableFailures: number;
    runsWithBoundaryHit: number;
  };
  deltas: {
    totalRuns: number;
    failedRuns: number;
    retryableFailures: number;
    nonRetryableFailures: number;
    runsWithBoundaryHit: number;
  };
};

export type KnowledgeBaseDocumentRunIssueHotspot = {
  sourceFamily: string;
  totalRuns: number;
  issueSignalScore: number;
  issueConcentration: number;
};

export type KnowledgeBaseDocumentRunIssueHotspotShift = {
  sourceFamily: string;
  leftIssueSignalScore: number;
  rightIssueSignalScore: number;
  issueSignalDelta: number;
  leftIssueConcentration: number;
  rightIssueConcentration: number;
  issueConcentrationDelta: number;
};

export type KnowledgeBaseDocumentRunIssueHotspotSlice = {
  leftHotspot: KnowledgeBaseDocumentRunIssueHotspot | null;
  rightHotspot: KnowledgeBaseDocumentRunIssueHotspot | null;
  dominantShift: KnowledgeBaseDocumentRunIssueHotspotShift | null;
};

export type KnowledgeBaseDocumentRunComparison =
  | {
      mode: 'run';
      left: KnowledgeBaseDocumentRunComparisonRunSnapshot;
      right: KnowledgeBaseDocumentRunComparisonRunSnapshot;
      meaningfulDifferences: KnowledgeBaseDocumentRunComparisonRunDifference[];
    }
  | {
      mode: 'snapshot';
      left: {
        sinceHours: number;
        summary: KnowledgeBaseDocumentRunSummary;
      };
      right: {
        sinceHours: number;
        summary: KnowledgeBaseDocumentRunSummary;
      };
      meaningfulDifferences: KnowledgeBaseDocumentRunComparisonSnapshotDifference[];
      sourceFamilyDeltas?: KnowledgeBaseDocumentRunComparisonSourceFamilyDelta[];
      issueHotspotSlice?: KnowledgeBaseDocumentRunIssueHotspotSlice;
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

export type EvalQuestionSetRunItem = {
  index: number;
  question: string;
  status: 'succeeded' | 'failed';
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
  /** Omitted by summaries stored before retrieval scoring existed. */
  retrievalEvaluatedQuestionCount?: number;
  /** Null when the question set declares no expected evidence. */
  retrievalRecallAtK?: number | null;
  retrievalMrr?: number | null;
};

export type EvalQuestionSetRunComparisonMetric = {
  metric:
    | 'succeeded'
    | 'failed'
    | 'successRate'
    | 'groundedRate'
    | 'strongRate'
    | 'fallbackRate'
    | 'averageCitationCount'
    | 'retrievalRecallAtK'
    | 'retrievalMrr';
  current: number;
  baseline: number;
  delta: number;
};

export type EvalQuestionSetRunQualityGateMode = 'warn' | 'fail';

export type EvalQuestionSetListItem = {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'locked' | 'archived';
  currentVersion: number;
  questionCount: number;
  baselineSnapshotId: string | null;
  baselineChosenAt: string | null;
  baselineVersion: number | null;
  baselineSnapshotCreatedAt: string | null;
  latestEvalRanAt: string | null;
  snapshotCount: number;
  createdAt: string;
  updatedAt: string;
};

export type EvalQuestionSetRecord = {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'locked' | 'archived';
  currentVersion: number;
  baselineSnapshotId: string | null;
  baselineChosenAt: string | null;
  latestEvalRanAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EvalQuestionSetBaselineSnapshotRecord = {
  id: string;
  questionSetId: string;
  version: number;
  name: string;
  description: string | null;
  questionCount: number;
  createdAt: string;
};

export type EvalQuestionSetRunQualityGate = {
  mode: EvalQuestionSetRunQualityGateMode;
  status: 'passed' | 'warning' | 'failed';
  limitVersion: string;
  breachedMetricCount: number;
  breachedMetrics: Array<{
    metric:
      | 'successRate'
      | 'groundedRate'
      | 'strongRate'
      | 'fallbackRate'
      | 'averageCitationCount';
    limitType: 'min' | 'max';
    limit: number;
    current: number;
    delta: number;
  }>;
  message: string;
};

export type EvalQuestionSetFailureDrilldownItem = {
  index: number;
  question: string;
  severity: 'critical' | 'high' | 'medium';
  reasonCodes: Array<
    | 'became_failed'
    | 'became_insufficient_context'
    | 'quality_degraded'
    | 'fallback_introduced'
    | 'citations_decreased'
  >;
  baseline: {
    status: 'succeeded' | 'failed';
    answerStatus: string | null;
    qualityOverall: string | null;
    qualityPrimaryIssue: string | null;
    citationCount: number;
    usedFallback: boolean | null;
  };
  current: {
    status: 'succeeded' | 'failed';
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
          | 'became_failed'
          | 'became_insufficient_context'
          | 'quality_degraded'
          | 'fallback_introduced'
          | 'citations_decreased';
        count: number;
      }>;
    };
  };
  reportExports?: {
    markdown: {
      format: 'markdown';
      fileName: string;
      mimeType: string;
      content: string;
    };
    json: {
      format: 'json';
      fileName: string;
      mimeType: string;
      content: string;
    };
    html: {
      format: 'html';
      fileName: string;
      mimeType: string;
      content: string;
    };
  };
};

export type Conversation = {
  id: string;
  tenantId: string;
  userId: string;
  assistantId: string;
  title: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
};

export type UpdateConversationInput = {
  title?: string;
};

export type Message = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  traceId: string | null;
  createdAt: string;
  /** Present on assistant messages; needed to resolve the `[n]` markers. */
  citations?: Citation[];
  /** Present when the assistant message was produced by Agent mode. */
  agentSteps?: AgentStep[];
};

export type TraceUsageSummary = {
  windowHours: number;
  sampledTraceCount: number;
  successCount: number;
  failedCount: number;
  latency: {
    firstTokenP50Ms: number | null;
    firstTokenP95Ms: number | null;
    totalP50Ms: number | null;
    totalP95Ms: number | null;
  };
  tokens: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    promptTokensEstimated: boolean;
  };
  cost: {
    estimatedUsd: number;
    inputCostPerMillion: number;
    outputCostPerMillion: number;
  };
  byModel: Array<{
    modelName: string;
    traceCount: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    firstTokenP50Ms: number | null;
    firstTokenP95Ms: number | null;
  }>;
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
  retrievalMetadataJson?: AskRetrievalMetadata | JsonValue | null;
  answeringMetadataJson?: AskAnsweringMetadata | JsonValue | null;
  modelName: string | null;
  latencyMs: number | null;
  traceSummary: TraceSummary | null;
  status: 'success' | 'failed';
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
