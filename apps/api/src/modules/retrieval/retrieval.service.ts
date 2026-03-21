import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import { EmbeddingService } from "../../infra/embedding/embedding.service";
import { VectorStoreService } from "../../infra/vector-store/vector-store.service";
import {
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
  }) {
    const normalizedFilters = retrievalProfileFiltersSchema.optional().parse(input.filters);
    const candidateLimit = Math.max(input.topK * 3, input.topK);
    const lexicalCandidates = await this.getLexicalCandidates({
      kbId: input.kbId,
      query: input.query,
      limit: candidateLimit,
      filters: normalizedFilters
    });

    try {
      const queryEmbedding = await this.embeddingService.embedQuery(input.query);
      const vectorMatches = await this.vectorStoreService.search({
        kbId: input.kbId,
        queryVector: queryEmbedding.vector,
        topK: candidateLimit,
        scoreThreshold: input.scoreThreshold,
        filters: normalizedFilters
      });

      if (vectorMatches.length > 0 || input.enableHybrid) {
        const vectorCandidates = await this.getVectorCandidates(vectorMatches);
        const mergedCandidates = input.enableHybrid
          ? this.mergeHybridCandidates(vectorCandidates, lexicalCandidates)
          : vectorCandidates;
        const rankedCandidates = this.rankCandidates(mergedCandidates, {
          enableRerank: input.enableRerank ?? false,
          query: input.query,
          scoreThreshold: input.scoreThreshold,
          topK: input.topK
        });

        if (rankedCandidates.length > 0) {
          return this.expandChunkWindow(
            input.kbId,
            rankedCandidates,
            input.chunkWindow ?? 0,
            normalizedFilters
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown vector retrieval error.";
      this.logger.warn(`Vector retrieval failed, falling back to lexical scoring. ${message}`);
    }

    return this.retrieveWithLexicalFallback({
      ...input,
      filters: normalizedFilters,
      lexicalCandidates
    });
  }

  private async retrieveWithLexicalFallback(input: {
    kbId: string;
    query: string;
    topK: number;
    scoreThreshold: number;
    chunkWindow?: number;
    lexicalCandidates?: RetrievalCandidate[];
    filters?: RetrievalProfileFilters;
  }) {
    const lexicalCandidates =
      input.lexicalCandidates ??
      (await this.getLexicalCandidates({
        kbId: input.kbId,
        query: input.query,
        limit: Math.max(input.topK * 3, input.topK),
        filters: input.filters
      }));
    const ranked = this.rankCandidates(lexicalCandidates, {
      enableRerank: false,
      query: input.query,
      scoreThreshold: input.scoreThreshold,
      topK: input.topK
    });

    if (ranked.length > 0) {
      return this.expandChunkWindow(input.kbId, ranked, input.chunkWindow ?? 0, input.filters);
    }

    const chunks = await this.prisma.documentChunk.findMany({
      where: this.buildChunkWhere(input.kbId, input.filters),
      include: {
        document: true
      },
      orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }]
    });

    const fallbackChunks = chunks.slice(0, input.topK).map(chunk => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentTitle: chunk.document.title,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      score: 0,
      isPrimary: true,
      pageNo: chunk.pageNo,
      sectionTitle: chunk.sectionTitle
    }));

    return this.expandChunkWindow(input.kbId, fallbackChunks, input.chunkWindow ?? 0, input.filters);
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
    lexicalCandidates: RetrievalCandidate[]
  ) {
    const merged = new Map<string, RetrievalCandidate>();
    const lexicalMaxScore = Math.max(...lexicalCandidates.map(candidate => candidate.lexicalScore), 0);

    for (const candidate of vectorCandidates) {
      merged.set(candidate.chunkId, candidate);
    }

    for (const lexicalCandidate of lexicalCandidates) {
      const existing = merged.get(lexicalCandidate.chunkId);
      const lexicalWeight = lexicalMaxScore > 0 ? lexicalCandidate.lexicalScore / lexicalMaxScore : 0;

      if (existing) {
        const score = existing.vectorScore * 0.7 + lexicalWeight * 0.3;
        merged.set(lexicalCandidate.chunkId, {
          ...existing,
          lexicalScore: lexicalCandidate.lexicalScore,
          score,
          hybridScore: score,
          rerankScore: score
        });
        continue;
      }

      const score = lexicalWeight * 0.3;
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
