type DocumentLike = {
  status: "pending" | "processing" | "ready" | "failed";
  chunkCount: number;
};

export type KnowledgeBaseWorkspaceSummary = {
  chunkCount: number;
  readyCount: number;
  processingCount: number;
  failedCount: number;
  tone: "failed" | "processing" | "ready" | "empty";
  toneColor: "red" | "yellow" | "indigo" | "gray";
  toneLabelKey:
    | "knowledgeBase.summary.failed"
    | "knowledgeBase.summary.processing"
    | "knowledgeBase.summary.ready"
    | "knowledgeBase.summary.empty";
};

export function buildKnowledgeBaseWorkspaceSummary({
  documents
}: {
  documents: DocumentLike[];
  assistantCount: number;
}): KnowledgeBaseWorkspaceSummary {
  const chunkCount = documents.reduce((sum, document) => sum + document.chunkCount, 0);
  const readyCount = documents.filter(document => document.status === "ready").length;
  const processingCount = documents.filter(
    document => document.status === "pending" || document.status === "processing"
  ).length;
  const failedCount = documents.filter(document => document.status === "failed").length;
  const tone =
    failedCount > 0 ? "failed" : processingCount > 0 ? "processing" : readyCount > 0 ? "ready" : "empty";
  const toneColor =
    tone === "failed" ? "red" : tone === "processing" ? "yellow" : tone === "ready" ? "indigo" : "gray";
  const toneLabelKey =
    tone === "failed"
      ? "knowledgeBase.summary.failed"
      : tone === "processing"
        ? "knowledgeBase.summary.processing"
        : tone === "ready"
          ? "knowledgeBase.summary.ready"
          : "knowledgeBase.summary.empty";

  return {
    chunkCount,
    readyCount,
    processingCount,
    failedCount,
    tone,
    toneColor,
    toneLabelKey
  };
}
