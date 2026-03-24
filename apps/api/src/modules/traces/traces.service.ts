import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TraceStatus } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";

type PersistedTrace = Awaited<ReturnType<PrismaService["answerTrace"]["findUnique"]>>;

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

  listConversationTraces(conversationId: string) {
    return this.prisma.answerTrace.findMany({
      where: { conversationId },
      orderBy: {
        createdAt: "desc"
      }
    }).then(traces => traces.map(trace => this.attachTraceSummary(trace)));
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
    const retrievedChunkCount = this.readRetrievedChunkCount(trace);
    const citationCount = Array.isArray(trace.citationsJson) ? trace.citationsJson.length : 0;
    const retrievalMetadata = this.readObject(trace.retrievalMetadataJson);
    const queryRewriteMetadata = this.readObject(retrievalMetadata?.queryRewrite);
    const retrievalExecution = this.readObject(retrievalMetadata?.execution);
    const retrievalFailure = this.readObject(retrievalMetadata?.failure);
    const answeringMetadata = this.readObject(trace.answeringMetadataJson);
    const qualityEvaluation = this.readObject(trace.qualityEvaluationJson);

    return {
      ...trace,
      traceSummary: {
        answerStatus: this.readString(answeringMetadata?.answerStatus),
        qualityOverall: this.readString(qualityEvaluation?.overall),
        primaryIssue: this.readString(qualityEvaluation?.primaryIssue),
        retrievalMode: this.readString(retrievalExecution?.actualMode),
        retrievalQuerySource: this.readString(queryRewriteMetadata?.finalQuerySource),
        generationMode: this.readString(answeringMetadata?.generationMode),
        contextMode: this.readString(answeringMetadata?.contextMode),
        rewriteApplied: trace.rewrittenQuery != null,
        fallbackReason: this.readString(retrievalExecution?.fallbackReason),
        resolvedLanguage: this.readString(answeringMetadata?.resolvedLanguage),
        citationAttribution: this.readString(answeringMetadata?.citationAttribution),
        citationSelectionSource: this.readString(answeringMetadata?.citationSelectionSource),
        missingInformationCount: this.readNumber(answeringMetadata?.missingInformationCount) ?? 0,
        insufficientContextReason: this.readString(answeringMetadata?.insufficientContextReason),
        answerTextSource: this.readString(answeringMetadata?.answerTextSource),
        answerStatusSource: this.readString(answeringMetadata?.answerStatusSource),
        failedStage: this.readString(retrievalFailure?.stage),
        failureMessage: this.readString(retrievalFailure?.message) ?? trace.errorMessage ?? null,
        retrievedChunkCount,
        citationCount,
        usedFallback: this.readBoolean(answeringMetadata?.usedFallback)
      }
    };
  }

  private readRetrievedChunkCount(trace: NonNullable<PersistedTrace>) {
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

  private readBoolean(value: unknown) {
    return typeof value === "boolean" ? value : false;
  }

  private readNumber(value: unknown) {
    return typeof value === "number" ? value : null;
  }
}
