import { Injectable } from "@nestjs/common";
import { MessageRole, Prisma, TraceStatus } from "@prisma/client";
import { AnswerPolicy } from "../../infra/llm/llm.types";
import { LlmService } from "../../infra/llm/llm.service";
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
import { RetrievalService } from "../retrieval/retrieval.service";
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

@Injectable()
export class AskAssistantService {
  constructor(
    private readonly assistantsService: AssistantsService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly retrievalService: RetrievalService,
    private readonly answeringService: AnsweringService,
    private readonly tracesService: TracesService,
    private readonly llmService: LlmService
  ) {}

  async askAssistant(input: {
    assistantId: string;
    question: string;
    conversationId?: string;
    authContext?: RequestAuthContext | null;
  }) {
    const authContext = resolveRequestAuthContext({
      authContext: input.authContext
    });
    const assistant = await this.assistantsService.getAssistant(input.assistantId, authContext.identity);
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

    const userMessage = await this.messagesService.createMessage({
      conversationId: conversation.id,
      role: MessageRole.user,
      content: input.question
    });

    const startedAt = Date.now();
    const retrievalStrategy = resolveRetrievalStrategy({
      topK: retrievalProfile.topK,
      enableHybrid: retrievalProfile.enableHybrid,
      enableRerank: retrievalProfile.enableRerank,
      strategyJson: retrievalProfile.strategyJson as RetrievalStrategy | undefined
    });
    const rewritten = retrievalStrategy.queryRewrite.enabled
      ? await this.llmService.rewriteQuery({
          question: input.question
        })
      : {
          rewrittenQuery: null,
          modelName: null,
          usedFallback: null,
          promptId: null
        };
    const retrievalQuery = rewritten.rewrittenQuery || input.question;
    const retrievalFilters = retrievalProfileFiltersSchema.optional().parse(
      assistant.retrievalProfile.filtersJson ?? undefined
    );
    const answerPolicy = answerPolicySchema.nullable().optional().parse(assistant.answerPolicyJson ?? undefined) ?? undefined;
    const normalizedAnswerPolicy = this.normalizeAnswerPolicy(answerPolicy);
    const retrievalResult = await this.retrieveOrCreateFailedTrace({
      assistantId: assistant.id,
      assistantKbId: assistant.kbId,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      userQuery: input.question,
      retrievalQuery,
      retrievalProfile,
      retrievalStrategy,
      retrievalFilters,
      rewritten
    });
    const retrievedChunks = retrievalResult.retrievedChunks;
    const contextGroups = retrievalResult.contextGroups;
    const retrievalScoresJson = this.buildRetrievalScoresJson(retrievedChunks);
    const retrievalMetadata = this.buildRetrievalMetadata({
      strategy: retrievalStrategy,
      filters: retrievalFilters,
      rewrittenQuery: rewritten.rewrittenQuery,
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
      execution: retrievalResult.execution
    }) as AskRetrievalMetadataJson;
    const strategyReadabilityLabel = buildStrategyReadabilityLabel({
      retrievalMode: retrievalMetadata.strategySummary?.retrievalMode ?? null,
      retrievalQuerySource: retrievalMetadata.strategySummary?.retrievalQuerySource ?? null,
      fallbackReason: retrievalMetadata.strategySummary?.fallbackReason ?? null,
      strategyUsedFallback: retrievalMetadata.strategySummary?.usedFallback ?? null
    });
    const retrievalModeProvenanceSentence = buildRetrievalModeProvenanceSentence({
      retrievalMode: retrievalMetadata.strategySummary?.retrievalMode ?? null,
      strategyUsedFallback: retrievalMetadata.strategySummary?.usedFallback ?? null,
      fallbackReason: retrievalMetadata.strategySummary?.fallbackReason ?? null
    });
    const rewriteReadabilityLabel = buildRewriteReadabilityLabel({
      rewriteEnabled: retrievalMetadata.strategySummary?.rewriteEnabled ?? false,
      rewriteApplied: retrievalMetadata.strategySummary?.rewriteApplied ?? false,
      rewriteUsedFallback: retrievalMetadata.strategySummary?.rewriteUsedFallback ?? null,
      rewritePromptId: retrievalMetadata.strategySummary?.rewritePromptId ?? null
    });

    const trace = await this.tracesService.createTrace({
      conversationId: conversation.id,
      assistantId: assistant.id,
      userMessageId: userMessage.id,
      userQuery: input.question,
      rewrittenQuery: retrievalQuery !== input.question ? retrievalQuery : null,
      retrievedChunkIdsJson: retrievedChunks.map(chunk => chunk.chunkId),
      retrievalScoresJson,
      retrievalMetadataJson: retrievalMetadata,
      modelName: rewritten.modelName ?? undefined,
      status: TraceStatus.success
    });
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
        retrievalMetadataJson: retrievalMetadata,
        answeringMetadataJson: resolvedAnswerResult.answeringMetadata,
        qualityEvaluationJson: resolvedAnswerResult.qualityEvaluation,
        latencyMs: Date.now() - startedAt,
        modelName: resolvedAnswerResult.modelName,
        rewrittenQuery: retrievalQuery !== input.question ? retrievalQuery : null,
        retrievedChunkIdsJson: retrievedChunks.map(chunk => chunk.chunkId),
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
      return {
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        traceId: trace.id,
        answer: resolvedAnswerResult.answer,
        citations: resolvedAnswerResult.citations,
        retrievedChunks: resolvedAnswerResult.retrievedChunks,
        contextGroups: resolvedAnswerResult.contextGroups,
        strategySummary: retrievalMetadata.strategySummary,
        strategyReadabilityLabel,
        rewriteReadabilityLabel,
        retrievalModeProvenanceSentence,
        retrievalMetadata,
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
        answeringMetadata: resolvedAnswerResult.answeringMetadata,
        modelName: resolvedAnswerResult.modelName,
        answerStatus: resolvedAnswerResult.answerStatus,
        missingInformation: resolvedAnswerResult.missingInformation,
        qualityEvaluation: resolvedAnswerResult.qualityEvaluation
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown ask pipeline error.";
      await this.tracesService.updateTrace(trace.id, {
        latencyMs: Date.now() - startedAt,
        modelName: rewritten.modelName ?? undefined,
        rewrittenQuery: retrievalQuery !== input.question ? retrievalQuery : null,
        retrievedChunkIdsJson: retrievedChunks.map(chunk => chunk.chunkId),
        retrievalScoresJson,
        retrievalMetadataJson: this.withFailureMetadata(retrievalMetadata, {
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
    const assistant = await this.assistantsService.getAssistant(input.assistantId, authContext.identity);
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

    await input.onEvent({
      type: "status",
      phase: "started"
    });

    const userMessage = await this.messagesService.createMessage({
      conversationId: conversation.id,
      role: MessageRole.user,
      content: input.question
    });

    const startedAt = Date.now();
    const retrievalStrategy = resolveRetrievalStrategy({
      topK: retrievalProfile.topK,
      enableHybrid: retrievalProfile.enableHybrid,
      enableRerank: retrievalProfile.enableRerank,
      strategyJson: retrievalProfile.strategyJson as RetrievalStrategy | undefined
    });
    const rewritten = retrievalStrategy.queryRewrite.enabled
      ? await this.llmService.rewriteQuery({
          question: input.question
        })
      : {
          rewrittenQuery: null,
          modelName: null,
          usedFallback: null,
          promptId: null
        };
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

    const retrievalResult = await this.retrieveOrCreateFailedTrace({
      assistantId: assistant.id,
      assistantKbId: assistant.kbId,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      userQuery: input.question,
      retrievalQuery,
      retrievalProfile,
      retrievalStrategy,
      retrievalFilters,
      rewritten
    });
    const retrievedChunks = retrievalResult.retrievedChunks;
    const contextGroups = retrievalResult.contextGroups;
    const retrievalScoresJson = this.buildRetrievalScoresJson(retrievedChunks);
    const retrievalMetadata = this.buildRetrievalMetadata({
      strategy: retrievalStrategy,
      filters: retrievalFilters,
      rewrittenQuery: rewritten.rewrittenQuery,
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
      execution: retrievalResult.execution
    }) as AskRetrievalMetadataJson;
    const strategyReadabilityLabel = buildStrategyReadabilityLabel({
      retrievalMode: retrievalMetadata.strategySummary?.retrievalMode ?? null,
      retrievalQuerySource: retrievalMetadata.strategySummary?.retrievalQuerySource ?? null,
      fallbackReason: retrievalMetadata.strategySummary?.fallbackReason ?? null,
      strategyUsedFallback: retrievalMetadata.strategySummary?.usedFallback ?? null
    });
    const retrievalModeProvenanceSentence = buildRetrievalModeProvenanceSentence({
      retrievalMode: retrievalMetadata.strategySummary?.retrievalMode ?? null,
      strategyUsedFallback: retrievalMetadata.strategySummary?.usedFallback ?? null,
      fallbackReason: retrievalMetadata.strategySummary?.fallbackReason ?? null
    });
    const rewriteReadabilityLabel = buildRewriteReadabilityLabel({
      rewriteEnabled: retrievalMetadata.strategySummary?.rewriteEnabled ?? false,
      rewriteApplied: retrievalMetadata.strategySummary?.rewriteApplied ?? false,
      rewriteUsedFallback: retrievalMetadata.strategySummary?.rewriteUsedFallback ?? null,
      rewritePromptId: retrievalMetadata.strategySummary?.rewritePromptId ?? null
    });

    const trace = await this.tracesService.createTrace({
      conversationId: conversation.id,
      assistantId: assistant.id,
      userMessageId: userMessage.id,
      userQuery: input.question,
      rewrittenQuery: retrievalQuery !== input.question ? retrievalQuery : null,
      retrievedChunkIdsJson: retrievedChunks.map(chunk => chunk.chunkId),
      retrievalScoresJson,
      retrievalMetadataJson: retrievalMetadata,
      modelName: rewritten.modelName ?? undefined,
      status: TraceStatus.success
    });

    try {
      await input.onEvent({
        type: "status",
        phase: "generating"
      });

      const resolvedAnswerResult =
        retrievedChunks.length === 0 && normalizedAnswerPolicy.noAnswerBehavior === "say_insufficient_context"
          ? await (async () => {
              const deterministicResult = this.answeringService.buildDeterministicInsufficientContextResult({
                question: input.question,
                answerPolicy: normalizedAnswerPolicy
              });
              await input.onEvent({
                type: "answer_delta",
                delta: deterministicResult.answer
              });

              return deterministicResult;
            })()
          : await (async () => {
              const streamResult = await this.llmService.generateAnswerStream({
                question: input.question,
                systemPrompt: assistant.systemPrompt,
                answerPolicy: normalizedAnswerPolicy,
                chunks: this.answeringService.buildStreamAnswerContext({
                  chunks: retrievedChunks,
                  contextGroups
                }),
                onDelta: async delta => {
                  await input.onEvent({
                    type: "answer_delta",
                    delta
                  });
                }
              });

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
        retrievalMetadataJson: retrievalMetadata,
        answeringMetadataJson: resolvedAnswerResult.answeringMetadata,
        qualityEvaluationJson: resolvedAnswerResult.qualityEvaluation,
        latencyMs: Date.now() - startedAt,
        modelName: resolvedAnswerResult.modelName,
        rewrittenQuery: retrievalQuery !== input.question ? retrievalQuery : null,
        retrievedChunkIdsJson: retrievedChunks.map(chunk => chunk.chunkId),
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
      const finalResult = {
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        traceId: trace.id,
        answer: resolvedAnswerResult.answer,
        citations: resolvedAnswerResult.citations,
        retrievedChunks: resolvedAnswerResult.retrievedChunks,
        contextGroups: resolvedAnswerResult.contextGroups,
        strategySummary: retrievalMetadata.strategySummary,
        strategyReadabilityLabel,
        rewriteReadabilityLabel,
        retrievalModeProvenanceSentence,
        retrievalMetadata,
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
        answeringMetadata: resolvedAnswerResult.answeringMetadata,
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
      const message = error instanceof Error ? error.message : "Unknown ask pipeline error.";
      await this.tracesService.updateTrace(trace.id, {
        latencyMs: Date.now() - startedAt,
        modelName: rewritten.modelName ?? undefined,
        rewrittenQuery: retrievalQuery !== input.question ? retrievalQuery : null,
        retrievedChunkIdsJson: retrievedChunks.map(chunk => chunk.chunkId),
        retrievalScoresJson,
        retrievalMetadataJson: this.withFailureMetadata(retrievalMetadata, {
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
    return chunks.map(chunk => ({
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
    conversationId: string;
    userMessageId: string;
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
    rewritten: {
      rewrittenQuery: string | null;
      modelName: string | null;
      usedFallback: boolean | null;
      promptId: string | null;
    };
  }) {
    try {
      return await this.retrievalService.retrieve({
        kbId: input.assistantKbId,
        query: input.retrievalQuery,
        topK: input.retrievalProfile.topK,
        scoreThreshold: input.retrievalProfile.scoreThreshold,
        chunkWindow: input.retrievalProfile.chunkWindow,
        enableHybrid: input.retrievalProfile.enableHybrid,
        enableRerank: input.retrievalProfile.enableRerank,
        filters: input.retrievalFilters,
        strategy: input.retrievalStrategy
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown retrieval pipeline error.";
      const embeddingDiagnostics = error instanceof VectorStoreCompatibilityError ? error.embeddingDiagnostics : null;
      const failedTrace = await this.tracesService.createTrace({
        conversationId: input.conversationId,
        assistantId: input.assistantId,
        userMessageId: input.userMessageId,
        userQuery: input.userQuery,
        rewrittenQuery: input.retrievalQuery !== input.userQuery ? input.retrievalQuery : null,
        retrievalMetadataJson: this.buildRetrievalFailureMetadata({
          strategy: input.retrievalStrategy,
          filters: input.retrievalFilters,
          rewrittenQuery: input.rewritten.rewrittenQuery,
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
}
