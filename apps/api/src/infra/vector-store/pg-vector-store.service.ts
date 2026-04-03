import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { RetrievalProfileFilters } from "../../modules/retrieval-profiles/retrieval-profile.schemas";
import { PrismaService } from "../database/prisma.service";
import {
  assertCompatibleEmbeddingConfigs,
  buildEmbeddingDiagnostics,
  summarizeUpsertEmbeddings,
  parseEmbeddingModelName
} from "./vector-store.shared";
import { resolveVectorStoreRuntimeConfig } from "./vector-store-runtime-config";
import {
  IndexedEmbeddingDiagnostics,
  ReplaceDocumentVectorsInput,
  VectorSearchInput,
  VectorSearchResult,
  VectorStore,
  VectorStoreCompatibilityError,
  VectorStoreRecord
} from "./vector-store.types";

type IndexedConfigRow = {
  modelName: string;
  dimensions: number;
  recordCount: bigint | number;
  documentCount: bigint | number;
};

type SearchRow = {
  chunkId: string;
  documentId: string;
  modelName: string;
  score: number;
};

@Injectable()
export class PgVectorStoreService implements VectorStore {
  private readonly runtimeConfig = resolveVectorStoreRuntimeConfig();

  constructor(private readonly prisma: PrismaService) {}

  async replaceDocumentVectors(input: ReplaceDocumentVectorsInput) {
    const nextDocumentEmbedding = summarizeUpsertEmbeddings(input);
    if (nextDocumentEmbedding && nextDocumentEmbedding.dimensions !== this.getRuntimeConfig().dimensions) {
      throw new VectorStoreCompatibilityError(
        `Embedding index compatibility error for knowledge base "${input.kbId}": active indexing embedding config ${nextDocumentEmbedding.modelName} (${nextDocumentEmbedding.dimensions}d) does not match pgvector store dimension ${this.getRuntimeConfig().dimensions}d.`,
        {
          active: nextDocumentEmbedding,
          indexed: null
        }
      );
    }

    const existingIndexedEmbedding = await this.readIndexedEmbeddingSummary(input.kbId, input.documentId);

    if (nextDocumentEmbedding && existingIndexedEmbedding) {
      assertCompatibleEmbeddingConfigs({
        kbId: input.kbId,
        active: nextDocumentEmbedding,
        indexed: existingIndexedEmbedding,
        action: "indexing"
      });
    }

    await this.prisma.$transaction(async transaction => {
      await transaction.$executeRaw(this.buildDeleteDocumentVectorsSql(input.kbId, input.documentId));

      if (input.records.length === 0) {
        return;
      }

      await transaction.$executeRaw(this.buildInsertVectorsSql(input));
    });
  }

  async deleteDocumentVectors(kbId: string, documentId: string) {
    await this.prisma.$executeRaw(this.buildDeleteDocumentVectorsSql(kbId, documentId));
  }

  async search(input: VectorSearchInput): Promise<VectorSearchResult> {
    const indexedEmbedding = await this.readIndexedEmbeddingSummary(input.kbId);
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

    const rows = await this.prisma.$queryRaw<SearchRow[]>(this.buildSearchSql(input));

    return {
      matches: rows.map(row => ({
        chunkId: row.chunkId,
        documentId: row.documentId,
        score: Number(row.score),
        modelName: row.modelName
      })),
      embedding: embeddingDiagnostics
    };
  }

  private async readIndexedEmbeddingSummary(kbId: string, excludedDocumentId?: string) {
    const rows = await this.prisma.$queryRaw<IndexedConfigRow[]>(this.buildIndexedConfigSql(kbId, excludedDocumentId));

    if (rows.length === 0) {
      return null;
    }

    if (rows.length > 1) {
      throw new VectorStoreCompatibilityError(
        `Embedding index compatibility error for knowledge base "${kbId}": indexed vectors contain multiple embedding configs (${rows
          .map(row => `${row.modelName} (${row.dimensions}d) x${this.toCount(row.recordCount)}`)
          .join(", ")}). Retrieval and indexing require one embedding config per knowledge base. Reindex the affected documents before continuing.`
      );
    }

    const [row] = rows;
    const parsed = parseEmbeddingModelName(row.modelName, kbId);
    return {
      provider: parsed.provider,
      model: parsed.model,
      modelName: row.modelName,
      dimensions: row.dimensions,
      fallbackState: parsed.provider === "fallback" ? "local_deterministic" : "none",
      recordCount: this.toCount(row.recordCount),
      documentCount: this.toCount(row.documentCount)
    } satisfies IndexedEmbeddingDiagnostics;
  }

  private buildDeleteDocumentVectorsSql(kbId: string, documentId: string) {
    return Prisma.sql`
      DELETE FROM ${this.tableIdentifier()}
      WHERE "kbId" = ${kbId} AND "documentId" = ${documentId}
    `;
  }

  private buildInsertVectorsSql(input: ReplaceDocumentVectorsInput) {
    const updatedAt = new Date();
    const values = Prisma.join(
      input.records.map(record => {
        const vectorLiteral = this.serializeVector(record.embedding.vector);
        return Prisma.sql`(
          ${record.id},
          ${record.kbId},
          ${record.documentId},
          ${record.chunkId},
          ${record.chunkIndex},
          ${record.sectionTitle},
          ${record.pageNo},
          ${record.content},
          ${record.embedding.modelName},
          ${record.embedding.dimensions},
          ${record.metadata as Prisma.InputJsonValue},
          ${vectorLiteral}::vector,
          ${updatedAt}
        )`;
      })
    );

    return Prisma.sql`
      INSERT INTO ${this.tableIdentifier()} (
        "id",
        "kbId",
        "documentId",
        "chunkId",
        "chunkIndex",
        "sectionTitle",
        "pageNo",
        "content",
        "modelName",
        "dimensions",
        "metadataJson",
        "embedding",
        "updatedAt"
      )
      VALUES ${values}
    `;
  }

  private buildIndexedConfigSql(kbId: string, excludedDocumentId?: string) {
    const conditions: Prisma.Sql[] = [Prisma.sql`"kbId" = ${kbId}`];

    if (excludedDocumentId) {
      conditions.push(Prisma.sql`"documentId" <> ${excludedDocumentId}`);
    }

    return Prisma.sql`
      SELECT
        "modelName",
        "dimensions",
        COUNT(*) AS "recordCount",
        COUNT(DISTINCT "documentId") AS "documentCount"
      FROM ${this.tableIdentifier()}
      WHERE ${Prisma.join(conditions, " AND ")}
      GROUP BY "modelName", "dimensions"
    `;
  }

  private buildSearchSql(input: VectorSearchInput) {
    const vectorLiteral = this.serializeVector(input.queryEmbedding.vector);
    const conditions: Prisma.Sql[] = [Prisma.sql`"kbId" = ${input.kbId}`];

    if (input.documentIds && input.documentIds.length > 0) {
      conditions.push(Prisma.sql`"documentId" IN (${Prisma.join(input.documentIds)})`);
    }

    this.appendFilterConditions(conditions, input.filters);

    conditions.push(Prisma.sql`1 - ("embedding" <=> ${vectorLiteral}::vector) >= ${input.scoreThreshold}`);

    return Prisma.sql`
      SELECT
        "chunkId",
        "documentId",
        "modelName",
        1 - ("embedding" <=> ${vectorLiteral}::vector) AS "score"
      FROM ${this.tableIdentifier()}
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY "embedding" <=> ${vectorLiteral}::vector
      LIMIT ${input.topK}
    `;
  }

  private appendFilterConditions(conditions: Prisma.Sql[], filters?: RetrievalProfileFilters) {
    if (!filters) {
      return;
    }

    if (filters.documentIds?.include?.length) {
      conditions.push(Prisma.sql`"documentId" IN (${Prisma.join(filters.documentIds.include)})`);
    }

    if (filters.documentIds?.exclude?.length) {
      conditions.push(Prisma.sql`"documentId" NOT IN (${Prisma.join(filters.documentIds.exclude)})`);
    }

    const sectionConditions: Prisma.Sql[] = [];
    if (filters.sectionTitles?.include?.length) {
      sectionConditions.push(Prisma.sql`COALESCE("sectionTitle", '') IN (${Prisma.join(filters.sectionTitles.include)})`);
    }

    if (filters.sectionTitles?.contains?.length) {
      sectionConditions.push(
          Prisma.sql`(${Prisma.join(
          filters.sectionTitles.contains.map(value => Prisma.sql`LOWER(COALESCE("sectionTitle", '')) LIKE ${`%${value.toLowerCase()}%`}`),
          " OR "
        )})`
      );
    }

    if (sectionConditions.length > 0) {
      conditions.push(Prisma.sql`(${Prisma.join(sectionConditions, " OR ")})`);
    }

    if (filters.sectionTitles?.exclude?.length) {
      conditions.push(Prisma.sql`COALESCE("sectionTitle", '') NOT IN (${Prisma.join(filters.sectionTitles.exclude)})`);
    }

    if (filters.pageNumbers?.exclude?.length) {
      conditions.push(Prisma.sql`("pageNo" IS NULL OR "pageNo" NOT IN (${Prisma.join(filters.pageNumbers.exclude)}))`);
    }

    if (
      filters.pageNumbers?.include?.length ||
      filters.pageNumbers?.min !== undefined ||
      filters.pageNumbers?.max !== undefined
    ) {
      const pageConditions: Prisma.Sql[] = [];

      if (filters.pageNumbers?.include?.length) {
        pageConditions.push(Prisma.sql`"pageNo" IN (${Prisma.join(filters.pageNumbers.include)})`);
      }

      const rangeConditions: Prisma.Sql[] = [];
      if (filters.pageNumbers?.min !== undefined) {
        rangeConditions.push(Prisma.sql`"pageNo" >= ${filters.pageNumbers.min}`);
      }
      if (filters.pageNumbers?.max !== undefined) {
        rangeConditions.push(Prisma.sql`"pageNo" <= ${filters.pageNumbers.max}`);
      }
      if (rangeConditions.length > 0) {
        pageConditions.push(Prisma.sql`(${Prisma.join(rangeConditions, " AND ")})`);
      }

      conditions.push(Prisma.sql`("pageNo" IS NOT NULL AND (${Prisma.join(pageConditions, " OR ")}))`);
    }
  }

  private serializeVector(vector: number[]) {
    return `[${vector.join(",")}]`;
  }

  private toCount(value: bigint | number) {
    return typeof value === "bigint" ? Number(value) : value;
  }

  private getRuntimeConfig() {
    if (this.runtimeConfig.provider !== "pgvector") {
      throw new VectorStoreCompatibilityError("PgVectorStoreService requires VECTOR_STORE_PROVIDER=pgvector.");
    }

    return this.runtimeConfig;
  }

  private tableIdentifier() {
    return Prisma.raw(`"${this.getRuntimeConfig().tableName}"`);
  }
}
