import { RetrievalProfileFilters } from "../../modules/retrieval-profiles/retrieval-profile.schemas";

export type VectorStoreRecord = {
  id: string;
  kbId: string;
  documentId: string;
  chunkId: string;
  chunkIndex: number;
  sectionTitle: string | null;
  pageNo: number | null;
  content: string;
  modelName: string;
  dimensions: number;
  vector: number[];
  metadata: Record<string, unknown>;
  updatedAt: string;
};

export type UpsertVectorInput = Omit<VectorStoreRecord, "updatedAt">;

export type ReplaceDocumentVectorsInput = {
  kbId: string;
  documentId: string;
  records: UpsertVectorInput[];
};

export type VectorSearchInput = {
  kbId: string;
  queryVector: number[];
  topK: number;
  scoreThreshold: number;
  documentIds?: string[];
  filters?: RetrievalProfileFilters;
};

export type VectorSearchMatch = {
  chunkId: string;
  documentId: string;
  score: number;
  modelName: string;
};

export interface VectorStore {
  replaceDocumentVectors(input: ReplaceDocumentVectorsInput): Promise<void>;
  deleteDocumentVectors(kbId: string, documentId: string): Promise<void>;
  search(input: VectorSearchInput): Promise<VectorSearchMatch[]>;
}

export const VECTOR_STORE = Symbol("VECTOR_STORE");
