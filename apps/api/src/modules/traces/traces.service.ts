import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TraceStatus } from '@prisma/client';
import {
  buildTraceExecutionModeReadabilityLabel,
  buildTraceExecutionModeReadabilitySentence,
  buildTraceExecutionToolNamesLabel,
  buildTraceExecutionToolNamesReadabilitySentence,
  collectTraceExecutionToolNames,
  readTraceExecutionMode,
  readTraceExecutionToolName,
  type TraceExecutionPlan,
  type TraceSummary
} from '@rag-system/shared';
import { PrismaService } from '../../infra/database/prisma.service';
import {
  buildAnswerEvidenceSourceReadabilityLabel,
  buildAnswerAttributionSummary
} from '../answering/answer-attribution-summary';
import {
  buildAnswerProvenanceFields,
  buildAnswerSourceReadability
} from '../answering/answer-source-readability';
import { buildMissingInformationProvenanceSentence } from '../answering/missing-information-provenance';
import { buildMissingInformationSourceReadabilityLabel } from '../answering/missing-information-source-readability';
import {
  buildRewriteReadabilityLabel,
  buildRetrievalModeProvenanceSentence,
  buildStrategyReadabilityLabel
} from '../retrieval/strategy-readability';
import {
  ListConversationTracesInput,
  ListTracesInput
} from '../documents/document.schemas';

type PersistedTrace = Awaited<
  ReturnType<PrismaService['answerTrace']['findUnique']>
>;

const TRACE_FAILED_STAGE_VALUES = new Set<
  NonNullable<TraceSummary['failedStage']>
>(['retrieval', 'answering']);

const TRACE_ANSWER_TEXT_SOURCE_VALUES = new Set<
  NonNullable<TraceSummary['answerTextSource']>
>(['model', 'deterministic_policy']);

const TRACE_ANSWER_STATUS_SOURCE_VALUES = new Set<
  NonNullable<TraceSummary['answerStatusSource']>
>(['model', 'inferred_from_retrieval', 'deterministic_policy']);

const TRACE_ROUTE_TYPE_VALUES = new Set<NonNullable<TraceSummary['routeType']>>(
  ['knowledge_base', 'policy_reply', 'external_source']
);

const TRACE_ROUTE_REASON_VALUES = new Set<
  NonNullable<TraceSummary['routeReason']>
>([
  'default_kb_ask',
  'policy_question',
  'explicit_source_url',
  'explicit_source_urls'
]);

@Injectable()
export class TracesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly traceListSelect = {
    id: true,
    conversationId: true,
    assistantId: true,
    userMessageId: true,
    assistantMessageId: true,
    userQuery: true,
    rewrittenQuery: true,
    retrievedChunkIdsJson: true,
    retrievalScoresJson: true,
    retrievalMetadataJson: true,
    citationsJson: true,
    answeringMetadataJson: true,
    qualityEvaluationJson: true,
    modelName: true,
    latencyMs: true,
    status: true,
    errorMessage: true,
    createdAt: true
  } satisfies Prisma.AnswerTraceSelect;

  getTrace(id: string, scope?: { tenantId: string; userId: string } | null) {
    const traceLookup =
      scope != null
        ? this.prisma.answerTrace.findFirst({
            where: {
              id,
              conversation: {
                tenantId: scope.tenantId,
                userId: scope.userId
              }
            },
            select: this.traceListSelect
          })
        : this.prisma.answerTrace.findUnique({
            where: { id },
            select: this.traceListSelect
          });

    return traceLookup.then((trace) => {
      if (!trace) {
        throw new NotFoundException(`Trace ${id} not found.`);
      }

      return this.attachTraceSummary(trace);
    });
  }

  listConversationTraces(
    conversationId: string,
    input: ListConversationTracesInput,
    scope?: { tenantId: string; userId: string } | null
  ) {
    return this.prisma.answerTrace
      .findMany({
        where:
          scope != null
            ? {
                conversationId,
                conversation: {
                  tenantId: scope.tenantId,
                  userId: scope.userId
                }
              }
            : { conversationId },
        take: input.limit,
        select: this.traceListSelect,
        orderBy: {
          createdAt: 'desc'
        }
      })
      .then((traces) =>
        traces.map((trace) => this.attachTraceListSummary(trace))
      );
  }

  listTraces(
    input: ListTracesInput,
    scope?: { tenantId: string; userId: string } | null
  ) {
    const normalizedQuery = input.query?.trim() ?? null;
    const normalizedRouteType = input.routeType ?? null;
    const normalizedRouteReason = input.routeReason ?? null;
    const routeFilters = [
      ...(normalizedRouteType != null
        ? [
            {
              retrievalMetadataJson: {
                path: ['routeDecision', 'routeType'],
                equals: normalizedRouteType
              }
            }
          ]
        : []),
      ...(normalizedRouteReason != null
        ? [
            {
              retrievalMetadataJson: {
                path: ['routeDecision', 'routeReason'],
                equals: normalizedRouteReason
              }
            }
          ]
        : [])
    ];

    return this.prisma.answerTrace
      .findMany({
        where: {
          ...(routeFilters.length > 0 ? { AND: routeFilters } : {}),
          ...(scope != null
            ? {
                conversation: {
                  tenantId: scope.tenantId,
                  userId: scope.userId
                }
              }
            : {}),
          ...(normalizedQuery != null
            ? {
                OR: [
                  {
                    id: {
                      contains: normalizedQuery,
                      mode: 'insensitive'
                    }
                  },
                  {
                    userQuery: {
                      contains: normalizedQuery,
                      mode: 'insensitive'
                    }
                  },
                  {
                    rewrittenQuery: {
                      contains: normalizedQuery,
                      mode: 'insensitive'
                    }
                  }
                ]
              }
            : {})
        },
        take: input.limit,
        select: this.traceListSelect,
        orderBy: {
          createdAt: 'desc'
        }
      })
      .then((traces) =>
        traces.map((trace) => this.attachTraceListSummary(trace))
      );
  }

  listLatestConversationTraces(
    conversationIds: string[],
    scope?: { tenantId: string; userId: string } | null
  ) {
    if (conversationIds.length === 0) {
      return Promise.resolve([]);
    }

    if (typeof this.prisma.$queryRaw === 'function') {
      const scopedFilter =
        scope == null
          ? Prisma.empty
          : Prisma.sql`AND c."tenantId" = ${scope.tenantId} AND c."userId" = ${scope.userId}`;

      return this.prisma
        .$queryRaw<
          Array<{
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
          }>
        >(
          Prisma.sql`
          WITH ranked_traces AS (
            SELECT
              t."id",
              t."conversationId",
              t."assistantId",
              t."userMessageId",
              t."assistantMessageId",
              t."userQuery",
              t."rewrittenQuery",
              t."retrievedChunkIdsJson",
              t."retrievalMetadataJson",
              t."citationsJson",
              t."answeringMetadataJson",
              t."qualityEvaluationJson",
              t."modelName",
              t."latencyMs",
              t."status",
              t."errorMessage",
              t."createdAt",
              ROW_NUMBER() OVER (
                PARTITION BY t."conversationId"
                ORDER BY t."createdAt" DESC, t."id" DESC
              ) AS rn
            FROM "AnswerTrace" t
            JOIN "Conversation" c ON c."id" = t."conversationId"
            WHERE t."conversationId" IN (${Prisma.join(conversationIds)})
            ${scopedFilter}
          )
          SELECT
            "id",
            "conversationId",
            "assistantId",
            "userMessageId",
            "assistantMessageId",
            "userQuery",
            "rewrittenQuery",
            "retrievedChunkIdsJson",
            "retrievalMetadataJson",
            "citationsJson",
            "answeringMetadataJson",
            "qualityEvaluationJson",
            "modelName",
            "latencyMs",
            "status",
            "errorMessage",
            "createdAt"
          FROM ranked_traces
          WHERE rn = 1
        `
        )
        .then((traces) =>
          this.mapLatestConversationTraces(conversationIds, traces)
        );
    }

    return this.prisma.answerTrace
      .findMany({
        where: {
          conversationId: {
            in: conversationIds
          },
          ...(scope != null
            ? {
                conversation: {
                  tenantId: scope.tenantId,
                  userId: scope.userId
                }
              }
            : {})
        },
        select: this.traceListSelect,
        orderBy: [{ conversationId: 'asc' }, { createdAt: 'desc' }]
      })
      .then((traces) =>
        this.mapLatestConversationTraces(conversationIds, traces)
      );
  }

  private mapLatestConversationTraces(
    conversationIds: string[],
    traces: Array<{
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
    }>
  ) {
    const latestTraceByConversationId = new Map<
      string,
      ReturnType<typeof this.attachTraceListSummary>
    >();

    for (const trace of traces) {
      if (!latestTraceByConversationId.has(trace.conversationId)) {
        latestTraceByConversationId.set(
          trace.conversationId,
          this.attachTraceListSummary(trace)
        );
      }
    }

    return conversationIds.flatMap((conversationId) => {
      const trace = latestTraceByConversationId.get(conversationId);
      return trace == null ? [] : [{ conversationId, trace }];
    });
  }

  createTrace(input: {
    conversationId: string;
    assistantId: string;
    userMessageId?: string;
    assistantMessageId?: string;
    userQuery: string;
    rewrittenQuery?: string | null;
    retrievedChunkIdsJson?:
      | Prisma.InputJsonValue
      | Prisma.NullableJsonNullValueInput;
    retrievalScoresJson?:
      | Prisma.InputJsonValue
      | Prisma.NullableJsonNullValueInput;
    retrievalMetadataJson?:
      | Prisma.InputJsonValue
      | Prisma.NullableJsonNullValueInput;
    citationsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    answeringMetadataJson?:
      | Prisma.InputJsonValue
      | Prisma.NullableJsonNullValueInput;
    qualityEvaluationJson?:
      | Prisma.InputJsonValue
      | Prisma.NullableJsonNullValueInput;
    modelName?: string;
    latencyMs?: number;
    status: TraceStatus;
    errorMessage?: string;
  }) {
    return this.prisma.answerTrace.create({
      data: input
    });
  }

  updateTrace(
    id: string,
    input: {
      assistantMessageId?: string;
      rewrittenQuery?: string | null;
      citationsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
      retrievalMetadataJson?:
        | Prisma.InputJsonValue
        | Prisma.NullableJsonNullValueInput;
      answeringMetadataJson?:
        | Prisma.InputJsonValue
        | Prisma.NullableJsonNullValueInput;
      qualityEvaluationJson?:
        | Prisma.InputJsonValue
        | Prisma.NullableJsonNullValueInput;
      latencyMs?: number;
      modelName?: string;
      status?: TraceStatus;
      errorMessage?: string;
      retrievedChunkIdsJson?:
        | Prisma.InputJsonValue
        | Prisma.NullableJsonNullValueInput;
      retrievalScoresJson?:
        | Prisma.InputJsonValue
        | Prisma.NullableJsonNullValueInput;
    }
  ) {
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
    const citationCount = Array.isArray(trace.citationsJson)
      ? trace.citationsJson.length
      : 0;
    const retrievalMetadata = this.readObject(trace.retrievalMetadataJson);
    const retrievalStrategy = this.readObject(retrievalMetadata?.strategy);
    const strategySummary = this.readObject(retrievalMetadata?.strategySummary);
    const queryRewriteMetadata = this.readObject(
      retrievalMetadata?.queryRewrite
    );
    const retrievalExecution = this.readObject(retrievalMetadata?.execution);
    const timingMetadata = this.readObject(retrievalMetadata?.timing);
    const retrievalFailure = this.readObject(retrievalMetadata?.failure);
    const routeDecision = this.readObject(retrievalMetadata?.routeDecision);
    const executionPlan = this.readTraceExecutionPlan(
      retrievalMetadata?.executionPlan
    );
    const executionMode = this.readTraceSummaryExecutionMode(
      executionPlan?.executionMode
    );
    const executionToolNames = collectTraceExecutionToolNames(executionPlan);
    const answeringMetadata = this.readObject(trace.answeringMetadataJson);
    const qualityEvaluation = this.readObject(trace.qualityEvaluationJson);
    const inputChunkCount =
      this.readNumber(answeringMetadata?.inputChunkCount) ??
      retrievedChunkCount;
    const contextGroupCount =
      this.readNumber(answeringMetadata?.contextGroupCount) ?? 0;
    const contextMode = this.readStringAs<
      NonNullable<TraceSummary['contextMode']>
    >(answeringMetadata?.contextMode);
    const promptContextCount =
      this.readNumber(answeringMetadata?.promptContextCount) ??
      (contextMode === 'context_groups' ? contextGroupCount : inputChunkCount);
    const retrievalMode =
      this.readStringAs<NonNullable<TraceSummary['retrievalMode']>>(
        retrievalExecution?.actualMode
      ) ??
      this.readStringAs<NonNullable<TraceSummary['retrievalMode']>>(
        strategySummary?.retrievalMode
      ) ??
      this.readStringAs<NonNullable<TraceSummary['retrievalMode']>>(
        retrievalMetadata?.retrievalMode
      );
    const routeType = this.readTraceRouteType(routeDecision?.routeType);
    const routeReason = this.readTraceRouteReason(routeDecision?.routeReason);
    const strategyRetrievalQuerySource = this.readStringAs<
      NonNullable<TraceSummary['retrievalQuerySource']>
    >(strategySummary?.retrievalQuerySource);
    const legacyRetrievalQuerySource = this.readStringAs<
      NonNullable<TraceSummary['retrievalQuerySource']>
    >(retrievalMetadata?.retrievalQuerySource);
    const strategyMode =
      this.readStringAs<
        NonNullable<TraceSummary['strategySummary']['strategyMode']>
      >(this.readObject(retrievalStrategy?.candidateSelection)?.mode) ??
      this.readStringAs<
        NonNullable<TraceSummary['strategySummary']['strategyMode']>
      >(strategySummary?.strategyMode) ??
      this.readStringAs<
        NonNullable<TraceSummary['strategySummary']['strategyMode']>
      >(strategySummary?.retrievalMode) ??
      retrievalMode;
    const queryRewriteFinalQuerySource = this.readStringAs<
      NonNullable<TraceSummary['retrievalQuerySource']>
    >(queryRewriteMetadata?.finalQuerySource);
    const rewriteApplied =
      trace.rewrittenQuery != null
        ? true
        : (this.readNullableBoolean(queryRewriteMetadata?.applied) ??
          this.readNullableBoolean(strategySummary?.rewriteApplied) ??
          (queryRewriteFinalQuerySource === 'rewritten' ? true : null) ??
          (strategyRetrievalQuerySource === 'rewritten' ? true : null) ??
          (legacyRetrievalQuerySource === 'rewritten' ? true : null) ??
          false);
    let retrievalQuerySource =
      queryRewriteFinalQuerySource ??
      strategyRetrievalQuerySource ??
      legacyRetrievalQuerySource ??
      (rewriteApplied ? 'rewritten' : null);
    const rewriteEnabled =
      this.readNullableBoolean(queryRewriteMetadata?.enabled) ??
      this.readNullableBoolean(strategySummary?.rewriteEnabled) ??
      this.readNullableBoolean(retrievalMetadata?.rewriteEnabled) ??
      (rewriteApplied ? true : null) ??
      (retrievalQuerySource === 'original_disabled'
        ? false
        : retrievalQuerySource != null);
    if (retrievalQuerySource == null) {
      retrievalQuerySource =
        rewriteEnabled === false
          ? 'original_disabled'
          : rewriteEnabled === true
            ? 'original_unchanged'
            : null;
    }
    const rewriteUsedFallback =
      this.readNullableBoolean(queryRewriteMetadata?.usedFallback) ??
      this.readNullableBoolean(strategySummary?.rewriteUsedFallback) ??
      this.readNullableBoolean(retrievalMetadata?.rewriteUsedFallback);
    const rewriteSkippedReason =
      this.readStringAs<NonNullable<TraceSummary['rewriteSkippedReason']>>(
        queryRewriteMetadata?.skippedReason
      ) ??
      this.readStringAs<NonNullable<TraceSummary['rewriteSkippedReason']>>(
        strategySummary?.rewriteSkippedReason
      );
    const rewritePromptId =
      this.readString(queryRewriteMetadata?.promptId) ??
      this.readString(strategySummary?.rewritePromptId) ??
      this.readString(retrievalMetadata?.rewritePromptId);
    const rewriteModelName =
      this.readString(queryRewriteMetadata?.modelName) ??
      this.readString(strategySummary?.rewriteModelName) ??
      this.readString(retrievalMetadata?.rewriteModelName);
    const citationAttribution = this.readStringAs<
      NonNullable<TraceSummary['citationAttribution']>
    >(answeringMetadata?.citationAttribution);
    const citationSelectionSource = this.readStringAs<
      NonNullable<TraceSummary['citationSelectionSource']>
    >(answeringMetadata?.citationSelectionSource);
    const answerEvidenceSource = citationSelectionSource;
    const fallbackReason =
      this.readStringAs<NonNullable<TraceSummary['fallbackReason']>>(
        retrievalExecution?.fallbackReason
      ) ??
      this.readStringAs<NonNullable<TraceSummary['fallbackReason']>>(
        strategySummary?.fallbackReason
      ) ??
      this.readStringAs<NonNullable<TraceSummary['fallbackReason']>>(
        retrievalMetadata?.fallbackReason
      );
    const strategyUsedFallback =
      this.readNullableBoolean(retrievalExecution?.usedFallback) ??
      this.readNullableBoolean(strategySummary?.usedFallback) ??
      this.readNullableBoolean(retrievalMetadata?.usedFallback) ??
      (fallbackReason != null ? true : null);
    const retrievalModeProvenanceSentence =
      buildRetrievalModeProvenanceSentence({
        retrievalMode,
        strategyUsedFallback,
        fallbackReason
      });
    const answerAttributionSummary = buildAnswerAttributionSummary({
      attribution: citationAttribution,
      source: citationSelectionSource
    });
    const rawAnswerTextSource = this.readString(
      answeringMetadata?.answerTextSource
    );
    const answerTextSource = this.readTraceAnswerTextSource(
      answeringMetadata?.answerTextSource
    );
    const rawAnswerStatusSource = this.readString(
      answeringMetadata?.answerStatusSource
    );
    const answerStatusSource = this.readTraceAnswerStatusSource(
      answeringMetadata?.answerStatusSource
    );
    const rawMissingInformationSource = this.readString(
      answeringMetadata?.missingInformationSource
    );
    const missingInformationSource = this.readStringAs<
      NonNullable<TraceSummary['missingInformationSource']>
    >(answeringMetadata?.missingInformationSource);
    const insufficientContextReason = this.readStringAs<
      NonNullable<TraceSummary['insufficientContextReason']>
    >(answeringMetadata?.insufficientContextReason);
    const missingInformationCount =
      this.readNumber(answeringMetadata?.missingInformationCount) ?? 0;
    const rawCitationCountBeforeLimit = this.readNumber(
      answeringMetadata?.citationCountBeforeLimit
    );
    const citationCountBeforeLimit = Math.max(
      rawCitationCountBeforeLimit ?? citationCount,
      citationCount
    );
    const citationLimitHit = this.readBoolean(
      answeringMetadata?.citationLimitHit
    );
    const missingInformationCountReadabilityLabel =
      this.buildMissingInformationCountReadabilityLabel(
        missingInformationCount
      );
    const citationCountReadabilityLabel =
      this.buildCitationCountReadabilityLabel({
        citationCount,
        citationCountBeforeLimit,
        citationLimitHit
      });
    const citationCountReadabilitySentence =
      this.buildCitationCountReadabilitySentence(citationCountReadabilityLabel);
    const missingInformationProvenanceSentence =
      buildMissingInformationProvenanceSentence({
        missingInformationSource,
        insufficientContextReason,
        missingInformationCount
      });
    const missingInformationSourceReadabilityLabel =
      buildMissingInformationSourceReadabilityLabel({
        missingInformationSource,
        rawMissingInformationSource
      });
    const answerAttributionReadabilitySentence =
      answerAttributionSummary.readabilitySentence ??
      'Answer attribution is unknown; source evidence is unknown.';
    const executionModeReadabilityLabel =
      buildTraceExecutionModeReadabilityLabel(executionMode);
    const executionModeReadabilitySentence =
      buildTraceExecutionModeReadabilitySentence(executionMode);
    const executionToolNamesReadabilityLabel =
      buildTraceExecutionToolNamesLabel(executionToolNames);
    const executionToolNamesReadabilitySentence =
      buildTraceExecutionToolNamesReadabilitySentence(executionToolNames);
    const {
      answerTextSourceReadabilityLabel,
      answerTextSourceReadabilitySentence,
      answerStatusSourceReadabilityLabel,
      answerStatusSourceReadabilitySentence
    } = buildAnswerSourceReadability({
      answerTextSource,
      rawAnswerTextSource,
      answerStatusSource,
      rawAnswerStatusSource
    });
    const { answerProvenanceSentence, answerProvenanceReadabilitySentence } =
      buildAnswerProvenanceFields({
        answerTextSource,
        answerStatusSource,
        answerAttributionReadabilityResolvedLabel:
          answerAttributionSummary.readabilityResolvedLabel,
        answerTextSourceReadabilityLabel,
        answerStatusSourceReadabilityLabel,
        answerAttributionReadabilitySentence
      });
    const answerEvidenceSourceReadabilityLabel =
      buildAnswerEvidenceSourceReadabilityLabel(answerEvidenceSource);
    const answerEvidenceSourceReadabilitySentence =
      this.buildAnswerEvidenceSourceReadabilitySentence(
        answerEvidenceSourceReadabilityLabel
      );
    const rawFailedStage = this.readString(retrievalFailure?.stage);
    const failedStage = this.readTraceFailedStage(rawFailedStage);
    const failedStageReadabilityLabel = this.buildFailedStageReadabilityLabel({
      failedStage,
      rawFailedStage
    });
    const failureMessage =
      this.readString(retrievalFailure?.message) ?? trace.errorMessage ?? null;
    const candidateLimit =
      this.readNumber(retrievalExecution?.candidateLimit) ?? 0;
    const vectorCandidateCount =
      this.readNumber(retrievalExecution?.vectorCandidateCount) ?? 0;
    const lexicalCandidateCount =
      this.readNumber(retrievalExecution?.lexicalCandidateCount) ?? 0;
    const mergedCandidateCount =
      this.readNumber(retrievalExecution?.mergedCandidateCount) ?? 0;
    const rankedCandidateCount =
      this.readNumber(retrievalExecution?.rankedCandidateCount) ?? 0;
    const candidateCountReadabilityLabel =
      this.buildCandidateCountReadabilityLabel({
        candidateLimit,
        vectorCandidateCount,
        lexicalCandidateCount,
        mergedCandidateCount,
        rankedCandidateCount
      });
    const candidateCountReadabilitySentence =
      this.buildCandidateCountReadabilitySentence({
        candidateLimit,
        vectorCandidateCount,
        lexicalCandidateCount,
        mergedCandidateCount,
        rankedCandidateCount
      });
    const timingSummary = {
      totalMs: this.readNumber(timingMetadata?.totalMs),
      firstTokenMs: this.readNumber(timingMetadata?.firstTokenMs),
      preGenerationMs: this.readNumber(timingMetadata?.preGenerationMs),
      llmFirstTokenMs: this.readNumber(timingMetadata?.llmFirstTokenMs),
      conversationLoadMs: this.readNumber(timingMetadata?.conversationLoadMs),
      userMessagePersistMs: this.readNumber(
        timingMetadata?.userMessagePersistMs
      ),
      rewriteMs: this.readNumber(timingMetadata?.rewriteMs),
      retrievalMs: this.readNumber(timingMetadata?.retrievalMs),
      traceCreateMs: this.readNumber(timingMetadata?.traceCreateMs),
      answerGenerationMs: this.readNumber(timingMetadata?.answerGenerationMs),
      assistantMessagePersistMs: this.readNumber(
        timingMetadata?.assistantMessagePersistMs
      ),
      traceFinalizeMs: this.readNumber(timingMetadata?.traceFinalizeMs),
      llmQueueWaitMs: this.readNumber(timingMetadata?.llmQueueWaitMs),
      retrievalQueueWaitMs: this.readNumber(
        timingMetadata?.retrievalQueueWaitMs
      )
    } satisfies TraceSummary['timingSummary'];
    const contextReadabilitySentence = this.buildContextReadabilitySentence({
      contextMode,
      inputChunkCount,
      promptContextCount,
      promptContextChars:
        this.readNumber(retrievalMetadata?.promptContextChars) ?? 0,
      promptContextApproxTokens:
        this.readNumber(retrievalMetadata?.promptContextApproxTokens) ?? 0,
      contextGroupCount,
      retrievedChunkCount,
      primaryChunkScoreAvg: this.readNumber(
        retrievalMetadata?.primaryChunkScoreAvg
      ),
      primaryChunkScoreMin: this.readNumber(
        retrievalMetadata?.primaryChunkScoreMin
      ),
      contextGroupAvgLength: this.readNumber(
        retrievalMetadata?.contextGroupAvgLength
      )
    });

    return {
      routeType,
      routeReason,
      promptId: this.readString(answeringMetadata?.promptId),
      answerStatus: this.readStringAs<
        NonNullable<TraceSummary['answerStatus']>
      >(answeringMetadata?.answerStatus),
      qualityOverall: this.readStringAs<
        NonNullable<TraceSummary['qualityOverall']>
      >(qualityEvaluation?.overall),
      primaryIssue: this.readStringAs<
        NonNullable<TraceSummary['primaryIssue']>
      >(qualityEvaluation?.primaryIssue),
      retrievalMode,
      retrievalQuerySource,
      strategyReadabilityLabel: buildStrategyReadabilityLabel({
        retrievalMode,
        retrievalQuerySource,
        fallbackReason,
        strategyUsedFallback
      }),
      retrievalModeProvenanceSentence,
      rewriteReadabilityLabel: buildRewriteReadabilityLabel({
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
        rewriteSkippedReason,
        rewriteUsedFallback,
        rewritePromptId,
        rewriteModelName,
        fallbackReason,
        usedFallback: strategyUsedFallback
      },
      routeDecisionSummary:
        routeType != null && routeReason != null
          ? {
              routeType,
              routeReason
            }
          : null,
      executionPlan,
      executionMode,
      executionModeReadabilityLabel,
      executionModeReadabilitySentence,
      executionToolNames,
      executionToolNamesReadabilityLabel,
      executionToolNamesReadabilitySentence,
      timingSummary,
      timingReadabilitySentence:
        this.buildTimingReadabilitySentence(timingSummary),
      generationMode: this.readStringAs<
        NonNullable<TraceSummary['generationMode']>
      >(answeringMetadata?.generationMode),
      contextMode,
      rewriteApplied,
      rewriteSkippedReason,
      fallbackReason,
      resolvedLanguage: this.readStringAs<
        NonNullable<TraceSummary['resolvedLanguage']>
      >(answeringMetadata?.resolvedLanguage),
      answerAttributionSummary,
      answerAttributionReadabilitySentence,
      answerAttribution: citationAttribution,
      answerAttributionSource: citationSelectionSource,
      answerEvidenceSource,
      answerEvidenceSourceReadabilityLabel,
      answerEvidenceSourceReadabilitySentence,
      citationAttribution,
      citationSelectionSource,
      missingInformationCount,
      missingInformationCountReadabilityLabel,
      missingInformationSource,
      missingInformationSourceReadabilityLabel,
      insufficientContextReason,
      missingInformationProvenanceSentence,
      answerTextSource,
      answerTextSourceReadabilityLabel,
      answerTextSourceReadabilitySentence,
      answerStatusSource,
      answerStatusSourceReadabilityLabel,
      answerStatusSourceReadabilitySentence,
      answerProvenanceReadabilitySentence,
      answerProvenanceSentence,
      failedStage,
      failedStageReadabilityLabel,
      failureMessage,
      failureReadabilitySentence: this.buildFailureReadabilitySentence({
        failedStageReadabilityLabel,
        failureMessage,
        fallbackReason,
        rankedCandidateCount
      }),
      candidateLimit,
      vectorCandidateCount,
      lexicalCandidateCount,
      mergedCandidateCount,
      rankedCandidateCount,
      candidateCountReadabilityLabel,
      candidateCountReadabilitySentence,
      vectorCandidateLimitHit: this.readBoolean(
        retrievalExecution?.vectorCandidateLimitHit
      ),
      lexicalCandidateLimitHit: this.readBoolean(
        retrievalExecution?.lexicalCandidateLimitHit
      ),
      rankingTopKHit: this.readBoolean(retrievalExecution?.rankingTopKHit),
      primaryChunkCount:
        this.readNumber(retrievalExecution?.primaryChunkCount) ??
        retrievedChunkCount,
      neighborChunkCount:
        this.readNumber(retrievalExecution?.neighborChunkCount) ?? 0,
      retrievedChunkCount,
      inputChunkCount,
      promptContextCount,
      promptContextChars:
        this.readNumber(retrievalMetadata?.promptContextChars) ?? 0,
      promptContextApproxTokens:
        this.readNumber(retrievalMetadata?.promptContextApproxTokens) ?? 0,
      contextGroupCount,
      primaryChunkScoreAvg: this.readNumber(
        retrievalMetadata?.primaryChunkScoreAvg
      ),
      primaryChunkScoreMin: this.readNumber(
        retrievalMetadata?.primaryChunkScoreMin
      ),
      contextGroupAvgLength: this.readNumber(
        retrievalMetadata?.contextGroupAvgLength
      ),
      contextReadabilitySentence,
      citationCount,
      citationCountReadabilityLabel,
      citationCountReadabilitySentence,
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

    return Array.isArray(trace.retrievedChunkIdsJson)
      ? trace.retrievedChunkIdsJson.length
      : 0;
  }

  private readObject(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private readString(value: unknown) {
    return typeof value === 'string' ? value : null;
  }

  private readNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private readStringAs<T extends string>(value: unknown): T | null {
    return typeof value === 'string' ? (value as T) : null;
  }

  private readTraceFailedStage(
    value: unknown
  ): NonNullable<TraceSummary['failedStage']> | null {
    return typeof value === 'string' &&
      TRACE_FAILED_STAGE_VALUES.has(
        value as NonNullable<TraceSummary['failedStage']>
      )
      ? (value as NonNullable<TraceSummary['failedStage']>)
      : null;
  }

  private readTraceAnswerTextSource(
    value: unknown
  ): NonNullable<TraceSummary['answerTextSource']> | null {
    return typeof value === 'string' &&
      TRACE_ANSWER_TEXT_SOURCE_VALUES.has(
        value as NonNullable<TraceSummary['answerTextSource']>
      )
      ? (value as NonNullable<TraceSummary['answerTextSource']>)
      : null;
  }

  private readTraceAnswerStatusSource(
    value: unknown
  ): NonNullable<TraceSummary['answerStatusSource']> | null {
    return typeof value === 'string' &&
      TRACE_ANSWER_STATUS_SOURCE_VALUES.has(
        value as NonNullable<TraceSummary['answerStatusSource']>
      )
      ? (value as NonNullable<TraceSummary['answerStatusSource']>)
      : null;
  }

  private readTraceRouteType(
    value: unknown
  ): NonNullable<TraceSummary['routeType']> | null {
    return typeof value === 'string' &&
      TRACE_ROUTE_TYPE_VALUES.has(
        value as NonNullable<TraceSummary['routeType']>
      )
      ? (value as NonNullable<TraceSummary['routeType']>)
      : null;
  }

  private readTraceRouteReason(
    value: unknown
  ): NonNullable<TraceSummary['routeReason']> | null {
    return typeof value === 'string' &&
      TRACE_ROUTE_REASON_VALUES.has(
        value as NonNullable<TraceSummary['routeReason']>
      )
      ? (value as NonNullable<TraceSummary['routeReason']>)
      : null;
  }

  private readTraceSummaryExecutionMode(
    value: unknown
  ): TraceSummary['executionMode'] {
    return readTraceExecutionMode(value);
  }

  private readTraceSummaryExecutionToolName(
    value: unknown
  ): TraceSummary['executionToolNames'][number] | null {
    return readTraceExecutionToolName(value);
  }

  private readTraceExecutionPlan(
    value: unknown
  ): TraceSummary['executionPlan'] {
    const plan = this.readObject(value);
    if (plan == null) {
      return null;
    }

    const steps = Array.isArray(plan.steps)
      ? plan.steps
          .map((step) => {
            const stepObject = this.readObject(step);
            if (stepObject == null) {
              return null;
            }

            const id = this.readString(stepObject.id);
            const key = this.readString(stepObject.key);
            const kind = this.readString(stepObject.kind);
            const status = this.readString(stepObject.status);
            const label = this.readString(stepObject.label);
            if (
              id == null ||
              key == null ||
              label == null ||
              (kind !== 'route_decision' &&
                kind !== 'retrieval' &&
                kind !== 'source_fetch' &&
                kind !== 'answer_generation' &&
                kind !== 'deterministic_reply') ||
              (status !== 'pending' &&
                status !== 'running' &&
                status !== 'completed' &&
                status !== 'failed')
            ) {
              return null;
            }

            return {
              key,
              id,
              kind,
              toolName: this.readTraceSummaryExecutionToolName(
                stepObject.toolName
              ),
              status,
              label,
              detail: this.readString(stepObject.detail),
              durationMs: this.readNumber(stepObject.durationMs)
            };
          })
          .filter(
            (
              step
            ): step is NonNullable<
              TraceSummary['executionPlan']
            >['steps'][number] => step != null
          )
      : [];

    if (steps.length === 0) {
      return null;
    }

    const executionMode =
      this.readTraceSummaryExecutionMode(plan.executionMode) ?? 'manual';

    return {
      executionMode,
      steps
    };
  }

  private buildTimingReadabilitySentence(
    timing: TraceSummary['timingSummary']
  ) {
    const render = (label: string, value: number | null) =>
      `${label} ${value == null ? 'n/a' : `${value}ms`}`;
    return (
      [
        render('total', timing.totalMs),
        render('first token', timing.firstTokenMs),
        render('conversation', timing.conversationLoadMs),
        render('persist user', timing.userMessagePersistMs),
        render('rewrite', timing.rewriteMs),
        render('retrieval', timing.retrievalMs),
        render('trace create', timing.traceCreateMs),
        render('generation', timing.answerGenerationMs),
        render('persist assistant', timing.assistantMessagePersistMs),
        render('trace finalize', timing.traceFinalizeMs),
        render('llm queue', timing.llmQueueWaitMs),
        render('retrieval queue', timing.retrievalQueueWaitMs)
      ].join('; ') + '.'
    );
  }

  private readBoolean(value: unknown) {
    return typeof value === 'boolean' ? value : false;
  }

  private readNullableBoolean(value: unknown) {
    return typeof value === 'boolean' ? value : null;
  }

  private buildAnswerEvidenceSourceReadabilitySentence(
    answerEvidenceSourceReadabilityLabel: TraceSummary['answerEvidenceSourceReadabilityLabel']
  ): TraceSummary['answerEvidenceSourceReadabilitySentence'] {
    return `Answer evidence source is ${answerEvidenceSourceReadabilityLabel}.`;
  }

  private buildMissingInformationCountReadabilityLabel(
    missingInformationCount: TraceSummary['missingInformationCount']
  ): TraceSummary['missingInformationCountReadabilityLabel'] {
    if (missingInformationCount === 0) {
      return 'no missing-information items';
    }

    if (missingInformationCount === 1) {
      return '1 missing-information item';
    }

    return `${missingInformationCount} missing-information items`;
  }

  private buildCitationCountReadabilityLabel(input: {
    citationCount: TraceSummary['citationCount'];
    citationCountBeforeLimit: TraceSummary['citationCountBeforeLimit'];
    citationLimitHit: TraceSummary['citationLimitHit'];
  }): TraceSummary['citationCountReadabilityLabel'] {
    if (!input.citationLimitHit) {
      if (input.citationCount === 0) {
        return 'no citations';
      }

      if (input.citationCount === 1) {
        return '1 citation';
      }

      return `${input.citationCount} citations`;
    }

    if (input.citationCountBeforeLimit <= input.citationCount) {
      if (input.citationCount === 1) {
        return '1 citation (limit hit)';
      }

      return `${input.citationCount} citations (limit hit)`;
    }

    if (input.citationCount === 1) {
      return `1 citation shown (${input.citationCountBeforeLimit} before limit)`;
    }

    return `${input.citationCount} citations shown (${input.citationCountBeforeLimit} before limit)`;
  }

  private buildCitationCountReadabilitySentence(
    citationCountReadabilityLabel: TraceSummary['citationCountReadabilityLabel']
  ): TraceSummary['citationCountReadabilitySentence'] {
    return `Citation count summary: ${citationCountReadabilityLabel}.`;
  }

  private buildCandidateCountReadabilityLabel(input: {
    candidateLimit: TraceSummary['candidateLimit'];
    vectorCandidateCount: TraceSummary['vectorCandidateCount'];
    lexicalCandidateCount: TraceSummary['lexicalCandidateCount'];
    mergedCandidateCount: TraceSummary['mergedCandidateCount'];
    rankedCandidateCount: TraceSummary['rankedCandidateCount'];
  }): TraceSummary['candidateCountReadabilityLabel'] {
    return `vector ${input.vectorCandidateCount}, lexical ${input.lexicalCandidateCount}, merged ${input.mergedCandidateCount}, ranked ${input.rankedCandidateCount} (candidate limit ${input.candidateLimit})`;
  }

  private buildCandidateCountReadabilitySentence(input: {
    candidateLimit: TraceSummary['candidateLimit'];
    vectorCandidateCount: TraceSummary['vectorCandidateCount'];
    lexicalCandidateCount: TraceSummary['lexicalCandidateCount'];
    mergedCandidateCount: TraceSummary['mergedCandidateCount'];
    rankedCandidateCount: TraceSummary['rankedCandidateCount'];
  }): TraceSummary['candidateCountReadabilitySentence'] {
    return `Candidate flow produced ${input.rankedCandidateCount} ranked candidates from ${input.mergedCandidateCount} merged candidates (${input.vectorCandidateCount} vector, ${input.lexicalCandidateCount} lexical) with candidate limit ${input.candidateLimit}.`;
  }

  private buildContextReadabilitySentence(input: {
    contextMode: TraceSummary['contextMode'];
    inputChunkCount: TraceSummary['inputChunkCount'];
    promptContextCount: TraceSummary['promptContextCount'];
    promptContextChars: TraceSummary['promptContextChars'];
    promptContextApproxTokens: TraceSummary['promptContextApproxTokens'];
    contextGroupCount: TraceSummary['contextGroupCount'];
    retrievedChunkCount: TraceSummary['retrievedChunkCount'];
    primaryChunkScoreAvg: TraceSummary['primaryChunkScoreAvg'];
    primaryChunkScoreMin: TraceSummary['primaryChunkScoreMin'];
    contextGroupAvgLength: TraceSummary['contextGroupAvgLength'];
  }): TraceSummary['contextReadabilitySentence'] {
    const contextModeLabel = input.contextMode ?? 'unknown';
    const scoreSummary =
      input.primaryChunkScoreAvg == null
        ? 'primary scores n/a'
        : `primary scores avg ${input.primaryChunkScoreAvg}, min ${input.primaryChunkScoreMin ?? input.primaryChunkScoreAvg}`;
    const groupSummary =
      input.contextGroupAvgLength == null
        ? 'context group length n/a'
        : `context group avg length ${input.contextGroupAvgLength} chars`;
    return `Prompt context used ${input.promptContextCount} items via ${contextModeLabel} mode (${input.inputChunkCount} input chunks, ${input.contextGroupCount} context groups, ${input.retrievedChunkCount} retrieved chunks, ${input.promptContextChars} chars, ~${input.promptContextApproxTokens} tokens; ${scoreSummary}; ${groupSummary}).`;
  }

  private buildFailedStageReadabilityLabel(input: {
    failedStage: TraceSummary['failedStage'];
    rawFailedStage: string | null;
  }): TraceSummary['failedStageReadabilityLabel'] {
    if (input.failedStage === 'retrieval') {
      return 'retrieval stage failed';
    }

    if (input.failedStage === 'answering') {
      return 'answering stage failed';
    }

    if (input.rawFailedStage != null) {
      return `unknown failed stage (${input.rawFailedStage})`;
    }

    return 'unknown failed stage';
  }

  private buildFailureReadabilitySentence(input: {
    failedStageReadabilityLabel: TraceSummary['failedStageReadabilityLabel'];
    failureMessage: TraceSummary['failureMessage'];
    fallbackReason: TraceSummary['fallbackReason'];
    rankedCandidateCount: TraceSummary['rankedCandidateCount'];
  }): TraceSummary['failureReadabilitySentence'] {
    const noRankedCandidatesHint =
      input.fallbackReason === 'no_ranked_candidates' ||
      input.rankedCandidateCount === 0
        ? ' No ranked candidates were produced.'
        : '';

    if (input.failureMessage == null) {
      return `${input.failedStageReadabilityLabel}; message unavailable.${noRankedCandidatesHint}`.trim();
    }

    const trimmedFailureMessage = input.failureMessage.trim();
    if (trimmedFailureMessage.length === 0) {
      return `${input.failedStageReadabilityLabel}; message unavailable.${noRankedCandidatesHint}`.trim();
    }

    if (/[.!?]$/.test(trimmedFailureMessage)) {
      return `${input.failedStageReadabilityLabel}; message: ${trimmedFailureMessage}${noRankedCandidatesHint}`.trim();
    }

    return `${input.failedStageReadabilityLabel}; message: ${trimmedFailureMessage}.${noRankedCandidatesHint}`.trim();
  }
}
