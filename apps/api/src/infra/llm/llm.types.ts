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

export type JudgeRerankInput = {
  question: string;
  candidates: Array<{
    chunkId: string;
    documentTitle: string;
    sectionTitle: string | null;
    content: string;
    score: number;
  }>;
};

export type LlmToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type LlmToolCall = {
  id: string;
  name: string;
  argumentsJson: string;
};

export type LlmChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: LlmToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export type GenerateWithToolsInput = {
  messages: LlmChatMessage[];
  tools: LlmToolDefinition[];
  temperature?: number;
  signal?: AbortSignal;
};

export type GenerateWithToolsOutput = {
  content: string | null;
  toolCalls: LlmToolCall[];
  modelName: string;
};
