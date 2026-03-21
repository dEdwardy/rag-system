export type AnswerPolicy = {
  responseStyle: "concise" | "detailed";
  citationMode: "required" | "optional";
  maxCitations: number;
  noAnswerBehavior: "say_insufficient_context" | "best_effort";
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

export type GenerateAnswerOutput = {
  answer: string;
  modelName: string;
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
};

export type RewriteQueryOutput = {
  rewrittenQuery: string;
  modelName: string;
  usedFallback: boolean;
};
