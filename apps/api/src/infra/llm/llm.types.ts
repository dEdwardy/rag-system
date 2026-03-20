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
  chunks: RetrievedChunkInput[];
};

export type GenerateAnswerOutput = {
  answer: string;
  modelName: string;
  citedChunkNumbers?: number[];
};

export type RewriteQueryInput = {
  question: string;
};

export type RewriteQueryOutput = {
  rewrittenQuery: string;
  modelName: string;
  usedFallback: boolean;
};
