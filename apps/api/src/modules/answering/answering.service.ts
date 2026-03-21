import { Injectable } from "@nestjs/common";
import { LlmService } from "../../infra/llm/llm.service";
import { AnswerPolicy } from "../../infra/llm/llm.types";

type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
  pageNo: number | null;
  sectionTitle: string | null;
};

type RetrievedContextGroup = {
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

const DEFAULT_ANSWER_POLICY: AnswerPolicy = {
  responseStyle: "concise",
  citationMode: "required",
  maxCitations: 3,
  noAnswerBehavior: "say_insufficient_context"
};

@Injectable()
export class AnsweringService {
  constructor(private readonly llmService: LlmService) {}

  async generateAnswer(input: {
    question: string;
    systemPrompt: string;
    answerPolicy?: Partial<AnswerPolicy> | null;
    chunks: RetrievedChunk[];
    contextGroups?: RetrievedContextGroup[];
  }) {
    const answerPolicy = this.normalizeAnswerPolicy(input.answerPolicy);
    const llmChunks = this.buildAnswerContextChunks(input.chunks, input.contextGroups);
    const result = await this.llmService.generateAnswer({
      question: input.question,
      systemPrompt: input.systemPrompt,
      answerPolicy,
      chunks: llmChunks
    });

    const answerStatus = result.answerStatus ?? (input.chunks.length === 0 ? "insufficient_context" : "grounded");
    const missingInformation = result.missingInformation ?? [];

    if (input.chunks.length === 0) {
      return {
        answer: result.answer,
        modelName: result.modelName,
        answerStatus,
        missingInformation,
        citations: [],
        retrievedChunks: [],
        contextGroups: []
      };
    }

    const citedChunks = this
      .selectCitedChunks(input.chunks, result.citedChunkNumbers ?? [], result.answer)
      .slice(0, answerPolicy.maxCitations);
    const citations = citedChunks.map(chunk => ({
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      pageNo: chunk.pageNo,
      sectionTitle: chunk.sectionTitle,
      snippet: this.buildSnippet(chunk.content, input.question)
    }));

    return {
      answer: result.answer,
      modelName: result.modelName,
      answerStatus,
      missingInformation,
      citations,
      retrievedChunks: input.chunks,
      contextGroups: input.contextGroups ?? []
    };
  }

  private buildAnswerContextChunks(chunks: RetrievedChunk[], contextGroups?: RetrievedContextGroup[]) {
    if (!contextGroups || contextGroups.length === 0) {
      return chunks;
    }

    return contextGroups.map(group => {
      const primaryChunk = chunks.find(chunk => group.primaryChunkIds.includes(chunk.chunkId)) ?? chunks[0];
      return {
        chunkId: group.primaryChunkIds[0] ?? group.chunkIds[0] ?? primaryChunk.chunkId,
        documentId: group.documentId,
        documentTitle: group.documentTitle,
        content: group.mergedContent,
        score: primaryChunk?.score ?? 0,
        pageNo: group.pageNumbers[0] ?? null,
        sectionTitle: group.sectionTitles.length > 0 ? group.sectionTitles.join(" / ") : null
      };
    });
  }

  private normalizeAnswerPolicy(input?: Partial<AnswerPolicy> | null): AnswerPolicy {
    return {
      responseStyle: input?.responseStyle ?? DEFAULT_ANSWER_POLICY.responseStyle,
      citationMode: input?.citationMode ?? DEFAULT_ANSWER_POLICY.citationMode,
      maxCitations: input?.maxCitations ?? DEFAULT_ANSWER_POLICY.maxCitations,
      noAnswerBehavior: input?.noAnswerBehavior ?? DEFAULT_ANSWER_POLICY.noAnswerBehavior
    };
  }

  private selectCitedChunks(chunks: RetrievedChunk[], citedChunkNumbers: number[], answer: string) {
    const validChunks = citedChunkNumbers
      .map(chunkNumber => chunks[chunkNumber - 1] ?? null)
      .filter((chunk): chunk is RetrievedChunk => chunk !== null);

    if (validChunks.length > 0) {
      return validChunks;
    }

    const extractedFromAnswer = [...answer.matchAll(/\[(\d+)\]/g)]
      .map(match => Number.parseInt(match[1] ?? "", 10))
      .filter(chunkNumber => !Number.isNaN(chunkNumber))
      .map(chunkNumber => chunks[chunkNumber - 1] ?? null)
      .filter((chunk): chunk is RetrievedChunk => chunk !== null);

    if (extractedFromAnswer.length > 0) {
      return extractedFromAnswer;
    }

    return chunks.slice(0, Math.min(3, chunks.length));
  }

  private buildSnippet(content: string, question: string) {
    const normalizedContent = content.replace(/\s+/g, " ").trim();
    const terms = question
      .toLowerCase()
      .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
      .filter(term => term.length >= 2);

    for (const term of terms) {
      const index = normalizedContent.toLowerCase().indexOf(term);
      if (index >= 0) {
        const start = Math.max(0, index - 80);
        const end = Math.min(normalizedContent.length, index + 180);
        const prefix = start > 0 ? "..." : "";
        const suffix = end < normalizedContent.length ? "..." : "";
        return `${prefix}${normalizedContent.slice(start, end).trim()}${suffix}`;
      }
    }

    return normalizedContent.slice(0, 300);
  }
}
