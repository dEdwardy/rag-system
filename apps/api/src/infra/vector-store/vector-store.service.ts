import { Injectable } from "@nestjs/common";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { RetrievalProfileFilters } from "../../modules/retrieval-profiles/retrieval-profile.schemas";
import {
  ReplaceDocumentVectorsInput,
  VectorSearchInput,
  VectorStore,
  VectorStoreRecord
} from "./vector-store.types";

@Injectable()
export class VectorStoreService implements VectorStore {
  private readonly storageRoot = resolve(process.cwd(), process.env.STORAGE_ROOT ?? "storage");
  private readonly vectorRoot = join(this.storageRoot, "vectors");

  async replaceDocumentVectors(input: ReplaceDocumentVectorsInput) {
    const records = await this.readKnowledgeBaseVectors(input.kbId);
    const nextRecords = [
      ...records.filter(record => record.documentId !== input.documentId),
      ...input.records.map(record => ({
        ...record,
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

  async search(input: VectorSearchInput) {
    const records = await this.readKnowledgeBaseVectors(input.kbId);
    const normalizedQueryVector = this.normalizeVector(input.queryVector);
    const documentIds = new Set(input.documentIds ?? []);

    return records
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
