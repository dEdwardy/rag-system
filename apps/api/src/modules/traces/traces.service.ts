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
      ?? this.readStringAs<NonNullable<TraceSummary["retrievalMode"]>>(strategySummary?.retrievalMode);
    const strategyMode = this.readStringAs<NonNullable<TraceSummary["strategySummary"]["strategyMode"]>>(this.readObject(retrievalStrategy?.candidateSelection)?.mode)
      ?? this.readStringAs<NonNullable<TraceSummary["strategySummary"]["strategyMode"]>>(strategySummary?.strategyMode);
    const retrievalQuerySource = this.readStringAs<NonNullable<TraceSummary["retrievalQuerySource"]>>(queryRewriteMetadata?.finalQuerySource)
      ?? this.readStringAs<NonNullable<TraceSummary["retrievalQuerySource"]>>(strategySummary?.retrievalQuerySource);
    const rewriteApplied = trace.rewrittenQuery != null
      ? true
      : this.readBoolean(strategySummary?.rewriteApplied);
    const rewriteUsedFallback = this.readNullableBoolean(queryRewriteMetadata?.usedFallback)
      ?? this.readNullableBoolean(strategySummary?.rewriteUsedFallback);
    const fallbackReason = this.readStringAs<NonNullable<TraceSummary["fallbackReason"]>>(retrievalExecution?.fallbackReason)
      ?? this.readStringAs<NonNullable<TraceSummary["fallbackReason"]>>(strategySummary?.fallbackReason);
    const strategyUsedFallback = this.readNullableBoolean(retrievalExecution?.usedFallback)
      ?? this.readNullableBoolean(strategySummary?.usedFallback);

    return {
      promptId: this.readString(answeringMetadata?.promptId),
      answerStatus: this.readStringAs<NonNullable<TraceSummary["answerStatus"]>>(answeringMetadata?.answerStatus),
      qualityOverall: this.readStringAs<NonNullable<TraceSummary["qualityOverall"]>>(qualityEvaluation?.overall),
      primaryIssue: this.readStringAs<NonNullable<TraceSummary["primaryIssue"]>>(qualityEvaluation?.primaryIssue),
      retrievalMode,
      retrievalQuerySource,
      strategySummary: {
        retrievalMode,
        strategyMode,
        retrievalQuerySource,
        rewriteApplied,
        rewriteUsedFallback,
        fallbackReason,
        usedFallback: strategyUsedFallback
      },
      generationMode: this.readStringAs<NonNullable<TraceSummary["generationMode"]>>(answeringMetadata?.generationMode),
      contextMode,
      rewriteApplied,
      fallbackReason,
      resolvedLanguage: this.readStringAs<NonNullable<TraceSummary["resolvedLanguage"]>>(answeringMetadata?.resolvedLanguage),
      citationAttribution: this.readStringAs<NonNullable<TraceSummary["citationAttribution"]>>(answeringMetadata?.citationAttribution),
      citationSelectionSource: this.readStringAs<NonNullable<TraceSummary["citationSelectionSource"]>>(answeringMetadata?.citationSelectionSource),
      missingInformationCount: this.readNumber(answeringMetadata?.missingInformationCount) ?? 0,
      missingInformationSource: this.readStringAs<NonNullable<TraceSummary["missingInformationSource"]>>(answeringMetadata?.missingInformationSource),
      insufficientContextReason: this.readStringAs<NonNullable<TraceSummary["insufficientContextReason"]>>(answeringMetadata?.insufficientContextReason),
      answerTextSource: this.readStringAs<NonNullable<TraceSummary["answerTextSource"]>>(answeringMetadata?.answerTextSource),
      answerStatusSource: this.readStringAs<NonNullable<TraceSummary["answerStatusSource"]>>(answeringMetadata?.answerStatusSource),
      failedStage: this.readTraceFailedStage(retrievalFailure?.stage),
      failureMessage: this.readString(retrievalFailure?.message) ?? trace.errorMessage ?? null,
      candidateLimit: this.readNumber(retrievalExecution?.candidateLimit) ?? 0,
      vectorCandidateCount: this.readNumber(retrievalExecution?.vectorCandidateCount) ?? 0,
      lexicalCandidateCount: this.readNumber(retrievalExecution?.lexicalCandidateCount) ?? 0,
      mergedCandidateCount: this.readNumber(retrievalExecution?.mergedCandidateCount) ?? 0,
      rankedCandidateCount: this.readNumber(retrievalExecution?.rankedCandidateCount) ?? 0,
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
      citationCountBeforeLimit: this.readNumber(answeringMetadata?.citationCountBeforeLimit) ?? citationCount,
      citationLimitHit: this.readBoolean(answeringMetadata?.citationLimitHit),
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
}
