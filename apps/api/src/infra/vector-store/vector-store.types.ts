import { RetrievalProfileFilters } from "../../modules/retrieval-profiles/retrieval-profile.schemas";
import type {
  EmbeddingDimensionsSource,
  EmbeddingFallbackState,
  EmbeddingModelSource,
  EmbeddingProvider,
  EmbeddingVector
} from "../embedding/embedding-runtime-config";

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

export type UpsertVectorInput = Omit<VectorStoreRecord, "updatedAt" | "modelName" | "dimensions" | "vector"> & {
  embedding: EmbeddingVector;
};

export type ReplaceDocumentVectorsInput = {
  kbId: string;
  documentId: string;
  records: UpsertVectorInput[];
};

export type VectorSearchInput = {
  kbId: string;
  queryEmbedding: EmbeddingVector;
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

export type ActiveEmbeddingDiagnostics = {
  provider: EmbeddingProvider;
  model: string;
  modelName: string;
  dimensions: number;
  modelSource: EmbeddingModelSource;
  dimensionsSource: EmbeddingDimensionsSource;
  fallbackState: EmbeddingFallbackState;
};

export type IndexedEmbeddingDiagnostics = {
  provider: EmbeddingProvider;
  model: string;
  modelName: string;
  dimensions: number;
  fallbackState: EmbeddingFallbackState;
  recordCount: number;
  documentCount: number;
};

export type VectorStoreEmbeddingDiagnostics = {
  active: ActiveEmbeddingDiagnostics;
  indexed: IndexedEmbeddingDiagnostics | null;
};

export type VectorSearchResult = {
  matches: VectorSearchMatch[];
  embedding: VectorStoreEmbeddingDiagnostics | null;
};

export class VectorStoreCompatibilityError extends Error {
  constructor(
    message: string,
    readonly embeddingDiagnostics: VectorStoreEmbeddingDiagnostics | null = null
  ) {
    super(message);
    this.name = "VectorStoreCompatibilityError";
  }
}

export interface VectorStore {
  replaceDocumentVectors(input: ReplaceDocumentVectorsInput): Promise<void>;
  deleteDocumentVectors(kbId: string, documentId: string): Promise<void>;
  search(input: VectorSearchInput): Promise<VectorSearchResult>;
}

export const VECTOR_STORE = Symbol("VECTOR_STORE");
