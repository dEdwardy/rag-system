import { Injectable } from "@nestjs/common";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { EmbeddingProvider, EmbeddingVector } from "../embedding/embedding-runtime-config";
import { RetrievalProfileFilters } from "../../modules/retrieval-profiles/retrieval-profile.schemas";
import {
  IndexedEmbeddingDiagnostics,
  ReplaceDocumentVectorsInput,
  VectorSearchResult,
  VectorSearchInput,
  VectorStoreCompatibilityError,
  VectorStoreEmbeddingDiagnostics,
  VectorStore,
  VectorStoreRecord
} from "./vector-store.types";

@Injectable()
export class VectorStoreService implements VectorStore {
  private readonly storageRoot = resolve(process.cwd(), process.env.STORAGE_ROOT ?? "storage");
  private readonly vectorRoot = join(this.storageRoot, "vectors");

  async replaceDocumentVectors(input: ReplaceDocumentVectorsInput) {
    const records = await this.readKnowledgeBaseVectors(input.kbId);
    const nextDocumentEmbedding = this.summarizeUpsertEmbeddings(input);
    const existingIndexedEmbedding = this.summarizeIndexedEmbedding(
      records.filter(record => record.documentId !== input.documentId),
      input.kbId
    );

    if (nextDocumentEmbedding && existingIndexedEmbedding) {
      this.assertCompatibleEmbeddingConfigs({
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
    const indexedEmbedding = this.summarizeIndexedEmbedding(records, input.kbId);
    const embeddingDiagnostics = this.buildEmbeddingDiagnostics(input.queryEmbedding, indexedEmbedding);

    if (indexedEmbedding) {
      this.assertCompatibleEmbeddingConfigs({
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
          return this.matchesFilters(record, input.filters);
        }

        return documentIds.has(record.documentId) && this.matchesFilters(record, input.filters);
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

  private matchesFilters(record: VectorStoreRecord, filters?: RetrievalProfileFilters) {
    if (!filters) {
      return true;
    }

    if (filters.documentIds?.include && !filters.documentIds.include.includes(record.documentId)) {
      return false;
    }

    if (filters.documentIds?.exclude && filters.documentIds.exclude.includes(record.documentId)) {
      return false;
    }

    const sectionTitle = record.sectionTitle ?? "";
    const sectionTitleIncludes = filters.sectionTitles?.include;
    const sectionTitleContains = filters.sectionTitles?.contains;
    if (sectionTitleIncludes || sectionTitleContains) {
      const matchesInclude = sectionTitleIncludes?.includes(sectionTitle) ?? false;
      const normalizedSectionTitle = sectionTitle.toLowerCase();
      const matchesContains =
        sectionTitleContains?.some(value => normalizedSectionTitle.includes(value.toLowerCase())) ?? false;

      if (!matchesInclude && !matchesContains) {
        return false;
      }
    }

    if (filters.sectionTitles?.exclude && filters.sectionTitles.exclude.includes(sectionTitle)) {
      return false;
    }

    if (filters.pageNumbers?.exclude && record.pageNo != null && filters.pageNumbers.exclude.includes(record.pageNo)) {
      return false;
    }

    if (
      filters.pageNumbers?.include ||
      filters.pageNumbers?.min !== undefined ||
      filters.pageNumbers?.max !== undefined
    ) {
      if (record.pageNo == null) {
        return false;
      }

      const matchesInclude = filters.pageNumbers.include?.includes(record.pageNo) ?? false;
      const matchesRange =
        (filters.pageNumbers.min === undefined || record.pageNo >= filters.pageNumbers.min) &&
        (filters.pageNumbers.max === undefined || record.pageNo <= filters.pageNumbers.max);

      if (!matchesInclude && !matchesRange) {
        return false;
      }
    }

    return true;
  }

  private async readKnowledgeBaseVectors(kbId: string) {
    const filePath = this.getKnowledgeBasePath(kbId);

    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as VectorStoreRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }

      throw error;
    }
  }

  private async writeKnowledgeBaseVectors(kbId: string, records: VectorStoreRecord[]) {
    await mkdir(this.vectorRoot, { recursive: true });
    const filePath = this.getKnowledgeBasePath(kbId);
    const temporaryPath = `${filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(records), "utf8");
    await rename(temporaryPath, filePath);
  }

  private getKnowledgeBasePath(kbId: string) {
    return join(this.vectorRoot, `${kbId}.json`);
  }

  private summarizeUpsertEmbeddings(input: ReplaceDocumentVectorsInput) {
    if (input.records.length === 0) {
      return null;
    }

    const uniqueConfigs = new Map<string, EmbeddingVector>();

    for (const record of input.records) {
      uniqueConfigs.set(this.createEmbeddingConfigKey(record.embedding.modelName, record.embedding.dimensions), record.embedding);
    }

    if (uniqueConfigs.size > 1) {
      throw new VectorStoreCompatibilityError(
        `Embedding index compatibility error for knowledge base "${input.kbId}": document "${input.documentId}" resolved multiple embedding configs in one indexing batch (${[...uniqueConfigs.values()]
          .map(embedding => this.formatEmbeddingConfig(embedding.modelName, embedding.dimensions))
          .join(", ")}). Indexing requires one embedding config per knowledge base.`
      );
    }

    const [embedding] = [...uniqueConfigs.values()];
    return this.buildActiveEmbeddingDiagnostics(embedding);
  }

  private summarizeIndexedEmbedding(records: VectorStoreRecord[], kbId: string): IndexedEmbeddingDiagnostics | null {
    if (records.length === 0) {
      return null;
    }

    const uniqueConfigs = new Map<
      string,
      {
        provider: EmbeddingProvider;
        model: string;
        modelName: string;
        dimensions: number;
        recordCount: number;
        documentIds: Set<string>;
      }
    >();

    for (const record of records) {
      const parsed = this.parseEmbeddingModelName(record.modelName, kbId);
      const key = this.createEmbeddingConfigKey(record.modelName, record.dimensions);
      const existing = uniqueConfigs.get(key);

      if (existing) {
        existing.recordCount += 1;
        existing.documentIds.add(record.documentId);
        continue;
      }

      uniqueConfigs.set(key, {
        provider: parsed.provider,
        model: parsed.model,
        modelName: record.modelName,
        dimensions: record.dimensions,
        recordCount: 1,
        documentIds: new Set([record.documentId])
      });
    }

    if (uniqueConfigs.size > 1) {
      throw new VectorStoreCompatibilityError(
        `Embedding index compatibility error for knowledge base "${kbId}": indexed vectors contain multiple embedding configs (${[...uniqueConfigs.values()]
          .map(config => `${this.formatEmbeddingConfig(config.modelName, config.dimensions)} x${config.recordCount}`)
          .join(", ")}). Retrieval and indexing require one embedding config per knowledge base. Reindex the affected documents before continuing.`
      );
    }

    const [config] = [...uniqueConfigs.values()];
    return {
      provider: config.provider,
      model: config.model,
      modelName: config.modelName,
      dimensions: config.dimensions,
      fallbackState: config.provider === "fallback" ? "local_deterministic" : "none",
      recordCount: config.recordCount,
      documentCount: config.documentIds.size
    };
  }

  private buildEmbeddingDiagnostics(
    queryEmbedding: EmbeddingVector,
    indexedEmbedding: IndexedEmbeddingDiagnostics | null
  ): VectorStoreEmbeddingDiagnostics {
    return {
      active: this.buildActiveEmbeddingDiagnostics(queryEmbedding),
      indexed: indexedEmbedding
    };
  }

  private buildActiveEmbeddingDiagnostics(embedding: EmbeddingVector): VectorStoreEmbeddingDiagnostics["active"] {
    return {
      provider: embedding.provider,
      model: embedding.model,
      modelName: embedding.modelName,
      dimensions: embedding.dimensions,
      modelSource: embedding.provenance.modelSource,
      dimensionsSource: embedding.provenance.dimensionsSource,
      fallbackState: embedding.provenance.fallback
    };
  }

  private assertCompatibleEmbeddingConfigs(input: {
    kbId: string;
    active: VectorStoreEmbeddingDiagnostics["active"];
    indexed: IndexedEmbeddingDiagnostics;
    action: "indexing" | "retrieval";
    diagnostics?: VectorStoreEmbeddingDiagnostics;
  }) {
    const sameModel = input.active.modelName === input.indexed.modelName;
    const sameDimensions = input.active.dimensions === input.indexed.dimensions;

    if (sameModel && sameDimensions) {
      return;
    }

    const actionLabel = input.action === "indexing" ? "Active indexing embedding config" : "Active retrieval embedding config";
    throw new VectorStoreCompatibilityError(
      `Embedding index compatibility error for knowledge base "${input.kbId}": ${actionLabel} ${this.formatEmbeddingConfig(
        input.active.modelName,
        input.active.dimensions
      )} (fallback=${input.active.fallbackState}) is incompatible with indexed vectors ${this.formatEmbeddingConfig(
        input.indexed.modelName,
        input.indexed.dimensions
      )} across ${input.indexed.documentCount} document(s). Reindex this knowledge base with one embedding config before continuing.`,
      input.diagnostics ?? {
        active: input.active,
        indexed: input.indexed
      }
    );
  }

  private parseEmbeddingModelName(modelName: string, kbId: string) {
    const separatorIndex = modelName.indexOf(":");
    const provider = separatorIndex > 0 ? modelName.slice(0, separatorIndex) : null;
    const model = separatorIndex > 0 ? modelName.slice(separatorIndex + 1) : null;

    if (!provider || !model || !this.isEmbeddingProvider(provider)) {
      throw new VectorStoreCompatibilityError(
        `Embedding index compatibility error for knowledge base "${kbId}": indexed vectors contain an invalid embedding model name "${modelName}".`
      );
    }

    return {
      provider,
      model
    };
  }

  private isEmbeddingProvider(value: string): value is EmbeddingProvider {
    return value === "ollama" || value === "openai" || value === "fallback";
  }

  private createEmbeddingConfigKey(modelName: string, dimensions: number) {
    return `${modelName}::${dimensions}`;
  }

  private formatEmbeddingConfig(modelName: string, dimensions: number) {
    return `${modelName} (${dimensions}d)`;
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
