import { Injectable } from "@nestjs/common";
import { MessageRole, Prisma, TraceStatus } from "@prisma/client";
import { AnswerPolicy } from "../../infra/llm/llm.types";
import { LlmService } from "../../infra/llm/llm.service";
import { AnsweringService } from "../answering/answering.service";
import { ConversationsService } from "../conversations/conversations.service";
import { MessagesService } from "../messages/messages.service";
import { RetrievalService } from "../retrieval/retrieval.service";
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

  async askAssistant(input: { assistantId: string; question: string; conversationId?: string }) {
    const assistant = await this.assistantsService.getAssistant(input.assistantId);
    const retrievalProfile = assistant.retrievalProfile as typeof assistant.retrievalProfile & {
      strategyJson?: unknown;
    };

    const conversation =
      input.conversationId != null
        ? await this.conversationsService.getConversation(input.conversationId)
        : await this.conversationsService.createConversation({
            tenantId: assistant.tenantId,
            userId: "default-user",
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
    const retrievalResult = await this.retrievalService.retrieve({
      kbId: assistant.kbId,
      query: retrievalQuery,
      topK: retrievalProfile.topK,
      scoreThreshold: retrievalProfile.scoreThreshold,
      chunkWindow: retrievalProfile.chunkWindow,
      enableHybrid: retrievalProfile.enableHybrid,
      enableRerank: retrievalProfile.enableRerank,
      filters: retrievalFilters,
      strategy: retrievalStrategy
    });
    const retrievedChunks = retrievalResult.retrievedChunks;
    const contextGroups = retrievalResult.contextGroups;
    const retrievalScoresJson = this.buildRetrievalScoresJson(retrievedChunks);
    const retrievalMetadata = this.buildRetrievalMetadata({
      strategy: retrievalStrategy,
      filters: retrievalFilters,
      rewrittenQuery: rewritten.rewrittenQuery,
      rewritePromptId: retrievalStrategy.queryRewrite.enabled ? rewritten.promptId : null,
      rewriteUsedFallback: retrievalStrategy.queryRewrite.enabled ? rewritten.usedFallback : null,
      originalQuestion: input.question,
      topK: retrievalProfile.topK,
      scoreThreshold: retrievalProfile.scoreThreshold,
      chunkWindow: retrievalProfile.chunkWindow,
      retrievedChunks,
      contextGroups,
      execution: retrievalResult.execution
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
      await this.conversationsService.touchConversation(conversation.id);
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

      return {
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        traceId: trace.id,
        answer: resolvedAnswerResult.answer,
        citations: resolvedAnswerResult.citations,
        retrievedChunks: resolvedAnswerResult.retrievedChunks,
        contextGroups: resolvedAnswerResult.contextGroups,
        retrievalMetadata,
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
        retrievalMetadataJson: retrievalMetadata,
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
    onEvent: (
      event:
        | { type: "status"; phase: "started" | "retrieving" | "generating" }
        | { type: "answer_delta"; delta: string }
        | { type: "final"; data: Record<string, unknown> }
    ) => void | Promise<void>;
  }) {
    await input.onEvent({
      type: "status",
      phase: "started"
    });

    const assistant = await this.assistantsService.getAssistant(input.assistantId);
    const retrievalProfile = assistant.retrievalProfile as typeof assistant.retrievalProfile & {
      strategyJson?: unknown;
    };

    const conversation =
      input.conversationId != null
        ? await this.conversationsService.getConversation(input.conversationId)
        : await this.conversationsService.createConversation({
            tenantId: assistant.tenantId,
            userId: "default-user",
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

    await input.onEvent({
      type: "status",
      phase: "retrieving"
    });

    const retrievalResult = await this.retrievalService.retrieve({
      kbId: assistant.kbId,
      query: retrievalQuery,
      topK: retrievalProfile.topK,
      scoreThreshold: retrievalProfile.scoreThreshold,
      chunkWindow: retrievalProfile.chunkWindow,
      enableHybrid: retrievalProfile.enableHybrid,
      enableRerank: retrievalProfile.enableRerank,
      filters: retrievalFilters,
      strategy: retrievalStrategy
    });
    const retrievedChunks = retrievalResult.retrievedChunks;
    const contextGroups = retrievalResult.contextGroups;
    const retrievalScoresJson = this.buildRetrievalScoresJson(retrievedChunks);
    const retrievalMetadata = this.buildRetrievalMetadata({
      strategy: retrievalStrategy,
      filters: retrievalFilters,
      rewrittenQuery: rewritten.rewrittenQuery,
      rewritePromptId: retrievalStrategy.queryRewrite.enabled ? rewritten.promptId : null,
      rewriteUsedFallback: retrievalStrategy.queryRewrite.enabled ? rewritten.usedFallback : null,
      originalQuestion: input.question,
      topK: retrievalProfile.topK,
      scoreThreshold: retrievalProfile.scoreThreshold,
      chunkWindow: retrievalProfile.chunkWindow,
      retrievedChunks,
      contextGroups,
      execution: retrievalResult.execution
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
                usedFallback: streamResult.usedFallback
              });
            })();

      const assistantMessage = await this.messagesService.createMessage({
        conversationId: conversation.id,
        role: MessageRole.assistant,
        content: resolvedAnswerResult.answer,
        traceId: trace.id
      });

      await this.messagesService.attachTrace(userMessage.id, trace.id);
      await this.conversationsService.touchConversation(conversation.id);
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

      const finalResult = {
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        traceId: trace.id,
        answer: resolvedAnswerResult.answer,
        citations: resolvedAnswerResult.citations,
        retrievedChunks: resolvedAnswerResult.retrievedChunks,
        contextGroups: resolvedAnswerResult.contextGroups,
        retrievalMetadata,
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
        retrievalMetadataJson: retrievalMetadata,
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
    rewritePromptId: string | null;
    rewriteUsedFallback: boolean | null;
    originalQuestion: string;
    topK: number;
    scoreThreshold: number;
    chunkWindow: number;
    retrievedChunks: AskResultChunk[];
    contextGroups: Array<{ primaryChunkIds: string[] }>;
    execution: {
      actualMode: "vector" | "hybrid" | "lexical";
      usedFallback: boolean;
      candidateLimit: number;
      vectorCandidateCount: number;
      lexicalCandidateCount: number;
      mergedCandidateCount: number;
      rankedCandidateCount: number;
    };
  }): Prisma.InputJsonValue {
    return {
      strategy: input.strategy,
      filters: input.filters ?? null,
      queryRewrite: {
        enabled: input.strategy.queryRewrite.enabled,
        applied: Boolean(input.rewrittenQuery && input.rewrittenQuery !== input.originalQuestion),
        usedFallback: input.strategy.queryRewrite.enabled ? input.rewriteUsedFallback : null,
        promptId: input.strategy.queryRewrite.enabled ? input.rewritePromptId : null
      },
      execution: {
        retrievalQuery: input.rewrittenQuery || input.originalQuestion,
        topK: input.topK,
        scoreThreshold: input.scoreThreshold,
        chunkWindow: input.chunkWindow,
        actualMode: input.execution.actualMode,
        usedFallback: input.execution.usedFallback,
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
}
