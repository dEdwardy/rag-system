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
  strategyJson: JsonValue | null;
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

export type AskResponse = {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  traceId: string;
  modelName: string;
  answer: string;
  citations: Citation[];
  retrievedChunks: RetrievedChunk[];
  contextGroups?: Array<{
    primaryChunkIds: string[];
    mergedContent: string;
  }>;
  retrievalMetadata?: JsonValue;
  answeringMetadata?: JsonValue;
  answerStatus?: "grounded" | "insufficient_context";
  missingInformation?: string[];
  qualityEvaluation?: JsonValue;
};

export type AskStreamFinalData = Pick<
  AskResponse,
  "conversationId" | "assistantMessageId" | "traceId" | "answer" | "citations" | "modelName"
> &
  Partial<AskResponse>;

export type AskStreamEvent =
  | {
      type: "status";
      phase: "started" | "generating";
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
  status: "success" | "failed";
  errorMessage: string | null;
  createdAt: string;
};

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
