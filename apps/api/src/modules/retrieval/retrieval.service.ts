import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import { EmbeddingRuntimeConfigError } from "../../infra/embedding/embedding-runtime-config";
import { EmbeddingService } from "../../infra/embedding/embedding.service";
import { PromptManagerService } from "../../infra/llm/prompt-manager.service";
import { LlmService } from "../../infra/llm/llm.service";
import {
  VECTOR_STORE,
  VectorSearchMatch,
  VectorSearchResult,
  VectorStore,
  VectorStoreCompatibilityError,
  VectorStoreEmbeddingDiagnostics
} from "../../infra/vector-store/vector-store.types";
import {
  resolveRetrievalStrategy,
  ResolvedRetrievalStrategy,
  RetrievalProfileFilters,
  retrievalProfileFiltersSchema
} from "../retrieval-profiles/retrieval-profile.schemas";

type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  score: number;
  isPrimary: boolean;
  pageNo: number | null;
  sectionTitle: string | null;
  matchSource: "fts" | "section_title" | "like_fallback" | "vector" | undefined;
  headingPath?: string[];
  blockType?: "paragraph" | "heading" | "list" | "table" | "faq" | "quote" | "code";
  listOrdinal?: number | null;
  isTableLike?: boolean;
};

type RetrievalCandidate = RetrievedChunk & {
  lexicalScore: number;
  vectorScore: number;
  hybridScore: number;
  rerankScore: number;
};

type ExpandedChunkRow = {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  sectionTitle: string | null;
  metadataJson: Prisma.JsonValue | null;
  pageNo: number | null;
  document: {
    title: string;
  };
};

export type RetrievalContextGroup = {
  documentId: string;
  documentTitle: string;
  startChunkIndex: number;
  endChunkIndex: number;
  chunkIds: string[];
  primaryChunkIds: string[];
  mergedContent: string;
  pageNumbers: number[];
  sectionTitles: string[];
};

export type RetrievalResult = {
  retrievedChunks: RetrievedChunk[];
  contextGroups: RetrievalContextGroup[];
  embedding: VectorStoreEmbeddingDiagnostics | null;
  execution: {
    actualMode: "vector" | "hybrid" | "lexical";
    usedFallback: boolean;
    fallbackReason: "vector_error" | "no_ranked_candidates" | null;
    rerankApplied: boolean;
    rerankMode: "off" | "local_heuristic" | "llm_judge";
    rerankJudgeSkippedReason:
      | "candidate_set_too_large"
      | "query_too_simple"
      | "judge_dependencies_missing"
      | null;
    chunkWindowApplied: boolean;
    vectorSearchAttempted: boolean;
    lexicalSearchAttempted: boolean;
    vectorCandidateLimitHit: boolean;
    lexicalCandidateLimitHit: boolean;
    rankingTopKHit: boolean;
    candidateLimit: number;
    vectorCandidateCount: number;
    lexicalCandidateCount: number;
    mergedCandidateCount: number;
    rankedCandidateCount: number;
    timing?: {
      lexicalSearchMs: number | null;
      vectorEmbeddingMs: number | null;
      vectorSearchMs: number | null;
      vectorCandidateFetchMs: number | null;
      mergeCandidatesMs: number | null;
      diverseSelectionMs: number | null;
      rankMs: number | null;
      chunkWindowMs: number | null;
      lexicalFallbackMs: number | null;
    };
  };
};

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    @Inject(VECTOR_STORE) private readonly vectorStoreService: VectorStore,
    private readonly llmService?: LlmService,
    private readonly promptManager?: PromptManagerService
  ) {}

  async retrieve(input: {
    kbId: string;
    query: string;
    topK: number;
    scoreThreshold: number;
    chunkWindow?: number;
    enableHybrid?: boolean;
    enableRerank?: boolean;
    filters?: RetrievalProfileFilters;
    strategy?: ResolvedRetrievalStrategy;
    documentVersions?: Record<string, number>;
  }) {
    const phaseTiming: NonNullable<RetrievalResult["execution"]["timing"]> = {
      lexicalSearchMs: null,
      vectorEmbeddingMs: null,
      vectorSearchMs: null,
      vectorCandidateFetchMs: null,
      mergeCandidatesMs: null,
      diverseSelectionMs: null,
      rankMs: null,
      chunkWindowMs: null,
      lexicalFallbackMs: null
    };
    const normalizedFilters = retrievalProfileFiltersSchema.optional().parse(input.filters);
    const strategy =
      input.strategy ??
      resolveRetrievalStrategy({
        topK: input.topK,
        enableHybrid: input.enableHybrid,
        enableRerank: input.enableRerank
      });
    const candidateSelectionMode = strategy.candidateSelection.mode;
    const resolvedEnableRerank = strategy.rerank.enabled;
    const resolvedRerankMode = strategy.rerank.mode;
    const candidateLimit = Math.max(
      input.topK * strategy.candidateSelection.candidateMultiplier,
      strategy.candidateSelection.minCandidates,
      input.topK
    );
    const vectorSearchTopK =
      candidateSelectionMode === "vector" && !resolvedEnableRerank
        ? input.topK
        : candidateLimit;

    if (candidateSelectionMode === "lexical") {
      const lexicalCandidates = await this.getLexicalCandidates({
        kbId: input.kbId,
        query: input.query,
        limit: candidateLimit,
        filters: normalizedFilters,
        documentVersions: input.documentVersions
      });

      return this.retrieveWithLexicalFallback({
        ...input,
        enableRerank: resolvedEnableRerank,
        filters: normalizedFilters,
        lexicalCandidates,
        candidateLimit,
        vectorCandidateCount: 0,
        embedding: null,
        actualMode: "lexical",
        usedFallback: false,
        fallbackReason: null,
        rerankApplied: resolvedEnableRerank,
        rerankMode: resolvedRerankMode,
        rerankJudgeSkippedReason: this.resolveJudgeRerankSkipReason({
          candidates: [],
          query: input.query,
          rerankMode: resolvedRerankMode
        })
      });
    }

    let vectorCandidateCount = 0;
    let embeddingDiagnostics: VectorStoreEmbeddingDiagnostics | null = null;

    try {
      const tasks: Array<Promise<{ type: "lexical" | "vector"; result: any }>> = [];

      if (candidateSelectionMode === "hybrid") {
        tasks.push(
          (async () => {
            const lexicalSearchStartedAt = Date.now();
            const result = await this.getLexicalCandidates({
              kbId: input.kbId,
              query: input.query,
              limit: candidateLimit,
              filters: normalizedFilters,
              documentVersions: input.documentVersions
            });
            phaseTiming.lexicalSearchMs = Date.now() - lexicalSearchStartedAt;
            return { type: "lexical" as const, result };
          })()
        );
      }

      tasks.push(
        (async () => {
          const embeddingStartedAt = Date.now();
          const queryEmbedding = await this.embeddingService.embedQuery(input.query);
          phaseTiming.vectorEmbeddingMs = Date.now() - embeddingStartedAt;
          const vectorSearchStartedAt = Date.now();
          const vectorSearch = (await this.vectorStoreService.search({
            kbId: input.kbId,
            queryEmbedding,
            topK: vectorSearchTopK,
            scoreThreshold: input.scoreThreshold,
            filters: normalizedFilters
          })) as VectorSearchResult | VectorSearchMatch[];
          phaseTiming.vectorSearchMs = Date.now() - vectorSearchStartedAt;
          const normalizedVectorSearch = this.normalizeVectorSearchResult(queryEmbedding, vectorSearch);
          return { type: "vector" as const, result: normalizedVectorSearch };
        })()
      );

      const results = await Promise.allSettled(tasks);

      let lexicalCandidates: RetrievalCandidate[] | undefined;
      let normalizedVectorSearch: VectorSearchResult | null = null;

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          if (result.value.type === "lexical") {
            lexicalCandidates = result.value.result;
          } else if (result.value.type === "vector") {
            normalizedVectorSearch = result.value.result;
          }
        } else {
          const taskType = index === 0 && candidateSelectionMode === "hybrid" ? "lexical" : "vector";
          if (taskType === "vector" && (
            result.reason instanceof EmbeddingRuntimeConfigError ||
            result.reason instanceof VectorStoreCompatibilityError
          )) {
            throw result.reason;
          }
          const message = result.reason instanceof Error ? result.reason.message : "Unknown error";
          this.logger.warn(`${taskType} search failed: ${message}`, result.reason);
        }
      });

      if (!normalizedVectorSearch) {
        throw new Error("Vector search failed and is required for non-lexical mode");
      }

      const vectorMatches = (normalizedVectorSearch as VectorSearchResult).matches;
      embeddingDiagnostics = (normalizedVectorSearch as VectorSearchResult).embedding;

      if (vectorMatches.length > 0 || candidateSelectionMode === "hybrid") {
        if (candidateSelectionMode === "vector" && !resolvedEnableRerank) {
          const topVectorMatches = vectorMatches.slice(0, input.topK);
          vectorCandidateCount = topVectorMatches.length;
          if (
            (input.chunkWindow ?? 0) > 0 &&
            topVectorMatches.every(match => typeof (match as { chunkIndex?: unknown }).chunkIndex === "number")
          ) {
            const chunkWindowStartedAt = Date.now();
            const retrievedChunks = await this.expandVectorMatchesWithChunkWindow(
              input.kbId,
              topVectorMatches,
              input.chunkWindow ?? 0,
              normalizedFilters,
              input.documentVersions
            );
            phaseTiming.chunkWindowMs = Date.now() - chunkWindowStartedAt;
            if (retrievedChunks.length > 0) {
              return this.buildRetrievalResult(retrievedChunks, {
                embedding: embeddingDiagnostics,
                actualMode: candidateSelectionMode,
                usedFallback: false,
                fallbackReason: null,
                rerankApplied: resolvedEnableRerank,
                rerankMode: resolvedRerankMode,
                rerankJudgeSkippedReason: this.resolveJudgeRerankSkipReason({
                  candidates: [],
                  query: input.query,
                  rerankMode: resolvedRerankMode
                }),
                chunkWindowApplied: true,
                vectorSearchAttempted: true,
                lexicalSearchAttempted: false,
                vectorCandidateLimitHit: vectorMatches.length >= vectorSearchTopK,
                lexicalCandidateLimitHit: false,
                rankingTopKHit: topVectorMatches.length >= input.topK,
                candidateLimit,
                vectorCandidateCount,
                lexicalCandidateCount: 0,
                mergedCandidateCount: topVectorMatches.length,
                rankedCandidateCount: topVectorMatches.length,
                timing: phaseTiming
              });
            }
          } else {
            const vectorCandidateFetchStartedAt = Date.now();
            const vectorCandidates = await this.getVectorCandidates(topVectorMatches);
            phaseTiming.vectorCandidateFetchMs = Date.now() - vectorCandidateFetchStartedAt;
            const rankedVectorCandidates = vectorCandidates.filter(candidate => candidate.score >= input.scoreThreshold);
            vectorCandidateCount = vectorCandidates.length;
            if (rankedVectorCandidates.length > 0) {
              let retrievedChunks: RetrievedChunk[] = rankedVectorCandidates;
              if ((input.chunkWindow ?? 0) > 0) {
                const chunkWindowStartedAt = Date.now();
                retrievedChunks = await this.expandChunkWindow(
                  input.kbId,
                  rankedVectorCandidates,
                  input.chunkWindow ?? 0,
                  normalizedFilters,
                  input.documentVersions
                );
                phaseTiming.chunkWindowMs = Date.now() - chunkWindowStartedAt;
              }

              return this.buildRetrievalResult(retrievedChunks, {
                embedding: embeddingDiagnostics,
                actualMode: candidateSelectionMode,
                usedFallback: false,
                fallbackReason: null,
                rerankApplied: resolvedEnableRerank,
                rerankMode: resolvedRerankMode,
                rerankJudgeSkippedReason: this.resolveJudgeRerankSkipReason({
                  candidates: rankedVectorCandidates,
                  query: input.query,
                  rerankMode: resolvedRerankMode
                }),
                chunkWindowApplied: (input.chunkWindow ?? 0) > 0,
                vectorSearchAttempted: true,
                lexicalSearchAttempted: false,
                vectorCandidateLimitHit: vectorMatches.length >= vectorSearchTopK,
                lexicalCandidateLimitHit: false,
                rankingTopKHit: rankedVectorCandidates.length >= input.topK,
                candidateLimit,
                vectorCandidateCount,
                lexicalCandidateCount: 0,
                mergedCandidateCount: rankedVectorCandidates.length,
                rankedCandidateCount: rankedVectorCandidates.length,
                timing: phaseTiming
              });
            }
          }
        }

        const vectorCandidateFetchStartedAt = Date.now();
        const vectorCandidates = await this.getVectorCandidates(vectorMatches, lexicalCandidates);
        phaseTiming.vectorCandidateFetchMs = Date.now() - vectorCandidateFetchStartedAt;
        vectorCandidateCount = vectorCandidates.length;
        const mergeCandidatesStartedAt = Date.now();
        const mergedCandidates = candidateSelectionMode === "hybrid" && lexicalCandidates
          ? this.mergeHybridCandidates(vectorCandidates, lexicalCandidates, strategy)
          : vectorCandidates;
        phaseTiming.mergeCandidatesMs = Date.now() - mergeCandidatesStartedAt;
        const diverseSelectionStartedAt = Date.now();
        const diverseCandidates = this.selectDiverseCandidates(mergedCandidates, candidateLimit);
        phaseTiming.diverseSelectionMs = Date.now() - diverseSelectionStartedAt;
        const rankStartedAt = Date.now();
        const rankedCandidates = await this.rankCandidates(diverseCandidates, {
            enableRerank: resolvedEnableRerank,
            rerankMode: resolvedRerankMode,
            query: input.query,
            scoreThreshold: input.scoreThreshold,
            topK: input.topK
          });
        phaseTiming.rankMs = Date.now() - rankStartedAt;

        if (rankedCandidates.length > 0) {
          const chunkWindowStartedAt = Date.now();
          const retrievedChunks = await this.expandChunkWindow(
            input.kbId,
            rankedCandidates,
            input.chunkWindow ?? 0,
            normalizedFilters,
            input.documentVersions
          );
          phaseTiming.chunkWindowMs = Date.now() - chunkWindowStartedAt;
          return this.buildRetrievalResult(retrievedChunks, {
            embedding: embeddingDiagnostics,
            actualMode: candidateSelectionMode,
            usedFallback: false,
            fallbackReason: null,
            rerankApplied: resolvedEnableRerank,
            rerankMode: resolvedRerankMode,
            rerankJudgeSkippedReason: this.resolveJudgeRerankSkipReason({
              candidates: diverseCandidates,
              query: input.query,
              rerankMode: resolvedRerankMode
            }),
            chunkWindowApplied: (input.chunkWindow ?? 0) > 0,
            vectorSearchAttempted: true,
            lexicalSearchAttempted: candidateSelectionMode === "hybrid",
            vectorCandidateLimitHit: vectorMatches.length >= vectorSearchTopK,
            lexicalCandidateLimitHit: (lexicalCandidates?.length ?? 0) >= candidateLimit,
            rankingTopKHit: rankedCandidates.length >= input.topK,
            candidateLimit,
            vectorCandidateCount,
            lexicalCandidateCount: lexicalCandidates?.length ?? 0,
            mergedCandidateCount: mergedCandidates.length,
            rankedCandidateCount: rankedCandidates.length,
            timing: phaseTiming
          });
        }
      }
    } catch (error) {
      if (error instanceof EmbeddingRuntimeConfigError || error instanceof VectorStoreCompatibilityError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Unknown vector retrieval error.";
      this.logger.warn(`Vector retrieval failed, falling back to lexical scoring. ${message}`);
      return this.retrieveWithLexicalFallback({
        ...input,
        enableRerank: resolvedEnableRerank,
        filters: normalizedFilters,
        lexicalCandidates: undefined,
        candidateLimit,
        vectorCandidateCount: 0,
        embedding: embeddingDiagnostics,
        actualMode: "lexical",
        usedFallback: true,
        fallbackReason: "vector_error",
        rerankApplied: resolvedEnableRerank,
        rerankMode: resolvedRerankMode,
        rerankJudgeSkippedReason: this.resolveJudgeRerankSkipReason({
          candidates: [],
          query: input.query,
          rerankMode: resolvedRerankMode
        }),
        phaseTiming,
        documentVersions: input.documentVersions
      });
    }

    return this.retrieveWithLexicalFallback({
      ...input,
      enableRerank: resolvedEnableRerank,
      filters: normalizedFilters,
      lexicalCandidates: undefined,
      candidateLimit,
      vectorCandidateCount,
      embedding: embeddingDiagnostics,
      actualMode: "lexical",
      usedFallback: true,
      fallbackReason: "no_ranked_candidates",
      rerankApplied: resolvedEnableRerank,
      rerankMode: resolvedRerankMode,
      rerankJudgeSkippedReason: this.resolveJudgeRerankSkipReason({
        candidates: [],
        query: input.query,
        rerankMode: resolvedRerankMode
      }),
      documentVersions: input.documentVersions
    });
  }

  private async retrieveWithLexicalFallback(input: {
    kbId: string;
    query: string;
    topK: number;
    scoreThreshold: number;
    chunkWindow?: number;
    enableRerank?: boolean;
    lexicalCandidates?: RetrievalCandidate[];
    candidateLimit: number;
    vectorCandidateCount: number;
    embedding: VectorStoreEmbeddingDiagnostics | null;
    filters?: RetrievalProfileFilters;
    actualMode: "lexical";
    usedFallback: boolean;
    fallbackReason: "vector_error" | "no_ranked_candidates" | null;
    rerankApplied: boolean;
    rerankMode: "off" | "local_heuristic" | "llm_judge";
    rerankJudgeSkippedReason:
      | "candidate_set_too_large"
      | "query_too_simple"
      | "judge_dependencies_missing"
      | null;
    phaseTiming?: NonNullable<RetrievalResult["execution"]["timing"]>;
    documentVersions?: Record<string, number>;
  }) {
    const lexicalFallbackStartedAt = Date.now();
    const lexicalCandidates =
      input.lexicalCandidates ??
      (await this.getLexicalCandidates({
        kbId: input.kbId,
        query: input.query,
        limit: input.candidateLimit,
        filters: input.filters,
        documentVersions: input.documentVersions
      }));
    const phaseTiming = input.phaseTiming ?? {
      lexicalSearchMs: null,
      vectorEmbeddingMs: null,
      vectorSearchMs: null,
      vectorCandidateFetchMs: null,
      mergeCandidatesMs: null,
      diverseSelectionMs: null,
      rankMs: null,
      chunkWindowMs: null,
      lexicalFallbackMs: null
    };
    if (input.lexicalCandidates == null && phaseTiming.lexicalSearchMs == null) {
      phaseTiming.lexicalSearchMs = Date.now() - lexicalFallbackStartedAt;
    }
    const diverseCandidates = this.selectDiverseCandidates(lexicalCandidates, input.candidateLimit);
    const ranked = await this.rankCandidates(diverseCandidates, {
      enableRerank: input.enableRerank ?? false,
      rerankMode: input.rerankMode,
      query: input.query,
      scoreThreshold: input.scoreThreshold,
      topK: input.topK
    });

    if (ranked.length > 0) {
      const chunkWindowStartedAt = Date.now();
      const retrievedChunks = await this.expandChunkWindow(
        input.kbId,
        ranked,
        input.chunkWindow ?? 0,
        input.filters,
        input.documentVersions
      );
      phaseTiming.chunkWindowMs = Date.now() - chunkWindowStartedAt;
      phaseTiming.lexicalFallbackMs = Date.now() - lexicalFallbackStartedAt;
      return this.buildRetrievalResult(retrievedChunks, {
        embedding: input.embedding,
        actualMode: input.actualMode,
        usedFallback: input.usedFallback,
        fallbackReason: input.fallbackReason,
        rerankApplied: input.rerankApplied,
        rerankMode: input.rerankMode,
        rerankJudgeSkippedReason: input.rerankJudgeSkippedReason,
        chunkWindowApplied: (input.chunkWindow ?? 0) > 0,
        vectorSearchAttempted: input.usedFallback,
        lexicalSearchAttempted: true,
        vectorCandidateLimitHit: input.vectorCandidateCount >= input.candidateLimit,
        lexicalCandidateLimitHit: lexicalCandidates.length >= input.candidateLimit,
        rankingTopKHit: ranked.length >= input.topK,
        candidateLimit: input.candidateLimit,
        vectorCandidateCount: input.vectorCandidateCount,
        lexicalCandidateCount: lexicalCandidates.length,
        mergedCandidateCount: lexicalCandidates.length,
        rankedCandidateCount: ranked.length,
        timing: phaseTiming
      });
    }
    phaseTiming.lexicalFallbackMs = Date.now() - lexicalFallbackStartedAt;
    return this.buildRetrievalResult([], {
      embedding: input.embedding,
      actualMode: input.actualMode,
      usedFallback: input.usedFallback,
      fallbackReason: input.fallbackReason,
      rerankApplied: input.rerankApplied,
      rerankMode: input.rerankMode,
      rerankJudgeSkippedReason: input.rerankJudgeSkippedReason,
      chunkWindowApplied: false,
      vectorSearchAttempted: input.usedFallback,
      lexicalSearchAttempted: true,
      vectorCandidateLimitHit: input.vectorCandidateCount >= input.candidateLimit,
      lexicalCandidateLimitHit: lexicalCandidates.length >= input.candidateLimit,
      rankingTopKHit: false,
      candidateLimit: input.candidateLimit,
      vectorCandidateCount: input.vectorCandidateCount,
      lexicalCandidateCount: lexicalCandidates.length,
      mergedCandidateCount: lexicalCandidates.length,
      rankedCandidateCount: 0,
      timing: phaseTiming
    });
  }

  private async getLexicalCandidates(input: {
    kbId: string;
    query: string;
    limit: number;
    filters?: RetrievalProfileFilters;
    documentVersions?: Record<string, number>;
  }): Promise<RetrievalCandidate[]> {
    if (typeof this.prisma.$queryRaw === "function") {
      return this.getLexicalCandidatesFromDatabase(input);
    }

    const chunks = await this.prisma.documentChunk.findMany({
      where: this.buildChunkWhere(input.kbId, input.filters, input.documentVersions),
      select: {
        id: true,
        documentId: true,
        chunkIndex: true,
        content: true,
        sectionTitle: true,
        metadataJson: true,
        pageNo: true,
        document: {
          select: {
            title: true
          }
        }
      }
    });

    const terms = this.tokenize(input.query);

    return chunks
      .map((chunk): RetrievalCandidate => {
        const chunkMetadata = this.readChunkMetadata(chunk.metadataJson);
        const lexicalScore = this.scoreChunk(
          chunk.content,
          chunk.sectionTitle,
          terms,
          input.query,
          chunkMetadata
        );
        const matchSource = this.resolveMatchSource(chunk.content, chunk.sectionTitle, input.query, terms);

        return {
          chunkId: chunk.id,
          documentId: chunk.documentId,
          documentTitle: chunk.document.title,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: lexicalScore,
          isPrimary: true,
          lexicalScore,
          vectorScore: 0,
          hybridScore: lexicalScore,
          rerankScore: lexicalScore,
          pageNo: chunk.pageNo,
          sectionTitle: chunk.sectionTitle,
          matchSource: matchSource as RetrievedChunk["matchSource"],
          headingPath: chunkMetadata.headingPath,
          blockType: chunkMetadata.blockType,
          listOrdinal: chunkMetadata.listOrdinal,
          isTableLike: chunkMetadata.isTableLike
        };
      })
      .sort((left, right) => right.lexicalScore - left.lexicalScore)
      .slice(0, input.limit);
  }

  private async getLexicalCandidatesFromDatabase(input: {
    kbId: string;
    query: string;
    limit: number;
    filters?: RetrievalProfileFilters;
    documentVersions?: Record<string, number>;
  }): Promise<RetrievalCandidate[]> {
    const terms = this.tokenize(input.query);
    const fullQuery = terms.join(" ").trim();

    if (terms.length === 0 && fullQuery.length === 0) {
      return [];
    }

    const lexicalScoreSql = this.buildLexicalScoreSql(terms, fullQuery);
    const lexicalMatchSql = this.buildLexicalMatchSql(terms, fullQuery);
    const filterSql = this.buildLexicalFilterSql(input.kbId, input.filters, input.documentVersions);

    const chunks = await this.prisma.$queryRaw<Array<{
      chunkId: string;
      documentId: string;
      documentTitle: string;
      chunkIndex: number;
      content: string;
      sectionTitle: string | null;
      pageNo: number | null;
      metadataJson: Prisma.JsonValue | null;
      lexicalScore: number;
      matchSource: "fts" | "section_title" | "like_fallback";
    }>>(
      Prisma.sql`
        SELECT
          c."id" AS "chunkId",
          c."documentId" AS "documentId",
          d."title" AS "documentTitle",
          c."chunkIndex" AS "chunkIndex",
          c."content" AS "content",
          c."sectionTitle" AS "sectionTitle",
          c."pageNo" AS "pageNo",
          c."metadataJson" AS "metadataJson",
          ${lexicalScoreSql} AS "lexicalScore"
          ,
          ${this.buildLexicalMatchSourceSql(terms, fullQuery)} AS "matchSource"
        FROM "DocumentChunk" c
        JOIN "Document" d ON d."id" = c."documentId"
        WHERE ${filterSql}
          AND (${lexicalMatchSql})
        ORDER BY "lexicalScore" DESC, c."documentId" ASC, c."chunkIndex" ASC
        LIMIT ${input.limit}
      `
    );

    return chunks.map((chunk): RetrievalCandidate => {
      const chunkMetadata = this.readChunkMetadata(chunk.metadataJson);
      const score = Number(chunk.lexicalScore);

      return {
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        score,
        isPrimary: true,
        lexicalScore: score,
        vectorScore: 0,
        hybridScore: score,
        rerankScore: score,
        pageNo: chunk.pageNo,
        sectionTitle: chunk.sectionTitle,
        matchSource: chunk.matchSource as RetrievedChunk["matchSource"],
        headingPath: chunkMetadata.headingPath,
        blockType: chunkMetadata.blockType,
        listOrdinal: chunkMetadata.listOrdinal,
        isTableLike: chunkMetadata.isTableLike
      };
    });
  }

  private async getVectorCandidates(
    vectorMatches: Array<{ chunkId: string; score: number }>,
    existingCandidates?: RetrievalCandidate[]
  ) {
    const existingCandidateMap = new Map((existingCandidates ?? []).map(candidate => [candidate.chunkId, candidate]));
    const missingMatchIds = vectorMatches
      .filter(match => !existingCandidateMap.has(match.chunkId))
      .map(match => match.chunkId);
    const chunks = missingMatchIds.length === 0
      ? []
      : await this.prisma.documentChunk.findMany({
          where: {
            id: {
              in: missingMatchIds
            }
          },
          select: {
            id: true,
            documentId: true,
            chunkIndex: true,
            content: true,
            sectionTitle: true,
            metadataJson: true,
            pageNo: true,
            document: {
              select: {
                title: true
              }
            }
          }
        });

    const chunkMap = new Map(chunks.map(chunk => [chunk.id, chunk]));

    return vectorMatches
      .map((match): RetrievalCandidate | null => {
        const existingCandidate = existingCandidateMap.get(match.chunkId);
        if (existingCandidate) {
          return {
            ...existingCandidate,
            score: match.score,
            isPrimary: true,
            lexicalScore: 0,
            vectorScore: match.score,
            hybridScore: match.score,
            rerankScore: match.score,
            matchSource: "vector"
          };
        }

        const chunk = chunkMap.get(match.chunkId);
        if (!chunk) {
          return null;
        }

        const chunkMetadata = this.readChunkMetadata(chunk.metadataJson);
        return {
          chunkId: chunk.id,
          documentId: chunk.documentId,
          documentTitle: chunk.document.title,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: match.score,
          isPrimary: true,
          lexicalScore: 0,
          vectorScore: match.score,
          hybridScore: match.score,
          rerankScore: match.score,
          pageNo: chunk.pageNo,
          sectionTitle: chunk.sectionTitle,
          matchSource: "vector" as const,
          headingPath: chunkMetadata.headingPath,
          blockType: chunkMetadata.blockType,
          listOrdinal: chunkMetadata.listOrdinal,
          isTableLike: chunkMetadata.isTableLike
        };
      })
      .filter((chunk): chunk is RetrievalCandidate => chunk !== null);
  }

  private mergeHybridCandidates(
    vectorCandidates: RetrievalCandidate[],
    lexicalCandidates: RetrievalCandidate[],
    strategy?: ResolvedRetrievalStrategy
  ) {
    const merged = new Map<string, RetrievalCandidate>();
    const lexicalMaxScore = Math.max(...lexicalCandidates.map(candidate => candidate.lexicalScore), 0);
    const vectorWeight = strategy?.hybrid.vectorWeight ?? 0.7;
    const lexicalWeight = strategy?.hybrid.lexicalWeight ?? 0.3;
    const totalWeight = vectorWeight + lexicalWeight;
    const normalizedVectorWeight = totalWeight > 0 ? vectorWeight / totalWeight : 0.7;
    const normalizedLexicalWeight = totalWeight > 0 ? lexicalWeight / totalWeight : 0.3;

    for (const candidate of vectorCandidates) {
      const score = candidate.vectorScore * normalizedVectorWeight;
      merged.set(candidate.chunkId, {
        ...candidate,
        score,
        hybridScore: score,
        rerankScore: score
      });
    }

    for (const lexicalCandidate of lexicalCandidates) {
      const existing = merged.get(lexicalCandidate.chunkId);
      const lexicalWeight = lexicalMaxScore > 0 ? lexicalCandidate.lexicalScore / lexicalMaxScore : 0;

      if (existing) {
        const score =
          existing.vectorScore * normalizedVectorWeight + lexicalWeight * normalizedLexicalWeight;
        merged.set(lexicalCandidate.chunkId, {
          ...existing,
          lexicalScore: lexicalCandidate.lexicalScore,
          score,
          hybridScore: score,
          rerankScore: score
        });
        continue;
      }

      const score = lexicalWeight * normalizedLexicalWeight;
      merged.set(lexicalCandidate.chunkId, {
        ...lexicalCandidate,
        score,
        hybridScore: score,
        rerankScore: score
      });
    }

    return Array.from(merged.values());
  }

  private selectDiverseCandidates(candidates: RetrievalCandidate[], limit: number) {
    if (candidates.length <= 2) {
      return candidates;
    }

    const buckets = new Map<string, RetrievalCandidate[]>();

    for (const candidate of candidates) {
      const key = `${candidate.documentId}:${this.buildSectionDiversityKey(candidate)}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(candidate);
      buckets.set(key, bucket);
    }

    const firstPass: RetrievalCandidate[] = [];
    const secondPass: RetrievalCandidate[] = [];
    const usedChunkIds = new Set<string>();

    for (const bucket of buckets.values()) {
      bucket.sort((left, right) => right.score - left.score);

      const first = bucket[0];
      if (first) {
        firstPass.push(first);
        usedChunkIds.add(first.chunkId);
      }

      const second = bucket[1];
      if (second) {
        secondPass.push(second);
      }
    }

    firstPass.sort((left, right) => right.score - left.score);
    if (firstPass.length >= limit) {
      return firstPass.slice(0, limit);
    }

    secondPass.sort((left, right) => right.score - left.score);
    const fill = secondPass.filter(candidate => !usedChunkIds.has(candidate.chunkId));

    return [...firstPass, ...fill].slice(0, limit);
  }

  private buildSectionDiversityKey(candidate: RetrievalCandidate) {
    const raw =
      candidate.sectionTitle?.trim() ||
      this.extractFirstHeading(candidate.content) ||
      candidate.documentTitle;

    return raw
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[�?�?].*$/, "")
      .trim();
  }

  private extractFirstHeading(content: string) {
    const headingMatch = content.match(/^\s{0,3}#{1,6}\s+(.+)$/m);
    if (headingMatch?.[1]) {
      return headingMatch[1].trim();
    }

    return content.replace(/\s+/g, " ").trim().slice(0, 80);
  }

  private async rankCandidates(
    candidates: RetrievalCandidate[],
    input: {
      query: string;
      topK: number;
      scoreThreshold: number;
      enableRerank: boolean;
      rerankMode: "off" | "local_heuristic" | "llm_judge";
    }
  ) {
    const judgeSkipReason = this.resolveJudgeRerankSkipReason({
      candidates,
      query: input.query,
      rerankMode: input.rerankMode
    });
    const useJudgeRerank = input.enableRerank && input.rerankMode === "llm_judge" && judgeSkipReason == null;
    const effectiveRerankMode = useJudgeRerank ? "llm_judge" : "local_heuristic";
    const reranked = useJudgeRerank
      ? await this.rankCandidatesWithJudge(candidates, input.query)
      : input.enableRerank
        ? candidates.map(candidate => ({
            ...candidate,
            rerankScore: this.computeRerankScore(candidate, input.query, effectiveRerankMode)
          }))
        : candidates;

    return reranked
      .filter(candidate => candidate.score >= input.scoreThreshold || candidate.lexicalScore >= input.scoreThreshold)
      .sort((left, right) => {
        const leftScore = input.enableRerank ? left.rerankScore : left.score;
        const rightScore = input.enableRerank ? right.rerankScore : right.score;

        return rightScore - leftScore;
      })
      .slice(0, input.topK)
      .map(candidate => ({
        chunkId: candidate.chunkId,
        documentId: candidate.documentId,
        documentTitle: candidate.documentTitle,
        chunkIndex: candidate.chunkIndex,
        content: candidate.content,
        score: input.enableRerank ? candidate.rerankScore : candidate.score,
        isPrimary: candidate.isPrimary,
        lexicalScore: candidate.lexicalScore,
        vectorScore: candidate.vectorScore,
        hybridScore: candidate.hybridScore,
        rerankScore: candidate.rerankScore,
        pageNo: candidate.pageNo,
        sectionTitle: candidate.sectionTitle,
        matchSource: candidate.matchSource
      }));
  }

  private resolveJudgeRerankSkipReason(input: {
    candidates: RetrievalCandidate[];
    query: string;
    rerankMode: "off" | "local_heuristic" | "llm_judge";
  }) {
    if (input.rerankMode !== "llm_judge") {
      return null;
    }

    if (!this.llmService?.generateRawCompletion || !this.promptManager?.buildJudgeRerankPrompt) {
      return "judge_dependencies_missing";
    }

    if (input.candidates.length > 8) {
      return "candidate_set_too_large";
    }

    if (!this.isJudgeWorthQuestion(input.query)) {
      return "query_too_simple";
    }

    return null;
  }

  private isJudgeWorthQuestion(query: string) {
    const normalized = query.toLowerCase().trim();
    const termCount = this.tokenize(query).length;
    if (termCount >= 6 || normalized.length >= 24) {
      return true;
    }

    return /compare|difference|vs|区别|对比|summary|summarize|list|总结|列举|概括|troubleshoot|problem|issue|why|how/.test(normalized);
  }

  private async rankCandidatesWithJudge(candidates: RetrievalCandidate[], query: string) {
    const limit = Math.min(12, candidates.length);
    const judgeCandidates = candidates.slice(0, limit);
    if (judgeCandidates.length === 0) {
      return candidates;
    }

    try {
      if (!this.llmService?.generateRawCompletion || !this.promptManager?.buildJudgeRerankPrompt) {
        throw new Error("LLM judge rerank is unavailable.");
      }

      const prompt = this.promptManager.buildJudgeRerankPrompt({
        question: query,
        candidates: judgeCandidates
      });
      const rawRanking = await this.llmService.generateRawCompletion({
        prompt
      });
      const rankedChunkIds = this.parseJudgeRanking(rawRanking, judgeCandidates.map(candidate => candidate.chunkId));

      if (rankedChunkIds.length === 0) {
        return candidates.map(candidate => ({
          ...candidate,
          rerankScore: this.computeRerankScore(candidate, query, "local_heuristic")
        }));
      }

      const rankedIdSet = new Map(rankedChunkIds.map((chunkId, index) => [chunkId, index]));
      return candidates
        .map(candidate => ({
          ...candidate,
          rerankScore:
            rankedIdSet.has(candidate.chunkId)
              ? candidates.length - (rankedIdSet.get(candidate.chunkId) ?? 0)
              : this.computeRerankScore(candidate, query, "local_heuristic") - candidates.length
        }))
        .sort((left, right) => right.rerankScore - left.rerankScore);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown judge rerank error.";
      this.logger.warn(`LLM judge rerank failed, falling back to local heuristic. ${message}`);
      return candidates.map(candidate => ({
        ...candidate,
        rerankScore: this.computeRerankScore(candidate, query, "local_heuristic")
      }));
    }
  }

  private parseJudgeRanking(rawRanking: string, allowedChunkIds: string[]) {
    const allowed = new Set(allowedChunkIds);
    const normalized = rawRanking.trim();
    const candidates = [normalized];
    const fenced = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      candidates.push(fenced[1].trim());
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate) as { ranking?: unknown };
        if (!parsed || !Array.isArray(parsed.ranking)) {
          continue;
        }

        const ranking = parsed.ranking.filter((item): item is string => typeof item === "string" && allowed.has(item));
        if (ranking.length > 0) {
          return Array.from(new Set(ranking));
        }
      } catch {
        continue;
      }
    }

    return [];
  }

  private tokenize(query: string) {
    return query
      .toLowerCase()
      .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
      .filter(term => term.length > 0);
  }

  private scoreChunk(
    content: string,
    sectionTitle: string | null,
    terms: string[],
    query: string,
    metadata?: ReturnType<RetrievalService["readChunkMetadata"]>
  ) {
    const normalized = content.toLowerCase();
    const normalizedSectionTitle = sectionTitle?.toLowerCase() ?? "";
    const normalizedTerms = terms;
    const normalizedQuery = query.toLowerCase().trim();
    let score = 0;

    if (normalizedQuery.length > 0 && normalized.includes(normalizedQuery)) {
      score += 6;
    }

    if (normalizedQuery.length > 0 && normalizedSectionTitle.includes(normalizedQuery)) {
      score += 8;
    }

    for (const term of normalizedTerms) {
      if (normalized.includes(term)) {
        score += 1;
      }
      if (normalizedSectionTitle.includes(term)) {
        score += 2;
      }
    }

    score += this.computeStructureBoost(query, metadata);

    return score;
  }

  private computeRerankScore(
    candidate: RetrievalCandidate,
    query: string,
    rerankMode: "off" | "local_heuristic" | "llm_judge"
  ) {
    const terms = this.tokenize(query);
    const normalizedQuery = query.toLowerCase().trim();
    const lexicalBoost = this.scoreChunk(
      candidate.content,
      candidate.sectionTitle,
      terms,
      query,
      {
        headingPath: candidate.headingPath ?? [],
        blockType: candidate.blockType ?? "paragraph",
        listOrdinal: candidate.listOrdinal ?? null,
        isTableLike: candidate.isTableLike ?? false
      }
    );
    const exactPhraseBoost = candidate.content.toLowerCase().includes(normalizedQuery) ? 3 : 0;
    const titleBoost = candidate.sectionTitle?.toLowerCase().includes(normalizedQuery) ? 4 : 0;
    const judgeBoost = rerankMode === "llm_judge"
      ? this.computeJudgeLikeBoost(candidate, query)
      : 0;

    return candidate.score + lexicalBoost * 0.15 + exactPhraseBoost + titleBoost + judgeBoost;
  }

  private async expandChunkWindow(
    kbId: string,
    chunks: RetrievedChunk[],
    chunkWindow: number,
    filters?: RetrievalProfileFilters,
    documentVersions?: Record<string, number>
  ): Promise<RetrievedChunk[]> {
    if (chunkWindow <= 0 || chunks.length === 0) {
      return chunks;
    }

    const requestedPositions = new Map<string, { score: number; primary: boolean }>();
    const existingChunkPositions = new Map<string, RetrievedChunk>();
    for (const chunk of chunks) {
      existingChunkPositions.set(`${chunk.documentId}:${chunk.chunkIndex}`, chunk);
      for (let index = chunk.chunkIndex - chunkWindow; index <= chunk.chunkIndex + chunkWindow; index += 1) {
        if (index < 0) {
          continue;
        }

        const key = `${chunk.documentId}:${index}`;
        const existing = requestedPositions.get(key);
        const isPrimary = index === chunk.chunkIndex;
        if (!existing || chunk.score > existing.score || (isPrimary && !existing.primary)) {
          requestedPositions.set(key, {
            score: chunk.score,
            primary: isPrimary
          });
        }
      }
    }

    const missingPositionEntries = Array.from(requestedPositions.keys())
      .filter(key => !existingChunkPositions.has(key))
      .map(key => {
        const [documentId, chunkIndex] = key.split(":");
        return {
          documentId,
          chunkIndex: Number.parseInt(chunkIndex ?? "0", 10)
        };
      });

    const groupedRanges = new Map<string, Array<{ start: number; end: number }>>();
    const sortedMissingEntries = missingPositionEntries.sort((left, right) =>
      left.documentId === right.documentId
        ? left.chunkIndex - right.chunkIndex
        : left.documentId.localeCompare(right.documentId)
    );
    for (const entry of sortedMissingEntries) {
      const ranges = groupedRanges.get(entry.documentId) ?? [];
      const lastRange = ranges[ranges.length - 1];
      if (lastRange && entry.chunkIndex <= lastRange.end + 1) {
        lastRange.end = Math.max(lastRange.end, entry.chunkIndex);
      } else {
        ranges.push({
          start: entry.chunkIndex,
          end: entry.chunkIndex
        });
      }
      groupedRanges.set(entry.documentId, ranges);
    }

    const rangeClauses = Array.from(groupedRanges.entries()).flatMap(([documentId, ranges]) =>
      ranges.map(range => ({
        documentId,
        chunkIndex: {
          gte: range.start,
          lte: range.end
        }
      }))
    );

    const fetchedExpandedChunks = rangeClauses.length === 0
      ? []
      : await this.prisma.documentChunk.findMany({
          where: {
            ...this.buildChunkWhere(kbId, filters, documentVersions),
            OR: rangeClauses
          },
          select: {
            id: true,
            documentId: true,
            chunkIndex: true,
            content: true,
            sectionTitle: true,
            metadataJson: true,
            pageNo: true,
            document: {
              select: {
                title: true
              }
            }
          },
          orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }]
        });

    const normalizedExistingChunks: ExpandedChunkRow[] = chunks.map(chunk => ({
      id: chunk.chunkId,
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      sectionTitle: chunk.sectionTitle,
      metadataJson: {
        headingPath: chunk.headingPath ?? [],
        blockType: chunk.blockType ?? "paragraph",
        listOrdinal: chunk.listOrdinal ?? null,
        isTableLike: chunk.isTableLike ?? false
      },
      pageNo: chunk.pageNo,
      document: {
        title: chunk.documentTitle
      }
    }));

    const dedupedExpandedChunks = new Map<string, ExpandedChunkRow>();
    for (const chunk of [...normalizedExistingChunks, ...fetchedExpandedChunks]) {
      dedupedExpandedChunks.set(`${chunk.documentId}:${chunk.chunkIndex}`, chunk);
    }
    const expandedChunks = Array.from(dedupedExpandedChunks.values()).sort((left, right) =>
      left.documentId === right.documentId
        ? left.chunkIndex - right.chunkIndex
        : left.documentId.localeCompare(right.documentId)
    );

    const chunkMap = new Map(chunks.map(chunk => [chunk.chunkId, chunk]));

    return expandedChunks
      .filter(chunk => requestedPositions.has(`${chunk.documentId}:${chunk.chunkIndex}`))
      .map((chunk): RetrievedChunk => {
        const key = `${chunk.documentId}:${chunk.chunkIndex}`;
        const requested = requestedPositions.get(key);
        const primaryChunk = chunkMap.get(chunk.id);

        const chunkMetadata = this.readChunkMetadata(chunk.metadataJson);
        return {
          chunkId: chunk.id,
          documentId: chunk.documentId,
          documentTitle: chunk.document.title,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: primaryChunk?.score ?? requested?.score ?? 0,
          isPrimary: requested?.primary ?? false,
          pageNo: chunk.pageNo,
          sectionTitle: chunk.sectionTitle,
          matchSource: (primaryChunk?.matchSource ?? "like_fallback") as RetrievedChunk["matchSource"],
          headingPath: chunkMetadata.headingPath,
          blockType: chunkMetadata.blockType,
          listOrdinal: chunkMetadata.listOrdinal,
          isTableLike: chunkMetadata.isTableLike
        };
      });
  }

  private async expandVectorMatchesWithChunkWindow(
    kbId: string,
    vectorMatches: Array<{ chunkId: string; documentId: string; chunkIndex: number; score: number }>,
    chunkWindow: number,
    filters?: RetrievalProfileFilters,
    documentVersions?: Record<string, number>
  ): Promise<RetrievedChunk[]> {
    if (vectorMatches.length === 0) {
      return [];
    }

    const requestedPositions = new Map<string, { score: number; primary: boolean }>();
    const primaryChunkIds = new Set(vectorMatches.map(match => match.chunkId));
    const scoreByChunkId = new Map(vectorMatches.map(match => [match.chunkId, match.score]));

    for (const match of vectorMatches) {
      for (let index = match.chunkIndex - chunkWindow; index <= match.chunkIndex + chunkWindow; index += 1) {
        if (index < 0) {
          continue;
        }

        const key = `${match.documentId}:${index}`;
        const existing = requestedPositions.get(key);
        const score = scoreByChunkId.get(match.chunkId) ?? 0;
        const isPrimary = index === match.chunkIndex;
        if (!existing || score > existing.score || (isPrimary && !existing.primary)) {
          requestedPositions.set(key, {
            score,
            primary: isPrimary
          });
        }
      }
    }

    const groupedRanges = new Map<string, Array<{ start: number; end: number }>>();
    const sortedRequestedEntries = Array.from(requestedPositions.keys())
      .map(key => {
        const [documentId, chunkIndex] = key.split(":");
        return {
          documentId,
          chunkIndex: Number.parseInt(chunkIndex ?? "0", 10)
        };
      })
      .sort((left, right) =>
        left.documentId === right.documentId
          ? left.chunkIndex - right.chunkIndex
          : left.documentId.localeCompare(right.documentId)
      );

    for (const entry of sortedRequestedEntries) {
      const ranges = groupedRanges.get(entry.documentId) ?? [];
      const lastRange = ranges[ranges.length - 1];
      if (lastRange && entry.chunkIndex <= lastRange.end + 1) {
        lastRange.end = Math.max(lastRange.end, entry.chunkIndex);
      } else {
        ranges.push({
          start: entry.chunkIndex,
          end: entry.chunkIndex
        });
      }
      groupedRanges.set(entry.documentId, ranges);
    }

    const rangeClauses = Array.from(groupedRanges.entries()).flatMap(([documentId, ranges]) =>
      ranges.map(range => ({
        documentId,
        chunkIndex: {
          gte: range.start,
          lte: range.end
        }
      }))
    );

    const expandedChunks = rangeClauses.length === 0
      ? []
      : await this.prisma.documentChunk.findMany({
          where: {
            ...this.buildChunkWhere(kbId, filters, documentVersions),
            OR: rangeClauses
          },
          select: {
            id: true,
            documentId: true,
            chunkIndex: true,
            content: true,
            sectionTitle: true,
            metadataJson: true,
            pageNo: true,
            document: {
              select: {
                title: true
              }
            }
          },
          orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }]
        });

    return expandedChunks
      .filter(chunk => requestedPositions.has(`${chunk.documentId}:${chunk.chunkIndex}`))
      .map((chunk): RetrievedChunk => {
        const requested = requestedPositions.get(`${chunk.documentId}:${chunk.chunkIndex}`);
        const chunkMetadata = this.readChunkMetadata(chunk.metadataJson);
        return {
          chunkId: chunk.id,
          documentId: chunk.documentId,
          documentTitle: chunk.document.title,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: scoreByChunkId.get(chunk.id) ?? requested?.score ?? 0,
          isPrimary: requested?.primary ?? false,
          pageNo: chunk.pageNo,
          sectionTitle: chunk.sectionTitle,
          matchSource: primaryChunkIds.has(chunk.id) ? "vector" : "like_fallback",
          headingPath: chunkMetadata.headingPath,
          blockType: chunkMetadata.blockType,
          listOrdinal: chunkMetadata.listOrdinal,
          isTableLike: chunkMetadata.isTableLike
        };
      });
  }

  private buildRetrievalResult(
    retrievedChunks: RetrievedChunk[],
    input: {
      embedding: RetrievalResult["embedding"];
      actualMode: RetrievalResult["execution"]["actualMode"];
      usedFallback: RetrievalResult["execution"]["usedFallback"];
      fallbackReason: RetrievalResult["execution"]["fallbackReason"];
      rerankApplied: RetrievalResult["execution"]["rerankApplied"];
      rerankMode: RetrievalResult["execution"]["rerankMode"];
      rerankJudgeSkippedReason: RetrievalResult["execution"]["rerankJudgeSkippedReason"];
      chunkWindowApplied: RetrievalResult["execution"]["chunkWindowApplied"];
      vectorSearchAttempted: RetrievalResult["execution"]["vectorSearchAttempted"];
      lexicalSearchAttempted: RetrievalResult["execution"]["lexicalSearchAttempted"];
      vectorCandidateLimitHit: RetrievalResult["execution"]["vectorCandidateLimitHit"];
      lexicalCandidateLimitHit: RetrievalResult["execution"]["lexicalCandidateLimitHit"];
      rankingTopKHit: RetrievalResult["execution"]["rankingTopKHit"];
      candidateLimit: RetrievalResult["execution"]["candidateLimit"];
      vectorCandidateCount: RetrievalResult["execution"]["vectorCandidateCount"];
      lexicalCandidateCount: RetrievalResult["execution"]["lexicalCandidateCount"];
      mergedCandidateCount: RetrievalResult["execution"]["mergedCandidateCount"];
      rankedCandidateCount: RetrievalResult["execution"]["rankedCandidateCount"];
      timing?: RetrievalResult["execution"]["timing"];
    }
  ): RetrievalResult {
    return {
      retrievedChunks,
      contextGroups: this.buildContextGroups(retrievedChunks),
      embedding: input.embedding,
      execution: {
        actualMode: input.actualMode,
        usedFallback: input.usedFallback,
        fallbackReason: input.fallbackReason,
        rerankApplied: input.rerankApplied,
        rerankMode: input.rerankMode,
        rerankJudgeSkippedReason: input.rerankJudgeSkippedReason,
        chunkWindowApplied: input.chunkWindowApplied,
        vectorSearchAttempted: input.vectorSearchAttempted,
        lexicalSearchAttempted: input.lexicalSearchAttempted,
        vectorCandidateLimitHit: input.vectorCandidateLimitHit,
        lexicalCandidateLimitHit: input.lexicalCandidateLimitHit,
        rankingTopKHit: input.rankingTopKHit,
        candidateLimit: input.candidateLimit,
        vectorCandidateCount: input.vectorCandidateCount,
        lexicalCandidateCount: input.lexicalCandidateCount,
        mergedCandidateCount: input.mergedCandidateCount,
        rankedCandidateCount: input.rankedCandidateCount,
        timing: input.timing
      }
    };
  }

  private normalizeVectorSearchResult(
    queryEmbedding: Awaited<ReturnType<EmbeddingService["embedQuery"]>>,
    result: VectorSearchResult | VectorSearchMatch[]
  ): VectorSearchResult {
    if (Array.isArray(result)) {
      if (!queryEmbedding || !("provenance" in queryEmbedding) || !queryEmbedding.provenance) {
        return {
          matches: result,
          embedding: null
        };
      }

      return {
        matches: result,
        embedding: {
          active: {
            provider: queryEmbedding.provider,
            model: queryEmbedding.model,
            modelName: queryEmbedding.modelName,
            dimensions: queryEmbedding.dimensions,
            modelSource: queryEmbedding.provenance.modelSource,
            dimensionsSource: queryEmbedding.provenance.dimensionsSource,
            fallbackState: queryEmbedding.provenance.fallback
          },
          indexed: null
        }
      };
    }

    return result;
  }

  private buildContextGroups(chunks: RetrievedChunk[]): RetrievalContextGroup[] {
    if (chunks.length === 0) {
      return [];
    }

    const sortedChunks = [...chunks].sort((left, right) => {
      if (left.documentId !== right.documentId) {
        return left.documentId.localeCompare(right.documentId);
      }

      return left.chunkIndex - right.chunkIndex;
    });
    const groups: RetrievalContextGroup[] = [];
    let currentGroupChunks: RetrievedChunk[] = [];

    for (const chunk of sortedChunks) {
      const previousChunk = currentGroupChunks[currentGroupChunks.length - 1];
      const isContiguous =
        previousChunk &&
        previousChunk.documentId === chunk.documentId &&
        previousChunk.chunkIndex + 1 === chunk.chunkIndex;

      if (!isContiguous && currentGroupChunks.length > 0) {
        groups.push(this.createContextGroup(currentGroupChunks));
        currentGroupChunks = [];
      }

      currentGroupChunks.push(chunk);
    }

    if (currentGroupChunks.length > 0) {
      groups.push(this.createContextGroup(currentGroupChunks));
    }

    return groups;
  }

  private createContextGroup(chunks: RetrievedChunk[]): RetrievalContextGroup {
    const firstChunk = chunks[0];
    const lastChunk = chunks[chunks.length - 1];

    return {
      documentId: firstChunk.documentId,
      documentTitle: firstChunk.documentTitle,
      startChunkIndex: firstChunk.chunkIndex,
      endChunkIndex: lastChunk.chunkIndex,
      chunkIds: chunks.map(chunk => chunk.chunkId),
      primaryChunkIds: chunks.filter(chunk => chunk.isPrimary).map(chunk => chunk.chunkId),
      mergedContent: chunks.map(chunk => chunk.content).join("\n\n"),
      pageNumbers: this.collectUniqueValues(chunks.map(chunk => chunk.pageNo)),
      sectionTitles: this.collectUniqueValues(chunks.map(chunk => chunk.sectionTitle))
    };
  }

  private collectUniqueValues<T>(values: Array<T | null | undefined>) {
    const uniqueValues: T[] = [];
    const seen = new Set<T>();

    for (const value of values) {
      if (value == null || seen.has(value)) {
        continue;
      }

      seen.add(value);
      uniqueValues.push(value);
    }

    return uniqueValues;
  }

  private buildChunkWhere(kbId: string, filters?: RetrievalProfileFilters, documentVersions?: Record<string, number>): Prisma.DocumentChunkWhereInput {
    if (!filters && !documentVersions) {
      return {
        kbId
      };
    }

    const directWhere: Prisma.DocumentChunkWhereInput = {
      kbId
    };
    const extraPositiveClauses: Prisma.DocumentChunkWhereInput[] = [];
    const negativeClauses: Prisma.DocumentChunkWhereInput[] = [];

    if (filters?.documentIds?.include) {
      directWhere.documentId = {
        in: filters.documentIds.include
      };
    }

    if (filters?.documentIds?.exclude) {
      negativeClauses.push({
        documentId: {
          in: filters.documentIds.exclude
        }
      });
    }

    const sectionTitleClauses: Prisma.DocumentChunkWhereInput[] = [];
    if (filters?.sectionTitles?.include) {
      sectionTitleClauses.push({
        sectionTitle: {
          in: filters.sectionTitles.include
        }
      });
    }

    if (filters?.sectionTitles?.contains) {
      sectionTitleClauses.push(
        ...filters.sectionTitles.contains.map(sectionTitle => ({
          sectionTitle: {
            contains: sectionTitle,
            mode: Prisma.QueryMode.insensitive
          }
        }))
      );
    }

    if (sectionTitleClauses.length === 1) {
      Object.assign(directWhere, sectionTitleClauses[0]);
    } else if (sectionTitleClauses.length > 1) {
      extraPositiveClauses.push({
        OR: sectionTitleClauses
      });
    }

    if (filters?.sectionTitles?.exclude) {
      negativeClauses.push({
        sectionTitle: {
          in: filters.sectionTitles.exclude
        }
      });
    }

    const pageNumberClauses: Prisma.DocumentChunkWhereInput[] = [];
    if (filters?.pageNumbers?.include) {
      pageNumberClauses.push({
        pageNo: {
          in: filters.pageNumbers.include
        }
      });
    }

    if (filters?.pageNumbers?.min !== undefined || filters?.pageNumbers?.max !== undefined) {
      pageNumberClauses.push({
        pageNo: {
          ...(filters.pageNumbers.min !== undefined ? { gte: filters.pageNumbers.min } : {}),
          ...(filters.pageNumbers.max !== undefined ? { lte: filters.pageNumbers.max } : {})
        }
      });
    }

    if (pageNumberClauses.length === 1) {
      Object.assign(directWhere, pageNumberClauses[0]);
    } else if (pageNumberClauses.length > 1) {
      extraPositiveClauses.push({
        OR: pageNumberClauses
      });
    }

    if (filters?.pageNumbers?.exclude) {
      negativeClauses.push({
        pageNo: {
          in: filters.pageNumbers.exclude
        }
      });
    }

    // Add document version constraints if provided
    if (documentVersions && Object.keys(documentVersions).length > 0) {
      const versionClauses = Object.entries(documentVersions).map(([documentId, version]) => ({
        documentId,
        document: {
          version: {
            lte: version
          }
        }
      }));
      extraPositiveClauses.push({
        OR: versionClauses
      });
    }

    if (negativeClauses.length > 0) {
      directWhere.NOT = negativeClauses;
    }

    if (extraPositiveClauses.length === 0) {
      return directWhere;
    }

    const directWhereKeys = Object.keys(directWhere).filter(key => key !== "kbId");
    if (directWhereKeys.length === 0 && extraPositiveClauses.length === 1) {
      return {
        kbId,
        ...extraPositiveClauses[0]
      };
    }

    return {
      AND: [directWhere, ...extraPositiveClauses]
    };
  }

  private buildLexicalScoreSql(terms: string[], fullQuery: string) {
    const scoreClauses: Prisma.Sql[] = [];

    if (fullQuery.length > 0) {
      const phrasePattern = `%${fullQuery}%`;
      scoreClauses.push(Prisma.sql`CASE WHEN c."content" ILIKE ${phrasePattern} THEN 6 ELSE 0 END`);
      scoreClauses.push(Prisma.sql`CASE WHEN COALESCE(c."sectionTitle", '') ILIKE ${phrasePattern} THEN 8 ELSE 0 END`);
    }

    for (const term of terms) {
      const termPattern = `%${term}%`;
      scoreClauses.push(Prisma.sql`CASE WHEN c."content" ILIKE ${termPattern} THEN 1 ELSE 0 END`);
      scoreClauses.push(Prisma.sql`CASE WHEN COALESCE(c."sectionTitle", '') ILIKE ${termPattern} THEN 2 ELSE 0 END`);
    }

    if (scoreClauses.length === 0) {
      return Prisma.sql`0`;
    }

    return this.joinSqlClauses(scoreClauses, "+");
  }

  private buildLexicalMatchSourceSql(terms: string[], fullQuery: string) {
    if (fullQuery.length > 0) {
      const phrasePattern = `%${fullQuery}%`;
      return Prisma.sql`
        CASE
          WHEN COALESCE(c."sectionTitle", '') ILIKE ${phrasePattern} THEN 'section_title'
          WHEN c."content" ILIKE ${phrasePattern} THEN 'fts'
          ELSE 'like_fallback'
        END
      `;
    }

    if (terms.length > 0) {
      const titleChecks = terms.map(term => Prisma.sql`COALESCE(c."sectionTitle", '') ILIKE ${`%${term}%`}`);
      const contentChecks = terms.map(term => Prisma.sql`c."content" ILIKE ${`%${term}%`}`);
      return Prisma.sql`
        CASE
          WHEN ${this.joinSqlClauses(titleChecks, "OR")} THEN 'section_title'
          WHEN ${this.joinSqlClauses(contentChecks, "OR")} THEN 'fts'
          ELSE 'like_fallback'
        END
      `;
    }

    return Prisma.sql`'like_fallback'`;
  }

  private readChunkMetadata(value: Prisma.JsonValue | null) {
    const metadata = typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
    return {
      headingPath: Array.isArray(metadata.headingPath)
        ? metadata.headingPath.filter((item): item is string => typeof item === "string")
        : [],
      blockType: typeof metadata.blockType === "string"
        ? (metadata.blockType as "paragraph" | "heading" | "list" | "table" | "faq" | "quote" | "code")
        : "paragraph",
      listOrdinal: typeof metadata.listOrdinal === "number" ? metadata.listOrdinal : null,
      isTableLike: metadata.isTableLike === true
    };
  }

  private resolveMatchSource(content: string, sectionTitle: string | null, query: string, terms: string[]) {
    const normalizedQuery = query.toLowerCase().trim();
    const normalizedSectionTitle = sectionTitle?.toLowerCase() ?? "";
    const normalizedContent = content.toLowerCase();
    if (normalizedQuery && normalizedSectionTitle.includes(normalizedQuery)) {
      return "section_title" as const;
    }
    if (normalizedQuery && normalizedContent.includes(normalizedQuery)) {
      return "fts" as const;
    }
    return terms.some(term => normalizedSectionTitle.includes(term.toLowerCase()))
      ? "section_title"
      : "like_fallback";
  }

  private computeStructureBoost(
    query: string,
    metadata?: ReturnType<RetrievalService["readChunkMetadata"]>
  ) {
    if (!metadata) {
      return 0;
    }

    const normalizedQuery = query.toLowerCase();
    const isSummaryLike = /summary|summarize|list|compare|overview|步骤|总结|概括|列举|哪些|对比|区别|流程|清单/.test(normalizedQuery);
    const isFactLike = /what|when|where|who|多少钱|是什么|哪一年|版本|id|命令/.test(normalizedQuery);

    if (isSummaryLike) {
      if (metadata.blockType === "list" || metadata.blockType === "heading") {
        return 1.5;
      }
      if (metadata.blockType === "table" || metadata.isTableLike) {
        return 1.2;
      }
    }

    if (isFactLike && (metadata.blockType === "faq" || metadata.blockType === "paragraph")) {
      return 0.8;
    }

    return 0;
  }

  private computeJudgeLikeBoost(candidate: RetrievalCandidate, query: string) {
    let boost = 0;
    const normalizedQuery = query.toLowerCase();
    if (/compare|difference|vs|区别|对比/.test(normalizedQuery) && /compare|difference|vs|区别|对比/i.test(candidate.content)) {
      boost += 2;
    }
    if (/summary|summarize|list|总结|列举|概括/.test(normalizedQuery) && (candidate.blockType === "list" || candidate.blockType === "heading")) {
      boost += 1.5;
    }
    if (/troubleshoot|error|failed|异常|报错|故障/.test(normalizedQuery) && /error|failed|troubleshoot|异常|报错|故障/i.test(candidate.content)) {
      boost += 2;
    }
    return boost;
  }

  private buildLexicalMatchSql(terms: string[], fullQuery: string) {
    const matchClauses: Prisma.Sql[] = [];

    if (fullQuery.length > 0) {
      const phrasePattern = `%${fullQuery}%`;
      matchClauses.push(Prisma.sql`c."content" ILIKE ${phrasePattern}`);
      matchClauses.push(Prisma.sql`COALESCE(c."sectionTitle", '') ILIKE ${phrasePattern}`);
    }

    for (const term of terms) {
      const termPattern = `%${term}%`;
      matchClauses.push(Prisma.sql`c."content" ILIKE ${termPattern}`);
      matchClauses.push(Prisma.sql`COALESCE(c."sectionTitle", '') ILIKE ${termPattern}`);
    }

    if (matchClauses.length === 0) {
      return Prisma.sql`FALSE`;
    }

    return this.joinSqlClauses(matchClauses, "OR");
  }

  private buildLexicalFilterSql(kbId: string, filters?: RetrievalProfileFilters, documentVersions?: Record<string, number>) {
    const clauses: Prisma.Sql[] = [Prisma.sql`c."kbId" = ${kbId}`];

    if (filters?.documentIds?.include && filters.documentIds.include.length > 0) {
      clauses.push(Prisma.sql`c."documentId" IN (${Prisma.join(filters.documentIds.include)})`);
    }

    if (filters?.documentIds?.exclude && filters.documentIds.exclude.length > 0) {
      clauses.push(Prisma.sql`c."documentId" NOT IN (${Prisma.join(filters.documentIds.exclude)})`);
    }

    if (filters?.sectionTitles?.include && filters.sectionTitles.include.length > 0) {
      clauses.push(Prisma.sql`COALESCE(c."sectionTitle", '') IN (${Prisma.join(filters.sectionTitles.include)})`);
    }

    if (filters?.sectionTitles?.contains && filters.sectionTitles.contains.length > 0) {
      clauses.push(
        Prisma.sql`(${this.joinSqlClauses(
          filters.sectionTitles.contains.map(sectionTitle => Prisma.sql`COALESCE(c."sectionTitle", '') ILIKE ${`%${sectionTitle}%`}`),
          "OR"
        )})`
      );
    }

    if (filters?.sectionTitles?.exclude && filters.sectionTitles.exclude.length > 0) {
      clauses.push(Prisma.sql`COALESCE(c."sectionTitle", '') NOT IN (${Prisma.join(filters.sectionTitles.exclude)})`);
    }

    if (filters?.pageNumbers?.include && filters.pageNumbers.include.length > 0) {
      clauses.push(Prisma.sql`c."pageNo" IN (${Prisma.join(filters.pageNumbers.include)})`);
    }

    if (filters?.pageNumbers?.min !== undefined) {
      clauses.push(Prisma.sql`c."pageNo" >= ${filters.pageNumbers.min}`);
    }

    if (filters?.pageNumbers?.max !== undefined) {
      clauses.push(Prisma.sql`c."pageNo" <= ${filters.pageNumbers.max}`);
    }

    if (filters?.pageNumbers?.exclude && filters.pageNumbers.exclude.length > 0) {
      clauses.push(Prisma.sql`(c."pageNo" IS NULL OR c."pageNo" NOT IN (${Prisma.join(filters.pageNumbers.exclude)}))`);
    }

    if (documentVersions && Object.keys(documentVersions).length > 0) {
      clauses.push(
        Prisma.sql`(${this.joinSqlClauses(
          Object.entries(documentVersions).map(([documentId, version]) =>
            Prisma.sql`(c."documentId" = ${documentId} AND d."version" <= ${version})`
          ),
          "OR"
        )})`
      );
    }

    return this.joinSqlClauses(clauses, "AND");
  }

  private joinSqlClauses(clauses: Prisma.Sql[], operator: "AND" | "OR" | "+") {
    if (clauses.length === 0) {
      return Prisma.sql``;
    }

    return clauses.slice(1).reduce((combined, clause) => Prisma.sql`${combined} ${Prisma.raw(operator)} ${clause}`, clauses[0]);
  }
}
