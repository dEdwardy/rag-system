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

type CitationSelection = {
  chunks: RetrievedChunk[];
  attribution: "explicit" | "heuristic" | "none";
};

type QualityEvaluation = {
  overall: "strong" | "partial" | "weak";
  grounding: "grounded" | "partially_grounded" | "ungrounded";
  completeness: "complete" | "partial" | "insufficient";
  primaryIssue:
    | "none"
    | "no_retrieval_hits"
    | "insufficient_context"
    | "missing_information"
    | "low_retrieval_score"
    | "fallback_generation"
    | "other";
  flags: string[];
  summary: string;
};

export type AnsweringMetadata = {
  promptId: string;
  usedFallback: boolean;
  answerPolicy: AnswerPolicy;
  resolvedLanguage: "en" | "zh";
  generationMode: "generated" | "deterministic_bypass";
  contextMode: "chunks" | "context_groups";
  inputChunkCount: number;
  promptContextCount: number;
  contextGroupCount: number;
  citationCountBeforeLimit: number;
  citationCount: number;
  citationLimitHit: boolean;
  citationAttribution: CitationSelection["attribution"];
  missingInformationCount: number;
  missingInformationSource: "none" | "model" | "deterministic_default" | "suppressed_by_policy";
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

  buildDeterministicInsufficientContextResult(input: {
    question: string;
    answerPolicy?: Partial<AnswerPolicy> | null;
  }) {
    const answerPolicy = this.normalizeAnswerPolicy(input.answerPolicy);
    const missingInformation = [
      this.buildInsufficientContextMissingInformation(input.question, answerPolicy.language)
    ];
    const qualityEvaluation = this.buildQualityEvaluation({
      question: input.question,
      language: answerPolicy.language,
      answerStatus: "insufficient_context",
      missingInformation,
      usedFallback: true,
      citationMode: answerPolicy.citationMode,
      citationCount: 0,
      chunkCount: 0,
      topScore: null
    });

    return {
      answer: this.buildInsufficientContextAnswer(input.question, answerPolicy.language),
      citations: [],
      retrievedChunks: [],
      contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: true,
          answerPolicy,
          resolvedLanguage: this.resolvePolicyLanguage(input.question, answerPolicy.language),
          generationMode: "deterministic_bypass",
          contextMode: "chunks" as const,
          inputChunkCount: 0,
          promptContextCount: 0,
          contextGroupCount: 0,
          citationCountBeforeLimit: 0,
          citationCount: 0,
          citationLimitHit: false,
          citationAttribution: "none",
          missingInformationCount: missingInformation.length,
          missingInformationSource: "deterministic_default",
          answerStatus: "insufficient_context" as const
        },
      modelName: "fallback-local",
      answerStatus: "insufficient_context" as const,
      missingInformation,
      qualityEvaluation
    };
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
    const resolvedLanguage = this.resolvePolicyLanguage(input.question, input.answerPolicy.language);
    const rawMissingInformation = input.result.missingInformation ?? [];
    const missingInformation = this.resolveMissingInformation({
      question: input.question,
      answerStatus,
      answerPolicy: input.answerPolicy,
      hasRetrievedContext: input.chunks.length > 0,
      missingInformation: rawMissingInformation
    });
    const answer = this.resolveAnswerText({
      question: input.question,
      answer: input.result.answer,
      answerStatus,
      answerPolicy: input.answerPolicy
    });

    if (input.chunks.length === 0) {
      const qualityEvaluation = this.buildQualityEvaluation({
        question: input.question,
        language: input.answerPolicy.language,
        answerStatus,
        missingInformation,
        usedFallback,
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
          resolvedLanguage,
          generationMode: "deterministic_bypass",
          contextMode: "chunks",
          inputChunkCount: 0,
          promptContextCount: 0,
          contextGroupCount: 0,
          citationCountBeforeLimit: 0,
          citationCount: 0,
          citationLimitHit: false,
          citationAttribution: "none",
          missingInformationCount: missingInformation.length,
          missingInformationSource: this.resolveMissingInformationSource({
            answerStatus,
            includeMissingInformation: input.answerPolicy.includeMissingInformation,
            rawMissingInformationCount: rawMissingInformation.length
          }),
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

    const citationSelection = this.selectCitedChunks({
      chunks: input.chunks,
      citedChunkNumbers: input.result.citedChunkNumbers ?? [],
      answer: input.result.answer,
      citationMode: input.answerPolicy.citationMode
    });
    const citationCountBeforeLimit = citationSelection.chunks.length;
    const citedChunks = citationSelection.chunks.slice(0, input.answerPolicy.maxCitations);
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
      question: input.question,
      language: input.answerPolicy.language,
      answerStatus,
      missingInformation,
      usedFallback,
      citationMode: input.answerPolicy.citationMode,
      citationCount: citations.length,
      citationAttribution: citationSelection.attribution,
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
        resolvedLanguage,
        generationMode: "generated",
        contextMode: input.contextGroups && input.contextGroups.length > 0 ? "context_groups" : "chunks",
        inputChunkCount: input.chunks.length,
        promptContextCount: input.contextGroups && input.contextGroups.length > 0
          ? input.contextGroups.length
          : input.chunks.length,
        contextGroupCount: input.contextGroups?.length ?? 0,
        citationCountBeforeLimit,
        citationCount: citations.length,
        citationLimitHit: citationCountBeforeLimit > input.answerPolicy.maxCitations,
        citationAttribution: citationSelection.attribution,
        missingInformationCount: missingInformation.length,
        missingInformationSource: this.resolveMissingInformationSource({
          answerStatus,
          includeMissingInformation: input.answerPolicy.includeMissingInformation,
          rawMissingInformationCount: rawMissingInformation.length
        }),
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
    question: string;
    answerStatus: "grounded" | "insufficient_context";
    answerPolicy: AnswerPolicy;
    hasRetrievedContext: boolean;
    missingInformation: string[];
  }) {
    if (input.answerStatus === "insufficient_context") {
      return input.missingInformation.length > 0
        ? input.missingInformation
        : [
            this.buildInsufficientContextMissingInformation(
              input.question,
              input.answerPolicy.language,
              input.hasRetrievedContext
            )
          ];
    }

    return input.answerPolicy.includeMissingInformation ? input.missingInformation : [];
  }

  private resolveMissingInformationSource(input: {
    answerStatus: "grounded" | "insufficient_context";
    includeMissingInformation: boolean;
    rawMissingInformationCount: number;
  }): AnsweringMetadata["missingInformationSource"] {
    if (input.answerStatus === "insufficient_context") {
      return input.rawMissingInformationCount > 0 ? "model" : "deterministic_default";
    }

    if (input.rawMissingInformationCount === 0) {
      return "none";
    }

    return input.includeMissingInformation ? "model" : "suppressed_by_policy";
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

  private buildInsufficientContextMissingInformation(
    question: string,
    language: AnswerPolicy["language"],
    hasRetrievedContext = false
  ) {
    const resolvedLanguage = this.resolvePolicyLanguage(question, language);

    if (resolvedLanguage === "zh") {
      return hasRetrievedContext
        ? "\u5df2\u68c0\u7d22\u5230\u76f8\u5173\u4e0a\u4e0b\u6587\uff0c\u4f46\u4ecd\u4e0d\u8db3\u4ee5\u652f\u6301\u53ef\u9760\u56de\u7b54\u3002"
        : "\u6ca1\u6709\u68c0\u7d22\u5230\u53ef\u7528\u4e8e\u652f\u6301\u56de\u7b54\u7684\u76f8\u5173\u6765\u6e90\u3002";
    }

    return hasRetrievedContext
      ? "Retrieved context was still insufficient to support a reliable answer."
      : "No relevant supporting sources were retrieved.";
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
  }): CitationSelection {
    const validChunks = input.citedChunkNumbers
      .map(chunkNumber => input.chunks[chunkNumber - 1] ?? null)
      .filter((chunk): chunk is RetrievedChunk => chunk !== null);

    if (validChunks.length > 0) {
      return {
        chunks: validChunks,
        attribution: "explicit"
      };
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
      return {
        chunks: uniqueExtractedFromAnswer,
        attribution: "explicit"
      };
    }

    if (input.citationMode === "optional") {
      return {
        chunks: [],
        attribution: "none"
      };
    }

    return {
      chunks: input.chunks.slice(0, Math.min(3, input.chunks.length)),
      attribution: input.chunks.length > 0 ? "heuristic" : "none"
    };
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
    question: string;
    language: AnswerPolicy["language"];
    answerStatus: "grounded" | "insufficient_context";
    missingInformation: string[];
    usedFallback: boolean;
    citationMode: "required" | "optional";
    citationCount: number;
    citationAttribution?: CitationSelection["attribution"];
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

    if (input.usedFallback && input.answerStatus === "grounded") {
      flags.push("fallback_generation");
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
        : completeness === "complete" &&
            !flags.some(flag =>
              [
                "missing_information",
                "insufficient_context",
                "no_retrieval_hits",
                "low_retrieval_score",
                "fallback_generation"
              ].includes(flag)
            )
          ? "strong"
          : "partial";

    const summary = this.buildQualitySummary({
      question: input.question,
      language: input.language,
      overall,
      flags,
      citationCount: input.citationCount,
      citationAttribution: input.citationAttribution ?? "none"
    });

    const primaryIssue =
      overall === "strong"
        ? "none"
        : flags.includes("no_retrieval_hits")
          ? "no_retrieval_hits"
          : flags.includes("insufficient_context")
            ? "insufficient_context"
            : flags.includes("fallback_generation")
                  ? "fallback_generation"
                : flags.includes("missing_information")
                  ? "missing_information"
                  : flags.includes("low_retrieval_score")
                    ? "low_retrieval_score"
                    : "other";

    const normalizedFlags =
      overall === "strong"
        ? flags.filter(flag => !["missing_information", "insufficient_context", "no_retrieval_hits"].includes(flag))
        : flags;

    return {
      overall,
      grounding,
      completeness,
      primaryIssue,
      flags: normalizedFlags,
      summary
    };
  }

  private buildQualitySummary(input: {
    question: string;
    language: AnswerPolicy["language"];
    overall: QualityEvaluation["overall"];
    flags: string[];
    citationCount: number;
    citationAttribution: CitationSelection["attribution"];
  }) {
    const resolvedLanguage = this.resolvePolicyLanguage(input.question, input.language);

    if (input.overall === "strong") {
      if (resolvedLanguage === "zh") {
        if (input.citationCount > 0 && input.citationAttribution === "explicit") {
          return "\u56de\u7b54\u5df2\u57fa\u4e8e\u5f15\u7528\u7684\u6765\u6e90\uff0c\u4e14\u6ca1\u6709\u53d1\u73b0\u5df2\u77e5\u7f3a\u53e3\u3002";
        }

        if (input.citationCount > 0 && input.citationAttribution === "heuristic") {
          return "\u56de\u7b54\u5df2\u57fa\u4e8e\u68c0\u7d22\u5230\u7684\u6765\u6e90\uff0c\u5f15\u7528\u7531\u540e\u7aef\u63a8\u65ad\u8865\u9f50\uff0c\u4e14\u6ca1\u6709\u53d1\u73b0\u5df2\u77e5\u7f3a\u53e3\u3002";
        }

        return "\u56de\u7b54\u5df2\u57fa\u4e8e\u68c0\u7d22\u5230\u7684\u6765\u6e90\uff0c\u4e14\u6ca1\u6709\u53d1\u73b0\u5df2\u77e5\u7f3a\u53e3\u3002";
      }

      if (input.citationCount > 0 && input.citationAttribution === "explicit") {
        return "Answer is grounded in cited sources with no reported gaps.";
      }

      if (input.citationCount > 0 && input.citationAttribution === "heuristic") {
        return "Answer is grounded in retrieved sources with backend-inferred citations and no reported gaps.";
      }

      return "Answer is grounded in retrieved sources with no reported gaps.";
    }

    if (input.overall === "partial") {
      if (resolvedLanguage === "zh") {
        if (
          input.flags.includes("missing_information") &&
          input.flags.includes("low_retrieval_score") &&
          input.flags.includes("fallback_generation")
        ) {
          return "\u56de\u7b54\u5df2\u57fa\u4e8e\u68c0\u7d22\u5230\u7684\u5185\u5bb9\uff0c\u4f46\u4ecd\u4e0d\u5b8c\u6574\uff1a\u90e8\u5206\u4fe1\u606f\u7f3a\u5931\uff0c\u68c0\u7d22\u7f6e\u4fe1\u5ea6\u504f\u4f4e\uff0c\u4e14\u5b83\u662f\u901a\u8fc7\u672c\u5730 fallback \u751f\u6210\u7684\u3002";
        }

        if (input.flags.includes("missing_information") && input.flags.includes("low_retrieval_score")) {
          return "\u56de\u7b54\u5df2\u57fa\u4e8e\u68c0\u7d22\u5230\u7684\u5185\u5bb9\uff0c\u4f46\u4ecd\u4e0d\u5b8c\u6574\uff1a\u90e8\u5206\u4fe1\u606f\u7f3a\u5931\uff0c\u4e14\u68c0\u7d22\u7f6e\u4fe1\u5ea6\u504f\u4f4e\u3002";
        }

        if (input.flags.includes("missing_information") && input.flags.includes("fallback_generation")) {
          return "\u56de\u7b54\u5df2\u57fa\u4e8e\u68c0\u7d22\u5230\u7684\u5185\u5bb9\uff0c\u4f46\u4ecd\u4e0d\u5b8c\u6574\uff1a\u90e8\u5206\u4fe1\u606f\u7f3a\u5931\uff0c\u4e14\u5b83\u662f\u901a\u8fc7\u672c\u5730 fallback \u751f\u6210\u7684\u3002";
        }

        if (input.flags.includes("low_retrieval_score") && input.flags.includes("fallback_generation")) {
          return "\u56de\u7b54\u5df2\u57fa\u4e8e\u68c0\u7d22\u5230\u7684\u5185\u5bb9\uff0c\u4f46\u652f\u6301\u4e0a\u4e0b\u6587\u7684\u68c0\u7d22\u7f6e\u4fe1\u5ea6\u504f\u4f4e\uff0c\u4e14\u5b83\u662f\u901a\u8fc7\u672c\u5730 fallback \u751f\u6210\u7684\u3002";
        }

        if (input.flags.includes("missing_information")) {
          return "\u56de\u7b54\u5df2\u57fa\u4e8e\u68c0\u7d22\u5230\u7684\u5185\u5bb9\uff0c\u4f46\u4ecd\u4e0d\u5b8c\u6574\uff1a\u90e8\u5206\u4fe1\u606f\u7f3a\u5931\u3002";
        }

        if (input.flags.includes("low_retrieval_score")) {
          return "\u56de\u7b54\u5df2\u57fa\u4e8e\u68c0\u7d22\u5230\u7684\u5185\u5bb9\uff0c\u4f46\u652f\u6301\u4e0a\u4e0b\u6587\u7684\u68c0\u7d22\u7f6e\u4fe1\u5ea6\u504f\u4f4e\u3002";
        }

        if (input.flags.includes("fallback_generation")) {
          return "\u56de\u7b54\u5df2\u57fa\u4e8e\u68c0\u7d22\u5230\u7684\u5185\u5bb9\uff0c\u4f46\u5b83\u662f\u901a\u8fc7\u672c\u5730 fallback \u751f\u6210\u7684\u3002";
        }

        return "\u56de\u7b54\u5df2\u57fa\u4e8e\u68c0\u7d22\u5230\u7684\u5185\u5bb9\uff0c\u4f46\u4ecd\u5b58\u5728\u672a\u89e3\u51b3\u7684\u8d28\u91cf\u9650\u5236\u3002";
      }

      if (
        input.flags.includes("missing_information") &&
        input.flags.includes("low_retrieval_score") &&
        input.flags.includes("fallback_generation")
      ) {
        return "Answer is grounded but incomplete because some information is missing, retrieval confidence was low, and it was produced through local fallback behavior.";
      }

      if (input.flags.includes("missing_information") && input.flags.includes("low_retrieval_score")) {
        return "Answer is grounded but incomplete because some information is missing, and retrieval confidence was low.";
      }

      if (input.flags.includes("missing_information") && input.flags.includes("fallback_generation")) {
        return "Answer is grounded but incomplete because some information is missing, and it was produced through local fallback behavior.";
      }

      if (input.flags.includes("low_retrieval_score") && input.flags.includes("fallback_generation")) {
        return "Answer is grounded, but retrieval confidence was low for the supporting context, and it was produced through local fallback behavior.";
      }

      if (input.flags.includes("missing_information")) {
        return "Answer is grounded but incomplete because some information is missing.";
      }

      if (input.flags.includes("low_retrieval_score")) {
        return "Answer is grounded, but retrieval confidence was low for the supporting context.";
      }

      if (input.flags.includes("fallback_generation")) {
        return "Answer is grounded, but it was produced through local fallback behavior.";
      }

      return "Answer is grounded but still has unresolved quality limitations.";
    }

    if (resolvedLanguage === "zh") {
      if (input.flags.includes("no_retrieval_hits")) {
        return "\u56de\u7b54\u8d28\u91cf\u8f83\u5f31\uff0c\u56e0\u4e3a\u6ca1\u6709\u8db3\u591f\u7684\u652f\u6301\u4e0a\u4e0b\u6587\u3002";
      }

      if (input.flags.includes("low_retrieval_score")) {
        return "\u56de\u7b54\u8d28\u91cf\u8f83\u5f31\uff0c\u56e0\u4e3a\u5373\u4f7f\u5df2\u68c0\u7d22\u5230\u4e0a\u4e0b\u6587\uff0c\u4ecd\u4e0d\u8db3\u4ee5\u652f\u6301\u53ef\u9760\u56de\u7b54\uff0c\u4e14\u68c0\u7d22\u7f6e\u4fe1\u5ea6\u504f\u4f4e\u3002";
      }

      return "\u56de\u7b54\u8d28\u91cf\u8f83\u5f31\uff0c\u56e0\u4e3a\u5373\u4f7f\u5df2\u68c0\u7d22\u5230\u4e0a\u4e0b\u6587\uff0c\u4ecd\u4e0d\u8db3\u4ee5\u652f\u6301\u53ef\u9760\u56de\u7b54\u3002";
    }

    if (input.flags.includes("no_retrieval_hits")) {
      return "Answer quality is weak because supporting context was insufficient.";
    }

    if (input.flags.includes("low_retrieval_score")) {
      return "Answer quality is weak because retrieved context was still insufficient, and retrieval confidence was low.";
    }

    return "Answer quality is weak because retrieved context was still insufficient.";
  }
}
