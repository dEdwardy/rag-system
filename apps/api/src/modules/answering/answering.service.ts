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

type CitationEvidence = {
  source: number;
  quote: string;
};

type QualityEvaluation = {
  overall: "strong" | "partial" | "weak";
  grounding: "grounded" | "partially_grounded" | "ungrounded";
  completeness: "complete" | "partial" | "insufficient";
  flags: string[];
  summary: string;
};

export type AnsweringMetadata = {
  promptId: string;
  usedFallback: boolean;
  answerPolicy: AnswerPolicy;
  contextMode: "chunks" | "context_groups";
  inputChunkCount: number;
  contextGroupCount: number;
  citationCount: number;
  answerStatus: "grounded" | "insufficient_context";
};

const DEFAULT_ANSWER_POLICY: AnswerPolicy = {
  responseStyle: "concise",
  tone: "neutral",
  outputFormat: "paragraph",
  language: "auto",
  citationMode: "required",
  maxCitations: 3,
  noAnswerBehavior: "say_insufficient_context",
  includeMissingInformation: true
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

    return this.finalizeResolvedAnswer({
      question: input.question,
      answerPolicy,
      chunks: input.chunks,
      contextGroups: input.contextGroups,
      result
    });
  }

  async finalizeStreamedAnswer(input: {
    question: string;
    answerPolicy?: Partial<AnswerPolicy> | null;
    chunks: RetrievedChunk[];
    contextGroups?: RetrievedContextGroup[];
    rawAnswer: string;
    modelName: string;
    promptId: string;
    usedFallback: boolean;
  }) {
    const answerPolicy = this.normalizeAnswerPolicy(input.answerPolicy);
    const llmResult = this.llmService.parseStructuredAnswer({
      rawAnswer: input.rawAnswer,
      modelName: input.modelName,
      promptId: input.promptId,
      usedFallback: input.usedFallback
    });

    return this.finalizeResolvedAnswer({
      question: input.question,
      answerPolicy,
      chunks: input.chunks,
      contextGroups: input.contextGroups,
      result: llmResult
    });
  }

  buildStreamAnswerContext(input: {
    chunks: RetrievedChunk[];
    contextGroups?: RetrievedContextGroup[];
  }) {
    return this.buildAnswerContextChunks(input.chunks, input.contextGroups);
  }

  private finalizeResolvedAnswer(input: {
    question: string;
    answerPolicy: AnswerPolicy;
    chunks: RetrievedChunk[];
    contextGroups?: RetrievedContextGroup[];
    result: {
      answer: string;
      modelName: string;
      promptId: string;
      usedFallback?: boolean;
      answerStatus?: "grounded" | "insufficient_context";
      missingInformation?: string[];
      citedChunkNumbers?: number[];
      citationEvidence?: CitationEvidence[];
    };
  }) {
    const usedFallback = input.result.usedFallback ?? input.result.modelName === "fallback-local";
    const answerStatus = input.result.answerStatus ?? (input.chunks.length === 0 ? "insufficient_context" : "grounded");
    const missingInformation = this.resolveMissingInformation({
      answerStatus,
      answerPolicy: input.answerPolicy,
      missingInformation: input.result.missingInformation ?? []
    });
    const answer = this.resolveAnswerText({
      question: input.question,
      answer: input.result.answer,
      answerStatus,
      answerPolicy: input.answerPolicy
    });

    if (input.chunks.length === 0) {
      const qualityEvaluation = this.buildQualityEvaluation({
        answerStatus,
        missingInformation,
        citationMode: input.answerPolicy.citationMode,
        citationCount: 0,
        chunkCount: 0,
        topScore: null
      });

      return {
        answer,
        modelName: input.result.modelName,
        answeringMetadata: {
          promptId: input.result.promptId ?? "answer.v2",
          usedFallback,
          answerPolicy: input.answerPolicy,
          contextMode: "chunks",
          inputChunkCount: 0,
          contextGroupCount: 0,
          citationCount: 0,
          answerStatus
        },
        answerStatus,
        missingInformation,
        qualityEvaluation,
        citations: [],
        retrievedChunks: [],
        contextGroups: []
      };
    }

    const citedChunks = this
      .selectCitedChunks({
        chunks: input.chunks,
        citedChunkNumbers: input.result.citedChunkNumbers ?? [],
        answer: input.result.answer,
        citationMode: input.answerPolicy.citationMode
      })
      .slice(0, input.answerPolicy.maxCitations);
    const citations = citedChunks.map(chunk => ({
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      pageNo: chunk.pageNo,
      sectionTitle: chunk.sectionTitle,
      snippet: this.resolveCitationSnippet(
        chunk,
        input.result.citationEvidence ?? [],
        input.chunks,
        input.question
      )
    }));
    const qualityEvaluation = this.buildQualityEvaluation({
      answerStatus,
      missingInformation,
      citationMode: input.answerPolicy.citationMode,
      citationCount: citations.length,
      chunkCount: input.chunks.length,
      topScore: input.chunks[0]?.score ?? null
    });

    return {
      answer,
      modelName: input.result.modelName,
      answeringMetadata: {
        promptId: input.result.promptId ?? "answer.v2",
        usedFallback,
        answerPolicy: input.answerPolicy,
        contextMode: input.contextGroups && input.contextGroups.length > 0 ? "context_groups" : "chunks",
        inputChunkCount: input.chunks.length,
        contextGroupCount: input.contextGroups?.length ?? 0,
        citationCount: citations.length,
        answerStatus
      },
      answerStatus,
      missingInformation,
      qualityEvaluation,
      citations,
      retrievedChunks: input.chunks,
      contextGroups: input.contextGroups ?? []
    };
  }

  private resolveAnswerText(input: {
    question: string;
    answer: string;
    answerStatus: "grounded" | "insufficient_context";
    answerPolicy: AnswerPolicy;
  }) {
    if (
      input.answerStatus !== "insufficient_context" ||
      input.answerPolicy.noAnswerBehavior !== "say_insufficient_context"
    ) {
      return input.answer;
    }

    return this.buildInsufficientContextAnswer(input.question, input.answerPolicy.language);
  }

  private resolveMissingInformation(input: {
    answerStatus: "grounded" | "insufficient_context";
    answerPolicy: AnswerPolicy;
    missingInformation: string[];
  }) {
    if (input.answerStatus === "insufficient_context") {
      return input.missingInformation.length > 0
        ? input.missingInformation
        : ["No relevant supporting sources were retrieved."];
    }

    return input.answerPolicy.includeMissingInformation ? input.missingInformation : [];
  }

  private buildInsufficientContextAnswer(
    question: string,
    language: AnswerPolicy["language"]
  ) {
    const resolvedLanguage = this.resolvePolicyLanguage(question, language);

    if (resolvedLanguage === "zh") {
      return "根据当前检索到的资料，我还没有足够信息来可靠回答这个问题。";
    }

    return "I don't have enough information in the retrieved sources to answer that reliably.";
  }

  private resolvePolicyLanguage(question: string, language: AnswerPolicy["language"]) {
    if (language === "zh" || language === "en") {
      return language;
    }

    const hasChinese = /[\u3400-\u9fff]/.test(question);
    return hasChinese ? "zh" : "en";
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
      tone: input?.tone ?? DEFAULT_ANSWER_POLICY.tone,
      outputFormat: input?.outputFormat ?? DEFAULT_ANSWER_POLICY.outputFormat,
      language: input?.language ?? DEFAULT_ANSWER_POLICY.language,
      citationMode: input?.citationMode ?? DEFAULT_ANSWER_POLICY.citationMode,
      maxCitations: input?.maxCitations ?? DEFAULT_ANSWER_POLICY.maxCitations,
      noAnswerBehavior: input?.noAnswerBehavior ?? DEFAULT_ANSWER_POLICY.noAnswerBehavior,
      includeMissingInformation:
        input?.includeMissingInformation ?? DEFAULT_ANSWER_POLICY.includeMissingInformation
    };
  }

  private selectCitedChunks(input: {
    chunks: RetrievedChunk[];
    citedChunkNumbers: number[];
    answer: string;
    citationMode: AnswerPolicy["citationMode"];
  }) {
    const validChunks = input.citedChunkNumbers
      .map(chunkNumber => input.chunks[chunkNumber - 1] ?? null)
      .filter((chunk): chunk is RetrievedChunk => chunk !== null);

    if (validChunks.length > 0) {
      return validChunks;
    }

    const extractedFromAnswer = [...input.answer.matchAll(/\[(\d+)\]/g)]
      .map(match => Number.parseInt(match[1] ?? "", 10))
      .filter(chunkNumber => !Number.isNaN(chunkNumber))
      .map(chunkNumber => input.chunks[chunkNumber - 1] ?? null)
      .filter((chunk): chunk is RetrievedChunk => chunk !== null);

    const uniqueExtractedFromAnswer: RetrievedChunk[] = [];
    for (const chunk of extractedFromAnswer) {
      if (uniqueExtractedFromAnswer.some(candidate => candidate.chunkId === chunk.chunkId)) {
        continue;
      }

      uniqueExtractedFromAnswer.push(chunk);
    }

    if (uniqueExtractedFromAnswer.length > 0) {
      return uniqueExtractedFromAnswer;
    }

    if (input.citationMode === "optional") {
      return [];
    }

    return input.chunks.slice(0, Math.min(3, input.chunks.length));
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

  private resolveCitationSnippet(
    chunk: RetrievedChunk,
    citationEvidence: CitationEvidence[],
    allChunks: RetrievedChunk[],
    question: string
  ) {
    const chunkIndex = allChunks.findIndex(candidate => candidate.chunkId === chunk.chunkId);
    const evidence = citationEvidence.find(candidate => candidate.source === chunkIndex + 1);
    const validatedQuote = evidence ? this.validateCitationQuote(chunk.content, evidence.quote) : null;

    if (validatedQuote) {
      return validatedQuote;
    }

    return this.buildSnippet(chunk.content, question);
  }

  private validateCitationQuote(content: string, quote: string) {
    const normalizedContent = this.normalizeWhitespace(content);
    const normalizedQuote = this.normalizeWhitespace(quote);

    if (!normalizedQuote) {
      return null;
    }

    return normalizedContent.includes(normalizedQuote) ? normalizedQuote : null;
  }

  private normalizeWhitespace(value: string) {
    return value.replace(/\s+/g, " ").trim();
  }

  private buildQualityEvaluation(input: {
    answerStatus: "grounded" | "insufficient_context";
    missingInformation: string[];
    citationMode: "required" | "optional";
    citationCount: number;
    chunkCount: number;
    topScore: number | null;
  }): QualityEvaluation {
    const flags: string[] = [];

    if (input.chunkCount === 0) {
      flags.push("no_retrieval_hits");
    }

    if (input.answerStatus === "insufficient_context") {
      flags.push("insufficient_context");
    }

    if (input.missingInformation.length > 0) {
      flags.push("missing_information");
    }

    if (input.topScore !== null && input.topScore < 0.5) {
      flags.push("low_retrieval_score");
    }

    if (input.citationMode === "required" && input.chunkCount > 0 && input.citationCount === 0) {
      flags.push("no_citations");
    }

    const grounding =
      input.answerStatus === "insufficient_context"
        ? "ungrounded"
        : input.citationCount > 0 || input.citationMode === "optional"
          ? "grounded"
          : "partially_grounded";

    const completeness =
      input.answerStatus === "insufficient_context"
        ? "insufficient"
        : input.missingInformation.length > 0
          ? "partial"
          : "complete";

    const overall =
      grounding === "ungrounded"
        ? "weak"
        : completeness === "complete" && !flags.some(flag => ["missing_information", "no_citations", "insufficient_context", "no_retrieval_hits"].includes(flag))
          ? "strong"
          : "partial";

    const summary =
      overall === "strong"
        ? "Answer is grounded in cited sources with no reported gaps."
        : overall === "partial"
          ? "Answer is grounded but incomplete because some information is missing."
          : "Answer quality is weak because supporting context was insufficient.";

    const normalizedFlags =
      overall === "strong"
        ? flags.filter(flag => !["no_citations", "missing_information", "insufficient_context", "no_retrieval_hits"].includes(flag))
        : flags;

    return {
      overall,
      grounding,
      completeness,
      flags: normalizedFlags,
      summary
    };
  }
}
