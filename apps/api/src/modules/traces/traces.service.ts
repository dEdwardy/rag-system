import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TraceStatus } from "@prisma/client";
import type { TraceSummary } from "@rag-system/shared";
import { PrismaService } from "../../infra/database/prisma.service";
import { ListConversationTracesInput } from "../documents/document.schemas";

type PersistedTrace = Awaited<ReturnType<PrismaService["answerTrace"]["findUnique"]>>;

const TRACE_FAILED_STAGE_VALUES = new Set<NonNullable<TraceSummary["failedStage"]>>([
  "retrieval",
  "answering"
]);

@Injectable()
export class TracesService {
  constructor(private readonly prisma: PrismaService) {}

  getTrace(id: string) {
    return this.prisma.answerTrace.findUnique({
      where: { id }
    }).then((trace) => {
      if (!trace) {
        throw new NotFoundException(`Trace ${id} not found.`);
      }

      return this.attachTraceSummary(trace);
    });
  }

  listConversationTraces(conversationId: string, input: ListConversationTracesInput) {
    return this.prisma.answerTrace.findMany({
      where: { conversationId },
      take: input.limit,
      select: {
        id: true,
        conversationId: true,
        assistantId: true,
        userMessageId: true,
        assistantMessageId: true,
        userQuery: true,
        rewrittenQuery: true,
        retrievedChunkIdsJson: true,
        retrievalMetadataJson: true,
        citationsJson: true,
        answeringMetadataJson: true,
        qualityEvaluationJson: true,
        modelName: true,
        latencyMs: true,
        status: true,
        errorMessage: true,
        createdAt: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }).then(traces => traces.map(trace => this.attachTraceListSummary(trace)));
  }

  createTrace(input: {
    conversationId: string;
    assistantId: string;
    userMessageId?: string;
    assistantMessageId?: string;
    userQuery: string;
    rewrittenQuery?: string | null;
    retrievedChunkIdsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    retrievalScoresJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    retrievalMetadataJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    citationsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    answeringMetadataJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    qualityEvaluationJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    modelName?: string;
    latencyMs?: number;
    status: TraceStatus;
    errorMessage?: string;
  }) {
    return this.prisma.answerTrace.create({
      data: input
    });
  }

  updateTrace(id: string, input: {
    assistantMessageId?: string;
    rewrittenQuery?: string | null;
    citationsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    retrievalMetadataJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    answeringMetadataJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    qualityEvaluationJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    latencyMs?: number;
    modelName?: string;
    status?: TraceStatus;
    errorMessage?: string;
    retrievedChunkIdsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    retrievalScoresJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  }) {
    return this.prisma.answerTrace.update({
      where: { id },
      data: input
    });
  }

  private attachTraceSummary(trace: NonNullable<PersistedTrace>) {
    return {
      ...trace,
      traceSummary: this.buildTraceSummary(trace)
    };
  }

  private attachTraceListSummary(trace: {
    id: string;
    conversationId: string;
    assistantId: string;
    userMessageId: string | null;
    assistantMessageId: string | null;
    userQuery: string;
    rewrittenQuery: string | null;
    retrievedChunkIdsJson: Prisma.JsonValue | null;
    retrievalMetadataJson: Prisma.JsonValue | null;
    citationsJson: Prisma.JsonValue | null;
    answeringMetadataJson: Prisma.JsonValue | null;
    qualityEvaluationJson: Prisma.JsonValue | null;
    modelName: string | null;
    latencyMs: number | null;
    status: TraceStatus;
    errorMessage: string | null;
    createdAt: Date;
  }) {
    return {
      id: trace.id,
      conversationId: trace.conversationId,
      assistantId: trace.assistantId,
      userMessageId: trace.userMessageId,
      assistantMessageId: trace.assistantMessageId,
      userQuery: trace.userQuery,
      rewrittenQuery: trace.rewrittenQuery,
      citationsJson: trace.citationsJson,
      modelName: trace.modelName,
      latencyMs: trace.latencyMs,
      status: trace.status,
      errorMessage: trace.errorMessage,
      createdAt: trace.createdAt,
      traceSummary: this.buildTraceSummary(trace)
    };
  }

  private buildTraceSummary(trace: {
    rewrittenQuery: string | null;
    retrievedChunkIdsJson: Prisma.JsonValue | null;
    retrievalMetadataJson: Prisma.JsonValue | null;
    citationsJson: Prisma.JsonValue | null;
    answeringMetadataJson: Prisma.JsonValue | null;
    qualityEvaluationJson: Prisma.JsonValue | null;
    errorMessage: string | null;
  }): TraceSummary {
    const retrievedChunkCount = this.readRetrievedChunkCount(trace);
    const citationCount = Array.isArray(trace.citationsJson) ? trace.citationsJson.length : 0;
    const retrievalMetadata = this.readObject(trace.retrievalMetadataJson);
    const retrievalStrategy = this.readObject(retrievalMetadata?.strategy);
    const strategySummary = this.readObject(retrievalMetadata?.strategySummary);
    const queryRewriteMetadata = this.readObject(retrievalMetadata?.queryRewrite);
    const retrievalExecution = this.readObject(retrievalMetadata?.execution);
    const retrievalFailure = this.readObject(retrievalMetadata?.failure);
    const answeringMetadata = this.readObject(trace.answeringMetadataJson);
    const qualityEvaluation = this.readObject(trace.qualityEvaluationJson);
    const inputChunkCount = this.readNumber(answeringMetadata?.inputChunkCount) ?? retrievedChunkCount;
    const contextGroupCount = this.readNumber(answeringMetadata?.contextGroupCount) ?? 0;
    const contextMode = this.readStringAs<NonNullable<TraceSummary["contextMode"]>>(answeringMetadata?.contextMode);
    const promptContextCount = this.readNumber(answeringMetadata?.promptContextCount)
      ?? (contextMode === "context_groups" ? contextGroupCount : inputChunkCount);
    const retrievalMode = this.readStringAs<NonNullable<TraceSummary["retrievalMode"]>>(retrievalExecution?.actualMode)
      ?? this.readStringAs<NonNullable<TraceSummary["retrievalMode"]>>(strategySummary?.retrievalMode)
      ?? this.readStringAs<NonNullable<TraceSummary["retrievalMode"]>>(retrievalMetadata?.retrievalMode);
    const strategyRetrievalQuerySource = this.readStringAs<NonNullable<TraceSummary["retrievalQuerySource"]>>(
      strategySummary?.retrievalQuerySource
    );
    const legacyRetrievalQuerySource = this.readStringAs<NonNullable<TraceSummary["retrievalQuerySource"]>>(
      retrievalMetadata?.retrievalQuerySource
    );
    const strategyMode = this.readStringAs<NonNullable<TraceSummary["strategySummary"]["strategyMode"]>>(this.readObject(retrievalStrategy?.candidateSelection)?.mode)
      ?? this.readStringAs<NonNullable<TraceSummary["strategySummary"]["strategyMode"]>>(strategySummary?.strategyMode)
      ?? this.readStringAs<NonNullable<TraceSummary["strategySummary"]["strategyMode"]>>(strategySummary?.retrievalMode)
      ?? retrievalMode;
    const queryRewriteFinalQuerySource = this.readStringAs<NonNullable<TraceSummary["retrievalQuerySource"]>>(
      queryRewriteMetadata?.finalQuerySource
    );
    const rewriteApplied = trace.rewrittenQuery != null
      ? true
      : this.readNullableBoolean(queryRewriteMetadata?.applied)
        ?? this.readNullableBoolean(strategySummary?.rewriteApplied)
        ?? (queryRewriteFinalQuerySource === "rewritten" ? true : null)
        ?? (strategyRetrievalQuerySource === "rewritten" ? true : null)
        ?? (legacyRetrievalQuerySource === "rewritten" ? true : null)
        ?? false;
    let retrievalQuerySource = queryRewriteFinalQuerySource
      ?? strategyRetrievalQuerySource
      ?? legacyRetrievalQuerySource
      ?? (rewriteApplied ? "rewritten" : null);
    const rewriteEnabled = this.readNullableBoolean(queryRewriteMetadata?.enabled)
      ?? this.readNullableBoolean(strategySummary?.rewriteEnabled)
      ?? this.readNullableBoolean(retrievalMetadata?.rewriteEnabled)
      ?? (rewriteApplied ? true : null)
      ?? (retrievalQuerySource === "original_disabled" ? false : retrievalQuerySource != null);
    if (retrievalQuerySource == null) {
      retrievalQuerySource = rewriteEnabled === false
        ? "original_disabled"
        : rewriteEnabled === true
          ? "original_unchanged"
          : null;
    }
    const rewriteUsedFallback = this.readNullableBoolean(queryRewriteMetadata?.usedFallback)
      ?? this.readNullableBoolean(strategySummary?.rewriteUsedFallback)
      ?? this.readNullableBoolean(retrievalMetadata?.rewriteUsedFallback);
    const rewritePromptId = this.readString(queryRewriteMetadata?.promptId)
      ?? this.readString(strategySummary?.rewritePromptId)
      ?? this.readString(retrievalMetadata?.rewritePromptId);
    const rewriteModelName = this.readString(queryRewriteMetadata?.modelName)
      ?? this.readString(strategySummary?.rewriteModelName)
      ?? this.readString(retrievalMetadata?.rewriteModelName);
    const citationAttribution = this.readStringAs<NonNullable<TraceSummary["citationAttribution"]>>(
      answeringMetadata?.citationAttribution
    );
    const citationSelectionSource = this.readStringAs<NonNullable<TraceSummary["citationSelectionSource"]>>(
      answeringMetadata?.citationSelectionSource
    );
    const answerEvidenceSource = citationSelectionSource;
    const fallbackReason = this.readStringAs<NonNullable<TraceSummary["fallbackReason"]>>(retrievalExecution?.fallbackReason)
      ?? this.readStringAs<NonNullable<TraceSummary["fallbackReason"]>>(strategySummary?.fallbackReason)
      ?? this.readStringAs<NonNullable<TraceSummary["fallbackReason"]>>(retrievalMetadata?.fallbackReason);
    const strategyUsedFallback = this.readNullableBoolean(retrievalExecution?.usedFallback)
      ?? this.readNullableBoolean(strategySummary?.usedFallback)
      ?? this.readNullableBoolean(retrievalMetadata?.usedFallback)
      ?? (fallbackReason != null ? true : null);
    const answerAttributionReadability = this.buildAnswerAttributionReadability(citationAttribution, citationSelectionSource);
    const answerAttributionLabel = this.buildAnswerAttributionLabel(citationAttribution);
    const answerAttributionSourceLabel = this.buildAnswerAttributionSourceLabel(citationSelectionSource);
    const answerAttributionReadabilityLabel = this.buildAnswerAttributionReadabilityLabel(
      answerAttributionLabel,
      answerAttributionSourceLabel
    );
    const answerAttributionReadabilityHint = this.buildAnswerAttributionReadabilityHint(
      answerAttributionLabel,
      answerAttributionSourceLabel
    );
    const answerAttributionReadabilityResolvedLabel = this.buildAnswerAttributionReadabilityResolvedLabel(
      answerAttributionLabel,
      answerAttributionSourceLabel
    );
    const answerAttributionReadabilitySentence = this.buildAnswerAttributionReadabilitySentence(
      citationAttribution,
      citationSelectionSource
    );
    const answerTextSource = this.readStringAs<NonNullable<TraceSummary["answerTextSource"]>>(answeringMetadata?.answerTextSource);
    const answerStatusSource = this.readStringAs<NonNullable<TraceSummary["answerStatusSource"]>>(answeringMetadata?.answerStatusSource);
    const missingInformationSource = this.readStringAs<NonNullable<TraceSummary["missingInformationSource"]>>(answeringMetadata?.missingInformationSource);
    const insufficientContextReason = this.readStringAs<NonNullable<TraceSummary["insufficientContextReason"]>>(answeringMetadata?.insufficientContextReason);
    const missingInformationCount = this.readNumber(answeringMetadata?.missingInformationCount) ?? 0;
    const citationCountBeforeLimit = this.readNumber(answeringMetadata?.citationCountBeforeLimit) ?? citationCount;
    const citationLimitHit = this.readBoolean(answeringMetadata?.citationLimitHit);
    const missingInformationCountReadabilityLabel = this.buildMissingInformationCountReadabilityLabel(missingInformationCount);
    const citationCountReadabilityLabel = this.buildCitationCountReadabilityLabel({
      citationCount,
      citationCountBeforeLimit,
      citationLimitHit
    });
    const missingInformationProvenanceSentence = this.buildMissingInformationProvenanceSentence({
      missingInformationSource,
      insufficientContextReason,
      missingInformationCount
    });
    const answerProvenanceSentence = this.buildAnswerProvenanceSentence({
      answerTextSource,
      answerStatusSource,
      answerAttributionReadabilityResolvedLabel
    });
    const answerTextSourceReadabilityLabel = this.buildAnswerTextSourceReadabilityLabel(answerTextSource);
    const answerStatusSourceReadabilityLabel = this.buildAnswerStatusSourceReadabilityLabel(answerStatusSource);
    const answerEvidenceSourceReadabilityLabel = this.buildAnswerEvidenceSourceReadabilityLabel(answerEvidenceSource);
    const rawFailedStage = this.readString(retrievalFailure?.stage);
    const failedStage = this.readTraceFailedStage(rawFailedStage);
    const candidateLimit = this.readNumber(retrievalExecution?.candidateLimit) ?? 0;
    const vectorCandidateCount = this.readNumber(retrievalExecution?.vectorCandidateCount) ?? 0;
    const lexicalCandidateCount = this.readNumber(retrievalExecution?.lexicalCandidateCount) ?? 0;
    const mergedCandidateCount = this.readNumber(retrievalExecution?.mergedCandidateCount) ?? 0;
    const rankedCandidateCount = this.readNumber(retrievalExecution?.rankedCandidateCount) ?? 0;
    const candidateCountReadabilityLabel = this.buildCandidateCountReadabilityLabel({
      candidateLimit,
      vectorCandidateCount,
      lexicalCandidateCount,
      mergedCandidateCount,
      rankedCandidateCount
    });

    return {
      promptId: this.readString(answeringMetadata?.promptId),
      answerStatus: this.readStringAs<NonNullable<TraceSummary["answerStatus"]>>(answeringMetadata?.answerStatus),
      qualityOverall: this.readStringAs<NonNullable<TraceSummary["qualityOverall"]>>(qualityEvaluation?.overall),
      primaryIssue: this.readStringAs<NonNullable<TraceSummary["primaryIssue"]>>(qualityEvaluation?.primaryIssue),
      retrievalMode,
      retrievalQuerySource,
      strategyReadabilityLabel: this.buildStrategyReadabilityLabel({
        retrievalMode,
        retrievalQuerySource,
        fallbackReason,
        strategyUsedFallback
      }),
      rewriteReadabilityLabel: this.buildRewriteReadabilityLabel({
        rewriteEnabled,
        rewriteApplied,
        rewriteUsedFallback,
        rewritePromptId
      }),
      strategySummary: {
        retrievalMode,
        strategyMode,
        retrievalQuerySource,
        rewriteEnabled,
        rewriteApplied,
        rewriteUsedFallback,
        rewritePromptId,
        rewriteModelName,
        fallbackReason,
        usedFallback: strategyUsedFallback
      },
      generationMode: this.readStringAs<NonNullable<TraceSummary["generationMode"]>>(answeringMetadata?.generationMode),
      contextMode,
      rewriteApplied,
      fallbackReason,
      resolvedLanguage: this.readStringAs<NonNullable<TraceSummary["resolvedLanguage"]>>(answeringMetadata?.resolvedLanguage),
      answerAttributionSummary: {
        attribution: citationAttribution,
        source: citationSelectionSource,
        readability: answerAttributionReadability,
        attributionLabel: answerAttributionLabel,
        sourceLabel: answerAttributionSourceLabel,
        readabilityLabel: answerAttributionReadabilityLabel,
        readabilityHint: answerAttributionReadabilityHint,
        readabilityResolvedLabel: answerAttributionReadabilityResolvedLabel,
        readabilitySentence: answerAttributionReadabilitySentence
      },
      answerAttribution: citationAttribution,
      answerAttributionSource: citationSelectionSource,
      answerEvidenceSource,
      answerEvidenceSourceReadabilityLabel,
      citationAttribution,
      citationSelectionSource,
      missingInformationCount,
      missingInformationCountReadabilityLabel,
      missingInformationSource,
      insufficientContextReason,
      missingInformationProvenanceSentence,
      answerTextSource,
      answerTextSourceReadabilityLabel,
      answerStatusSource,
      answerStatusSourceReadabilityLabel,
      answerProvenanceSentence,
      failedStage,
      failedStageReadabilityLabel: this.buildFailedStageReadabilityLabel({
        failedStage,
        rawFailedStage
      }),
      failureMessage: this.readString(retrievalFailure?.message) ?? trace.errorMessage ?? null,
      candidateLimit,
      vectorCandidateCount,
      lexicalCandidateCount,
      mergedCandidateCount,
      rankedCandidateCount,
      candidateCountReadabilityLabel,
      vectorCandidateLimitHit: this.readBoolean(retrievalExecution?.vectorCandidateLimitHit),
      lexicalCandidateLimitHit: this.readBoolean(retrievalExecution?.lexicalCandidateLimitHit),
      rankingTopKHit: this.readBoolean(retrievalExecution?.rankingTopKHit),
      primaryChunkCount: this.readNumber(retrievalExecution?.primaryChunkCount) ?? retrievedChunkCount,
      neighborChunkCount: this.readNumber(retrievalExecution?.neighborChunkCount) ?? 0,
      retrievedChunkCount,
      inputChunkCount,
      promptContextCount,
      contextGroupCount,
      citationCount,
      citationCountReadabilityLabel,
      citationCountBeforeLimit,
      citationLimitHit,
      usedFallback: this.readBoolean(answeringMetadata?.usedFallback)
    } satisfies TraceSummary;
  }

  private readRetrievedChunkCount(trace: {
    retrievedChunkIdsJson: Prisma.JsonValue | null;
    retrievalMetadataJson: Prisma.JsonValue | null;
  }) {
    const retrievalMetadata = this.readObject(trace.retrievalMetadataJson);
    const execution = this.readObject(retrievalMetadata?.execution);
    const executionCount = this.readNumber(execution?.retrievedChunkCount);
    if (executionCount != null) {
      return executionCount;
    }

    return Array.isArray(trace.retrievedChunkIdsJson) ? trace.retrievedChunkIdsJson.length : 0;
  }

  private readObject(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private readString(value: unknown) {
    return typeof value === "string" ? value : null;
  }

  private readStringAs<T extends string>(value: unknown): T | null {
    return typeof value === "string" ? (value as T) : null;
  }

  private readTraceFailedStage(value: unknown): NonNullable<TraceSummary["failedStage"]> | null {
    return typeof value === "string" && TRACE_FAILED_STAGE_VALUES.has(value as NonNullable<TraceSummary["failedStage"]>)
      ? (value as NonNullable<TraceSummary["failedStage"]>)
      : null;
  }

  private readBoolean(value: unknown) {
    return typeof value === "boolean" ? value : false;
  }

  private readNullableBoolean(value: unknown) {
    return typeof value === "boolean" ? value : null;
  }

  private readNumber(value: unknown) {
    return typeof value === "number" ? value : null;
  }

  private buildAnswerAttributionReadability(
    attribution: TraceSummary["answerAttribution"],
    source: TraceSummary["answerAttributionSource"]
  ): TraceSummary["answerAttributionSummary"]["readability"] {
    return attribution != null && source != null
      ? `${attribution}:${source}`
      : null;
  }

  private buildAnswerAttributionLabel(
    attribution: TraceSummary["answerAttribution"]
  ): TraceSummary["answerAttributionSummary"]["attributionLabel"] {
    if (attribution == null) {
      return null;
    }

    return attribution === "none"
      ? "no attribution"
      : `${attribution} attribution`;
  }

  private buildAnswerAttributionSourceLabel(
    source: TraceSummary["answerAttributionSource"]
  ): TraceSummary["answerAttributionSummary"]["sourceLabel"] {
    if (source == null) {
      return null;
    }

    return source === "none"
      ? "no source evidence"
      : source === "inline_markers"
        ? "inline-marker source"
        : `${source} source`;
  }

  private buildAnswerAttributionReadabilityLabel(
    attributionLabel: TraceSummary["answerAttributionSummary"]["attributionLabel"],
    sourceLabel: TraceSummary["answerAttributionSummary"]["sourceLabel"]
  ): TraceSummary["answerAttributionSummary"]["readabilityLabel"] {
    if (attributionLabel == null || sourceLabel == null) {
      return null;
    }

    return `${attributionLabel} via ${sourceLabel}`;
  }

  private buildAnswerAttributionReadabilityHint(
    attributionLabel: TraceSummary["answerAttributionSummary"]["attributionLabel"],
    sourceLabel: TraceSummary["answerAttributionSummary"]["sourceLabel"]
  ): TraceSummary["answerAttributionSummary"]["readabilityHint"] {
    if (attributionLabel != null && sourceLabel != null) {
      return `${attributionLabel} via ${sourceLabel}`;
    }

    if (attributionLabel != null) {
      return `${attributionLabel} via unknown source`;
    }

    if (sourceLabel != null) {
      return `unknown attribution via ${sourceLabel}`;
    }

    return null;
  }

  private buildAnswerAttributionReadabilityResolvedLabel(
    attributionLabel: TraceSummary["answerAttributionSummary"]["attributionLabel"],
    sourceLabel: TraceSummary["answerAttributionSummary"]["sourceLabel"]
  ): TraceSummary["answerAttributionSummary"]["readabilityResolvedLabel"] {
    const resolvedAttributionLabel = attributionLabel ?? "unknown attribution";
    const resolvedSourceLabel = sourceLabel ?? "unknown source";
    return `${resolvedAttributionLabel} via ${resolvedSourceLabel}`;
  }

  private buildAnswerAttributionReadabilitySentence(
    attribution: TraceSummary["answerAttribution"],
    source: TraceSummary["answerAttributionSource"]
  ): TraceSummary["answerAttributionSummary"]["readabilitySentence"] {
    const attributionValue = attribution ?? "unknown";
    const sourceValue = source ?? "unknown";
    return `Answer attribution is ${attributionValue}; source evidence is ${sourceValue}.`;
  }

  private buildAnswerProvenanceSentence(input: {
    answerTextSource: TraceSummary["answerTextSource"];
    answerStatusSource: TraceSummary["answerStatusSource"];
    answerAttributionReadabilityResolvedLabel: TraceSummary["answerAttributionSummary"]["readabilityResolvedLabel"];
  }): TraceSummary["answerProvenanceSentence"] {
    const textSourceValue = input.answerTextSource ?? "unknown";
    const statusSourceValue = input.answerStatusSource ?? "unknown";
    return `Answer text source is ${textSourceValue}; status source is ${statusSourceValue}; attribution summary is ${input.answerAttributionReadabilityResolvedLabel}.`;
  }

  private buildAnswerTextSourceReadabilityLabel(
    answerTextSource: TraceSummary["answerTextSource"]
  ): TraceSummary["answerTextSourceReadabilityLabel"] {
    if (answerTextSource === "model") {
      return "model-generated answer text";
    }

    if (answerTextSource === "deterministic_policy") {
      return "deterministic policy answer text";
    }

    return "unknown answer text source";
  }

  private buildAnswerEvidenceSourceReadabilityLabel(
    answerEvidenceSource: TraceSummary["answerEvidenceSource"]
  ): TraceSummary["answerEvidenceSourceReadabilityLabel"] {
    if (answerEvidenceSource === "structured") {
      return "structured evidence source";
    }

    if (answerEvidenceSource === "inline_markers") {
      return "inline-marker evidence source";
    }

    if (answerEvidenceSource === "heuristic") {
      return "heuristic evidence source";
    }

    if (answerEvidenceSource === "none") {
      return "no evidence source";
    }

    return "unknown evidence source";
  }

  private buildMissingInformationProvenanceSentence(input: {
    missingInformationSource: TraceSummary["missingInformationSource"];
    insufficientContextReason: TraceSummary["insufficientContextReason"];
    missingInformationCount: number;
  }): TraceSummary["missingInformationProvenanceSentence"] {
    const sourceValue = input.missingInformationSource ?? "unknown";
    const insufficientReasonValue = input.insufficientContextReason ?? "none";
    return `Missing-information source is ${sourceValue}; insufficient-context reason is ${insufficientReasonValue}; missing-information count is ${input.missingInformationCount}.`;
  }

  private buildMissingInformationCountReadabilityLabel(
    missingInformationCount: TraceSummary["missingInformationCount"]
  ): TraceSummary["missingInformationCountReadabilityLabel"] {
    if (missingInformationCount === 0) {
      return "no missing-information items";
    }

    if (missingInformationCount === 1) {
      return "1 missing-information item";
    }

    return `${missingInformationCount} missing-information items`;
  }

  private buildCitationCountReadabilityLabel(input: {
    citationCount: TraceSummary["citationCount"];
    citationCountBeforeLimit: TraceSummary["citationCountBeforeLimit"];
    citationLimitHit: TraceSummary["citationLimitHit"];
  }): TraceSummary["citationCountReadabilityLabel"] {
    if (!input.citationLimitHit) {
      if (input.citationCount === 0) {
        return "no citations";
      }

      if (input.citationCount === 1) {
        return "1 citation";
      }

      return `${input.citationCount} citations`;
    }

    if (input.citationCount === 1) {
      return `1 citation shown (${input.citationCountBeforeLimit} before limit)`;
    }

    return `${input.citationCount} citations shown (${input.citationCountBeforeLimit} before limit)`;
  }

  private buildCandidateCountReadabilityLabel(input: {
    candidateLimit: TraceSummary["candidateLimit"];
    vectorCandidateCount: TraceSummary["vectorCandidateCount"];
    lexicalCandidateCount: TraceSummary["lexicalCandidateCount"];
    mergedCandidateCount: TraceSummary["mergedCandidateCount"];
    rankedCandidateCount: TraceSummary["rankedCandidateCount"];
  }): TraceSummary["candidateCountReadabilityLabel"] {
    return `vector ${input.vectorCandidateCount}, lexical ${input.lexicalCandidateCount}, merged ${input.mergedCandidateCount}, ranked ${input.rankedCandidateCount} (candidate limit ${input.candidateLimit})`;
  }

  private buildAnswerStatusSourceReadabilityLabel(
    answerStatusSource: TraceSummary["answerStatusSource"]
  ): TraceSummary["answerStatusSourceReadabilityLabel"] {
    if (answerStatusSource === "model") {
      return "model-decided answer status";
    }

    if (answerStatusSource === "inferred_from_retrieval") {
      return "retrieval-inferred answer status";
    }

    if (answerStatusSource === "deterministic_policy") {
      return "deterministic policy answer status";
    }

    return "unknown answer status source";
  }

  private buildFailedStageReadabilityLabel(input: {
    failedStage: TraceSummary["failedStage"];
    rawFailedStage: string | null;
  }): TraceSummary["failedStageReadabilityLabel"] {
    if (input.failedStage === "retrieval") {
      return "retrieval stage failed";
    }

    if (input.failedStage === "answering") {
      return "answering stage failed";
    }

    if (input.rawFailedStage != null) {
      return `unknown failed stage (${input.rawFailedStage})`;
    }

    return "unknown failed stage";
  }

  private buildStrategyReadabilityLabel(input: {
    retrievalMode: TraceSummary["retrievalMode"];
    retrievalQuerySource: TraceSummary["retrievalQuerySource"];
    fallbackReason: TraceSummary["fallbackReason"];
    strategyUsedFallback: TraceSummary["strategySummary"]["usedFallback"];
  }) {
    const retrievalModeLabel = input.retrievalMode ?? "unknown mode";
    const querySourceLabel = input.retrievalQuerySource ?? "unknown query source";
    const fallbackLabel = input.fallbackReason ?? "none";
    const fallbackUsageLabel = input.strategyUsedFallback == null
      ? "unknown"
      : input.strategyUsedFallback
        ? "yes"
        : "no";
    return `${retrievalModeLabel} retrieval via ${querySourceLabel}; fallback: ${fallbackLabel}; fallback used: ${fallbackUsageLabel}.`;
  }

  private buildRewriteReadabilityLabel(input: {
    rewriteEnabled: TraceSummary["strategySummary"]["rewriteEnabled"];
    rewriteApplied: TraceSummary["strategySummary"]["rewriteApplied"];
    rewriteUsedFallback: TraceSummary["strategySummary"]["rewriteUsedFallback"];
    rewritePromptId: TraceSummary["strategySummary"]["rewritePromptId"];
  }): TraceSummary["rewriteReadabilityLabel"] {
    const rewriteEnabledLabel = input.rewriteEnabled ? "enabled" : "disabled";
    const rewriteAppliedLabel = input.rewriteApplied ? "yes" : "no";
    const rewriteFallbackLabel = input.rewriteUsedFallback == null
      ? "unknown"
      : input.rewriteUsedFallback
        ? "yes"
        : "no";
    const rewritePromptLabel = input.rewritePromptId ?? "unknown";
    return `rewrite ${rewriteEnabledLabel}; rewrite applied: ${rewriteAppliedLabel}; rewrite fallback: ${rewriteFallbackLabel}; rewrite prompt: ${rewritePromptLabel}.`;
  }
}
