import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import { EmbeddingService } from "../../infra/embedding/embedding.service";
import { VectorStoreService } from "../../infra/vector-store/vector-store.service";
import {
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
};

type RetrievalCandidate = RetrievedChunk & {
  lexicalScore: number;
  vectorScore: number;
  hybridScore: number;
  rerankScore: number;
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
  execution: {
    actualMode: "vector" | "hybrid" | "lexical";
    usedFallback: boolean;
    fallbackReason: "vector_error" | "no_ranked_candidates" | null;
    rerankApplied: boolean;
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
  };
};

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStoreService: VectorStoreService
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
  }) {
    const normalizedFilters = retrievalProfileFiltersSchema.optional().parse(input.filters);
    const strategy = input.strategy;
    const candidateSelectionMode = strategy?.candidateSelection.mode ?? (input.enableHybrid ? "hybrid" : "vector");
    const resolvedEnableRerank = strategy?.rerank.enabled ?? input.enableRerank ?? false;
    const candidateLimit = Math.max(
      input.topK * (strategy?.candidateSelection.candidateMultiplier ?? 3),
      strategy?.candidateSelection.minCandidates ?? input.topK,
      input.topK
    );

    if (candidateSelectionMode === "lexical") {
      const lexicalCandidates = await this.getLexicalCandidates({
        kbId: input.kbId,
        query: input.query,
        limit: candidateLimit,
        filters: normalizedFilters
      });

      return this.retrieveWithLexicalFallback({
        ...input,
        enableRerank: resolvedEnableRerank,
        filters: normalizedFilters,
        lexicalCandidates,
        candidateLimit,
        vectorCandidateCount: 0,
        actualMode: "lexical",
        usedFallback: false,
        fallbackReason: null,
        rerankApplied: resolvedEnableRerank
      });
    }

    const lexicalCandidates =
      candidateSelectionMode === "hybrid"
        ? await this.getLexicalCandidates({
            kbId: input.kbId,
            query: input.query,
            limit: candidateLimit,
            filters: normalizedFilters
          })
        : undefined;

    try {
      const queryEmbedding = await this.embeddingService.embedQuery(input.query);
      const vectorMatches = await this.vectorStoreService.search({
        kbId: input.kbId,
        queryVector: queryEmbedding.vector,
        topK: candidateLimit,
        scoreThreshold: input.scoreThreshold,
        filters: normalizedFilters
      });

      if (vectorMatches.length > 0 || candidateSelectionMode === "hybrid") {
        const vectorCandidates = await this.getVectorCandidates(vectorMatches);
        const mergedCandidates = candidateSelectionMode === "hybrid"
          ? this.mergeHybridCandidates(vectorCandidates, lexicalCandidates ?? [], strategy)
          : vectorCandidates;
        const rankedCandidates = this.rankCandidates(mergedCandidates, {
          enableRerank: resolvedEnableRerank,
          query: input.query,
          scoreThreshold: input.scoreThreshold,
          topK: input.topK
        });

        if (rankedCandidates.length > 0) {
          const retrievedChunks = await this.expandChunkWindow(
            input.kbId,
            rankedCandidates,
            input.chunkWindow ?? 0,
            normalizedFilters
          );
          return this.buildRetrievalResult(retrievedChunks, {
            actualMode: candidateSelectionMode,
            usedFallback: false,
            fallbackReason: null,
            rerankApplied: resolvedEnableRerank,
            chunkWindowApplied: (input.chunkWindow ?? 0) > 0,
            vectorSearchAttempted: true,
            lexicalSearchAttempted: candidateSelectionMode === "hybrid",
            vectorCandidateLimitHit: vectorCandidates.length >= candidateLimit,
            lexicalCandidateLimitHit: (lexicalCandidates?.length ?? 0) >= candidateLimit,
            rankingTopKHit: rankedCandidates.length >= input.topK,
            candidateLimit,
            vectorCandidateCount: vectorCandidates.length,
            lexicalCandidateCount: lexicalCandidates?.length ?? 0,
            mergedCandidateCount: mergedCandidates.length,
            rankedCandidateCount: rankedCandidates.length
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown vector retrieval error.";
      this.logger.warn(`Vector retrieval failed, falling back to lexical scoring. ${message}`);
      return this.retrieveWithLexicalFallback({
        ...input,
        enableRerank: resolvedEnableRerank,
        filters: normalizedFilters,
        lexicalCandidates,
        candidateLimit,
        vectorCandidateCount: 0,
        actualMode: "lexical",
        usedFallback: true,
        fallbackReason: "vector_error",
        rerankApplied: resolvedEnableRerank
      });
    }

    return this.retrieveWithLexicalFallback({
      ...input,
      enableRerank: resolvedEnableRerank,
      filters: normalizedFilters,
      lexicalCandidates,
      candidateLimit,
      vectorCandidateCount: 0,
      actualMode: "lexical",
      usedFallback: true,
      fallbackReason: "no_ranked_candidates",
      rerankApplied: resolvedEnableRerank
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
    filters?: RetrievalProfileFilters;
    actualMode: "lexical";
    usedFallback: boolean;
    fallbackReason: "vector_error" | "no_ranked_candidates" | null;
    rerankApplied: boolean;
  }) {
    const lexicalCandidates =
      input.lexicalCandidates ??
      (await this.getLexicalCandidates({
        kbId: input.kbId,
        query: input.query,
        limit: input.candidateLimit,
        filters: input.filters
      }));
    const ranked = this.rankCandidates(lexicalCandidates, {
      enableRerank: input.enableRerank ?? false,
      query: input.query,
      scoreThreshold: input.scoreThreshold,
      topK: input.topK
    });

    if (ranked.length > 0) {
      const retrievedChunks = await this.expandChunkWindow(
        input.kbId,
        ranked,
        input.chunkWindow ?? 0,
        input.filters
      );
      return this.buildRetrievalResult(retrievedChunks, {
        actualMode: input.actualMode,
        usedFallback: input.usedFallback,
        fallbackReason: input.fallbackReason,
        rerankApplied: input.rerankApplied,
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
        rankedCandidateCount: ranked.length
      });
    }
    return this.buildRetrievalResult([], {
      actualMode: input.actualMode,
      usedFallback: input.usedFallback,
      fallbackReason: input.fallbackReason,
      rerankApplied: input.rerankApplied,
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
      rankedCandidateCount: 0
    });
  }

  private async getLexicalCandidates(input: {
    kbId: string;
    query: string;
    limit: number;
    filters?: RetrievalProfileFilters;
  }) {
    const chunks = await this.prisma.documentChunk.findMany({
      where: this.buildChunkWhere(input.kbId, input.filters),
      include: {
        document: true
      }
    });

    const terms = this.tokenize(input.query);

    return chunks
      .map(chunk => {
        const lexicalScore = this.scoreChunk(chunk.content, chunk.sectionTitle, terms);

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
          sectionTitle: chunk.sectionTitle
        };
      })
      .sort((left, right) => right.lexicalScore - left.lexicalScore)
      .slice(0, input.limit);
  }

  private async getVectorCandidates(vectorMatches: Array<{ chunkId: string; score: number }>) {
    const chunks = await this.prisma.documentChunk.findMany({
      where: {
        id: {
          in: vectorMatches.map(match => match.chunkId)
        }
      },
      include: {
        document: true
      }
    });

    const chunkMap = new Map(chunks.map(chunk => [chunk.id, chunk]));

    return vectorMatches
      .map(match => {
        const chunk = chunkMap.get(match.chunkId);
        if (!chunk) {
          return null;
        }

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
          sectionTitle: chunk.sectionTitle
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

  private rankCandidates(
    candidates: RetrievalCandidate[],
    input: {
      query: string;
      topK: number;
      scoreThreshold: number;
      enableRerank: boolean;
    }
  ) {
    const reranked = input.enableRerank
      ? candidates.map(candidate => ({
          ...candidate,
          rerankScore: this.computeRerankScore(candidate, input.query)
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
        sectionTitle: candidate.sectionTitle
      }));
  }

  private tokenize(query: string) {
    return query
      .toLowerCase()
      .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
      .filter(term => term.length > 0);
  }

  private scoreChunk(content: string, sectionTitle: string | null, terms: string[]) {
    const normalized = content.toLowerCase();
    const normalizedSectionTitle = sectionTitle?.toLowerCase() ?? "";
    const normalizedTerms = terms.map(term => term.toLowerCase());
    const fullQuery = normalizedTerms.join(" ").trim();
    let score = 0;

    if (fullQuery.length > 0 && normalized.includes(fullQuery)) {
      score += 6;
    }

    if (fullQuery.length > 0 && normalizedSectionTitle.includes(fullQuery)) {
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

    return score;
  }

  private computeRerankScore(candidate: RetrievalCandidate, query: string) {
    const terms = this.tokenize(query);
    const lexicalBoost = this.scoreChunk(candidate.content, candidate.sectionTitle, terms);
    const exactPhraseBoost = candidate.content.toLowerCase().includes(query.toLowerCase().trim()) ? 3 : 0;
    const titleBoost = candidate.sectionTitle?.toLowerCase().includes(query.toLowerCase().trim()) ? 4 : 0;

    return candidate.score + lexicalBoost * 0.15 + exactPhraseBoost + titleBoost;
  }

  private async expandChunkWindow(
    kbId: string,
    chunks: RetrievedChunk[],
    chunkWindow: number,
    filters?: RetrievalProfileFilters
  ) {
    if (chunkWindow <= 0 || chunks.length === 0) {
      return chunks;
    }

    const requestedPositions = new Map<string, { score: number; primary: boolean }>();
    for (const chunk of chunks) {
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

    const documentChunkEntries = Array.from(requestedPositions.keys()).map(key => {
      const [documentId, chunkIndex] = key.split(":");
      return {
        documentId,
        chunkIndex: Number.parseInt(chunkIndex ?? "0", 10)
      };
    });

    const expandedChunks = await this.prisma.documentChunk.findMany({
      where: {
        ...this.buildChunkWhere(kbId, filters),
        OR: documentChunkEntries
      },
      include: {
        document: true
      },
      orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }]
    });

    const chunkMap = new Map(chunks.map(chunk => [chunk.chunkId, chunk]));

    return expandedChunks.map(chunk => {
      const key = `${chunk.documentId}:${chunk.chunkIndex}`;
      const requested = requestedPositions.get(key);
      const primaryChunk = chunkMap.get(chunk.id);

      return {
        chunkId: chunk.id,
        documentId: chunk.documentId,
        documentTitle: chunk.document.title,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        score: primaryChunk?.score ?? requested?.score ?? 0,
        isPrimary: requested?.primary ?? false,
        pageNo: chunk.pageNo,
        sectionTitle: chunk.sectionTitle
      };
    });
  }

  private buildRetrievalResult(
    retrievedChunks: RetrievedChunk[],
    execution: RetrievalResult["execution"]
  ): RetrievalResult {
    return {
      retrievedChunks,
      contextGroups: this.buildContextGroups(retrievedChunks),
      execution
    };
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

    for (const value of values) {
      if (value == null || uniqueValues.includes(value)) {
        continue;
      }

      uniqueValues.push(value);
    }

    return uniqueValues;
  }

  private buildChunkWhere(kbId: string, filters?: RetrievalProfileFilters): Prisma.DocumentChunkWhereInput {
    if (!filters) {
      return {
        kbId
      };
    }

    const directWhere: Prisma.DocumentChunkWhereInput = {
      kbId
    };
    const extraPositiveClauses: Prisma.DocumentChunkWhereInput[] = [];
    const negativeClauses: Prisma.DocumentChunkWhereInput[] = [];

    if (filters.documentIds?.include) {
      directWhere.documentId = {
        in: filters.documentIds.include
      };
    }

    if (filters.documentIds?.exclude) {
      negativeClauses.push({
        documentId: {
          in: filters.documentIds.exclude
        }
      });
    }

    const sectionTitleClauses: Prisma.DocumentChunkWhereInput[] = [];
    if (filters.sectionTitles?.include) {
      sectionTitleClauses.push({
        sectionTitle: {
          in: filters.sectionTitles.include
        }
      });
    }

    if (filters.sectionTitles?.contains) {
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

    if (filters.sectionTitles?.exclude) {
      negativeClauses.push({
        sectionTitle: {
          in: filters.sectionTitles.exclude
        }
      });
    }

    const pageNumberClauses: Prisma.DocumentChunkWhereInput[] = [];
    if (filters.pageNumbers?.include) {
      pageNumberClauses.push({
        pageNo: {
          in: filters.pageNumbers.include
        }
      });
    }

    if (filters.pageNumbers?.min !== undefined || filters.pageNumbers?.max !== undefined) {
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

    if (filters.pageNumbers?.exclude) {
      negativeClauses.push({
        pageNo: {
          in: filters.pageNumbers.exclude
        }
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
}
