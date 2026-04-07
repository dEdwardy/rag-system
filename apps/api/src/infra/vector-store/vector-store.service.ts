import { Inject, Injectable } from "@nestjs/common";
import { STORAGE_PROVIDER_SERVICE, type StorageProviderService } from "../storage/storage-provider.service";
import {
  assertCompatibleEmbeddingConfigs,
  buildEmbeddingDiagnostics,
  matchesVectorStoreFilters,
  shouldReplaceIndexedFallbackDuringIndexing,
  summarizeIndexedEmbedding,
  summarizeUpsertEmbeddings
} from "./vector-store.shared";
import { ReplaceDocumentVectorsInput, VectorSearchInput, VectorSearchResult, VectorStore, VectorStoreRecord } from "./vector-store.types";

@Injectable()
export class VectorStoreService implements VectorStore {
  constructor(@Inject(STORAGE_PROVIDER_SERVICE) private readonly storageProviderService: StorageProviderService) {}

  async replaceDocumentVectors(input: ReplaceDocumentVectorsInput) {
    const records = await this.readKnowledgeBaseVectors(input.kbId);
    const nextDocumentEmbedding = summarizeUpsertEmbeddings(input);
    const existingIndexedEmbedding = summarizeIndexedEmbedding(
      records.filter(record => record.documentId !== input.documentId),
      input.kbId
    );

    if (
      nextDocumentEmbedding &&
      existingIndexedEmbedding &&
      shouldReplaceIndexedFallbackDuringIndexing({
        active: nextDocumentEmbedding,
        indexed: existingIndexedEmbedding
      })
    ) {
      const migratedRecords = input.records.map(({ embedding, ...record }) => ({
        ...record,
        modelName: embedding.modelName,
        dimensions: embedding.dimensions,
        vector: embedding.vector,
        updatedAt: new Date().toISOString()
      }));

      await this.writeKnowledgeBaseVectors(input.kbId, migratedRecords);
      return;
    }

    if (nextDocumentEmbedding && existingIndexedEmbedding) {
      assertCompatibleEmbeddingConfigs({
        kbId: input.kbId,
        active: nextDocumentEmbedding,
        indexed: existingIndexedEmbedding,
        action: "indexing"
      });
    }

    const nextRecords = [
      ...records.filter(record => record.documentId !== input.documentId),
      ...input.records.map(({ embedding, ...record }) => ({
        ...record,
        modelName: embedding.modelName,
        dimensions: embedding.dimensions,
        vector: embedding.vector,
        updatedAt: new Date().toISOString()
      }))
    ];

    await this.writeKnowledgeBaseVectors(input.kbId, nextRecords);
  }

  async deleteDocumentVectors(kbId: string, documentId: string) {
    const records = await this.readKnowledgeBaseVectors(kbId);
    const nextRecords = records.filter(record => record.documentId !== documentId);

    if (nextRecords.length === records.length) {
      return;
    }

    await this.writeKnowledgeBaseVectors(kbId, nextRecords);
  }

  async search(input: VectorSearchInput): Promise<VectorSearchResult> {
    const records = await this.readKnowledgeBaseVectors(input.kbId);
    const indexedEmbedding = summarizeIndexedEmbedding(records, input.kbId);
    const embeddingDiagnostics = buildEmbeddingDiagnostics(input.queryEmbedding, indexedEmbedding);

    if (indexedEmbedding) {
      assertCompatibleEmbeddingConfigs({
        kbId: input.kbId,
        active: embeddingDiagnostics.active,
        indexed: indexedEmbedding,
        action: "retrieval",
        diagnostics: embeddingDiagnostics
      });
    }

    const normalizedQueryVector = this.normalizeVector(input.queryEmbedding.vector);
    const documentIds = new Set(input.documentIds ?? []);
    const matches = records
      .filter(record => {
        if (documentIds.size === 0) {
          return matchesVectorStoreFilters(record, input.filters);
        }

        return documentIds.has(record.documentId) && matchesVectorStoreFilters(record, input.filters);
      })
      .map(record => ({
        chunkId: record.chunkId,
        documentId: record.documentId,
        score: this.cosineSimilarity(normalizedQueryVector, record.vector),
        modelName: record.modelName
      }))
      .filter(record => record.score >= input.scoreThreshold)
      .sort((left, right) => right.score - left.score)
      .slice(0, input.topK);

    return {
      matches,
      embedding: embeddingDiagnostics
    };
  }

  private async readKnowledgeBaseVectors(kbId: string) {
    const storageKey = this.getKnowledgeBaseStorageKey(kbId);

    try {
      const buffer = await this.storageProviderService.readFileByStorageKey(storageKey);
      const raw = buffer.toString("utf8");
      const parsed = JSON.parse(raw) as VectorStoreRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      // If the file doesn't exist, return an empty array
      return [];
    }
  }

  private async writeKnowledgeBaseVectors(kbId: string, records: VectorStoreRecord[]) {
    const storageKey = this.getKnowledgeBaseStorageKey(kbId);
    const content = JSON.stringify(records);
    const buffer = Buffer.from(content, "utf8");

    await this.storageProviderService.saveUploadedFile({
      buffer,
      originalName: `${kbId}.json`,
      mimeType: "application/json"
    });
  }

  private getKnowledgeBaseStorageKey(kbId: string) {
    return `vectors/${kbId}.json`;
  }

  private cosineSimilarity(left: number[], right: number[]) {
    if (left.length === 0 || right.length === 0 || left.length !== right.length) {
      return 0;
    }

    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;

    for (let index = 0; index < left.length; index += 1) {
      const leftValue = left[index] ?? 0;
      const rightValue = right[index] ?? 0;
      dot += leftValue * rightValue;
      leftMagnitude += leftValue * leftValue;
      rightMagnitude += rightValue * rightValue;
    }

    if (leftMagnitude === 0 || rightMagnitude === 0) {
      return 0;
    }

    return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
  }

  private normalizeVector(vector: number[]) {
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

    if (magnitude === 0) {
      return vector;
    }

    return vector.map(value => value / magnitude);
  }
}
