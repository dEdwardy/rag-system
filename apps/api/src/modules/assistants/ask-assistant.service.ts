import { Injectable, Logger } from "@nestjs/common";
import { MessageRole, Prisma, TraceStatus } from "@prisma/client";
import { AnswerPolicy } from "../../infra/llm/llm.types";
import { LlmService } from "../../infra/llm/llm.service";
import { PromptManagerService } from "../../infra/llm/prompt-manager.service";
import { ConcurrencyLimiter, ResultCache } from "../../common/concurrency-utils";
import { VectorStoreCompatibilityError, VectorStoreEmbeddingDiagnostics } from "../../infra/vector-store/vector-store.types";
import {
  buildAnswerEvidenceSourceReadabilityLabel,
  buildAnswerAttributionSummary
} from "../answering/answer-attribution-summary";
import {
  buildAnswerProvenanceFields,
  buildAnswerSourceReadability,
} from "../answering/answer-source-readability";
import { buildMissingInformationProvenanceSentence } from "../answering/missing-information-provenance";
import { buildMissingInformationSourceReadabilityLabel } from "../answering/missing-information-source-readability";
import { resolveRequestAuthContext, type RequestAuthContext } from "../auth/auth-identity.contract";
import { AnsweringService } from "../answering/answering.service";
import { ConversationsService } from "../conversations/conversations.service";
import { MessagesService } from "../messages/messages.service";
import { RetrievalService, type RetrievalResult } from "../retrieval/retrieval.service";
import {
  buildRewriteReadabilityLabel,
  buildRetrievalModeProvenanceSentence,
  buildStrategyReadabilityLabel
} from "../retrieval/strategy-readability";
import {
  RetrievalProfileFilters,
  RetrievalStrategy,
  resolveRetrievalStrategy,
  retrievalProfileFiltersSchema
} from "../retrieval-profiles/retrieval-profile.schemas";
import { TracesService } from "../traces/traces.service";
import { answerPolicySchema } from "./assistant.schemas";
import { AssistantsService } from "./assistants.service";
import { AskAssistantError } from "./ask-assistant.error";
import type {
  TraceAnswerAttributionSummary,
  RetrievalStrategySummary,
  TraceCitationAttribution,
  TraceCitationSelectionSource,
  TraceSummary
} from "@rag-system/shared";

type AskResultChunk = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  score: number;
  isPrimary?: boolean;
  pageNo?: number | null;
  sectionTitle?: string | null;
  vectorScore?: number;
  lexicalScore?: number;
  hybridScore?: number;
  rerankScore?: number;
};

type AskRetrievalMetadataJson = Prisma.InputJsonObject & {
  strategySummary?: RetrievalStrategySummary;
};

type AskRewriteDecision = {
  shouldRewrite: boolean;
  skippedReason:
    | "disabled_by_default"
    | "query_too_short"
    | "not_summary_or_complex_question"
    | "latency_budget_exceeded"
    | null;
};

type AskRewriteResult = {
  rewrittenQuery: string | null;
  modelName: string | null;
  usedFallback: boolean | null;
  promptId: string | null;
  skippedReason: RetrievalStrategySummary["rewriteSkippedReason"];
};

type AskConversationRef = {
  id: string;
};

type AssistantRecord = Awaited<ReturnType<AssistantsService["getAssistant"]>>;

type AskPersistedMessage = {
  id: string;
};

type TimedResult<T> = {
  value: T;
  durationMs: number;
};

type AskTimingSummary = {
  totalMs: number | null;
  firstTokenMs: number | null;
  preGenerationMs: number | null;
  llmFirstTokenMs: number | null;
  conversationLoadMs: number | null;
  userMessagePersistMs: number | null;
  rewriteMs: number | null;
  retrievalMs: number | null;
  traceCreateMs: number | null;
  answerGenerationMs: number | null;
  assistantMessagePersistMs: number | null;
  traceFinalizeMs: number | null;
  llmQueueWaitMs: number | null;
  retrievalQueueWaitMs: number | null;
};

type PromptSnapshot = {
  systemPrompt: string;
  userPrompt: string;
};

@Injectable()
export class AskAssistantService {
  private readonly logger = new Logger(AskAssistantService.name);
  private readonly retrievalLimiter = new ConcurrencyLimiter(5);
  private readonly llmLimiter = new ConcurrencyLimiter(3);
  private readonly assistantCache = new ResultCache<string, AssistantRecord>(100, 60000);

  constructor(
    private readonly assistantsService: AssistantsService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly retrievalService: RetrievalService,
    private readonly answeringService: AnsweringService,
    private readonly tracesService: TracesService,
    private readonly llmService: LlmService,
    private readonly promptManager: PromptManagerService
  ) {}

  async askAssistant(input: {
    assistantId: string;
    question: string;
    conversationId?: string;
    authContext?: RequestAuthContext | null;
    documentVersions?: Record<string, number>;
  }) {
    const authContext = resolveRequestAuthContext({
      authContext: input.authContext
    });
    
    const assistant = await this.assistantCache.getOrSet(input.assistantId, () =>
      this.assistantsService.getAssistant(input.assistantId, authContext.identity)
    );
    
    const retrievalProfile = assistant.retrievalProfile as typeof assistant.retrievalProfile & {
      strategyJson?: unknown;
    };

    const conversation =
      input.conversationId != null
        ? await this.conversationsService.getConversation(input.conversationId, authContext.identity)
        : await this.conversationsService.createConversation({
            tenantId: authContext.identity.tenantId,
            userId: authContext.identity.userId,
            assistantId: assistant.id,
            title: input.question.slice(0, 80)
          });

    const conversationResult: TimedResult<AskConversationRef> = {
      value: conversation,
      durationMs: 0
    };

    const userMessagePromise: Promise<TimedResult<AskPersistedMessage>> = this.messagesService.createMessage({
      conversationId: conversation.id,
      role: MessageRole.user,
      content: input.question
    }).then(message => ({
      value: message,
      durationMs: 0
    }));

    const startedAt = Date.now();
    const retrievalStrategy = resolveRetrievalStrategy({
      topK: retrievalProfile.topK,
      enableHybrid: retrievalProfile.enableHybrid,
      enableRerank: retrievalProfile.enableRerank,
      strategyJson: retrievalProfile.strategyJson as RetrievalStrategy | undefined
    });
    
    const rewriteDecision = this.resolveRewriteDecision(input.question, retrievalStrategy);
    let rewritten: AskRewriteResult;
    
    if (rewriteDecision.shouldRewrite) {
      try {
        const rewriteResult = await this.llmLimiter.execute(() =>
          this.llmService.rewriteQuery({
            question: input.question
          })
        );
        rewritten = {
          ...rewriteResult,
          skippedReason: null
        };
      } catch {
        rewritten = {
          rewrittenQuery: null,
          modelName: null,
          usedFallback: null,
          promptId: null,
          skippedReason: "latency_budget_exceeded"
        };
      }
    } else {
      rewritten = {
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null,
        skippedReason: rewriteDecision.skippedReason
      };
    }
    
    const retrievalQuery = rewritten.rewrittenQuery || input.question;
    const retrievalFilters = retrievalProfileFiltersSchema.optional().parse(
      assistant.retrievalProfile.filtersJson ?? undefined
    );
    const answerPolicy = answerPolicySchema.nullable().optional().parse(assistant.answerPolicyJson ?? undefined) ?? undefined;
    const normalizedAnswerPolicy = this.normalizeAnswerPolicy(answerPolicy);
    
    const { value: userMessage } = await userMessagePromise;

    const retrievalResult = await this.retrievalLimiter.execute(() =>
      this.retrieveOrCreateFailedTrace({
        assistantId: assistant.id,
        assistantKbId: assistant.kbId,
        conversationPromise: Promise.resolve(conversationResult),
        userMessagePromise,
        userQuery: input.question,
        retrievalQuery,
        retrievalProfile,
        retrievalStrategy,
        retrievalFilters,
        rewritten,
        documentVersions: input.documentVersions
      })
    );
    
    const retrievedChunks = retrievalResult.retrievedChunks;
    const contextGroups = retrievalResult.contextGroups;
    
    const [retrievalScoresJson, retrievalMetadata] = await Promise.all([
      Promise.resolve(this.buildRetrievalScoresJson(retrievedChunks)),
      Promise.resolve(this.buildRetrievalMetadata({
        strategy: retrievalStrategy,
        filters: retrievalFilters,
        rewrittenQuery: rewritten.rewrittenQuery,
        rewriteSkippedReason: rewritten.skippedReason,
        rewriteModelName: retrievalStrategy.queryRewrite.enabled ? rewritten.modelName : null,
        rewritePromptId: retrievalStrategy.queryRewrite.enabled ? rewritten.promptId : null,
        rewriteUsedFallback: retrievalStrategy.queryRewrite.enabled ? rewritten.usedFallback : null,
        originalQuestion: input.question,
        topK: retrievalProfile.topK,
        scoreThreshold: retrievalProfile.scoreThreshold,
        chunkWindow: retrievalProfile.chunkWindow,
        retrievedChunks,
        contextGroups,
        embedding: retrievalResult.embedding,
        execution: retrievalResult.execution,
        promptContextChars: null,
        promptContextApproxTokens: null
      }) as AskRetrievalMetadataJson)
    ]);
    
    const [strategyReadabilityLabel, retrievalModeProvenanceSentence, rewriteReadabilityLabel] = await Promise.all([
      buildStrategyReadabilityLabel({
        retrievalMode: retrievalMetadata.strategySummary?.retrievalMode ?? null,
        retrievalQuerySource: retrievalMetadata.strategySummary?.retrievalQuerySource ?? null,
        fallbackReason: retrievalMetadata.strategySummary?.fallbackReason ?? null,
        strategyUsedFallback: retrievalMetadata.strategySummary?.usedFallback ?? null
      }),
      buildRetrievalModeProvenanceSentence({
        retrievalMode: retrievalMetadata.strategySummary?.retrievalMode ?? null,
        strategyUsedFallback: retrievalMetadata.strategySummary?.usedFallback ?? null,
        fallbackReason: retrievalMetadata.strategySummary?.fallbackReason ?? null
      }),
      buildRewriteReadabilityLabel({
        rewriteEnabled: retrievalMetadata.strategySummary?.rewriteEnabled ?? false,
        rewriteApplied: retrievalMetadata.strategySummary?.rewriteApplied ?? false,
        rewriteUsedFallback: retrievalMetadata.strategySummary?.rewriteUsedFallback ?? null,
        rewritePromptId: retrievalMetadata.strategySummary?.rewritePromptId ?? null
      })
    ]);
    
    const trace = await this.tracesService.createTrace({
      conversationId: conversation.id,
      assistantId: assistant.id,
      userMessageId: userMessage.id,
      userQuery: input.question,
      rewrittenQuery: retrievalQuery !== input.question ? retrievalQuery : null,
      retrievedChunkIdsJson: retrievedChunks.map((chunk: AskResultChunk) => chunk.chunkId),
      retrievalScoresJson,
      retrievalMetadataJson: retrievalMetadata,
      modelName: rewritten.modelName ?? undefined,
      status: TraceStatus.success
    });
    const promptSnapshot = this.buildPromptSnapshot({
      question: input.question,
      systemPrompt: assistant.systemPrompt,
      answerPolicy: normalizedAnswerPolicy,
      chunks: retrievedChunks,
      contextGroups
    });
    const retrievalMetadataWithPrompt = this.withPromptContextMetrics(retrievalMetadata, promptSnapshot);

    try {
      const resolvedAnswerResult =
        retrievedChunks.length === 0 && normalizedAnswerPolicy.noAnswerBehavior === "say_insufficient_context"
          ? this.answeringService.buildDeterministicInsufficientContextResult({
              question: input.question,
              answerPolicy: normalizedAnswerPolicy
            })
          : await this.answeringService.generateAnswer({
              question: input.question,
              systemPrompt: assistant.systemPrompt,
              answerPolicy: normalizedAnswerPolicy,
              chunks: retrievedChunks,
              contextGroups
            });

      const assistantMessage = await this.messagesService.createMessage({
        conversationId: conversation.id,
        role: MessageRole.assistant,
        content: resolvedAnswerResult.answer,
        traceId: trace.id
      });

      await this.messagesService.attachTrace(userMessage.id, trace.id);
      await this.conversationsService.touchConversation(conversation.id, authContext.identity);
      await this.tracesService.updateTrace(trace.id, {
        assistantMessageId: assistantMessage.id,
        citationsJson: resolvedAnswerResult.citations,
        retrievalMetadataJson: retrievalMetadataWithPrompt,
        answeringMetadataJson: this.withPromptSnapshot(resolvedAnswerResult.answeringMetadata, promptSnapshot),
        qualityEvaluationJson: resolvedAnswerResult.qualityEvaluation,
        latencyMs: Date.now() - startedAt,
        modelName: resolvedAnswerResult.modelName,
        rewrittenQuery: retrievalQuery !== input.question ? retrievalQuery : null,
        retrievedChunkIdsJson: retrievedChunks.map((chunk: AskResultChunk) => chunk.chunkId),
        retrievalScoresJson,
        status: TraceStatus.success
      });

      const answerAttributionSummary = this.resolveAnswerAttributionSummary(resolvedAnswerResult.answeringMetadata);
      const answerAttributionSource = this.resolveAnswerAttributionSource(resolvedAnswerResult.answeringMetadata);
      const answerEvidenceSourceReadabilityLabel = buildAnswerEvidenceSourceReadabilityLabel(answerAttributionSource);
      const answerEvidenceSourceReadabilitySentence = this.buildAnswerEvidenceSourceReadabilitySentence(
        answerEvidenceSourceReadabilityLabel
      );
      const answerTextSource = this.resolveAnswerTextSource(resolvedAnswerResult.answeringMetadata);
      const rawAnswerTextSource = this.readString(
        typeof resolvedAnswerResult.answeringMetadata === "object" && resolvedAnswerResult.answeringMetadata !== null
          ? (resolvedAnswerResult.answeringMetadata as Record<string, unknown>).answerTextSource
          : null
      );
      const answerStatusSource = this.resolveAnswerStatusSource(resolvedAnswerResult.answeringMetadata);
      const rawAnswerStatusSource = this.readString(
        typeof resolvedAnswerResult.answeringMetadata === "object" && resolvedAnswerResult.answeringMetadata !== null
          ? (resolvedAnswerResult.answeringMetadata as Record<string, unknown>).answerStatusSource
          : null
      );
      const answerSourceReadability = buildAnswerSourceReadability({
        answerTextSource,
        rawAnswerTextSource,
        answerStatusSource,
        rawAnswerStatusSource
      });
      const {
        answerTextSourceReadabilityLabel,
        answerTextSourceReadabilitySentence,
        answerStatusSourceReadabilityLabel,
        answerStatusSourceReadabilitySentence
      } = answerSourceReadability;
      const answerAttributionReadabilitySentence =
        answerAttributionSummary.readabilitySentence ?? "Answer attribution is unknown; source evidence is unknown.";
      const { answerProvenanceSentence, answerProvenanceReadabilitySentence } = buildAnswerProvenanceFields({
        answerTextSource,
        answerStatusSource,
        answerAttributionReadabilityResolvedLabel: answerAttributionSummary.readabilityResolvedLabel,
        answerTextSourceReadabilityLabel,
        answerStatusSourceReadabilityLabel,
        answerAttributionReadabilitySentence
      });
      const missingInformationSource = this.resolveMissingInformationSource(resolvedAnswerResult.answeringMetadata);
      const missingInformationProvenanceSentence = buildMissingInformationProvenanceSentence({
        missingInformationSource,
        insufficientContextReason: this.resolveInsufficientContextReason(resolvedAnswerResult.answeringMetadata),
        missingInformationCount: this.resolveMissingInformationCount({
          answeringMetadata: resolvedAnswerResult.answeringMetadata,
          missingInformation: resolvedAnswerResult.missingInformation
        })
      });
      this.logAskTiming({
        route: "ask",
        status: "success",
        assistantId: assistant.id,
        conversationId: conversation.id,
        traceId: trace.id,
        retrievalMode: retrievalMetadataWithPrompt.strategySummary?.retrievalMode ?? null,
        timing: null,
        retrievalExecution:
          typeof retrievalMetadataWithPrompt.execution === "object" && retrievalMetadataWithPrompt.execution !== null
            ? retrievalMetadataWithPrompt.execution
            : null,
        retrievalDiagnostics: this.buildRetrievalLogDiagnostics(retrievalMetadataWithPrompt)
      });
      
      return {
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        traceId: trace.id,
        answer: resolvedAnswerResult.answer,
        citations: resolvedAnswerResult.citations,
        retrievedChunks: resolvedAnswerResult.retrievedChunks,
        contextGroups: resolvedAnswerResult.contextGroups,
        strategySummary: retrievalMetadataWithPrompt.strategySummary,
        strategyReadabilityLabel,
        rewriteReadabilityLabel,
        retrievalModeProvenanceSentence,
        retrievalMetadata: retrievalMetadataWithPrompt,
        answerAttributionSummary,
        answerAttributionReadabilitySentence,
        answerAttribution: this.resolveAnswerAttribution(resolvedAnswerResult.answeringMetadata),
        answerAttributionSource,
        answerEvidenceSource: answerAttributionSource,
        answerEvidenceSourceReadabilityLabel,
        answerEvidenceSourceReadabilitySentence,
        answerTextSource,
        answerTextSourceReadabilityLabel,
        answerTextSourceReadabilitySentence,
        answerStatusSource,
        answerStatusSourceReadabilityLabel,
        answerStatusSourceReadabilitySentence,
        answerProvenanceSentence,
        answerProvenanceReadabilitySentence,
        missingInformationSource,
        missingInformationProvenanceSentence,
        missingInformationSourceReadabilityLabel: buildMissingInformationSourceReadabilityLabel({
          missingInformationSource
        }),
        answeringMetadata: this.withPromptSnapshot(resolvedAnswerResult.answeringMetadata, promptSnapshot),
        modelName: resolvedAnswerResult.modelName,
        answerStatus: resolvedAnswerResult.answerStatus,
        missingInformation: resolvedAnswerResult.missingInformation,
        qualityEvaluation: resolvedAnswerResult.qualityEvaluation
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown ask pipeline error.";
      this.logAskTiming({
        route: "ask",
        status: this.isAbortError(error) ? "aborted" : "failed",
        assistantId: assistant.id,
        conversationId: conversation.id,
        traceId: trace.id,
        retrievalMode: retrievalMetadata.strategySummary?.retrievalMode ?? null,
        timing: null,
        retrievalExecution:
          typeof retrievalMetadata.execution === "object" && retrievalMetadata.execution !== null
            ? retrievalMetadata.execution
            : null,
        retrievalDiagnostics: this.buildRetrievalLogDiagnostics(retrievalMetadata),
        errorMessage: message
      });
      await this.tracesService.updateTrace(trace.id, {
        latencyMs: Date.now() - startedAt,
        modelName: rewritten.modelName ?? undefined,
        rewrittenQuery: retrievalQuery !== input.question ? retrievalQuery : null,
        retrievedChunkIdsJson: retrievedChunks.map((chunk: AskResultChunk) => chunk.chunkId),
        retrievalScoresJson,
        retrievalMetadataJson: this.withFailureMetadata(this.withPromptContextMetrics(retrievalMetadata, promptSnapshot), {
          stage: "answering",
          message
        }),
        status: TraceStatus.failed,
        errorMessage: message
      });
      throw new AskAssistantError({
        traceId: trace.id,
        details: {
          stage: "answering",
          cause: message
        }
      });
    }
  }

  async askAssistantStream(input: {
    assistantId: string;
    question: string;
    conversationId?: string;
    authContext?: RequestAuthContext | null;
    signal?: AbortSignal;
    onEvent: (
      event:
        | { type: "status"; phase: "started" | "retrieving" | "generating" }
        | { type: "answer_delta"; delta: string }
        | { type: "final"; data: Record<string, unknown> }
    ) => void | Promise<void>;
  }) {
    const authContext = resolveRequestAuthContext({
      authContext: input.authContext
    });
    
    const assistant = await this.assistantCache.getOrSet(input.assistantId, () =>
      this.assistantsService.getAssistant(input.assistantId, authContext.identity)
    );
    
    const retrievalProfile = assistant.retrievalProfile as typeof assistant.retrievalProfile & {
      strategyJson?: unknown;
    };

    const conversationStartedAt = Date.now();
    const conversationPromise: Promise<TimedResult<AskConversationRef>> = (
      input.conversationId != null
        ? this.conversationsService.getConversation(input.conversationId, authContext.identity)
        : this.conversationsService.createConversation({
            tenantId: authContext.identity.tenantId,
            userId: authContext.identity.userId,
            assistantId: assistant.id,
            title: input.question.slice(0, 80)
          })
    ).then(conversation => ({
      value: conversation,
      durationMs: Date.now() - conversationStartedAt
    }));

    await input.onEvent({
      type: "status",
      phase: "started"
    });

    const userMessagePersistStartedAt = Date.now();
    const userMessagePromise: Promise<TimedResult<AskPersistedMessage>> = conversationPromise
      .then(({ value: conversation }) => this.messagesService.createMessage({
        conversationId: conversation.id,
        role: MessageRole.user,
        content: input.question
      }))
      .then(message => ({
        value: message,
        durationMs: Date.now() - userMessagePersistStartedAt
      }));

    const startedAt = Date.now();
    const retrievalStrategy = resolveRetrievalStrategy({
      topK: retrievalProfile.topK,
      enableHybrid: retrievalProfile.enableHybrid,
      enableRerank: retrievalProfile.enableRerank,
      strategyJson: retrievalProfile.strategyJson as RetrievalStrategy | undefined
    });
    
    const rewriteDecision = this.resolveRewriteDecision(input.question, retrievalStrategy);
    let rewritten: AskRewriteResult;
    let rewriteMs = 0;
    let llmQueueWaitMs = 0;
    
    if (rewriteDecision.shouldRewrite) {
      try {
        const rewriteResult = await this.llmLimiter.executeMeasured(() =>
          this.llmService.rewriteQuery({
            question: input.question,
            signal: input.signal
          })
        );
        rewritten = {
          ...rewriteResult.result,
          skippedReason: null
        };
        rewriteMs = rewriteResult.runMs;
        llmQueueWaitMs += rewriteResult.waitMs;
      } catch (error) {
        if (this.isAbortError(error)) {
          throw error;
        }
        rewritten = {
          rewrittenQuery: null,
          modelName: null,
          usedFallback: null,
          promptId: null,
          skippedReason: "latency_budget_exceeded"
        };
      }
    } else {
      rewritten = {
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null,
        skippedReason: rewriteDecision.skippedReason
      };
    }
    
    const retrievalQuery = rewritten.rewrittenQuery || input.question;
    const retrievalFilters = retrievalProfileFiltersSchema.optional().parse(
      assistant.retrievalProfile.filtersJson ?? undefined
    );
    const answerPolicy = answerPolicySchema.nullable().optional().parse(assistant.answerPolicyJson ?? undefined) ?? undefined;
    const normalizedAnswerPolicy = this.normalizeAnswerPolicy(answerPolicy);

    await input.onEvent({
      type: "status",
      phase: "retrieving"
    });

    const retrievalResultMeasured = await this.retrievalLimiter.executeMeasured(() =>
      this.retrieveOrCreateFailedTrace({
        assistantId: assistant.id,
        assistantKbId: assistant.kbId,
        conversationPromise,
        userMessagePromise,
        userQuery: input.question,
        retrievalQuery,
        retrievalProfile,
        retrievalStrategy,
        retrievalFilters,
        rewritten
      })
    );
    const retrievalResult = retrievalResultMeasured.result;
    const retrievalMs = retrievalResultMeasured.runMs;
    const retrievalQueueWaitMs = retrievalResultMeasured.waitMs;
    
    const retrievedChunks = retrievalResult.retrievedChunks;
    const contextGroups = retrievalResult.contextGroups;
    
    const [retrievalScoresJson, retrievalMetadata] = await Promise.all([
      Promise.resolve(this.buildRetrievalScoresJson(retrievedChunks)),
      Promise.resolve(this.buildRetrievalMetadata({
        strategy: retrievalStrategy,
        filters: retrievalFilters,
        rewrittenQuery: rewritten.rewrittenQuery,
        rewriteSkippedReason: rewritten.skippedReason,
        rewriteModelName: retrievalStrategy.queryRewrite.enabled ? rewritten.modelName : null,
        rewritePromptId: retrievalStrategy.queryRewrite.enabled ? rewritten.promptId : null,
        rewriteUsedFallback: retrievalStrategy.queryRewrite.enabled ? rewritten.usedFallback : null,
        originalQuestion: input.question,
        topK: retrievalProfile.topK,
        scoreThreshold: retrievalProfile.scoreThreshold,
        chunkWindow: retrievalProfile.chunkWindow,
        retrievedChunks,
        contextGroups,
        embedding: retrievalResult.embedding,
        execution: retrievalResult.execution,
        promptContextChars: null,
        promptContextApproxTokens: null
      }) as AskRetrievalMetadataJson)
    ]);
    const [
      { value: conversation, durationMs: conversationLoadMs },
      { value: userMessage, durationMs: userMessagePersistMs }
    ] = await Promise.all([conversationPromise, userMessagePromise]);
    
    const traceCreateStartedAt = Date.now();
    const tracePromise = this.tracesService.createTrace({
      conversationId: conversation.id,
      assistantId: assistant.id,
      userMessageId: userMessage.id,
      userQuery: input.question,
      rewrittenQuery: retrievalQuery !== input.question ? retrievalQuery : null,
        retrievedChunkIdsJson: retrievedChunks.map((chunk: AskResultChunk) => chunk.chunkId),
      retrievalScoresJson,
      retrievalMetadataJson: retrievalMetadata,
      modelName: rewritten.modelName ?? undefined,
      status: TraceStatus.success
    });
    let trace: { id: string } | null = null;
    let traceCreateMs = 0;

    try {
      await input.onEvent({
        type: "status",
        phase: "generating"
      });

      let firstTokenMs: number | null = null;
      const generationStartedAt = Date.now();
      const preGenerationMs = generationStartedAt - startedAt;
      const resolvedAnswerResult =
        retrievedChunks.length === 0 && normalizedAnswerPolicy.noAnswerBehavior === "say_insufficient_context"
          ? await (async () => {
              const deterministicResult = this.answeringService.buildDeterministicInsufficientContextResult({
                question: input.question,
                answerPolicy: normalizedAnswerPolicy
              });
              firstTokenMs = Date.now() - startedAt;
              await input.onEvent({
                type: "answer_delta",
                delta: deterministicResult.answer
              });

              return deterministicResult;
            })()
          : await (async () => {
              const streamResultMeasured = await this.llmLimiter.executeMeasured(() =>
                this.llmService.generateAnswerStream({
                question: input.question,
                systemPrompt: assistant.systemPrompt,
                answerPolicy: normalizedAnswerPolicy,
                chunks: this.answeringService.buildStreamAnswerContext({
                  chunks: retrievedChunks,
                  contextGroups
                }),
                signal: input.signal,
                onDelta: async delta => {
                  if (firstTokenMs == null) {
                    firstTokenMs = Date.now() - startedAt;
                  }
                  await input.onEvent({
                    type: "answer_delta",
                    delta
                  });
                }
              })
              );
              llmQueueWaitMs += streamResultMeasured.waitMs;
              const streamResult = streamResultMeasured.result;

              return this.answeringService.finalizeStreamedAnswer({
                question: input.question,
                answerPolicy: normalizedAnswerPolicy,
                chunks: retrievedChunks,
                contextGroups,
                rawAnswer: streamResult.rawAnswer,
                modelName: streamResult.modelName,
                promptId: streamResult.promptId,
                usedFallback: streamResult.usedFallback,
                answerStatus: streamResult.answerStatus,
                missingInformation: streamResult.missingInformation,
                citedChunkNumbers: streamResult.citedChunkNumbers,
                citationEvidence: streamResult.citationEvidence
              });
            })();
      const answerGenerationMs = Date.now() - generationStartedAt;
      trace = await tracePromise;
      traceCreateMs = Date.now() - traceCreateStartedAt;
      const promptSnapshot = this.buildPromptSnapshot({
        question: input.question,
        systemPrompt: assistant.systemPrompt,
        answerPolicy: normalizedAnswerPolicy,
        chunks: retrievedChunks,
        contextGroups
      });
      const retrievalMetadataWithPrompt = this.withPromptContextMetrics(retrievalMetadata, promptSnapshot);
      const [strategyReadabilityLabel, retrievalModeProvenanceSentence, rewriteReadabilityLabel] = await Promise.all([
        buildStrategyReadabilityLabel({
          retrievalMode: retrievalMetadata.strategySummary?.retrievalMode ?? null,
          retrievalQuerySource: retrievalMetadata.strategySummary?.retrievalQuerySource ?? null,
          fallbackReason: retrievalMetadata.strategySummary?.fallbackReason ?? null,
          strategyUsedFallback: retrievalMetadata.strategySummary?.usedFallback ?? null
        }),
        buildRetrievalModeProvenanceSentence({
          retrievalMode: retrievalMetadata.strategySummary?.retrievalMode ?? null,
          strategyUsedFallback: retrievalMetadata.strategySummary?.usedFallback ?? null,
          fallbackReason: retrievalMetadata.strategySummary?.fallbackReason ?? null
        }),
        buildRewriteReadabilityLabel({
          rewriteEnabled: retrievalMetadata.strategySummary?.rewriteEnabled ?? false,
          rewriteApplied: retrievalMetadata.strategySummary?.rewriteApplied ?? false,
          rewriteUsedFallback: retrievalMetadata.strategySummary?.rewriteUsedFallback ?? null,
          rewritePromptId: retrievalMetadata.strategySummary?.rewritePromptId ?? null
        })
      ]);
      const assistantMessagePersistStartedAt = Date.now();

      const assistantMessage = await this.messagesService.createMessage({
        conversationId: conversation.id,
        role: MessageRole.assistant,
        content: resolvedAnswerResult.answer,
        traceId: trace.id
      });
      const assistantMessagePersistMs = Date.now() - assistantMessagePersistStartedAt;

      await this.messagesService.attachTrace(userMessage.id, trace.id);
      await this.conversationsService.touchConversation(conversation.id, authContext.identity);
      const traceFinalizeStartedAt = Date.now();
      const persistedTimingSummary = this.buildTimingSummary({
        totalMs: Date.now() - startedAt,
        firstTokenMs,
        preGenerationMs,
        llmFirstTokenMs: firstTokenMs != null ? Math.max(0, firstTokenMs - preGenerationMs) : null,
        conversationLoadMs,
        userMessagePersistMs,
        rewriteMs,
        retrievalMs,
        traceCreateMs,
        answerGenerationMs,
        assistantMessagePersistMs,
        traceFinalizeMs: null,
        llmQueueWaitMs,
        retrievalQueueWaitMs
      });
      await this.tracesService.updateTrace(trace.id, {
        assistantMessageId: assistantMessage.id,
        citationsJson: resolvedAnswerResult.citations,
        retrievalMetadataJson: {
          ...(retrievalMetadataWithPrompt as Record<string, unknown>),
          timing: persistedTimingSummary
        } as AskRetrievalMetadataJson,
        answeringMetadataJson: this.withPromptSnapshot(resolvedAnswerResult.answeringMetadata, promptSnapshot),
        qualityEvaluationJson: resolvedAnswerResult.qualityEvaluation,
        latencyMs: Date.now() - startedAt,
        modelName: resolvedAnswerResult.modelName,
        rewrittenQuery: retrievalQuery !== input.question ? retrievalQuery : null,
        retrievedChunkIdsJson: retrievedChunks.map((chunk: AskResultChunk) => chunk.chunkId),
        retrievalScoresJson,
        status: TraceStatus.success
      });
      const timingSummary = this.buildTimingSummary({
        ...persistedTimingSummary,
        traceFinalizeMs: Date.now() - traceFinalizeStartedAt
      });
      const timingReadabilitySentence = this.buildTimingReadabilitySentence(timingSummary);
      this.logAskTiming({
        route: "ask_stream",
        status: "success",
        assistantId: assistant.id,
        conversationId: conversation.id,
        traceId: trace.id,
        retrievalMode: retrievalMetadataWithPrompt.strategySummary?.retrievalMode ?? null,
        timing: timingSummary,
        retrievalExecution:
          typeof retrievalMetadataWithPrompt.execution === "object" && retrievalMetadataWithPrompt.execution !== null
            ? retrievalMetadataWithPrompt.execution
            : null,
        retrievalDiagnostics: this.buildRetrievalLogDiagnostics(retrievalMetadataWithPrompt)
      });

      const answerAttributionSummary = this.resolveAnswerAttributionSummary(resolvedAnswerResult.answeringMetadata);
      const answerAttributionSource = this.resolveAnswerAttributionSource(resolvedAnswerResult.answeringMetadata);
      const answerEvidenceSourceReadabilityLabel = buildAnswerEvidenceSourceReadabilityLabel(answerAttributionSource);
      const answerEvidenceSourceReadabilitySentence = this.buildAnswerEvidenceSourceReadabilitySentence(
        answerEvidenceSourceReadabilityLabel
      );
      const answerTextSource = this.resolveAnswerTextSource(resolvedAnswerResult.answeringMetadata);
      const rawAnswerTextSource = this.readString(
        typeof resolvedAnswerResult.answeringMetadata === "object" && resolvedAnswerResult.answeringMetadata !== null
          ? (resolvedAnswerResult.answeringMetadata as Record<string, unknown>).answerTextSource
          : null
      );
      const answerStatusSource = this.resolveAnswerStatusSource(resolvedAnswerResult.answeringMetadata);
      const rawAnswerStatusSource = this.readString(
        typeof resolvedAnswerResult.answeringMetadata === "object" && resolvedAnswerResult.answeringMetadata !== null
          ? (resolvedAnswerResult.answeringMetadata as Record<string, unknown>).answerStatusSource
          : null
      );
      const answerSourceReadability = buildAnswerSourceReadability({
        answerTextSource,
        rawAnswerTextSource,
        answerStatusSource,
        rawAnswerStatusSource
      });
      const {
        answerTextSourceReadabilityLabel,
        answerTextSourceReadabilitySentence,
        answerStatusSourceReadabilityLabel,
        answerStatusSourceReadabilitySentence
      } = answerSourceReadability;
      const answerAttributionReadabilitySentence =
        answerAttributionSummary.readabilitySentence ?? "Answer attribution is unknown; source evidence is unknown.";
      const { answerProvenanceSentence, answerProvenanceReadabilitySentence } = buildAnswerProvenanceFields({
        answerTextSource,
        answerStatusSource,
        answerAttributionReadabilityResolvedLabel: answerAttributionSummary.readabilityResolvedLabel,
        answerTextSourceReadabilityLabel,
        answerStatusSourceReadabilityLabel,
        answerAttributionReadabilitySentence
      });
      const missingInformationSource = this.resolveMissingInformationSource(resolvedAnswerResult.answeringMetadata);
      const missingInformationProvenanceSentence = buildMissingInformationProvenanceSentence({
        missingInformationSource,
        insufficientContextReason: this.resolveInsufficientContextReason(resolvedAnswerResult.answeringMetadata),
        missingInformationCount: this.resolveMissingInformationCount({
          answeringMetadata: resolvedAnswerResult.answeringMetadata,
          missingInformation: resolvedAnswerResult.missingInformation
        })
      });
      const finalResult = {
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        traceId: trace.id,
        answer: resolvedAnswerResult.answer,
        citations: resolvedAnswerResult.citations,
        retrievedChunks: resolvedAnswerResult.retrievedChunks,
        contextGroups: resolvedAnswerResult.contextGroups,
        strategySummary: retrievalMetadataWithPrompt.strategySummary,
        strategyReadabilityLabel,
        rewriteReadabilityLabel,
        retrievalModeProvenanceSentence,
        retrievalMetadata: retrievalMetadataWithPrompt,
        timingSummary,
        timingReadabilitySentence,
        answerAttributionSummary,
        answerAttributionReadabilitySentence,
        answerAttribution: this.resolveAnswerAttribution(resolvedAnswerResult.answeringMetadata),
        answerAttributionSource,
        answerEvidenceSource: answerAttributionSource,
        answerEvidenceSourceReadabilityLabel,
        answerEvidenceSourceReadabilitySentence,
        answerTextSource,
        answerTextSourceReadabilityLabel,
        answerTextSourceReadabilitySentence,
        answerStatusSource,
        answerStatusSourceReadabilityLabel,
        answerStatusSourceReadabilitySentence,
        answerProvenanceSentence,
        answerProvenanceReadabilitySentence,
        missingInformationSource,
        missingInformationProvenanceSentence,
        missingInformationSourceReadabilityLabel: buildMissingInformationSourceReadabilityLabel({
          missingInformationSource
        }),
        answeringMetadata: this.withPromptSnapshot(resolvedAnswerResult.answeringMetadata, promptSnapshot),
        modelName: resolvedAnswerResult.modelName,
        answerStatus: resolvedAnswerResult.answerStatus,
        missingInformation: resolvedAnswerResult.missingInformation,
        qualityEvaluation: resolvedAnswerResult.qualityEvaluation
      };

      await input.onEvent({
        type: "final",
        data: finalResult
      });

      return finalResult;
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Unknown ask pipeline error.";
      const resolvedTrace = trace ?? (await tracePromise);
      trace = resolvedTrace;
      const promptSnapshot = this.buildPromptSnapshot({
        question: input.question,
        systemPrompt: assistant.systemPrompt,
        answerPolicy: normalizedAnswerPolicy,
        chunks: retrievedChunks,
        contextGroups
      });
      const retrievalMetadataWithPrompt = this.withPromptContextMetrics(retrievalMetadata, promptSnapshot);
      const failureTimingSummary = this.buildTimingSummary({
        totalMs: Date.now() - startedAt,
        firstTokenMs: null,
        preGenerationMs: null,
        llmFirstTokenMs: null,
        conversationLoadMs,
        userMessagePersistMs,
        rewriteMs,
        retrievalMs,
        traceCreateMs,
        answerGenerationMs: null,
        assistantMessagePersistMs: null,
        traceFinalizeMs: null,
        llmQueueWaitMs,
        retrievalQueueWaitMs
      });
      this.logAskTiming({
        route: "ask_stream",
        status: "failed",
        assistantId: assistant.id,
        conversationId: conversation.id,
        traceId: resolvedTrace.id,
        retrievalMode: retrievalMetadataWithPrompt.strategySummary?.retrievalMode ?? null,
        timing: failureTimingSummary,
        retrievalExecution:
          typeof retrievalMetadataWithPrompt.execution === "object" && retrievalMetadataWithPrompt.execution !== null
            ? retrievalMetadataWithPrompt.execution
            : null,
        retrievalDiagnostics: this.buildRetrievalLogDiagnostics(retrievalMetadataWithPrompt),
        errorMessage: message
      });
      await this.tracesService.updateTrace(resolvedTrace.id, {
        latencyMs: Date.now() - startedAt,
        modelName: rewritten.modelName ?? undefined,
        rewrittenQuery: retrievalQuery !== input.question ? retrievalQuery : null,
        retrievedChunkIdsJson: retrievedChunks.map((chunk: AskResultChunk) => chunk.chunkId),
        retrievalScoresJson,
        retrievalMetadataJson: this.withFailureMetadata({
          ...(retrievalMetadataWithPrompt as Record<string, unknown>),
          timing: failureTimingSummary
        } as AskRetrievalMetadataJson, {
          stage: "answering",
          message
        }),
        status: TraceStatus.failed,
        errorMessage: message
      });
      throw new AskAssistantError({
        traceId: resolvedTrace.id,
        details: {
          stage: "answering",
          cause: message
        }
      });
    }
  }

  private buildTimingSummary(input: AskTimingSummary): AskTimingSummary {
    return { ...input };
  }

  private buildPromptSnapshot(input: {
    question: string;
    systemPrompt: string;
    answerPolicy: Partial<AnswerPolicy> | null | undefined;
    chunks: AskResultChunk[];
    contextGroups: Array<{
      documentId: string;
      documentTitle: string;
      startChunkIndex: number;
      endChunkIndex: number;
      chunkIds: string[];
      primaryChunkIds: string[];
      mergedContent: string;
      pageNumbers: number[];
      sectionTitles: string[];
    }>;
  }): PromptSnapshot {
    const normalizedChunks = input.chunks.map((chunk: AskResultChunk) => ({
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      content: chunk.content,
      score: chunk.score,
      pageNo: chunk.pageNo ?? null,
      sectionTitle: chunk.sectionTitle ?? null
    }));
    const llmChunks = this.answeringService.buildStreamAnswerContext({
      chunks: normalizedChunks,
      contextGroups: input.contextGroups
    });
    const prompt = this.promptManager.buildAnswerPrompt({
      question: input.question,
      systemPrompt: input.systemPrompt,
      answerPolicy: this.normalizeAnswerPolicy(input.answerPolicy),
      chunks: llmChunks
    });

    return {
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt
    };
  }

  private withPromptContextMetrics(
    retrievalMetadata: AskRetrievalMetadataJson,
    promptSnapshot: PromptSnapshot
  ): AskRetrievalMetadataJson {
    const promptContextChars = promptSnapshot.userPrompt.length;
    const promptContextApproxTokens = this.approximateTokenCount(promptSnapshot.systemPrompt) +
      this.approximateTokenCount(promptSnapshot.userPrompt);

    return {
      ...(retrievalMetadata as Record<string, unknown>),
      promptContextChars,
      promptContextApproxTokens
    } as AskRetrievalMetadataJson;
  }

  private buildTimingReadabilitySentence(timing: AskTimingSummary) {
    const render = (label: string, value: number | null) => `${label} ${value == null ? "n/a" : `${value}ms`}`;
    return [
      render("total", timing.totalMs),
      render("first token", timing.firstTokenMs),
      render("pre-generation", timing.preGenerationMs),
      render("llm first token", timing.llmFirstTokenMs),
      render("conversation", timing.conversationLoadMs),
      render("persist user", timing.userMessagePersistMs),
      render("rewrite", timing.rewriteMs),
      render("retrieval", timing.retrievalMs),
      render("trace create", timing.traceCreateMs),
      render("generation", timing.answerGenerationMs),
      render("persist assistant", timing.assistantMessagePersistMs),
      render("trace finalize", timing.traceFinalizeMs),
      render("llm queue", timing.llmQueueWaitMs),
      render("retrieval queue", timing.retrievalQueueWaitMs)
    ].join("; ") + ".";
  }

  private logAskTiming(input: {
    route: "ask" | "ask_stream";
    status: "success" | "failed" | "aborted";
    assistantId: string;
    conversationId: string;
    traceId: string;
    retrievalMode: string | null;
    timing: AskTimingSummary | null;
    retrievalExecution?: unknown;
    retrievalDiagnostics?: unknown;
    errorMessage?: string;
  }) {
    const payload = {
      event: "ask_timing",
      route: input.route,
      status: input.status,
      assistantId: input.assistantId,
      conversationId: input.conversationId,
      traceId: input.traceId,
      retrievalMode: input.retrievalMode,
      timing: input.timing,
      retrievalExecution: input.retrievalExecution ?? null,
      retrievalDiagnostics: input.retrievalDiagnostics ?? null,
      errorMessage: input.errorMessage ?? null
    };

    if (input.status === "success") {
      this.logger.log(JSON.stringify(payload));
      return;
    }

    this.logger.warn(JSON.stringify(payload));
  }

  private buildRetrievalLogDiagnostics(retrievalMetadata: unknown) {
    if (typeof retrievalMetadata !== "object" || retrievalMetadata == null || Array.isArray(retrievalMetadata)) {
      return null;
    }

    const metadata = retrievalMetadata as Record<string, unknown>;
    const execution =
      typeof metadata.execution === "object" && metadata.execution !== null && !Array.isArray(metadata.execution)
        ? (metadata.execution as Record<string, unknown>)
        : null;
    const timing =
      execution != null && typeof execution.timing === "object" && execution.timing !== null && !Array.isArray(execution.timing)
        ? (execution.timing as Record<string, unknown>)
        : null;
    const embedding =
      typeof metadata.embedding === "object" && metadata.embedding !== null && !Array.isArray(metadata.embedding)
        ? (metadata.embedding as Record<string, unknown>)
        : null;
    const activeEmbedding =
      embedding != null && typeof embedding.active === "object" && embedding.active !== null && !Array.isArray(embedding.active)
        ? (embedding.active as Record<string, unknown>)
        : null;
    const indexedEmbedding =
      embedding != null && typeof embedding.indexed === "object" && embedding.indexed !== null && !Array.isArray(embedding.indexed)
        ? (embedding.indexed as Record<string, unknown>)
        : null;

    const retrievalQuery = typeof execution?.retrievalQuery === "string" ? execution.retrievalQuery : "";
    const vectorCandidateCount = this.readNumber(execution?.vectorCandidateCount);
    const retrievedChunkCount = this.readNumber(execution?.retrievedChunkCount);
    const contextGroupCount = this.readNumber(execution?.contextGroupCount);
    const lexicalCandidateCount = this.readNumber(execution?.lexicalCandidateCount);
    const candidateLimit = this.readNumber(execution?.candidateLimit);
    const vectorSearchMs = this.readNumber(timing?.vectorSearchMs);
    const vectorCandidateFetchMs = this.readNumber(timing?.vectorCandidateFetchMs);
    const chunkWindowMs = this.readNumber(timing?.chunkWindowMs);
    const lexicalSearchMs = this.readNumber(timing?.lexicalSearchMs);

    return {
      queryChars: retrievalQuery.length,
      queryApproxTokens: this.approximateTokenCount(retrievalQuery),
      indexedRecordCount: this.readNumber(indexedEmbedding?.recordCount),
      indexedDocumentCount: this.readNumber(indexedEmbedding?.documentCount),
      indexedModelName: this.readString(indexedEmbedding?.modelName),
      indexedDimensions: this.readNumber(indexedEmbedding?.dimensions),
      activeModelName: this.readString(activeEmbedding?.modelName),
      activeDimensions: this.readNumber(activeEmbedding?.dimensions),
      candidateLimit,
      vectorCandidateCount,
      lexicalCandidateCount,
      retrievedChunkCount,
      contextGroupCount,
      vectorSearchMsPerVectorCandidate:
        vectorSearchMs != null && vectorCandidateCount != null && vectorCandidateCount > 0
          ? Number((vectorSearchMs / vectorCandidateCount).toFixed(2))
          : null,
      vectorFetchMsPerVectorCandidate:
        vectorCandidateFetchMs != null && vectorCandidateCount != null && vectorCandidateCount > 0
          ? Number((vectorCandidateFetchMs / vectorCandidateCount).toFixed(2))
          : null,
      chunkWindowMsPerRetrievedChunk:
        chunkWindowMs != null && retrievedChunkCount != null && retrievedChunkCount > 0
          ? Number((chunkWindowMs / retrievedChunkCount).toFixed(2))
          : null,
      lexicalCandidatesPerBudget:
        lexicalCandidateCount != null && candidateLimit != null && candidateLimit > 0
          ? Number((lexicalCandidateCount / candidateLimit).toFixed(3))
          : null,
      lexicalSearchMs,
      vectorSearchMs,
      vectorCandidateFetchMs,
      chunkWindowMs
    };
  }

  private normalizeAnswerPolicy(input?: Partial<AnswerPolicy> | null) {
    return {
      responseStyle: input?.responseStyle ?? "concise",
      tone: input?.tone ?? "neutral",
      outputFormat: input?.outputFormat ?? "paragraph",
      language: input?.language ?? "auto",
      citationMode: input?.citationMode ?? "required",
      maxCitations: input?.maxCitations ?? 3,
      noAnswerBehavior: input?.noAnswerBehavior ?? "say_insufficient_context",
      includeMissingInformation: input?.includeMissingInformation ?? true
    } as const;
  }

  private isAbortError(error: unknown) {
    return error instanceof Error && error.name === "AbortError";
  }

  private resolveRewriteDecision(
    question: string,
    retrievalStrategy: ReturnType<typeof resolveRetrievalStrategy>
  ): AskRewriteDecision {
    const mode = retrievalStrategy.queryRewrite.mode;
    if (!retrievalStrategy.queryRewrite.enabled || mode === "off") {
      return {
        shouldRewrite: false,
        skippedReason: "disabled_by_default"
      };
    }

    if (mode === "always") {
      return {
        shouldRewrite: true,
        skippedReason: null
      };
    }

    const normalizedQuestion = this.normalizeQuestion(question);
    const termCount = normalizedQuestion.length === 0 ? 0 : normalizedQuestion.split(/\s+/).length;
    if (normalizedQuestion.length < 18 || termCount < 6) {
      return {
        shouldRewrite: false,
        skippedReason: "query_too_short"
      };
    }

    if (!this.isSummaryOrComplexQuestion(question)) {
      return {
        shouldRewrite: false,
        skippedReason: "not_summary_or_complex_question"
      };
    }

    const estimatedRewriteLatencyMs = 180 + termCount * 30 + Math.ceil(normalizedQuestion.length / 12);
    if (retrievalStrategy.queryRewrite.maxAddedLatencyMs < estimatedRewriteLatencyMs) {
      return {
        shouldRewrite: false,
        skippedReason: "latency_budget_exceeded"
      };
    }

    return {
      shouldRewrite: true,
      skippedReason: null
    };
  }

  private isSummaryOrComplexQuestion(question: string) {
    return /summary|compare|difference|list|steps|why|how|issue|problem|debug|error|tradeoff|versus|vs\b|\?|总结|概括|列出|比较|区别|排查|问题|原因|步骤|有哪些/i
      .test(question);
  }

  private normalizeQuestion(question: string) {
    return question.toLowerCase().replace(/\s+/g, " ").trim();
  }

  private approximateTokenCount(value: string) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return 0;
    }

    return Math.ceil(normalized.length / 4);
  }

  private resolveAnswerAttribution(answeringMetadata: unknown): TraceCitationAttribution | null {
    if (typeof answeringMetadata !== "object" || answeringMetadata === null) {
      return null;
    }

    const attribution = (answeringMetadata as Record<string, unknown>).citationAttribution;
    return attribution === "explicit" || attribution === "heuristic" || attribution === "none"
      ? attribution
      : null;
  }

  private resolveAnswerAttributionSource(answeringMetadata: unknown): TraceCitationSelectionSource | null {
    if (typeof answeringMetadata !== "object" || answeringMetadata === null) {
      return null;
    }

    const source = (answeringMetadata as Record<string, unknown>).citationSelectionSource;
    return source === "structured" || source === "inline_markers" || source === "heuristic" || source === "none"
      ? source
      : null;
  }

  private resolveAnswerAttributionSummary(answeringMetadata: unknown): TraceAnswerAttributionSummary {
    return buildAnswerAttributionSummary({
      attribution: this.resolveAnswerAttribution(answeringMetadata),
      source: this.resolveAnswerAttributionSource(answeringMetadata)
    });
  }

  private resolveAnswerTextSource(answeringMetadata: unknown): TraceSummary["answerTextSource"] {
    if (typeof answeringMetadata !== "object" || answeringMetadata === null) {
      return null;
    }

    const source = (answeringMetadata as Record<string, unknown>).answerTextSource;
    return source === "model" || source === "deterministic_policy" ? source : null;
  }

  private resolveAnswerStatusSource(answeringMetadata: unknown): TraceSummary["answerStatusSource"] {
    if (typeof answeringMetadata !== "object" || answeringMetadata === null) {
      return null;
    }

    const source = (answeringMetadata as Record<string, unknown>).answerStatusSource;
    return source === "model" || source === "inferred_from_retrieval" || source === "deterministic_policy"
      ? source
      : null;
  }

  private readString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
  }

  private readNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private buildAnswerEvidenceSourceReadabilitySentence(
    answerEvidenceSourceReadabilityLabel: TraceSummary["answerEvidenceSourceReadabilityLabel"]
  ): TraceSummary["answerEvidenceSourceReadabilitySentence"] {
    return `Answer evidence source is ${answerEvidenceSourceReadabilityLabel}.`;
  }

  private resolveMissingInformationSource(answeringMetadata: unknown): TraceSummary["missingInformationSource"] {
    if (typeof answeringMetadata !== "object" || answeringMetadata === null) {
      return null;
    }

    const source = (answeringMetadata as Record<string, unknown>).missingInformationSource;
    return source === "none" || source === "model" || source === "deterministic_default" || source === "suppressed_by_policy"
      ? source
      : null;
  }

  private resolveInsufficientContextReason(answeringMetadata: unknown): TraceSummary["insufficientContextReason"] {
    if (typeof answeringMetadata !== "object" || answeringMetadata === null) {
      return null;
    }

    const reason = (answeringMetadata as Record<string, unknown>).insufficientContextReason;
    return reason === "no_retrieval_hits" || reason === "retrieved_context_insufficient"
      ? reason
      : null;
  }

  private resolveMissingInformationCount(input: {
    answeringMetadata: unknown;
    missingInformation: unknown;
  }) {
    if (typeof input.answeringMetadata === "object" && input.answeringMetadata !== null) {
      const count = (input.answeringMetadata as Record<string, unknown>).missingInformationCount;
      if (typeof count === "number") {
        return count;
      }
    }

    return Array.isArray(input.missingInformation) ? input.missingInformation.length : 0;
  }

  private buildRetrievalScoresJson(chunks: AskResultChunk[]): Prisma.InputJsonValue {
    return chunks.map((chunk: AskResultChunk) => ({
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      chunkIndex: chunk.chunkIndex,
      contentPreview: this.buildContentPreview(chunk.content),
      isPrimary: chunk.isPrimary ?? true,
      pageNo: chunk.pageNo ?? null,
      sectionTitle: chunk.sectionTitle ?? null,
      score: chunk.score,
      vectorScore: chunk.vectorScore ?? null,
      lexicalScore: chunk.lexicalScore ?? null,
      hybridScore: chunk.hybridScore ?? null,
      rerankScore: chunk.rerankScore ?? null
    })) as Prisma.InputJsonValue;
  }

  private buildContentPreview(content: string) {
    const normalized = content.replace(/\s+/g, " ").trim();
    if (normalized.length <= 220) {
      return normalized;
    }

    return `${normalized.slice(0, 217)}...`;
  }

  private buildRetrievalMetadata(input: {
    strategy: ReturnType<typeof resolveRetrievalStrategy>;
    filters?: RetrievalProfileFilters;
    rewrittenQuery: string | null;
    rewriteSkippedReason: RetrievalStrategySummary["rewriteSkippedReason"];
    rewriteModelName: string | null;
    rewritePromptId: string | null;
    rewriteUsedFallback: boolean | null;
    originalQuestion: string;
    topK: number;
    scoreThreshold: number;
    chunkWindow: number;
    retrievedChunks: AskResultChunk[];
    contextGroups: Array<{ primaryChunkIds: string[] }>;
    embedding: VectorStoreEmbeddingDiagnostics | null;
    promptContextChars: number | null;
    promptContextApproxTokens: number | null;
    execution: {
      actualMode: "vector" | "hybrid" | "lexical";
      usedFallback: boolean;
      fallbackReason: "vector_error" | "no_ranked_candidates" | null;
      rerankApplied: boolean;
      rerankMode?: "off" | "local_heuristic" | "llm_judge";
      rerankJudgeSkippedReason?:
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
  }): Prisma.InputJsonValue {
    const rewriteApplied = Boolean(input.rewrittenQuery && input.rewrittenQuery !== input.originalQuestion);
    const retrievalQuerySource = !input.strategy.queryRewrite.enabled
      ? "original_disabled"
      : rewriteApplied
        ? "rewritten"
        : "original_unchanged";

    const primaryChunks = input.retrievedChunks.filter(chunk => chunk.isPrimary ?? true);
    const primaryChunkScores = primaryChunks.map((chunk: AskResultChunk) => chunk.score);
    const primaryChunkScoreAvg = primaryChunkScores.length > 0
      ? Number((primaryChunkScores.reduce((sum, score) => sum + score, 0) / primaryChunkScores.length).toFixed(4))
      : null;
    const primaryChunkScoreMin = primaryChunkScores.length > 0
      ? Number(Math.min(...primaryChunkScores).toFixed(4))
      : null;
    const contextGroupAvgLength = input.contextGroups.length > 0
      ? Number(
          (
            input.contextGroups.reduce((sum, group) => {
              const groupLength = (group as { mergedContent?: string }).mergedContent?.length ?? 0;
              return sum + groupLength;
            }, 0) / input.contextGroups.length
          ).toFixed(2)
        )
      : null;

    return {
      strategy: input.strategy,
      filters: input.filters ?? null,
      promptContextChars: input.promptContextChars,
      promptContextApproxTokens: input.promptContextApproxTokens,
      primaryChunkScoreAvg,
      primaryChunkScoreMin,
      contextGroupAvgLength,
      queryRewrite: {
        enabled: input.strategy.queryRewrite.enabled,
        applied: rewriteApplied,
        finalQuerySource: retrievalQuerySource,
        skippedReason: input.rewriteSkippedReason,
        usedFallback: input.strategy.queryRewrite.enabled ? input.rewriteUsedFallback : null,
        modelName: input.strategy.queryRewrite.enabled ? input.rewriteModelName : null,
        promptId: input.strategy.queryRewrite.enabled ? input.rewritePromptId : null
      },
      strategySummary: {
        retrievalMode: input.execution.actualMode,
        strategyMode: input.strategy.candidateSelection.mode,
        retrievalQuerySource,
        rewriteEnabled: input.strategy.queryRewrite.enabled,
        rewriteApplied,
        rewriteSkippedReason: input.rewriteSkippedReason,
        rewriteUsedFallback: input.strategy.queryRewrite.enabled ? input.rewriteUsedFallback : null,
        rewritePromptId: input.strategy.queryRewrite.enabled ? input.rewritePromptId : null,
        rewriteModelName: input.strategy.queryRewrite.enabled ? input.rewriteModelName : null,
        fallbackReason: input.execution.fallbackReason,
        usedFallback: input.execution.usedFallback
      },
      embedding: input.embedding ?? null,
      execution: {
        retrievalQuery: input.rewrittenQuery || input.originalQuestion,
        topK: input.topK,
        scoreThreshold: input.scoreThreshold,
        chunkWindow: input.chunkWindow,
        actualMode: input.execution.actualMode,
        usedFallback: input.execution.usedFallback,
        fallbackReason: input.execution.fallbackReason,
        rerankApplied: input.execution.rerankApplied,
        rerankMode: input.execution.rerankMode ?? (input.execution.rerankApplied ? "local_heuristic" : "off"),
        rerankJudgeSkippedReason: input.execution.rerankJudgeSkippedReason ?? null,
        chunkWindowApplied: input.execution.chunkWindowApplied,
        vectorSearchAttempted: input.execution.vectorSearchAttempted,
        lexicalSearchAttempted: input.execution.lexicalSearchAttempted,
        vectorCandidateLimitHit: input.execution.vectorCandidateLimitHit,
        lexicalCandidateLimitHit: input.execution.lexicalCandidateLimitHit,
        rankingTopKHit: input.execution.rankingTopKHit,
        candidateLimit: input.execution.candidateLimit,
        vectorCandidateCount: input.execution.vectorCandidateCount,
        lexicalCandidateCount: input.execution.lexicalCandidateCount,
        mergedCandidateCount: input.execution.mergedCandidateCount,
        rankedCandidateCount: input.execution.rankedCandidateCount,
        timing: input.execution.timing ?? null,
        retrievedChunkCount: input.retrievedChunks.length,
        contextGroupCount: input.contextGroups.length,
        primaryChunkCount: input.retrievedChunks.filter(chunk => chunk.isPrimary ?? true).length,
        neighborChunkCount: input.retrievedChunks.filter(chunk => !(chunk.isPrimary ?? true)).length
      }
    } as Prisma.InputJsonValue;
  }

  private async retrieveOrCreateFailedTrace(input: {
    assistantId: string;
    assistantKbId: string;
    conversationPromise: Promise<TimedResult<AskConversationRef>>;
    userMessagePromise: Promise<TimedResult<AskPersistedMessage>>;
    userQuery: string;
    retrievalQuery: string;
    retrievalProfile: {
      topK: number;
      scoreThreshold: number;
      chunkWindow: number;
      enableHybrid: boolean;
      enableRerank: boolean;
    };
    retrievalStrategy: ReturnType<typeof resolveRetrievalStrategy>;
    retrievalFilters?: RetrievalProfileFilters;
    rewritten: AskRewriteResult;
    documentVersions?: Record<string, number>;
  }): Promise<RetrievalResult> {
    try {
      const retrievalResult = await this.retrievalService.retrieve({
        kbId: input.assistantKbId,
        query: input.retrievalQuery,
        topK: input.retrievalProfile.topK,
        scoreThreshold: input.retrievalProfile.scoreThreshold,
        chunkWindow: input.retrievalProfile.chunkWindow,
        enableHybrid: input.retrievalProfile.enableHybrid,
        enableRerank: input.retrievalProfile.enableRerank,
        filters: input.retrievalFilters,
        strategy: input.retrievalStrategy,
        documentVersions: input.documentVersions
      });
      if (!retrievalResult) {
        throw new Error("Retrieval returned no result.");
      }

      return retrievalResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown retrieval pipeline error.";
      const embeddingDiagnostics = error instanceof VectorStoreCompatibilityError ? error.embeddingDiagnostics : null;
      const [
        { value: conversation },
        { value: userMessage }
      ] = await Promise.all([input.conversationPromise, input.userMessagePromise]);
      const failedTrace = await this.tracesService.createTrace({
        conversationId: conversation.id,
        assistantId: input.assistantId,
        userMessageId: userMessage.id,
        userQuery: input.userQuery,
        rewrittenQuery: input.retrievalQuery !== input.userQuery ? input.retrievalQuery : null,
        retrievalMetadataJson: this.buildRetrievalFailureMetadata({
          strategy: input.retrievalStrategy,
          filters: input.retrievalFilters,
          rewrittenQuery: input.rewritten.rewrittenQuery,
          rewriteSkippedReason: input.rewritten.skippedReason,
          rewriteModelName: input.retrievalStrategy.queryRewrite.enabled ? input.rewritten.modelName : null,
          rewritePromptId: input.retrievalStrategy.queryRewrite.enabled ? input.rewritten.promptId : null,
          rewriteUsedFallback: input.retrievalStrategy.queryRewrite.enabled ? input.rewritten.usedFallback : null,
          originalQuestion: input.userQuery,
          topK: input.retrievalProfile.topK,
          scoreThreshold: input.retrievalProfile.scoreThreshold,
          chunkWindow: input.retrievalProfile.chunkWindow,
          embedding: embeddingDiagnostics,
          failure: {
            stage: "retrieval",
            message
          }
        }),
        modelName: input.rewritten.modelName ?? undefined,
        status: TraceStatus.failed,
        errorMessage: message
      });
      throw new AskAssistantError({
        traceId: failedTrace.id,
        details: {
          stage: "retrieval",
          cause: message
        }
      });
    }
  }

  private buildRetrievalFailureMetadata(input: {
    strategy: ReturnType<typeof resolveRetrievalStrategy>;
    filters?: RetrievalProfileFilters;
    rewrittenQuery: string | null;
    rewriteSkippedReason: RetrievalStrategySummary["rewriteSkippedReason"];
    rewriteModelName: string | null;
    rewritePromptId: string | null;
    rewriteUsedFallback: boolean | null;
    originalQuestion: string;
    topK: number;
    scoreThreshold: number;
    chunkWindow: number;
    embedding?: VectorStoreEmbeddingDiagnostics | null;
    failure: {
      stage: "retrieval";
      message: string;
    };
  }): Prisma.InputJsonValue {
    const rewriteApplied = Boolean(input.rewrittenQuery && input.rewrittenQuery !== input.originalQuestion);
    const retrievalQuerySource = !input.strategy.queryRewrite.enabled
      ? "original_disabled"
      : rewriteApplied
        ? "rewritten"
        : "original_unchanged";

    return {
      strategy: input.strategy,
      filters: input.filters ?? null,
      queryRewrite: {
        enabled: input.strategy.queryRewrite.enabled,
        applied: rewriteApplied,
        finalQuerySource: retrievalQuerySource,
        skippedReason: input.rewriteSkippedReason,
        usedFallback: input.strategy.queryRewrite.enabled ? input.rewriteUsedFallback : null,
        modelName: input.strategy.queryRewrite.enabled ? input.rewriteModelName : null,
        promptId: input.strategy.queryRewrite.enabled ? input.rewritePromptId : null
      },
      strategySummary: {
        retrievalMode: null,
        strategyMode: input.strategy.candidateSelection.mode,
        retrievalQuerySource,
        rewriteEnabled: input.strategy.queryRewrite.enabled,
        rewriteApplied,
        rewriteSkippedReason: input.rewriteSkippedReason,
        rewriteUsedFallback: input.strategy.queryRewrite.enabled ? input.rewriteUsedFallback : null,
        rewritePromptId: input.strategy.queryRewrite.enabled ? input.rewritePromptId : null,
        rewriteModelName: input.strategy.queryRewrite.enabled ? input.rewriteModelName : null,
        fallbackReason: null,
        usedFallback: null
      },
      embedding: input.embedding ?? null,
      execution: {
        retrievalQuery: input.rewrittenQuery || input.originalQuestion,
        topK: input.topK,
        scoreThreshold: input.scoreThreshold,
        chunkWindow: input.chunkWindow
      },
      failure: {
        stage: input.failure.stage,
        message: input.failure.message
      }
    } as Prisma.InputJsonValue;
  }

  private withFailureMetadata(
    retrievalMetadata: AskRetrievalMetadataJson,
    failure: { stage: "answering"; message: string }
  ): AskRetrievalMetadataJson {
    return {
      ...(retrievalMetadata as Record<string, unknown>),
      failure: {
        stage: failure.stage,
        message: failure.message
      }
    } as AskRetrievalMetadataJson;
  }

  private withPromptSnapshot(
    answeringMetadata: unknown,
    promptSnapshot: PromptSnapshot
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (typeof answeringMetadata !== "object" || answeringMetadata == null || Array.isArray(answeringMetadata)) {
      return answeringMetadata == null ? undefined : (answeringMetadata as Prisma.InputJsonValue);
    }

    return {
      ...(answeringMetadata as Record<string, unknown>),
      promptSnapshot
    } as Prisma.InputJsonValue;
  }
}
