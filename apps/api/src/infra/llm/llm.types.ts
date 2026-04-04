export type AnswerPolicy = {
  responseStyle: "concise" | "balanced" | "detailed";
  tone: "neutral" | "friendly" | "direct";
  outputFormat: "paragraph" | "bullets" | "markdown";
  language: "auto" | "same_as_question" | "zh" | "en";
  citationMode: "required" | "optional";
  maxCitations: number;
  noAnswerBehavior: "say_insufficient_context" | "best_effort";
  includeMissingInformation: boolean;
};

export type RetrievedChunkInput = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
  pageNo: number | null;
  sectionTitle: string | null;
};

export type GenerateAnswerInput = {
  question: string;
  systemPrompt: string;
  answerPolicy: AnswerPolicy;
  chunks: RetrievedChunkInput[];
};

export type GenerateAnswerStreamInput = GenerateAnswerInput & {
  onDelta: (delta: string) => void | Promise<void>;
  signal?: AbortSignal;
};

export type GenerateAnswerOutput = {
  answer: string;
  modelName: string;
  promptId: string;
  usedFallback: boolean;
  answerStatus?: "grounded" | "insufficient_context";
  missingInformation?: string[];
  citedChunkNumbers?: number[];
  citationEvidence?: Array<{
    source: number;
    quote: string;
  }>;
};

export type GenerateAnswerStreamOutput = {
  rawAnswer: string;
  modelName: string;
  promptId: string;
  usedFallback: boolean;
  answerStatus?: "grounded" | "insufficient_context";
  missingInformation?: string[];
  citedChunkNumbers?: number[];
  citationEvidence?: Array<{
    source: number;
    quote: string;
  }>;
};

export type RewriteQueryInput = {
  question: string;
  signal?: AbortSignal;
};

export type RewriteQueryOutput = {
  rewrittenQuery: string;
  modelName: string;
  usedFallback: boolean;
  promptId: string;
};
