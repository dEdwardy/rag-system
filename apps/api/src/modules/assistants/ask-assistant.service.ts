import { Injectable, Logger } from '@nestjs/common';
import { MessageRole, Prisma, TraceStatus } from '@prisma/client';
import { AnswerPolicy } from '../../infra/llm/llm.types';
import { LlmService } from '../../infra/llm/llm.service';
import { PromptManagerService } from '../../infra/llm/prompt-manager.service';
import { FeedSourceService } from '../../infra/feed-source/feed-source.service';
import { SitemapSourceService } from '../../infra/sitemap-source/sitemap-source.service';
import { WebPageService } from '../../infra/web-page/web-page.service';
import {
  ConcurrencyLimiter,
  ResultCache
} from '../../common/concurrency-utils';
import {
  VectorStoreCompatibilityError,
  VectorStoreEmbeddingDiagnostics
} from '../../infra/vector-store/vector-store.types';
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
  resolveRequestAuthContext,
  type AuthIdentity,
  type RequestAuthContext
} from '../auth/auth-identity.contract';
import { AnsweringService } from '../answering/answering.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import {
  RetrievalService,
  type RetrievalResult
} from '../retrieval/retrieval.service';
import {
  buildRewriteReadabilityLabel,
  buildRetrievalModeProvenanceSentence,
  buildStrategyReadabilityLabel
} from '../retrieval/strategy-readability';
import {
  buildTraceExecutionPlan,
  buildTraceMetadataCanonicalSurface
} from '@rag-system/shared';
import {
  RetrievalProfileFilters,
  RetrievalStrategy,
  resolveRetrievalStrategy,
  retrievalProfileFiltersSchema
} from '../retrieval-profiles/retrieval-profile.schemas';
import { TracesService } from '../traces/traces.service';
import { answerPolicySchema } from './assistant.schemas';
import { AssistantsService } from './assistants.service';
import { AskAssistantError } from './ask-assistant.error';
import {
  isPolicyQuestion,
  resolveAskRouteDecision,
  resolveExplicitExternalSourceRoute,
  resolveExplicitExternalSourceRoutes,
  type AskRouteDecision,
  type ResolvedExternalSourceCandidate,
  type ResolvedExternalSourceRoute
} from './ask-route-decision';
import type {
  TraceAnswerAttributionSummary,
  RetrievalStrategySummary,
  TraceCitationAttribution,
  TraceCitationSelectionSource,
  TraceKnowledgeBaseMultiStepSummary,
  TraceSummary
} from '@rag-system/shared';

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

type AskExternalSourceMetadataView = {
  url: string;
  kind: ResolvedExternalSourceRoute['sourceKind'];
  kindLabel: string;
  title: string | null;
  diagnostics: unknown;
};

type AskRouteToolAdapter = () => Promise<unknown>;

type AskRouteToolAdapters = Partial<
  Record<AskRouteDecision['routeType'], AskRouteToolAdapter>
>;

type AskKnowledgeBaseRouteAdapter = () => Promise<unknown>;

type AskExternalSourceFetchAdapterInput = {
  resolvedSource: ResolvedExternalSourceCandidate;
  routeDecision: AskRouteDecision;
};

type AskExternalSourceFetchAdapter = (
  input: AskExternalSourceFetchAdapterInput
) => Promise<AskFetchedExternalSource>;

type AskExternalSourceResult = {
  routeDecision: AskRouteDecision;
  sourceUrl: string;
  sourceKind: ResolvedExternalSourceRoute['sourceKind'];
};

type AskExternalSourceChunkSource = {
  url: string;
  sourceKind: ResolvedExternalSourceRoute['sourceKind'];
  title: string | null;
  content: string;
};

type AskExternalSourcePayload = {
  title: string | null;
  content: string;
  diagnostics: unknown;
};

type AskResolvedExternalSourcePayload = ResolvedExternalSourceCandidate &
  AskExternalSourcePayload;

type AskFetchedExternalSource = {
  routeDecision: AskRouteDecision;
  sourceUrl: string;
  sourceKind: ResolvedExternalSourceRoute['sourceKind'];
  label: string | null;
  title: string | null;
  content: string;
  diagnostics: unknown;
};

type AskRewriteDecision = {
  shouldRewrite: boolean;
  skippedReason:
    | 'disabled_by_default'
    | 'query_too_short'
    | 'not_summary_or_complex_question'
    | 'latency_budget_exceeded'
    | null;
};

type AskRewriteResult = {
  rewrittenQuery: string | null;
  modelName: string | null;
  usedFallback: boolean | null;
  promptId: string | null;
  skippedReason: RetrievalStrategySummary['rewriteSkippedReason'];
};

type AskConversationRef = {
  id: string;
};

type AssistantRecord = Awaited<ReturnType<AssistantsService['getAssistant']>>;

type AskPersistedMessage = {
  id: string;
};

type AskReusableConversationMessage = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  traceId: string | null;
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

const MIN_ANSWERABLE_PRIMARY_SCORE = 0.2;
const FABRICATION_REQUEST_PATTERNS = [
  /if\s+(the\s+)?(knowledge\s*base|sources?)\s+(does\s+not|don't|do not)\s+(have|contain|include)/i,
  /不要说不知(道|晓)/,
  /尽量给我一个完整答案/,
  /没有相关内容.*完整答案/,
  /even if (the )?(knowledge\s*base|sources?) (do not|don't|does not) (have|contain|include)/i,
  /make up a complete answer/i
] as const;
const POLICY_LIKE_TEXT_PATTERNS = [
  /\b(citation|citations|insufficient[_\s-]?context|missing information|supporting sources|retrieved sources)\b/i,
  /\b(system|assistant)\s+(policy|behavior|boundary|boundaries|capability|capabilities)\b/i,
  /\b(refusal|abstain|hallucinat|prompt injection)\b/i,
  /引用策略/,
  /拒答/,
  /能力边界/,
  /系统策略/,
  /不要伪造答案/,
  /没有依据/
] as const;
@Injectable()
export class AskAssistantService {
  private readonly logger = new Logger(AskAssistantService.name);
  private readonly retrievalLimiter = new ConcurrencyLimiter(5);
  private readonly llmLimiter = new ConcurrencyLimiter(3);
  private readonly assistantCache = new ResultCache<string, AssistantRecord>(
    100,
    60000
  );

  constructor(
    private readonly assistantsService: AssistantsService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly retrievalService: RetrievalService,
    private readonly answeringService: AnsweringService,
    private readonly tracesService: TracesService,
    private readonly llmService: LlmService,
    private readonly promptManager: PromptManagerService,
    private readonly webPageService: WebPageService,
    private readonly feedSourceService: FeedSourceService,
    private readonly sitemapSourceService: SitemapSourceService
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

    const assistant = await this.assistantCache.getOrSet(
      input.assistantId,
      () =>
        this.assistantsService.getAssistant(
          input.assistantId,
          authContext.identity
        )
    );

    const retrievalProfile =
      assistant.retrievalProfile as typeof assistant.retrievalProfile & {
        strategyJson?: unknown;
      };

    const conversation =
      input.conversationId != null
        ? await this.conversationsService.getConversation(
            input.conversationId,
            authContext.identity
          )
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

    const startedAt = Date.now();
    const retrievalStrategy = resolveRetrievalStrategy({
      topK: retrievalProfile.topK,
      enableHybrid: retrievalProfile.enableHybrid,
      enableRerank: retrievalProfile.enableRerank,
      strategyJson: retrievalProfile.strategyJson as
        | RetrievalStrategy
        | undefined
    });

    const rewriteDecision = this.resolveRewriteDecision(
      input.question,
      retrievalStrategy
    );
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
          skippedReason: 'latency_budget_exceeded'
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
    const retrievalFilters = retrievalProfileFiltersSchema
      .optional()
      .parse(assistant.retrievalProfile.filtersJson ?? undefined);
    const answerPolicy =
      answerPolicySchema
        .nullable()
        .optional()
        .parse(assistant.answerPolicyJson ?? undefined) ?? undefined;
    const normalizedAnswerPolicy = this.normalizeAnswerPolicy(answerPolicy);
    const routeDecision = this.resolveRouteDecision(input.question);
    const reusableConversationAnswer =
      input.conversationId != null &&
      routeDecision.routeType === 'knowledge_base'
        ? await this.findReusableConversationAnswer({
            conversationId: conversation.id,
            assistantId: assistant.id,
            question: input.question,
            authContext: authContext.identity
          })
        : null;

    if (reusableConversationAnswer != null) {
      return reusableConversationAnswer;
    }

    const userMessagePromise: Promise<TimedResult<AskPersistedMessage>> =
      this.messagesService
        .createMessage({
          conversationId: conversation.id,
          role: MessageRole.user,
          content: input.question
        })
        .then((message) => ({
          value: message,
          durationMs: 0
        }));

    return this.dispatchRouteAsk({
      routeDecision,
      executors: this.buildAskRouteToolAdapters({
        assistant,
        authContext,
        conversation,
        userMessagePromise,
        startedAt,
        question: input.question,
        normalizedAnswerPolicy,
        routeDecision
      }),
      knowledgeBaseAsk: () =>
        this.handleKnowledgeBaseRouteAsk({
          assistant,
          authContext,
          conversation,
          userMessagePromise,
          startedAt,
          question: input.question,
          retrievalQuery,
          retrievalProfile,
          retrievalStrategy,
          retrievalFilters,
          rewritten,
          normalizedAnswerPolicy,
          routeDecision,
          documentVersions: input.documentVersions
        })
    });
  }

  async searchAssistant(input: {
    assistantId: string;
    question: string;
    authContext?: RequestAuthContext | null;
  }) {
    const authContext = resolveRequestAuthContext({
      authContext: input.authContext
    });

    const assistant = await this.assistantCache.getOrSet(
      input.assistantId,
      () =>
        this.assistantsService.getAssistant(
          input.assistantId,
          authContext.identity
        )
    );

    const retrievalProfile =
      assistant.retrievalProfile as typeof assistant.retrievalProfile & {
        strategyJson?: unknown;
      };
    const retrievalStrategy = resolveRetrievalStrategy({
      topK: retrievalProfile.topK,
      enableHybrid: retrievalProfile.enableHybrid,
      enableRerank: retrievalProfile.enableRerank,
      strategyJson: retrievalProfile.strategyJson as
        | RetrievalStrategy
        | undefined
    });
    const rewriteDecision = this.resolveRewriteDecision(
      input.question,
      retrievalStrategy
    );
    const rewritten: AskRewriteResult = rewriteDecision.shouldRewrite
      ? await this.resolveSearchRewrite(input.question)
      : {
          rewrittenQuery: null,
          modelName: null,
          usedFallback: null,
          promptId: null,
          skippedReason: rewriteDecision.skippedReason
        };
    const retrievalQuery = rewritten.rewrittenQuery || input.question;
    const retrievalFilters = retrievalProfileFiltersSchema
      .optional()
      .parse(assistant.retrievalProfile.filtersJson ?? undefined);
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
    if (!retrievalResult) {
      throw new Error('Retrieval returned no result.');
    }
    const rewriteApplied = Boolean(
      rewritten.rewrittenQuery && rewritten.rewrittenQuery !== input.question
    );
    const retrievalQuerySource = !retrievalStrategy.queryRewrite.enabled
      ? 'original_disabled'
      : rewriteApplied
        ? 'rewritten'
        : 'original_unchanged';

    return {
      query: {
        original: input.question,
        retrieval: retrievalQuery,
        rewritten: rewritten.rewrittenQuery,
        rewrite: {
          modelName: rewritten.modelName,
          usedFallback: rewritten.usedFallback,
          promptId: rewritten.promptId,
          skippedReason: rewritten.skippedReason
        }
      },
      chunks: retrievalResult.retrievedChunks,
      contextGroups: retrievalResult.contextGroups,
      diagnostics: {
        profile: {
          topK: retrievalProfile.topK,
          scoreThreshold: retrievalProfile.scoreThreshold,
          chunkWindow: retrievalProfile.chunkWindow,
          enableHybrid: retrievalProfile.enableHybrid,
          enableRerank: retrievalProfile.enableRerank
        },
        execution: retrievalResult.execution,
        embedding: retrievalResult.embedding,
        filters: retrievalFilters ?? null,
        strategySummary: {
          retrievalMode: retrievalResult.execution.actualMode,
          strategyMode: retrievalStrategy.candidateSelection.mode,
          retrievalQuerySource,
          rewriteEnabled: retrievalStrategy.queryRewrite.enabled,
          rewriteApplied,
          rewriteSkippedReason: rewritten.skippedReason,
          rewriteUsedFallback: retrievalStrategy.queryRewrite.enabled
            ? rewritten.usedFallback
            : null,
          rewritePromptId: retrievalStrategy.queryRewrite.enabled
            ? rewritten.promptId
            : null,
          rewriteModelName: retrievalStrategy.queryRewrite.enabled
            ? rewritten.modelName
            : null,
          fallbackReason: retrievalResult.execution.fallbackReason,
          usedFallback: retrievalResult.execution.usedFallback
        }
      }
    };
  }

  async askAssistantStream(input: {
    assistantId: string;
    question: string;
    conversationId?: string;
    authContext?: RequestAuthContext | null;
    signal?: AbortSignal;
    onEvent: (
      event:
        | { type: 'status'; phase: 'started' | 'retrieving' | 'generating' }
        | { type: 'answer_delta'; delta: string }
        | { type: 'final'; data: Record<string, unknown> }
    ) => void | Promise<void>;
  }) {
    const authContext = resolveRequestAuthContext({
      authContext: input.authContext
    });

    const assistant = await this.assistantCache.getOrSet(
      input.assistantId,
      () =>
        this.assistantsService.getAssistant(
          input.assistantId,
          authContext.identity
        )
    );

    const retrievalProfile =
      assistant.retrievalProfile as typeof assistant.retrievalProfile & {
        strategyJson?: unknown;
      };

    const conversationStartedAt = Date.now();
    const conversationPromise: Promise<TimedResult<AskConversationRef>> = (
      input.conversationId != null
        ? this.conversationsService.getConversation(
            input.conversationId,
            authContext.identity
          )
        : this.conversationsService.createConversation({
            tenantId: authContext.identity.tenantId,
            userId: authContext.identity.userId,
            assistantId: assistant.id,
            title: input.question.slice(0, 80)
          })
    ).then((conversation) => ({
      value: conversation,
      durationMs: Date.now() - conversationStartedAt
    }));

    const startedAt = Date.now();
    const retrievalStrategy = resolveRetrievalStrategy({
      topK: retrievalProfile.topK,
      enableHybrid: retrievalProfile.enableHybrid,
      enableRerank: retrievalProfile.enableRerank,
      strategyJson: retrievalProfile.strategyJson as
        | RetrievalStrategy
        | undefined
    });

    const rewriteDecision = this.resolveRewriteDecision(
      input.question,
      retrievalStrategy
    );
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
          skippedReason: 'latency_budget_exceeded'
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
    const retrievalFilters = retrievalProfileFiltersSchema
      .optional()
      .parse(assistant.retrievalProfile.filtersJson ?? undefined);
    const answerPolicy =
      answerPolicySchema
        .nullable()
        .optional()
        .parse(assistant.answerPolicyJson ?? undefined) ?? undefined;
    const normalizedAnswerPolicy = this.normalizeAnswerPolicy(answerPolicy);
    const routeDecision = this.resolveRouteDecision(input.question);
    const reusableConversationAnswer =
      input.conversationId != null &&
      routeDecision.routeType === 'knowledge_base'
        ? await this.findReusableConversationAnswer({
            conversationId: (await conversationPromise).value.id,
            assistantId: assistant.id,
            question: input.question,
            authContext: authContext.identity
          })
        : null;

    if (reusableConversationAnswer != null) {
      await input.onEvent({
        type: 'final',
        data: reusableConversationAnswer
      });
      return reusableConversationAnswer;
    }

    const startedStatusEventPromise = Promise.resolve(
      input.onEvent({
        type: 'status',
        phase: 'started'
      })
    );
    const retrievingStatusEventOutcomePromise = startedStatusEventPromise
      .then(() =>
        input.onEvent({
          type: 'status',
          phase: 'retrieving'
        })
      )
      .then(() => ({ error: null as unknown }))
      .catch((error) => ({ error }));

    let userMessagePromise: Promise<TimedResult<AskPersistedMessage>> | null =
      null;
    const getUserMessagePromise = () => {
      if (userMessagePromise == null) {
        const userMessagePersistStartedAt = Date.now();
        userMessagePromise = conversationPromise
          .then(({ value: conversation }) =>
            this.messagesService.createMessage({
              conversationId: conversation.id,
              role: MessageRole.user,
              content: input.question
            })
          )
          .then((message) => ({
            value: message,
            durationMs: Date.now() - userMessagePersistStartedAt
          }));
      }

      return userMessagePromise;
    };
    const eagerUserMessagePromise = getUserMessagePromise();

    return this.dispatchRouteAsk({
      routeDecision,
      executors: this.buildAskStreamRouteToolAdapters({
        assistant,
        authContext,
        conversationPromise,
        eagerUserMessagePromise,
        startedAt,
        question: input.question,
        normalizedAnswerPolicy,
        routeDecision,
        onEvent: input.onEvent
      }),
      knowledgeBaseAsk: () =>
        this.handleKnowledgeBaseRouteAskStream({
          assistant,
          authContext,
          conversationPromise,
          retrievingStatusEventOutcomePromise,
          getUserMessagePromise,
          eagerUserMessagePromise,
          startedAt,
          question: input.question,
          retrievalQuery,
          retrievalProfile,
          retrievalStrategy,
          retrievalFilters,
          rewritten,
          rewriteMs,
          llmQueueWaitMs,
          normalizedAnswerPolicy,
          routeDecision,
          onEvent: input.onEvent,
          signal: input.signal
        })
    });
  }

  private async resolveSearchRewrite(
    question: string
  ): Promise<AskRewriteResult> {
    try {
      const rewriteResult = await this.llmLimiter.execute(() =>
        this.llmService.rewriteQuery({
          question
        })
      );
      return {
        ...rewriteResult,
        skippedReason: null
      };
    } catch {
      return {
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null,
        skippedReason: 'latency_budget_exceeded'
      };
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
    const promptContextApproxTokens =
      this.approximateTokenCount(promptSnapshot.systemPrompt) +
      this.approximateTokenCount(promptSnapshot.userPrompt);

    return {
      ...(retrievalMetadata as Record<string, unknown>),
      promptContextChars,
      promptContextApproxTokens
    } as AskRetrievalMetadataJson;
  }

  private buildTimingReadabilitySentence(timing: AskTimingSummary) {
    const render = (label: string, value: number | null) =>
      `${label} ${value == null ? 'n/a' : `${value}ms`}`;
    return (
      [
        render('total', timing.totalMs),
        render('first token', timing.firstTokenMs),
        render('pre-generation', timing.preGenerationMs),
        render('llm first token', timing.llmFirstTokenMs),
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

  private shouldDeterministicallyAbstain(input: {
    question: string;
    retrievedChunks: AskResultChunk[];
    scoreThreshold: number;
  }) {
    if (input.retrievedChunks.length === 0) {
      return true;
    }

    const primaryChunks = input.retrievedChunks.filter(
      (chunk) => chunk.isPrimary ?? true
    );
    const candidateChunks =
      primaryChunks.length > 0 ? primaryChunks : input.retrievedChunks;
    const minAnswerableScore = Math.max(
      input.scoreThreshold,
      MIN_ANSWERABLE_PRIMARY_SCORE
    );

    if (this.isExplicitFabricationRequest(input.question)) {
      return true;
    }

    if (
      this.isPolicyLikeOnlyEvidence(candidateChunks) &&
      !this.isPolicyQuestion(input.question)
    ) {
      return true;
    }

    return !candidateChunks.some((chunk) => chunk.score >= minAnswerableScore);
  }

  private resolveKnowledgeBaseDeterministicBypass(input: {
    question: string;
    retrievedChunks: AskResultChunk[];
    scoreThreshold: number;
    noAnswerBehavior: AnswerPolicy['noAnswerBehavior'];
  }) {
    if (input.noAnswerBehavior !== 'say_insufficient_context') {
      return {
        shouldBypass: false,
        insufficientContextReason: null
      } as const;
    }

    const shouldBypass = this.shouldDeterministicallyAbstain({
      question: input.question,
      retrievedChunks: input.retrievedChunks,
      scoreThreshold: input.scoreThreshold
    });

    return {
      shouldBypass,
      insufficientContextReason: shouldBypass
        ? input.retrievedChunks.length > 0
          ? 'retrieved_context_insufficient'
          : 'no_retrieval_hits'
        : null
    } as const;
  }

  private isExplicitFabricationRequest(question: string) {
    return FABRICATION_REQUEST_PATTERNS.some((pattern) =>
      pattern.test(question)
    );
  }

  private isPolicyQuestion(question: string) {
    return isPolicyQuestion(question);
  }

  private isPolicyLikeOnlyEvidence(chunks: AskResultChunk[]) {
    return (
      chunks.length > 0 &&
      chunks.every((chunk) => this.isPolicyLikeChunk(chunk))
    );
  }

  private isPolicyLikeChunk(chunk: AskResultChunk) {
    const searchableText = [
      chunk.documentTitle,
      chunk.sectionTitle ?? '',
      chunk.content
    ]
      .join('\n')
      .trim();

    return POLICY_LIKE_TEXT_PATTERNS.some((pattern) =>
      pattern.test(searchableText)
    );
  }

  private logAskTiming(input: {
    route: 'ask' | 'ask_stream';
    status: 'success' | 'failed' | 'aborted';
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
      event: 'ask_timing',
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

    if (input.status === 'success') {
      this.logger.log(JSON.stringify(payload));
      return;
    }

    this.logger.warn(JSON.stringify(payload));
  }

  private buildRetrievalLogDiagnostics(retrievalMetadata: unknown) {
    if (
      typeof retrievalMetadata !== 'object' ||
      retrievalMetadata == null ||
      Array.isArray(retrievalMetadata)
    ) {
      return null;
    }

    const metadata = retrievalMetadata as Record<string, unknown>;
    const execution =
      typeof metadata.execution === 'object' &&
      metadata.execution !== null &&
      !Array.isArray(metadata.execution)
        ? (metadata.execution as Record<string, unknown>)
        : null;
    const timing =
      execution != null &&
      typeof execution.timing === 'object' &&
      execution.timing !== null &&
      !Array.isArray(execution.timing)
        ? (execution.timing as Record<string, unknown>)
        : null;
    const embedding =
      typeof metadata.embedding === 'object' &&
      metadata.embedding !== null &&
      !Array.isArray(metadata.embedding)
        ? (metadata.embedding as Record<string, unknown>)
        : null;
    const activeEmbedding =
      embedding != null &&
      typeof embedding.active === 'object' &&
      embedding.active !== null &&
      !Array.isArray(embedding.active)
        ? (embedding.active as Record<string, unknown>)
        : null;
    const indexedEmbedding =
      embedding != null &&
      typeof embedding.indexed === 'object' &&
      embedding.indexed !== null &&
      !Array.isArray(embedding.indexed)
        ? (embedding.indexed as Record<string, unknown>)
        : null;

    const retrievalQuery =
      typeof execution?.retrievalQuery === 'string'
        ? execution.retrievalQuery
        : '';
    const vectorCandidateCount = this.readNumber(
      execution?.vectorCandidateCount
    );
    const retrievedChunkCount = this.readNumber(execution?.retrievedChunkCount);
    const contextGroupCount = this.readNumber(execution?.contextGroupCount);
    const lexicalCandidateCount = this.readNumber(
      execution?.lexicalCandidateCount
    );
    const candidateLimit = this.readNumber(execution?.candidateLimit);
    const vectorSearchMs = this.readNumber(timing?.vectorSearchMs);
    const vectorCandidateFetchMs = this.readNumber(
      timing?.vectorCandidateFetchMs
    );
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
        vectorSearchMs != null &&
        vectorCandidateCount != null &&
        vectorCandidateCount > 0
          ? Number((vectorSearchMs / vectorCandidateCount).toFixed(2))
          : null,
      vectorFetchMsPerVectorCandidate:
        vectorCandidateFetchMs != null &&
        vectorCandidateCount != null &&
        vectorCandidateCount > 0
          ? Number((vectorCandidateFetchMs / vectorCandidateCount).toFixed(2))
          : null,
      chunkWindowMsPerRetrievedChunk:
        chunkWindowMs != null &&
        retrievedChunkCount != null &&
        retrievedChunkCount > 0
          ? Number((chunkWindowMs / retrievedChunkCount).toFixed(2))
          : null,
      lexicalCandidatesPerBudget:
        lexicalCandidateCount != null &&
        candidateLimit != null &&
        candidateLimit > 0
          ? Number((lexicalCandidateCount / candidateLimit).toFixed(3))
          : null,
      lexicalSearchMs,
      vectorSearchMs,
      vectorCandidateFetchMs,
      chunkWindowMs
    };
  }

  private resolveRouteDecision(question: string): AskRouteDecision {
    return resolveAskRouteDecision(question);
  }

  private resolveExplicitExternalSourceRoute(
    question: string
  ): ResolvedExternalSourceRoute | null {
    return resolveExplicitExternalSourceRoute(question);
  }

  private resolveExplicitExternalSourceRoutes(
    question: string
  ): ResolvedExternalSourceCandidate[] {
    return resolveExplicitExternalSourceRoutes(question);
  }

  private buildPolicyRouteMetadata(input: {
    question: string;
    routeDecision: AskRouteDecision;
  }): AskRetrievalMetadataJson {
    const executionPlan = buildTraceExecutionPlan({
      routeType: input.routeDecision.routeType,
      routeReason: input.routeDecision.routeReason
    });

    return {
      ...buildTraceMetadataCanonicalSurface({
        routeDecision: input.routeDecision,
        executionPlan
      }),
      ...this.buildRouteMetadataBase({
        question: input.question,
        retrievedChunkCount: 0,
        primaryChunkCount: 0,
        strategyMode: null,
        retrievalMode: null
      })
    } as AskRetrievalMetadataJson;
  }

  private buildExternalSourceRouteMetadata(input: {
    question: string;
    sourceUrl: string;
    sourceKind: ResolvedExternalSourceRoute['sourceKind'];
    sourceTitle: string | null;
    diagnostics: unknown;
    routeDecision: AskRouteDecision;
    externalSources?: AskExternalSourceMetadataView[];
  }): AskRetrievalMetadataJson {
    const executionPlan = buildTraceExecutionPlan({
      routeType: input.routeDecision.routeType,
      routeReason: input.routeDecision.routeReason,
      sourceCount:
        input.externalSources != null && input.externalSources.length > 0
          ? input.externalSources.length
          : 1
    });

    return {
      ...buildTraceMetadataCanonicalSurface({
        routeDecision: input.routeDecision,
        executionPlan
      }),
      externalSource: {
        url: input.sourceUrl,
        kind: input.sourceKind,
        kindLabel: this.buildExternalSourceKindLabel(input.sourceKind),
        title: input.sourceTitle,
        diagnostics: input.diagnostics ?? null
      },
      ...(input.externalSources != null
        ? {
            externalSources: input.externalSources
          }
        : {}),
      ...this.buildRouteMetadataBase({
        question: input.question,
        retrievedChunkCount:
          input.externalSources != null && input.externalSources.length > 0
            ? input.externalSources.length
            : 1,
        primaryChunkCount: 1,
        strategyMode: null,
        retrievalMode: null
      })
    } as AskRetrievalMetadataJson;
  }

  private buildRouteMetadataBase(input: {
    question: string;
    retrievedChunkCount: number;
    primaryChunkCount: number;
    strategyMode: RetrievalStrategySummary['strategyMode'];
    retrievalMode: RetrievalStrategySummary['retrievalMode'] | null;
  }): Pick<
    AskRetrievalMetadataJson,
    'queryRewrite' | 'strategySummary' | 'execution'
  > {
    return {
      queryRewrite: {
        enabled: false,
        applied: false,
        finalQuerySource: 'original_disabled',
        skippedReason: 'disabled_by_default',
        usedFallback: null,
        modelName: null,
        promptId: null
      },
      strategySummary: {
        retrievalMode: input.retrievalMode,
        strategyMode: input.strategyMode,
        retrievalQuerySource: 'original_disabled',
        rewriteEnabled: false,
        rewriteApplied: false,
        rewriteSkippedReason: 'disabled_by_default',
        rewriteUsedFallback: null,
        rewritePromptId: null,
        rewriteModelName: null,
        fallbackReason: null,
        usedFallback: null
      },
      execution: {
        retrievalQuery: input.question,
        topK: 1,
        scoreThreshold: 0,
        chunkWindow: 0,
        retrievedChunkCount: input.retrievedChunkCount,
        contextGroupCount: 0,
        primaryChunkCount: input.primaryChunkCount,
        neighborChunkCount: 0
      }
    };
  }

  private buildExternalSourceChunk(input: {
    sourceUrl: string;
    sourceKind: ResolvedExternalSourceRoute['sourceKind'];
    sourceTitle: string | null;
    content: string;
  }): AskResultChunk {
    const sourceLabel =
      input.sourceTitle ?? this.buildExternalSourceKindLabel(input.sourceKind);

    return {
      chunkId: `external:${input.sourceKind}:${input.sourceUrl}`,
      documentId: `external:${input.sourceKind}:${input.sourceUrl}`,
      documentTitle: sourceLabel,
      chunkIndex: 0,
      content: input.content,
      score: 1,
      isPrimary: true,
      pageNo: null,
      sectionTitle: this.buildExternalSourceSectionTitle(input.sourceKind)
    };
  }

  private buildReadableExternalSourceLabel(
    url: string,
    sourceKind: ResolvedExternalSourceRoute['sourceKind']
  ) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./i, '');
      const path = parsed.pathname.replace(/\/+$/, '');
      const tail = path.split('/').filter(Boolean).pop() ?? '';
      const readableTail = tail || (sourceKind === 'web' ? 'page' : sourceKind);
      return `${host}/${readableTail}`;
    } catch {
      return this.buildExternalSourceKindLabel(sourceKind, true);
    }
  }

  private buildExternalSourceKindLabel(
    sourceKind: ResolvedExternalSourceRoute['sourceKind'],
    lowercase = false
  ) {
    if (sourceKind === 'web') {
      return lowercase ? 'external web page' : 'External web page';
    }

    if (sourceKind === 'feed') {
      return lowercase ? 'external feed' : 'External feed';
    }

    return lowercase ? 'external sitemap' : 'External sitemap';
  }

  private buildExternalSourceSectionTitle(
    sourceKind: ResolvedExternalSourceRoute['sourceKind']
  ) {
    return sourceKind === 'web' ? 'Fetched content' : 'External source';
  }

  private buildExternalSourceTitle(input: {
    url: string;
    sourceKind: ResolvedExternalSourceRoute['sourceKind'];
    title: string | null;
    label: string | null;
  }) {
    return (
      input.title ??
      input.label ??
      this.buildReadableExternalSourceLabel(input.url, input.sourceKind)
    );
  }

  private buildResolvedExternalSourceView(
    sources: Array<AskResolvedExternalSourcePayload>,
    mode: 'chunks' | 'metadata'
  ): Array<{
    url: string;
    sourceKind: ResolvedExternalSourceRoute['sourceKind'];
    kindLabel: string;
    title: string | null;
    content?: string;
    diagnostics: unknown;
  }> {
    return sources.map((source, index) => ({
      url: source.url,
      sourceKind: source.sourceKind,
      kindLabel: this.buildExternalSourceKindLabel(source.sourceKind),
      title:
        index === 0
          ? source.title
          : this.buildExternalSourceStepTitle({
              sourceKind: source.sourceKind,
              title: source.title
            }),
      content: mode === 'chunks' ? source.content : undefined,
      diagnostics:
        mode === 'metadata' && index === 0 ? source.diagnostics : null
    }));
  }

  private buildResolvedExternalSourceSummary(
    sources: Array<AskFetchedExternalSource>
  ) {
    const resolvedSources = sources.map((source) => ({
      raw: source.sourceUrl,
      url: source.sourceUrl,
      sourceKind: source.sourceKind,
      label: source.label ?? null,
      title: this.buildExternalSourceTitle({
        url: source.sourceUrl,
        sourceKind: source.sourceKind,
        title: source.title,
        label: source.label ?? null
      }),
      content: source.content,
      diagnostics: source.diagnostics
    }));

    return {
      title:
        resolvedSources.length === 1
          ? resolvedSources[0].title
          : 'Multiple external sources',
      diagnostics:
        resolvedSources.length === 1
          ? resolvedSources[0].diagnostics
          : {
              sources: resolvedSources.map((source) => ({
                url: source.url,
                kind: source.sourceKind,
                kindLabel: this.buildExternalSourceKindLabel(source.sourceKind),
                title: source.title,
                diagnostics: source.diagnostics
              }))
            },
      sources: resolvedSources
    };
  }

  private buildExternalSourceChunks(
    sources: AskExternalSourceChunkSource[]
  ): AskResultChunk[] {
    return sources.map((source, index) =>
      this.buildExternalSourceChunk({
        sourceUrl: source.url,
        sourceKind: source.sourceKind,
        sourceTitle:
          source.title ??
          (index === 0 ? 'External source' : `External source ${index + 1}`),
        content: source.content
      })
    );
  }

  private buildExternalSourceFetchToolAdapters(): Record<
    ResolvedExternalSourceRoute['sourceKind'],
    AskExternalSourceFetchAdapter
  > {
    return {
      sitemap: async ({ resolvedSource, routeDecision }) => {
        const result = await this.sitemapSourceService.fetchSitemap({
          url: resolvedSource.url,
          maxPages: 3
        });
        return {
          routeDecision,
          sourceUrl: resolvedSource.url,
          sourceKind: resolvedSource.sourceKind,
          label: resolvedSource.label,
          title: null,
          content: result.content,
          diagnostics: result.diagnostics
        };
      },
      feed: async ({ resolvedSource, routeDecision }) => {
        const result = await this.feedSourceService.fetchFeed({
          url: resolvedSource.url,
          maxItems: 5
        });
        return {
          routeDecision,
          sourceUrl: resolvedSource.url,
          sourceKind: resolvedSource.sourceKind,
          label: resolvedSource.label,
          title: result.title,
          content: result.content,
          diagnostics: result.diagnostics
        };
      },
      web: async ({ resolvedSource, routeDecision }) => {
        const result = await this.webPageService.fetchWebPage(
          resolvedSource.url
        );
        return {
          routeDecision,
          sourceUrl: resolvedSource.url,
          sourceKind: resolvedSource.sourceKind,
          label: resolvedSource.label,
          title: result.title,
          content: result.content,
          diagnostics: result.diagnostics
        };
      }
    };
  }

  private async fetchResolvedExternalSource(
    resolvedSource: ResolvedExternalSourceCandidate,
    routeDecision: AskRouteDecision
  ) {
    const adapters = this.buildExternalSourceFetchToolAdapters();
    const adapter = adapters[resolvedSource.sourceKind];
    return adapter({
      resolvedSource,
      routeDecision
    });
  }

  private async fetchExternalSourcePayloadOrCreateFailedTrace(input: {
    assistantId: string;
    conversation: AskConversationRef;
    userMessagePromise: Promise<TimedResult<AskPersistedMessage>>;
    question: string;
    routeDecision: AskRouteDecision;
  }): Promise<
    (AskExternalSourceResult & AskExternalSourcePayload) & {
      sources: Array<AskResolvedExternalSourcePayload>;
    }
  > {
    const resolvedSources = this.resolveExplicitExternalSourceRoutes(
      input.question
    );
    if (resolvedSources.length === 0) {
      throw new Error(
        'External source route was selected without an explicit source URL.'
      );
    }

    try {
      const fetchedSources: AskFetchedExternalSource[] = await Promise.all(
        resolvedSources.map((resolvedSource) =>
          this.fetchResolvedExternalSource(resolvedSource, input.routeDecision)
        )
      );

      const combinedContent = fetchedSources
        .map(
          (source, index) =>
            `Source ${index + 1}: ${source.label ?? source.sourceUrl}\n` +
            `URL: ${source.sourceUrl}\n` +
            `Kind: ${source.sourceKind}\n` +
            `${source.content}`
        )
        .join('\n\n---\n\n');

      const summary = this.buildResolvedExternalSourceSummary(fetchedSources);

      return {
        routeDecision: input.routeDecision,
        sourceUrl: fetchedSources[0].sourceUrl,
        sourceKind: fetchedSources[0].sourceKind,
        title: summary.title,
        content: combinedContent,
        diagnostics: summary.diagnostics,
        sources: summary.sources
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown external source fetch error.';
      const { value: userMessage } = await input.userMessagePromise;
      const retrievalMetadata = this.withFailureMetadata(
        this.buildExternalSourceRouteMetadata({
          question: input.question,
          sourceUrl: resolvedSources[0].url,
          sourceKind: resolvedSources[0].sourceKind,
          sourceTitle: null,
          diagnostics: null,
          routeDecision: input.routeDecision
        }),
        {
          stage: 'answering',
          message
        }
      );
      const failedTrace = await this.tracesService.createTrace({
        conversationId: input.conversation.id,
        assistantId: input.assistantId,
        userMessageId: userMessage.id,
        userQuery: input.question,
        retrievedChunkIdsJson: [],
        retrievalScoresJson: [],
        retrievalMetadataJson: retrievalMetadata,
        status: TraceStatus.failed,
        errorMessage: message
      });
      throw new AskAssistantError({
        traceId: failedTrace.id,
        details: {
          stage: 'retrieval',
          cause: message
        }
      });
    }
  }

  private buildPolicyRouteResult(input: {
    question: string;
    answerPolicy: AnswerPolicy;
  }) {
    const resolvedLanguage = this.resolvePolicyLanguage(
      input.question,
      input.answerPolicy.language
    );

    return {
      answer:
        resolvedLanguage === 'zh'
          ? '这是系统策略类问题。我会优先基于当前知识库内容回答，并在证据不足时明确说明信息不足；不会把没有依据的内容伪造成已知事实。'
          : 'This is a system-policy question. I answer from the current knowledge base first, and when supporting evidence is insufficient I say so explicitly instead of presenting unsupported content as fact.',
      citations: [],
      retrievedChunks: [],
      contextGroups: [],
      answeringMetadata: {
        promptId: 'policy.route.v1',
        usedFallback: true,
        answerPolicy: input.answerPolicy,
        resolvedLanguage,
        generationMode: 'deterministic_bypass' as const,
        contextMode: 'chunks' as const,
        inputChunkCount: 0,
        promptContextCount: 0,
        contextGroupCount: 0,
        citationCountBeforeLimit: 0,
        citationCount: 0,
        citationLimitHit: false,
        citationAttribution: 'none' as const,
        citationSelectionSource: 'none' as const,
        missingInformationCount: 0,
        missingInformationSource: 'suppressed_by_policy' as const,
        answerTextSource: 'deterministic_policy' as const,
        insufficientContextReason: null,
        answerStatusSource: 'deterministic_policy' as const,
        answerStatus: 'grounded' as const
      },
      modelName: 'policy-route-local',
      answerStatus: 'grounded' as const,
      missingInformation: [],
      qualityEvaluation: {
        overall: 'strong' as const,
        grounding: 'grounded' as const,
        completeness: 'complete' as const,
        primaryIssue: 'none' as const,
        flags: [],
        summary:
          resolvedLanguage === 'zh'
            ? '回答使用确定性的系统策略回复，未发现已知缺口。'
            : 'Answer used a deterministic policy reply with no known gaps.'
      }
    };
  }

  private resolvePolicyLanguage(
    question: string,
    language: AnswerPolicy['language']
  ) {
    if (language === 'zh' || language === 'en') {
      return language;
    }

    return /[\u3400-\u9fff]/.test(question) ? 'zh' : 'en';
  }

  private buildStaticRouteReadabilityArtifacts() {
    return {
      strategyReadabilityLabel: buildStrategyReadabilityLabel({
        retrievalMode: null,
        retrievalQuerySource: 'original_disabled',
        fallbackReason: null,
        strategyUsedFallback: null
      }),
      retrievalModeProvenanceSentence: buildRetrievalModeProvenanceSentence({
        retrievalMode: null,
        strategyUsedFallback: null,
        fallbackReason: null
      }),
      rewriteReadabilityLabel: buildRewriteReadabilityLabel({
        rewriteEnabled: false,
        rewriteApplied: false,
        rewriteUsedFallback: null,
        rewritePromptId: null
      })
    };
  }

  private buildAnswerPresentationArtifacts(input: {
    answeringMetadata: unknown;
    missingInformation: unknown;
  }) {
    const answerAttributionSummary = this.resolveAnswerAttributionSummary(
      input.answeringMetadata
    );
    const answerAttributionSource = this.resolveAnswerAttributionSource(
      input.answeringMetadata
    );
    const answerEvidenceSourceReadabilityLabel =
      buildAnswerEvidenceSourceReadabilityLabel(answerAttributionSource);
    const answerEvidenceSourceReadabilitySentence =
      this.buildAnswerEvidenceSourceReadabilitySentence(
        answerEvidenceSourceReadabilityLabel
      );
    const answerTextSource = this.resolveAnswerTextSource(
      input.answeringMetadata
    );
    const rawAnswerTextSource = this.readString(
      typeof input.answeringMetadata === 'object' &&
        input.answeringMetadata !== null
        ? (input.answeringMetadata as Record<string, unknown>).answerTextSource
        : null
    );
    const answerStatusSource = this.resolveAnswerStatusSource(
      input.answeringMetadata
    );
    const rawAnswerStatusSource = this.readString(
      typeof input.answeringMetadata === 'object' &&
        input.answeringMetadata !== null
        ? (input.answeringMetadata as Record<string, unknown>)
            .answerStatusSource
        : null
    );
    const answerSourceReadability = buildAnswerSourceReadability({
      answerTextSource,
      rawAnswerTextSource,
      answerStatusSource,
      rawAnswerStatusSource
    });
    const answerAttributionReadabilitySentence =
      answerAttributionSummary.readabilitySentence ??
      'Answer attribution is unknown; source evidence is unknown.';
    const { answerProvenanceSentence, answerProvenanceReadabilitySentence } =
      buildAnswerProvenanceFields({
        answerTextSource,
        answerStatusSource,
        answerAttributionReadabilityResolvedLabel:
          answerAttributionSummary.readabilityResolvedLabel,
        answerTextSourceReadabilityLabel:
          answerSourceReadability.answerTextSourceReadabilityLabel,
        answerStatusSourceReadabilityLabel:
          answerSourceReadability.answerStatusSourceReadabilityLabel,
        answerAttributionReadabilitySentence
      });
    const missingInformationSource = this.resolveMissingInformationSource(
      input.answeringMetadata
    );
    const missingInformationProvenanceSentence =
      buildMissingInformationProvenanceSentence({
        missingInformationSource,
        insufficientContextReason: this.resolveInsufficientContextReason(
          input.answeringMetadata
        ),
        missingInformationCount: this.resolveMissingInformationCount({
          answeringMetadata: input.answeringMetadata,
          missingInformation: input.missingInformation
        })
      });

    return {
      answerAttributionSummary,
      answerAttributionReadabilitySentence,
      answerAttribution: this.resolveAnswerAttribution(input.answeringMetadata),
      answerAttributionSource,
      answerEvidenceSource: answerAttributionSource,
      answerEvidenceSourceReadabilityLabel,
      answerEvidenceSourceReadabilitySentence,
      answerTextSource,
      answerTextSourceReadabilityLabel:
        answerSourceReadability.answerTextSourceReadabilityLabel,
      answerTextSourceReadabilitySentence:
        answerSourceReadability.answerTextSourceReadabilitySentence,
      answerStatusSource,
      answerStatusSourceReadabilityLabel:
        answerSourceReadability.answerStatusSourceReadabilityLabel,
      answerStatusSourceReadabilitySentence:
        answerSourceReadability.answerStatusSourceReadabilitySentence,
      answerProvenanceSentence,
      answerProvenanceReadabilitySentence,
      missingInformationSource,
      missingInformationProvenanceSentence,
      missingInformationSourceReadabilityLabel:
        buildMissingInformationSourceReadabilityLabel({
          missingInformationSource
        })
    };
  }

  private buildRouteResultPayload(input: {
    routeDecision: AskRouteDecision;
    conversationId: string;
    userMessageId: string;
    assistantMessageId: string;
    traceId: string;
    answer: string;
    citations: unknown;
    retrievedChunks: AskResultChunk[];
    contextGroups: Array<Record<string, unknown>>;
    strategySummary: RetrievalStrategySummary | undefined;
    retrievalMetadata: AskRetrievalMetadataJson;
    answeringMetadata: unknown;
    modelName: string | null;
    answerStatus: string | null;
    missingInformation: unknown;
    qualityEvaluation: unknown;
    timingSummary?: AskTimingSummary;
  }) {
    return {
      routeType: input.routeDecision.routeType,
      routeReason: input.routeDecision.routeReason,
      routeDecisionSummary: input.routeDecision,
      conversationId: input.conversationId,
      userMessageId: input.userMessageId,
      assistantMessageId: input.assistantMessageId,
      traceId: input.traceId,
      answer: input.answer,
      citations: input.citations,
      retrievedChunks: input.retrievedChunks,
      contextGroups: input.contextGroups,
      strategySummary: input.strategySummary,
      ...this.buildStaticRouteReadabilityArtifacts(),
      retrievalMetadata: input.retrievalMetadata,
      ...(input.timingSummary != null
        ? {
            timingSummary: input.timingSummary,
            timingReadabilitySentence: this.buildTimingReadabilitySentence(
              input.timingSummary
            )
          }
        : {}),
      ...this.buildAnswerPresentationArtifacts({
        answeringMetadata: input.answeringMetadata,
        missingInformation: input.missingInformation
      }),
      answeringMetadata: input.answeringMetadata,
      modelName: input.modelName,
      answerStatus: input.answerStatus,
      missingInformation: input.missingInformation,
      qualityEvaluation: input.qualityEvaluation
    };
  }

  private buildExternalSourceStepTitle(input: {
    sourceKind: ResolvedExternalSourceRoute['sourceKind'];
    title: string | null;
  }) {
    if (input.title != null && input.title.trim().length > 0) {
      return input.title;
    }

    if (input.sourceKind === 'web') {
      return 'External web page';
    }

    if (input.sourceKind === 'feed') {
      return 'External feed';
    }

    return 'External sitemap';
  }

  private async persistRouteAnswerResult(input: {
    conversationId: string;
    userMessageId: string;
    traceId: string;
    identity: AuthIdentity | null;
    answer: string;
    createdAtMs: number;
    retrievalMetadataJson: AskRetrievalMetadataJson;
    answeringMetadataJson: unknown;
    qualityEvaluationJson: unknown;
    modelName: string | null;
    citationsJson: unknown;
    retrievedChunkIdsJson: string[];
    retrievalScoresJson: Prisma.InputJsonValue;
    latencyMs?: number;
  }) {
    const assistantMessage = await this.messagesService.createMessage({
      conversationId: input.conversationId,
      role: MessageRole.assistant,
      content: input.answer,
      traceId: input.traceId
    });
    await this.messagesService.attachTrace(input.userMessageId, input.traceId);
    if (input.identity != null) {
      await this.conversationsService.touchConversation(
        input.conversationId,
        input.identity
      );
    }
    await this.tracesService.updateTrace(input.traceId, {
      assistantMessageId: assistantMessage.id,
      citationsJson: input.citationsJson as Prisma.InputJsonValue,
      retrievalMetadataJson:
        input.retrievalMetadataJson as Prisma.InputJsonValue,
      answeringMetadataJson:
        input.answeringMetadataJson as Prisma.InputJsonValue,
      qualityEvaluationJson:
        input.qualityEvaluationJson as Prisma.InputJsonValue,
      latencyMs: input.latencyMs ?? Date.now() - input.createdAtMs,
      modelName: input.modelName ?? undefined,
      retrievedChunkIdsJson: input.retrievedChunkIdsJson,
      retrievalScoresJson: input.retrievalScoresJson as Prisma.InputJsonValue,
      status: TraceStatus.success
    });
    return assistantMessage;
  }

  private async handleExternalSourceRouteAsk(input: {
    assistant: AssistantRecord;
    authContext: ReturnType<typeof resolveRequestAuthContext>;
    conversation: AskConversationRef;
    userMessagePromise: Promise<TimedResult<AskPersistedMessage>>;
    startedAt: number;
    question: string;
    normalizedAnswerPolicy: AnswerPolicy;
    routeDecision: AskRouteDecision;
  }) {
    const fetchedSource =
      await this.fetchExternalSourcePayloadOrCreateFailedTrace({
        assistantId: input.assistant.id,
        conversation: input.conversation,
        userMessagePromise: input.userMessagePromise,
        question: input.question,
        routeDecision: input.routeDecision
      });
    const retrievedChunks = this.buildExternalSourceChunks(
      this.buildResolvedExternalSourceView(fetchedSource.sources, 'chunks').map(
        (source) => ({
          url: source.url,
          sourceKind: source.sourceKind,
          title: source.title ?? fetchedSource.title,
          content: source.content ?? ''
        })
      )
    );
    const retrievalMetadata = this.buildExternalSourceRouteMetadata({
      question: input.question,
      sourceUrl: fetchedSource.sourceUrl,
      sourceKind: fetchedSource.sourceKind,
      sourceTitle: fetchedSource.title,
      diagnostics: fetchedSource.diagnostics,
      routeDecision: input.routeDecision,
      externalSources: this.buildResolvedExternalSourceView(
        fetchedSource.sources,
        'metadata'
      ).map((source, index) => ({
        url: source.url,
        kind: source.sourceKind,
        kindLabel: this.buildExternalSourceKindLabel(source.sourceKind),
        title: source.title ?? fetchedSource.title,
        diagnostics: index === 0 ? fetchedSource.diagnostics : null
      }))
    });
    const retrievalScoresJson = this.buildRetrievalScoresJson(
      retrievedChunks
    ) as unknown[];
    const { value: userMessage } = await input.userMessagePromise;
    const trace = await this.tracesService.createTrace({
      conversationId: input.conversation.id,
      assistantId: input.assistant.id,
      userMessageId: userMessage.id,
      userQuery: input.question,
      retrievedChunkIdsJson: retrievedChunks.map((chunk) => chunk.chunkId),
      retrievalScoresJson: retrievalScoresJson as Prisma.InputJsonValue,
      retrievalMetadataJson: retrievalMetadata,
      status: TraceStatus.success
    });
    const promptSnapshot = this.buildPromptSnapshot({
      question: input.question,
      systemPrompt: input.assistant.systemPrompt,
      answerPolicy: input.normalizedAnswerPolicy,
      chunks: retrievedChunks,
      contextGroups: []
    });
    const retrievalMetadataWithPrompt = this.withPromptContextMetrics(
      retrievalMetadata,
      promptSnapshot
    );
    const resolvedAnswerResult = await this.answeringService.generateAnswer({
      question: input.question,
      systemPrompt: input.assistant.systemPrompt,
      answerPolicy: input.normalizedAnswerPolicy,
      chunks: retrievedChunks.map((chunk) => ({
        ...chunk,
        pageNo: chunk.pageNo ?? null,
        sectionTitle: chunk.sectionTitle ?? null
      })),
      contextGroups: []
    });
    const answeringMetadataWithPrompt = this.withPromptSnapshot(
      resolvedAnswerResult.answeringMetadata,
      promptSnapshot
    );
    const assistantMessage = await this.persistRouteAnswerResult({
      conversationId: input.conversation.id,
      userMessageId: userMessage.id,
      traceId: trace.id,
      identity: input.authContext.identity,
      answer: resolvedAnswerResult.answer,
      createdAtMs: input.startedAt,
      retrievalMetadataJson: retrievalMetadataWithPrompt,
      answeringMetadataJson: answeringMetadataWithPrompt,
      qualityEvaluationJson: resolvedAnswerResult.qualityEvaluation,
      modelName: resolvedAnswerResult.modelName,
      citationsJson: resolvedAnswerResult.citations,
      retrievedChunkIdsJson: retrievedChunks.map((chunk) => chunk.chunkId),
      retrievalScoresJson: retrievalScoresJson as Prisma.InputJsonValue,
      latencyMs: Date.now() - input.startedAt
    });

    return this.buildRouteResultPayload({
      routeDecision: input.routeDecision,
      conversationId: input.conversation.id,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      traceId: trace.id,
      answer: resolvedAnswerResult.answer,
      citations: resolvedAnswerResult.citations,
      retrievedChunks,
      contextGroups: [],
      strategySummary: retrievalMetadata.strategySummary,
      retrievalMetadata: retrievalMetadataWithPrompt,
      answeringMetadata: answeringMetadataWithPrompt,
      modelName: resolvedAnswerResult.modelName,
      answerStatus: resolvedAnswerResult.answerStatus,
      missingInformation: resolvedAnswerResult.missingInformation,
      qualityEvaluation: resolvedAnswerResult.qualityEvaluation
    });
  }

  private async handleExternalSourceRouteAskStream(input: {
    assistant: AssistantRecord;
    authContext: ReturnType<typeof resolveRequestAuthContext>;
    conversationPromise: Promise<TimedResult<AskConversationRef>>;
    eagerUserMessagePromise: Promise<TimedResult<AskPersistedMessage>>;
    startedAt: number;
    question: string;
    normalizedAnswerPolicy: AnswerPolicy;
    routeDecision: AskRouteDecision;
    onEvent: (
      event:
        | { type: 'status'; phase: 'started' | 'retrieving' | 'generating' }
        | { type: 'answer_delta'; delta: string }
        | { type: 'final'; data: Record<string, unknown> }
    ) => void | Promise<void>;
  }) {
    const [{ value: conversation }, { value: userMessage }] = await Promise.all(
      [input.conversationPromise, input.eagerUserMessagePromise]
    );
    const fetchedSource =
      await this.fetchExternalSourcePayloadOrCreateFailedTrace({
        assistantId: input.assistant.id,
        conversation,
        userMessagePromise: Promise.resolve({
          value: userMessage,
          durationMs: 0
        }),
        question: input.question,
        routeDecision: input.routeDecision
      });
    const retrievedChunks = this.buildExternalSourceChunks(
      fetchedSource.sources.map((source, index) => ({
        url: source.url,
        sourceKind: source.sourceKind,
        title:
          index === 0
            ? fetchedSource.title
            : this.buildExternalSourceStepTitle({
                sourceKind: source.sourceKind,
                title: source.title
              }),
        content: source.content
      }))
    );
    const retrievalMetadata = this.buildExternalSourceRouteMetadata({
      question: input.question,
      sourceUrl: fetchedSource.sourceUrl,
      sourceKind: fetchedSource.sourceKind,
      sourceTitle: fetchedSource.title,
      diagnostics: fetchedSource.diagnostics,
      routeDecision: input.routeDecision,
      externalSources: fetchedSource.sources.map((source, index) => ({
        url: source.url,
        kind: source.sourceKind,
        kindLabel: this.buildExternalSourceKindLabel(source.sourceKind),
        title:
          index === 0
            ? fetchedSource.title
            : this.buildExternalSourceStepTitle({
                sourceKind: source.sourceKind,
                title: source.title
              }),
        diagnostics: index === 0 ? fetchedSource.diagnostics : null
      }))
    });
    const retrievalScoresJson = this.buildRetrievalScoresJson(
      retrievedChunks
    ) as unknown[];
    const trace = await this.tracesService.createTrace({
      conversationId: conversation.id,
      assistantId: input.assistant.id,
      userMessageId: userMessage.id,
      userQuery: input.question,
      retrievedChunkIdsJson: retrievedChunks.map((chunk) => chunk.chunkId),
      retrievalScoresJson: retrievalScoresJson as Prisma.InputJsonValue,
      retrievalMetadataJson: retrievalMetadata,
      status: TraceStatus.success
    });
    await input.onEvent({ type: 'status', phase: 'generating' });
    const promptSnapshot = this.buildPromptSnapshot({
      question: input.question,
      systemPrompt: input.assistant.systemPrompt,
      answerPolicy: input.normalizedAnswerPolicy,
      chunks: retrievedChunks,
      contextGroups: []
    });
    const resolvedAnswerResult = await this.answeringService.generateAnswer({
      question: input.question,
      systemPrompt: input.assistant.systemPrompt,
      answerPolicy: input.normalizedAnswerPolicy,
      chunks: retrievedChunks.map((chunk) => ({
        ...chunk,
        pageNo: chunk.pageNo ?? null,
        sectionTitle: chunk.sectionTitle ?? null
      })),
      contextGroups: []
    });
    await input.onEvent({
      type: 'answer_delta',
      delta: resolvedAnswerResult.answer
    });
    const answeringMetadataWithPrompt = this.withPromptSnapshot(
      resolvedAnswerResult.answeringMetadata,
      promptSnapshot
    );
    const timingSummary = this.buildTimingSummary({
      totalMs: Date.now() - input.startedAt,
      firstTokenMs: Date.now() - input.startedAt,
      preGenerationMs: 0,
      llmFirstTokenMs: 0,
      conversationLoadMs: null,
      userMessagePersistMs: null,
      rewriteMs: 0,
      retrievalMs: 0,
      traceCreateMs: 0,
      answerGenerationMs: 0,
      assistantMessagePersistMs: 0,
      traceFinalizeMs: 0,
      llmQueueWaitMs: 0,
      retrievalQueueWaitMs: 0
    });
    const retrievalMetadataWithPrompt = this.withPromptContextMetrics(
      {
        ...(retrievalMetadata as Record<string, unknown>),
        timing: timingSummary
      } as AskRetrievalMetadataJson,
      promptSnapshot
    );
    const assistantMessage = await this.persistRouteAnswerResult({
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      traceId: trace.id,
      identity: input.authContext.identity,
      answer: resolvedAnswerResult.answer,
      createdAtMs: input.startedAt,
      retrievalMetadataJson: retrievalMetadataWithPrompt,
      answeringMetadataJson: answeringMetadataWithPrompt,
      qualityEvaluationJson: resolvedAnswerResult.qualityEvaluation,
      modelName: resolvedAnswerResult.modelName,
      citationsJson: resolvedAnswerResult.citations,
      retrievedChunkIdsJson: retrievedChunks.map((chunk) => chunk.chunkId),
      retrievalScoresJson: retrievalScoresJson as Prisma.InputJsonValue,
      latencyMs: Date.now() - input.startedAt
    });

    const finalResult = this.buildRouteResultPayload({
      routeDecision: input.routeDecision,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      traceId: trace.id,
      answer: resolvedAnswerResult.answer,
      citations: resolvedAnswerResult.citations,
      retrievedChunks,
      contextGroups: [],
      strategySummary: retrievalMetadata.strategySummary,
      retrievalMetadata: retrievalMetadataWithPrompt,
      answeringMetadata: answeringMetadataWithPrompt,
      modelName: resolvedAnswerResult.modelName,
      answerStatus: resolvedAnswerResult.answerStatus,
      missingInformation: resolvedAnswerResult.missingInformation,
      qualityEvaluation: resolvedAnswerResult.qualityEvaluation,
      timingSummary
    });
    await input.onEvent({ type: 'final', data: finalResult });
    return finalResult;
  }

  private async handlePolicyRouteAsk(input: {
    assistant: AssistantRecord;
    authContext: ReturnType<typeof resolveRequestAuthContext>;
    conversation: AskConversationRef;
    userMessagePromise: Promise<TimedResult<AskPersistedMessage>>;
    startedAt: number;
    question: string;
    normalizedAnswerPolicy: AnswerPolicy;
    routeDecision: AskRouteDecision;
  }) {
    const retrievalMetadata = this.buildPolicyRouteMetadata({
      question: input.question,
      routeDecision: input.routeDecision
    });
    const retrievalScoresJson: unknown[] = [];
    const { value: userMessage } = await input.userMessagePromise;
    const trace = await this.tracesService.createTrace({
      conversationId: input.conversation.id,
      assistantId: input.assistant.id,
      userMessageId: userMessage.id,
      userQuery: input.question,
      retrievedChunkIdsJson: [],
      retrievalScoresJson: retrievalScoresJson as Prisma.InputJsonValue,
      retrievalMetadataJson: retrievalMetadata,
      modelName: 'policy-route-local',
      status: TraceStatus.success
    });
    const resolvedAnswerResult = this.buildPolicyRouteResult({
      question: input.question,
      answerPolicy: input.normalizedAnswerPolicy
    });
    const assistantMessage = await this.persistRouteAnswerResult({
      conversationId: input.conversation.id,
      userMessageId: userMessage.id,
      traceId: trace.id,
      identity: input.authContext.identity,
      answer: resolvedAnswerResult.answer,
      createdAtMs: input.startedAt,
      retrievalMetadataJson: retrievalMetadata,
      answeringMetadataJson: resolvedAnswerResult.answeringMetadata,
      qualityEvaluationJson: resolvedAnswerResult.qualityEvaluation,
      modelName: resolvedAnswerResult.modelName,
      citationsJson: [],
      retrievedChunkIdsJson: [],
      retrievalScoresJson: retrievalScoresJson as Prisma.InputJsonValue,
      latencyMs: Date.now() - input.startedAt
    });

    const strategyReadabilityLabel = buildStrategyReadabilityLabel({
      retrievalMode: null,
      retrievalQuerySource: 'original_disabled',
      fallbackReason: null,
      strategyUsedFallback: null
    });
    const retrievalModeProvenanceSentence =
      buildRetrievalModeProvenanceSentence({
        retrievalMode: null,
        strategyUsedFallback: null,
        fallbackReason: null
      });
    const rewriteReadabilityLabel = buildRewriteReadabilityLabel({
      rewriteEnabled: false,
      rewriteApplied: false,
      rewriteUsedFallback: null,
      rewritePromptId: null
    });
    const answerAttributionSummary = this.resolveAnswerAttributionSummary(
      resolvedAnswerResult.answeringMetadata
    );
    const answerAttributionSource = this.resolveAnswerAttributionSource(
      resolvedAnswerResult.answeringMetadata
    );
    const answerEvidenceSourceReadabilityLabel =
      buildAnswerEvidenceSourceReadabilityLabel(answerAttributionSource);
    const answerEvidenceSourceReadabilitySentence =
      this.buildAnswerEvidenceSourceReadabilitySentence(
        answerEvidenceSourceReadabilityLabel
      );
    const answerTextSource = this.resolveAnswerTextSource(
      resolvedAnswerResult.answeringMetadata
    );
    const answerStatusSource = this.resolveAnswerStatusSource(
      resolvedAnswerResult.answeringMetadata
    );
    const answerSourceReadability = buildAnswerSourceReadability({
      answerTextSource,
      rawAnswerTextSource: answerTextSource,
      answerStatusSource,
      rawAnswerStatusSource: answerStatusSource
    });
    const answerAttributionReadabilitySentence =
      answerAttributionSummary.readabilitySentence ??
      'Answer attribution is unknown; source evidence is unknown.';
    const { answerProvenanceSentence, answerProvenanceReadabilitySentence } =
      buildAnswerProvenanceFields({
        answerTextSource,
        answerStatusSource,
        answerAttributionReadabilityResolvedLabel:
          answerAttributionSummary.readabilityResolvedLabel,
        answerTextSourceReadabilityLabel:
          answerSourceReadability.answerTextSourceReadabilityLabel,
        answerStatusSourceReadabilityLabel:
          answerSourceReadability.answerStatusSourceReadabilityLabel,
        answerAttributionReadabilitySentence
      });
    const missingInformationSource = this.resolveMissingInformationSource(
      resolvedAnswerResult.answeringMetadata
    );
    const missingInformationProvenanceSentence =
      buildMissingInformationProvenanceSentence({
        missingInformationSource,
        insufficientContextReason: this.resolveInsufficientContextReason(
          resolvedAnswerResult.answeringMetadata
        ),
        missingInformationCount: 0
      });

    return {
      routeType: input.routeDecision.routeType,
      routeReason: input.routeDecision.routeReason,
      routeDecisionSummary: input.routeDecision,
      conversationId: input.conversation.id,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      traceId: trace.id,
      answer: resolvedAnswerResult.answer,
      citations: [],
      retrievedChunks: [],
      contextGroups: [],
      strategySummary: retrievalMetadata.strategySummary,
      strategyReadabilityLabel,
      rewriteReadabilityLabel,
      retrievalModeProvenanceSentence,
      retrievalMetadata,
      answerAttributionSummary,
      answerAttributionReadabilitySentence,
      answerAttribution: this.resolveAnswerAttribution(
        resolvedAnswerResult.answeringMetadata
      ),
      answerAttributionSource,
      answerEvidenceSource: answerAttributionSource,
      answerEvidenceSourceReadabilityLabel,
      answerEvidenceSourceReadabilitySentence,
      answerTextSource,
      answerTextSourceReadabilityLabel:
        answerSourceReadability.answerTextSourceReadabilityLabel,
      answerTextSourceReadabilitySentence:
        answerSourceReadability.answerTextSourceReadabilitySentence,
      answerStatusSource,
      answerStatusSourceReadabilityLabel:
        answerSourceReadability.answerStatusSourceReadabilityLabel,
      answerStatusSourceReadabilitySentence:
        answerSourceReadability.answerStatusSourceReadabilitySentence,
      answerProvenanceSentence,
      answerProvenanceReadabilitySentence,
      missingInformationSource,
      missingInformationProvenanceSentence,
      missingInformationSourceReadabilityLabel:
        buildMissingInformationSourceReadabilityLabel({
          missingInformationSource
        }),
      answeringMetadata: resolvedAnswerResult.answeringMetadata,
      modelName: resolvedAnswerResult.modelName,
      answerStatus: resolvedAnswerResult.answerStatus,
      missingInformation: resolvedAnswerResult.missingInformation,
      qualityEvaluation: resolvedAnswerResult.qualityEvaluation
    };
  }

  private async handlePolicyRouteAskStream(input: {
    assistant: AssistantRecord;
    authContext: ReturnType<typeof resolveRequestAuthContext>;
    conversationPromise: Promise<TimedResult<AskConversationRef>>;
    eagerUserMessagePromise: Promise<TimedResult<AskPersistedMessage>>;
    startedAt: number;
    question: string;
    normalizedAnswerPolicy: AnswerPolicy;
    routeDecision: AskRouteDecision;
    onEvent: (
      event:
        | { type: 'status'; phase: 'started' | 'retrieving' | 'generating' }
        | { type: 'answer_delta'; delta: string }
        | { type: 'final'; data: Record<string, unknown> }
    ) => void | Promise<void>;
  }) {
    const [{ value: conversation }, { value: userMessage }] = await Promise.all(
      [input.conversationPromise, input.eagerUserMessagePromise]
    );
    const retrievalMetadata = this.buildPolicyRouteMetadata({
      question: input.question,
      routeDecision: input.routeDecision
    });
    const retrievalScoresJson: unknown[] = [];
    const trace = await this.tracesService.createTrace({
      conversationId: conversation.id,
      assistantId: input.assistant.id,
      userMessageId: userMessage.id,
      userQuery: input.question,
      retrievedChunkIdsJson: [],
      retrievalScoresJson: retrievalScoresJson as Prisma.InputJsonValue,
      retrievalMetadataJson: retrievalMetadata,
      modelName: 'policy-route-local',
      status: TraceStatus.success
    });
    await input.onEvent({ type: 'status', phase: 'generating' });
    const resolvedAnswerResult = this.buildPolicyRouteResult({
      question: input.question,
      answerPolicy: input.normalizedAnswerPolicy
    });
    await input.onEvent({
      type: 'answer_delta',
      delta: resolvedAnswerResult.answer
    });
    const timingSummary = this.buildTimingSummary({
      totalMs: Date.now() - input.startedAt,
      firstTokenMs: Date.now() - input.startedAt,
      preGenerationMs: 0,
      llmFirstTokenMs: 0,
      conversationLoadMs: null,
      userMessagePersistMs: null,
      rewriteMs: 0,
      retrievalMs: 0,
      traceCreateMs: 0,
      answerGenerationMs: 0,
      assistantMessagePersistMs: 0,
      traceFinalizeMs: 0,
      llmQueueWaitMs: 0,
      retrievalQueueWaitMs: 0
    });
    const assistantMessage = await this.persistRouteAnswerResult({
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      traceId: trace.id,
      identity: input.authContext.identity,
      answer: resolvedAnswerResult.answer,
      createdAtMs: input.startedAt,
      retrievalMetadataJson: {
        ...(retrievalMetadata as Record<string, unknown>),
        timing: timingSummary
      } as AskRetrievalMetadataJson,
      answeringMetadataJson: resolvedAnswerResult.answeringMetadata,
      qualityEvaluationJson: resolvedAnswerResult.qualityEvaluation,
      modelName: resolvedAnswerResult.modelName,
      citationsJson: [],
      retrievedChunkIdsJson: [],
      retrievalScoresJson: retrievalScoresJson as Prisma.InputJsonValue,
      latencyMs: Date.now() - input.startedAt
    });
    const strategyReadabilityLabel = buildStrategyReadabilityLabel({
      retrievalMode: null,
      retrievalQuerySource: 'original_disabled',
      fallbackReason: null,
      strategyUsedFallback: null
    });
    const retrievalModeProvenanceSentence =
      buildRetrievalModeProvenanceSentence({
        retrievalMode: null,
        strategyUsedFallback: null,
        fallbackReason: null
      });
    const rewriteReadabilityLabel = buildRewriteReadabilityLabel({
      rewriteEnabled: false,
      rewriteApplied: false,
      rewriteUsedFallback: null,
      rewritePromptId: null
    });
    const answerAttributionSummary = this.resolveAnswerAttributionSummary(
      resolvedAnswerResult.answeringMetadata
    );
    const answerAttributionSource = this.resolveAnswerAttributionSource(
      resolvedAnswerResult.answeringMetadata
    );
    const answerEvidenceSourceReadabilityLabel =
      buildAnswerEvidenceSourceReadabilityLabel(answerAttributionSource);
    const answerEvidenceSourceReadabilitySentence =
      this.buildAnswerEvidenceSourceReadabilitySentence(
        answerEvidenceSourceReadabilityLabel
      );
    const answerTextSource = this.resolveAnswerTextSource(
      resolvedAnswerResult.answeringMetadata
    );
    const answerStatusSource = this.resolveAnswerStatusSource(
      resolvedAnswerResult.answeringMetadata
    );
    const answerSourceReadability = buildAnswerSourceReadability({
      answerTextSource,
      rawAnswerTextSource: answerTextSource,
      answerStatusSource,
      rawAnswerStatusSource: answerStatusSource
    });
    const answerAttributionReadabilitySentence =
      answerAttributionSummary.readabilitySentence ??
      'Answer attribution is unknown; source evidence is unknown.';
    const { answerProvenanceSentence, answerProvenanceReadabilitySentence } =
      buildAnswerProvenanceFields({
        answerTextSource,
        answerStatusSource,
        answerAttributionReadabilityResolvedLabel:
          answerAttributionSummary.readabilityResolvedLabel,
        answerTextSourceReadabilityLabel:
          answerSourceReadability.answerTextSourceReadabilityLabel,
        answerStatusSourceReadabilityLabel:
          answerSourceReadability.answerStatusSourceReadabilityLabel,
        answerAttributionReadabilitySentence
      });
    const missingInformationSource = this.resolveMissingInformationSource(
      resolvedAnswerResult.answeringMetadata
    );
    const missingInformationProvenanceSentence =
      buildMissingInformationProvenanceSentence({
        missingInformationSource,
        insufficientContextReason: this.resolveInsufficientContextReason(
          resolvedAnswerResult.answeringMetadata
        ),
        missingInformationCount: 0
      });
    const finalResult = {
      routeType: input.routeDecision.routeType,
      routeReason: input.routeDecision.routeReason,
      routeDecisionSummary: input.routeDecision,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      traceId: trace.id,
      answer: resolvedAnswerResult.answer,
      citations: [],
      retrievedChunks: [],
      contextGroups: [],
      strategySummary: retrievalMetadata.strategySummary,
      strategyReadabilityLabel,
      rewriteReadabilityLabel,
      retrievalModeProvenanceSentence,
      retrievalMetadata,
      timingSummary,
      timingReadabilitySentence:
        this.buildTimingReadabilitySentence(timingSummary),
      answerAttributionSummary,
      answerAttributionReadabilitySentence,
      answerAttribution: this.resolveAnswerAttribution(
        resolvedAnswerResult.answeringMetadata
      ),
      answerAttributionSource,
      answerEvidenceSource: answerAttributionSource,
      answerEvidenceSourceReadabilityLabel,
      answerEvidenceSourceReadabilitySentence,
      answerTextSource,
      answerTextSourceReadabilityLabel:
        answerSourceReadability.answerTextSourceReadabilityLabel,
      answerTextSourceReadabilitySentence:
        answerSourceReadability.answerTextSourceReadabilitySentence,
      answerStatusSource,
      answerStatusSourceReadabilityLabel:
        answerSourceReadability.answerStatusSourceReadabilityLabel,
      answerStatusSourceReadabilitySentence:
        answerSourceReadability.answerStatusSourceReadabilitySentence,
      answerProvenanceSentence,
      answerProvenanceReadabilitySentence,
      missingInformationSource,
      missingInformationProvenanceSentence,
      missingInformationSourceReadabilityLabel:
        buildMissingInformationSourceReadabilityLabel({
          missingInformationSource
        }),
      answeringMetadata: resolvedAnswerResult.answeringMetadata,
      modelName: resolvedAnswerResult.modelName,
      answerStatus: resolvedAnswerResult.answerStatus,
      missingInformation: resolvedAnswerResult.missingInformation,
      qualityEvaluation: resolvedAnswerResult.qualityEvaluation
    };
    await input.onEvent({
      type: 'final',
      data: finalResult
    });

    return finalResult;
  }

  private normalizeAnswerPolicy(input?: Partial<AnswerPolicy> | null) {
    return {
      responseStyle: input?.responseStyle ?? 'concise',
      tone: input?.tone ?? 'neutral',
      outputFormat: input?.outputFormat ?? 'paragraph',
      language: input?.language ?? 'auto',
      citationMode: input?.citationMode ?? 'required',
      maxCitations: input?.maxCitations ?? 3,
      noAnswerBehavior: input?.noAnswerBehavior ?? 'say_insufficient_context',
      includeMissingInformation: input?.includeMissingInformation ?? true
    } as const;
  }

  private normalizeReuseQuestion(input: string) {
    return input.replace(/\s+/g, ' ').trim();
  }

  private dispatchSpecialRouteAsk(input: {
    routeDecision: AskRouteDecision;
    executors: AskRouteToolAdapters;
  }): Promise<unknown> | null {
    const executor = input.executors[input.routeDecision.routeType];
    return executor != null ? executor() : null;
  }

  private dispatchRouteAsk(input: {
    routeDecision: AskRouteDecision;
    executors: AskRouteToolAdapters;
    knowledgeBaseAsk: AskKnowledgeBaseRouteAdapter;
  }) {
    return (
      this.dispatchSpecialRouteAsk({
        routeDecision: input.routeDecision,
        executors: input.executors
      }) ?? input.knowledgeBaseAsk()
    );
  }

  private buildAskRouteToolAdapters(input: {
    assistant: AssistantRecord;
    authContext: ReturnType<typeof resolveRequestAuthContext>;
    conversation: AskConversationRef;
    userMessagePromise: Promise<TimedResult<AskPersistedMessage>>;
    startedAt: number;
    question: string;
    normalizedAnswerPolicy: AnswerPolicy;
    routeDecision: AskRouteDecision;
  }): AskRouteToolAdapters {
    return {
      policy_reply: () =>
        this.handlePolicyRouteAsk({
          assistant: input.assistant,
          authContext: input.authContext,
          conversation: input.conversation,
          userMessagePromise: input.userMessagePromise,
          startedAt: input.startedAt,
          question: input.question,
          normalizedAnswerPolicy: input.normalizedAnswerPolicy,
          routeDecision: input.routeDecision
        }),
      external_source: () =>
        this.handleExternalSourceRouteAsk({
          assistant: input.assistant,
          authContext: input.authContext,
          conversation: input.conversation,
          userMessagePromise: input.userMessagePromise,
          startedAt: input.startedAt,
          question: input.question,
          normalizedAnswerPolicy: input.normalizedAnswerPolicy,
          routeDecision: input.routeDecision
        })
    };
  }

  private buildAskStreamRouteToolAdapters(input: {
    assistant: AssistantRecord;
    authContext: ReturnType<typeof resolveRequestAuthContext>;
    conversationPromise: Promise<TimedResult<AskConversationRef>>;
    eagerUserMessagePromise: Promise<TimedResult<AskPersistedMessage>>;
    startedAt: number;
    question: string;
    normalizedAnswerPolicy: AnswerPolicy;
    routeDecision: AskRouteDecision;
    onEvent: (
      event:
        | { type: 'status'; phase: 'started' | 'retrieving' | 'generating' }
        | { type: 'answer_delta'; delta: string }
        | { type: 'final'; data: Record<string, unknown> }
    ) => void | Promise<void>;
  }): AskRouteToolAdapters {
    return {
      policy_reply: () =>
        this.handlePolicyRouteAskStream({
          assistant: input.assistant,
          authContext: input.authContext,
          conversationPromise: input.conversationPromise,
          eagerUserMessagePromise: input.eagerUserMessagePromise,
          startedAt: input.startedAt,
          question: input.question,
          normalizedAnswerPolicy: input.normalizedAnswerPolicy,
          routeDecision: input.routeDecision,
          onEvent: input.onEvent
        }),
      external_source: () =>
        this.handleExternalSourceRouteAskStream({
          assistant: input.assistant,
          authContext: input.authContext,
          conversationPromise: input.conversationPromise,
          eagerUserMessagePromise: input.eagerUserMessagePromise,
          startedAt: input.startedAt,
          question: input.question,
          normalizedAnswerPolicy: input.normalizedAnswerPolicy,
          routeDecision: input.routeDecision,
          onEvent: input.onEvent
        })
    };
  }

  private async handleKnowledgeBaseRouteAsk(input: {
    assistant: AssistantRecord;
    authContext: ReturnType<typeof resolveRequestAuthContext>;
    conversation: AskConversationRef;
    userMessagePromise: Promise<TimedResult<AskPersistedMessage>>;
    startedAt: number;
    question: string;
    retrievalQuery: string;
    retrievalProfile: AssistantRecord['retrievalProfile'] & {
      strategyJson?: unknown;
    };
    retrievalStrategy: ReturnType<typeof resolveRetrievalStrategy>;
    retrievalFilters: RetrievalProfileFilters | undefined;
    rewritten: AskRewriteResult;
    normalizedAnswerPolicy: AnswerPolicy;
    routeDecision: AskRouteDecision;
    documentVersions?: Record<string, number>;
  }) {
    const retrievalResult = await this.retrievalLimiter.execute(() =>
      this.retrieveOrCreateFailedTrace({
        assistantId: input.assistant.id,
        assistantKbId: input.assistant.kbId,
        conversationPromise: Promise.resolve({
          value: input.conversation,
          durationMs: 0
        }),
        getUserMessagePromise: () => input.userMessagePromise,
        userQuery: input.question,
        retrievalQuery: input.retrievalQuery,
        retrievalProfile: input.retrievalProfile,
        retrievalStrategy: input.retrievalStrategy,
        retrievalFilters: input.retrievalFilters,
        rewritten: input.rewritten,
        documentVersions: input.documentVersions
      })
    );
    const resolvedRetrievalResult = retrievalResult;

    const retrievedChunks = resolvedRetrievalResult.retrievedChunks;
    const contextGroups = resolvedRetrievalResult.contextGroups;

    const [retrievalScoresJson, retrievalMetadata] = await Promise.all([
      Promise.resolve(this.buildRetrievalScoresJson(retrievedChunks)),
      Promise.resolve(
        this.buildRetrievalMetadata({
          strategy: input.retrievalStrategy,
          filters: input.retrievalFilters,
          rewrittenQuery: input.rewritten.rewrittenQuery,
          rewriteSkippedReason: input.rewritten.skippedReason,
          rewriteModelName: input.retrievalStrategy.queryRewrite.enabled
            ? input.rewritten.modelName
            : null,
          rewritePromptId: input.retrievalStrategy.queryRewrite.enabled
            ? input.rewritten.promptId
            : null,
          rewriteUsedFallback: input.retrievalStrategy.queryRewrite.enabled
            ? input.rewritten.usedFallback
            : null,
          originalQuestion: input.question,
          topK: input.retrievalProfile.topK,
          scoreThreshold: input.retrievalProfile.scoreThreshold,
          chunkWindow: input.retrievalProfile.chunkWindow,
          retrievedChunks,
          contextGroups,
          embedding: resolvedRetrievalResult.embedding,
          routeDecision: input.routeDecision,
          execution: resolvedRetrievalResult.execution,
          knowledgeBaseMultiStep: undefined,
          promptContextChars: null,
          promptContextApproxTokens: null
        }) as AskRetrievalMetadataJson
      )
    ]);

    const [
      strategyReadabilityLabel,
      retrievalModeProvenanceSentence,
      rewriteReadabilityLabel
    ] = await Promise.all([
      buildStrategyReadabilityLabel({
        retrievalMode: retrievalMetadata.strategySummary?.retrievalMode ?? null,
        retrievalQuerySource:
          retrievalMetadata.strategySummary?.retrievalQuerySource ?? null,
        fallbackReason:
          retrievalMetadata.strategySummary?.fallbackReason ?? null,
        strategyUsedFallback:
          retrievalMetadata.strategySummary?.usedFallback ?? null
      }),
      buildRetrievalModeProvenanceSentence({
        retrievalMode: retrievalMetadata.strategySummary?.retrievalMode ?? null,
        strategyUsedFallback:
          retrievalMetadata.strategySummary?.usedFallback ?? null,
        fallbackReason:
          retrievalMetadata.strategySummary?.fallbackReason ?? null
      }),
      buildRewriteReadabilityLabel({
        rewriteEnabled:
          retrievalMetadata.strategySummary?.rewriteEnabled ?? false,
        rewriteApplied:
          retrievalMetadata.strategySummary?.rewriteApplied ?? false,
        rewriteUsedFallback:
          retrievalMetadata.strategySummary?.rewriteUsedFallback ?? null,
        rewritePromptId:
          retrievalMetadata.strategySummary?.rewritePromptId ?? null
      })
    ]);

    const { value: userMessage } = await input.userMessagePromise;

    const trace = await this.tracesService.createTrace({
      conversationId: input.conversation.id,
      assistantId: input.assistant.id,
      userMessageId: userMessage.id,
      userQuery: input.question,
      rewrittenQuery:
        input.retrievalQuery !== input.question ? input.retrievalQuery : null,
      retrievedChunkIdsJson: retrievedChunks.map(
        (chunk: AskResultChunk) => chunk.chunkId
      ),
      retrievalScoresJson: retrievalScoresJson as Prisma.InputJsonValue,
      retrievalMetadataJson: retrievalMetadata,
      modelName: input.rewritten.modelName ?? undefined,
      status: TraceStatus.success
    });
    const promptSnapshot = this.buildPromptSnapshot({
      question: input.question,
      systemPrompt: input.assistant.systemPrompt,
      answerPolicy: input.normalizedAnswerPolicy,
      chunks: retrievedChunks,
      contextGroups
    });
    const retrievalMetadataWithPrompt = this.withPromptContextMetrics(
      retrievalMetadata,
      promptSnapshot
    );

    try {
      const deterministicBypass = this.resolveKnowledgeBaseDeterministicBypass({
        question: input.question,
        retrievedChunks,
        scoreThreshold: input.retrievalProfile.scoreThreshold,
        noAnswerBehavior: input.normalizedAnswerPolicy.noAnswerBehavior
      });
      const resolvedAnswerResult = deterministicBypass.shouldBypass
        ? this.answeringService.buildDeterministicInsufficientContextResult({
            question: input.question,
            answerPolicy: input.normalizedAnswerPolicy,
            hasRetrievedContext: retrievedChunks.length > 0,
            insufficientContextReason:
              deterministicBypass.insufficientContextReason ?? undefined,
            topScore: retrievedChunks[0]?.score ?? null
          })
        : await this.answeringService.generateAnswer({
            question: input.question,
            systemPrompt: input.assistant.systemPrompt,
            answerPolicy: input.normalizedAnswerPolicy,
            chunks: retrievedChunks,
            contextGroups
          });

      const assistantMessage = await this.messagesService.createMessage({
        conversationId: input.conversation.id,
        role: MessageRole.assistant,
        content: resolvedAnswerResult.answer,
        traceId: trace.id
      });

      await this.messagesService.attachTrace(userMessage.id, trace.id);
      await this.conversationsService.touchConversation(
        input.conversation.id,
        input.authContext.identity
      );
      await this.tracesService.updateTrace(trace.id, {
        assistantMessageId: assistantMessage.id,
        citationsJson: resolvedAnswerResult.citations,
        retrievalMetadataJson: retrievalMetadataWithPrompt,
        answeringMetadataJson: this.withPromptSnapshot(
          resolvedAnswerResult.answeringMetadata,
          promptSnapshot
        ),
        qualityEvaluationJson: resolvedAnswerResult.qualityEvaluation,
        latencyMs: Date.now() - input.startedAt,
        modelName: resolvedAnswerResult.modelName,
        rewrittenQuery:
          input.retrievalQuery !== input.question ? input.retrievalQuery : null,
        retrievedChunkIdsJson: retrievedChunks.map(
          (chunk: AskResultChunk) => chunk.chunkId
        ),
        retrievalScoresJson,
        status: TraceStatus.success
      });

      const answerAttributionSummary = this.resolveAnswerAttributionSummary(
        resolvedAnswerResult.answeringMetadata
      );
      const answerAttributionSource = this.resolveAnswerAttributionSource(
        resolvedAnswerResult.answeringMetadata
      );
      const answerEvidenceSourceReadabilityLabel =
        buildAnswerEvidenceSourceReadabilityLabel(answerAttributionSource);
      const answerEvidenceSourceReadabilitySentence =
        this.buildAnswerEvidenceSourceReadabilitySentence(
          answerEvidenceSourceReadabilityLabel
        );
      const answerTextSource = this.resolveAnswerTextSource(
        resolvedAnswerResult.answeringMetadata
      );
      const rawAnswerTextSource = this.readString(
        typeof resolvedAnswerResult.answeringMetadata === 'object' &&
          resolvedAnswerResult.answeringMetadata !== null
          ? (resolvedAnswerResult.answeringMetadata as Record<string, unknown>)
              .answerTextSource
          : null
      );
      const answerStatusSource = this.resolveAnswerStatusSource(
        resolvedAnswerResult.answeringMetadata
      );
      const rawAnswerStatusSource = this.readString(
        typeof resolvedAnswerResult.answeringMetadata === 'object' &&
          resolvedAnswerResult.answeringMetadata !== null
          ? (resolvedAnswerResult.answeringMetadata as Record<string, unknown>)
              .answerStatusSource
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
        answerAttributionSummary.readabilitySentence ??
        'Answer attribution is unknown; source evidence is unknown.';
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
      const missingInformationSource = this.resolveMissingInformationSource(
        resolvedAnswerResult.answeringMetadata
      );
      const missingInformationProvenanceSentence =
        buildMissingInformationProvenanceSentence({
          missingInformationSource,
          insufficientContextReason: this.resolveInsufficientContextReason(
            resolvedAnswerResult.answeringMetadata
          ),
          missingInformationCount: this.resolveMissingInformationCount({
            answeringMetadata: resolvedAnswerResult.answeringMetadata,
            missingInformation: resolvedAnswerResult.missingInformation
          })
        });
      this.logAskTiming({
        route: 'ask',
        status: 'success',
        assistantId: input.assistant.id,
        conversationId: input.conversation.id,
        traceId: trace.id,
        retrievalMode:
          retrievalMetadataWithPrompt.strategySummary?.retrievalMode ?? null,
        timing: null,
        retrievalExecution:
          typeof retrievalMetadataWithPrompt.execution === 'object' &&
          retrievalMetadataWithPrompt.execution !== null
            ? retrievalMetadataWithPrompt.execution
            : null,
        retrievalDiagnostics: this.buildRetrievalLogDiagnostics(
          retrievalMetadataWithPrompt
        )
      });

      return {
        routeType: input.routeDecision.routeType,
        routeReason: input.routeDecision.routeReason,
        routeDecisionSummary: input.routeDecision,
        conversationId: input.conversation.id,
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
        answerAttribution: this.resolveAnswerAttribution(
          resolvedAnswerResult.answeringMetadata
        ),
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
        missingInformationSourceReadabilityLabel:
          buildMissingInformationSourceReadabilityLabel({
            missingInformationSource
          }),
        answeringMetadata: this.withPromptSnapshot(
          resolvedAnswerResult.answeringMetadata,
          promptSnapshot
        ),
        modelName: resolvedAnswerResult.modelName,
        answerStatus: resolvedAnswerResult.answerStatus,
        missingInformation: resolvedAnswerResult.missingInformation,
        qualityEvaluation: resolvedAnswerResult.qualityEvaluation
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown ask pipeline error.';
      this.logAskTiming({
        route: 'ask',
        status: this.isAbortError(error) ? 'aborted' : 'failed',
        assistantId: input.assistant.id,
        conversationId: input.conversation.id,
        traceId: trace.id,
        retrievalMode: retrievalMetadata.strategySummary?.retrievalMode ?? null,
        timing: null,
        retrievalExecution:
          typeof retrievalMetadata.execution === 'object' &&
          retrievalMetadata.execution !== null
            ? retrievalMetadata.execution
            : null,
        retrievalDiagnostics:
          this.buildRetrievalLogDiagnostics(retrievalMetadata),
        errorMessage: message
      });
      await this.tracesService.updateTrace(trace.id, {
        latencyMs: Date.now() - input.startedAt,
        modelName: input.rewritten.modelName ?? undefined,
        rewrittenQuery:
          input.retrievalQuery !== input.question ? input.retrievalQuery : null,
        retrievedChunkIdsJson: retrievedChunks.map(
          (chunk: AskResultChunk) => chunk.chunkId
        ),
        retrievalScoresJson,
        retrievalMetadataJson: this.withFailureMetadata(
          this.withPromptContextMetrics(retrievalMetadata, promptSnapshot),
          {
            stage: 'answering',
            message
          }
        ),
        status: TraceStatus.failed,
        errorMessage: message
      });
      throw new AskAssistantError({
        traceId: trace.id,
        details: {
          stage: 'answering',
          cause: message
        }
      });
    }
  }

  private async handleKnowledgeBaseRouteAskStream(input: {
    assistant: AssistantRecord;
    authContext: ReturnType<typeof resolveRequestAuthContext>;
    conversationPromise: Promise<TimedResult<AskConversationRef>>;
    retrievingStatusEventOutcomePromise: Promise<{ error: unknown }>;
    getUserMessagePromise: () => Promise<TimedResult<AskPersistedMessage>>;
    eagerUserMessagePromise: Promise<TimedResult<AskPersistedMessage>>;
    startedAt: number;
    question: string;
    retrievalQuery: string;
    retrievalProfile: AssistantRecord['retrievalProfile'] & {
      strategyJson?: unknown;
    };
    retrievalStrategy: ReturnType<typeof resolveRetrievalStrategy>;
    retrievalFilters: RetrievalProfileFilters | undefined;
    rewritten: AskRewriteResult;
    rewriteMs: number;
    llmQueueWaitMs: number;
    normalizedAnswerPolicy: AnswerPolicy;
    routeDecision: AskRouteDecision;
    onEvent: (
      event:
        | { type: 'status'; phase: 'started' | 'retrieving' | 'generating' }
        | { type: 'answer_delta'; delta: string }
        | { type: 'final'; data: Record<string, unknown> }
    ) => void | Promise<void>;
    signal?: AbortSignal;
  }) {
    let llmQueueWaitMs = input.llmQueueWaitMs;

    const retrievalResultMeasured = await this.retrievalLimiter.executeMeasured(
      () =>
        this.retrieveOrCreateFailedTrace({
          assistantId: input.assistant.id,
          assistantKbId: input.assistant.kbId,
          conversationPromise: input.conversationPromise,
          getUserMessagePromise: input.getUserMessagePromise,
          userQuery: input.question,
          retrievalQuery: input.retrievalQuery,
          retrievalProfile: input.retrievalProfile,
          retrievalStrategy: input.retrievalStrategy,
          retrievalFilters: input.retrievalFilters,
          rewritten: input.rewritten
        })
    );
    const retrievalResult = retrievalResultMeasured.result;
    const resolvedRetrievalResult = retrievalResult;
    const retrievalMs = retrievalResultMeasured.runMs;
    const retrievalQueueWaitMs = retrievalResultMeasured.waitMs;

    const retrievedChunks = resolvedRetrievalResult.retrievedChunks;
    const contextGroups = resolvedRetrievalResult.contextGroups;

    const conversationAndUserMessagePromise = Promise.all([
      input.conversationPromise,
      input.eagerUserMessagePromise
    ]).then(([conversationResult, userMessageResult]) => ({
      conversation: conversationResult.value,
      conversationLoadMs: conversationResult.durationMs,
      userMessage: userMessageResult.value,
      userMessagePersistMs: userMessageResult.durationMs
    }));
    const retrievalArtifactsPromise = conversationAndUserMessagePromise.then(
      () => ({
        retrievalScoresJson: this.buildRetrievalScoresJson(retrievedChunks),
        retrievalMetadata: this.buildRetrievalMetadata({
          strategy: input.retrievalStrategy,
          filters: input.retrievalFilters,
          rewrittenQuery: input.rewritten.rewrittenQuery,
          rewriteSkippedReason: input.rewritten.skippedReason,
          rewriteModelName: input.retrievalStrategy.queryRewrite.enabled
            ? input.rewritten.modelName
            : null,
          rewritePromptId: input.retrievalStrategy.queryRewrite.enabled
            ? input.rewritten.promptId
            : null,
          rewriteUsedFallback: input.retrievalStrategy.queryRewrite.enabled
            ? input.rewritten.usedFallback
            : null,
          originalQuestion: input.question,
          topK: input.retrievalProfile.topK,
          scoreThreshold: input.retrievalProfile.scoreThreshold,
          chunkWindow: input.retrievalProfile.chunkWindow,
          retrievedChunks,
          contextGroups,
          embedding: resolvedRetrievalResult.embedding,
          routeDecision: input.routeDecision,
          execution: resolvedRetrievalResult.execution,
          knowledgeBaseMultiStep: undefined,
          promptContextChars: null,
          promptContextApproxTokens: null
        }) as AskRetrievalMetadataJson
      })
    );

    const traceCreateStartedAt = Date.now();
    const tracePromise = Promise.all([
      conversationAndUserMessagePromise,
      retrievalArtifactsPromise
    ]).then(
      ([
        { conversation, userMessage },
        { retrievalScoresJson, retrievalMetadata }
      ]) =>
        this.tracesService.createTrace({
          conversationId: conversation.id,
          assistantId: input.assistant.id,
          userMessageId: userMessage.id,
          userQuery: input.question,
          rewrittenQuery:
            input.retrievalQuery !== input.question
              ? input.retrievalQuery
              : null,
          retrievedChunkIdsJson: retrievedChunks.map(
            (chunk: AskResultChunk) => chunk.chunkId
          ),
          retrievalScoresJson,
          retrievalMetadataJson: retrievalMetadata,
          modelName: input.rewritten.modelName ?? undefined,
          status: TraceStatus.success
        })
    );
    let trace: { id: string } | null = null;
    let traceCreateMs = 0;

    try {
      const generatingStatusEventPromise = Promise.resolve(
        input.onEvent({
          type: 'status',
          phase: 'generating'
        })
      );

      let firstTokenMs: number | null = null;
      const generationStartedAt = Date.now();
      const preGenerationMs = generationStartedAt - input.startedAt;
      const deterministicBypass = this.resolveKnowledgeBaseDeterministicBypass({
        question: input.question,
        retrievedChunks,
        scoreThreshold: input.retrievalProfile.scoreThreshold,
        noAnswerBehavior: input.normalizedAnswerPolicy.noAnswerBehavior
      });
      const resolvedAnswerResult = deterministicBypass.shouldBypass
        ? await (async () => {
            const deterministicResult =
              this.answeringService.buildDeterministicInsufficientContextResult(
                {
                  question: input.question,
                  answerPolicy: input.normalizedAnswerPolicy,
                  hasRetrievedContext: retrievedChunks.length > 0,
                  insufficientContextReason:
                    deterministicBypass.insufficientContextReason ?? undefined,
                  topScore: retrievedChunks[0]?.score ?? null
                }
              );
            await generatingStatusEventPromise;
            firstTokenMs = Date.now() - input.startedAt;
            await input.onEvent({
              type: 'answer_delta',
              delta: deterministicResult.answer
            });

            return deterministicResult;
          })()
        : await (async () => {
            const streamResultMeasured = await this.llmLimiter.executeMeasured(
              () =>
                this.llmService.generateAnswerStream({
                  question: input.question,
                  systemPrompt: input.assistant.systemPrompt,
                  answerPolicy: input.normalizedAnswerPolicy,
                  chunks: this.answeringService.buildStreamAnswerContext({
                    chunks: retrievedChunks,
                    contextGroups
                  }),
                  signal: input.signal,
                  onDelta: async (delta) => {
                    await generatingStatusEventPromise;
                    if (firstTokenMs == null) {
                      firstTokenMs = Date.now() - input.startedAt;
                    }
                    await input.onEvent({
                      type: 'answer_delta',
                      delta
                    });
                  }
                })
            );
            llmQueueWaitMs += streamResultMeasured.waitMs;
            const streamResult = streamResultMeasured.result;

            return this.answeringService.finalizeStreamedAnswer({
              question: input.question,
              answerPolicy: input.normalizedAnswerPolicy,
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
      await generatingStatusEventPromise;
      const answerGenerationMs = Date.now() - generationStartedAt;
      const {
        conversation,
        conversationLoadMs,
        userMessage,
        userMessagePersistMs
      } = await conversationAndUserMessagePromise;
      const { retrievalScoresJson, retrievalMetadata } =
        await retrievalArtifactsPromise;
      trace = await tracePromise;
      traceCreateMs = Date.now() - traceCreateStartedAt;
      const promptSnapshot = this.buildPromptSnapshot({
        question: input.question,
        systemPrompt: input.assistant.systemPrompt,
        answerPolicy: input.normalizedAnswerPolicy,
        chunks: retrievedChunks,
        contextGroups
      });
      const retrievalMetadataWithPrompt = this.withPromptContextMetrics(
        retrievalMetadata,
        promptSnapshot
      );
      const [
        strategyReadabilityLabel,
        retrievalModeProvenanceSentence,
        rewriteReadabilityLabel
      ] = await Promise.all([
        buildStrategyReadabilityLabel({
          retrievalMode:
            retrievalMetadata.strategySummary?.retrievalMode ?? null,
          retrievalQuerySource:
            retrievalMetadata.strategySummary?.retrievalQuerySource ?? null,
          fallbackReason:
            retrievalMetadata.strategySummary?.fallbackReason ?? null,
          strategyUsedFallback:
            retrievalMetadata.strategySummary?.usedFallback ?? null
        }),
        buildRetrievalModeProvenanceSentence({
          retrievalMode:
            retrievalMetadata.strategySummary?.retrievalMode ?? null,
          strategyUsedFallback:
            retrievalMetadata.strategySummary?.usedFallback ?? null,
          fallbackReason:
            retrievalMetadata.strategySummary?.fallbackReason ?? null
        }),
        buildRewriteReadabilityLabel({
          rewriteEnabled:
            retrievalMetadata.strategySummary?.rewriteEnabled ?? false,
          rewriteApplied:
            retrievalMetadata.strategySummary?.rewriteApplied ?? false,
          rewriteUsedFallback:
            retrievalMetadata.strategySummary?.rewriteUsedFallback ?? null,
          rewritePromptId:
            retrievalMetadata.strategySummary?.rewritePromptId ?? null
        })
      ]);
      const assistantMessagePersistStartedAt = Date.now();
      const retrievingStatusEventOutcome =
        await input.retrievingStatusEventOutcomePromise;
      if (retrievingStatusEventOutcome.error != null) {
        throw retrievingStatusEventOutcome.error;
      }

      const assistantMessage = await this.messagesService.createMessage({
        conversationId: conversation.id,
        role: MessageRole.assistant,
        content: resolvedAnswerResult.answer,
        traceId: trace.id
      });
      const assistantMessagePersistMs =
        Date.now() - assistantMessagePersistStartedAt;

      await this.messagesService.attachTrace(userMessage.id, trace.id);
      await this.conversationsService.touchConversation(
        conversation.id,
        input.authContext.identity
      );
      const traceFinalizeStartedAt = Date.now();
      const persistedTimingSummary = this.buildTimingSummary({
        totalMs: Date.now() - input.startedAt,
        firstTokenMs,
        preGenerationMs,
        llmFirstTokenMs:
          firstTokenMs != null
            ? Math.max(0, firstTokenMs - preGenerationMs)
            : null,
        conversationLoadMs,
        userMessagePersistMs,
        rewriteMs: input.rewriteMs,
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
        answeringMetadataJson: this.withPromptSnapshot(
          resolvedAnswerResult.answeringMetadata,
          promptSnapshot
        ),
        qualityEvaluationJson: resolvedAnswerResult.qualityEvaluation,
        latencyMs: Date.now() - input.startedAt,
        modelName: resolvedAnswerResult.modelName,
        rewrittenQuery:
          input.retrievalQuery !== input.question ? input.retrievalQuery : null,
        retrievedChunkIdsJson: retrievedChunks.map(
          (chunk: AskResultChunk) => chunk.chunkId
        ),
        retrievalScoresJson,
        status: TraceStatus.success
      });
      const timingSummary = this.buildTimingSummary({
        ...persistedTimingSummary,
        traceFinalizeMs: Date.now() - traceFinalizeStartedAt
      });
      const timingReadabilitySentence =
        this.buildTimingReadabilitySentence(timingSummary);
      this.logAskTiming({
        route: 'ask_stream',
        status: 'success',
        assistantId: input.assistant.id,
        conversationId: conversation.id,
        traceId: trace.id,
        retrievalMode:
          retrievalMetadataWithPrompt.strategySummary?.retrievalMode ?? null,
        timing: timingSummary,
        retrievalExecution:
          typeof retrievalMetadataWithPrompt.execution === 'object' &&
          retrievalMetadataWithPrompt.execution !== null
            ? retrievalMetadataWithPrompt.execution
            : null,
        retrievalDiagnostics: this.buildRetrievalLogDiagnostics(
          retrievalMetadataWithPrompt
        )
      });

      const answerAttributionSummary = this.resolveAnswerAttributionSummary(
        resolvedAnswerResult.answeringMetadata
      );
      const answerAttributionSource = this.resolveAnswerAttributionSource(
        resolvedAnswerResult.answeringMetadata
      );
      const answerEvidenceSourceReadabilityLabel =
        buildAnswerEvidenceSourceReadabilityLabel(answerAttributionSource);
      const answerEvidenceSourceReadabilitySentence =
        this.buildAnswerEvidenceSourceReadabilitySentence(
          answerEvidenceSourceReadabilityLabel
        );
      const answerTextSource = this.resolveAnswerTextSource(
        resolvedAnswerResult.answeringMetadata
      );
      const rawAnswerTextSource = this.readString(
        typeof resolvedAnswerResult.answeringMetadata === 'object' &&
          resolvedAnswerResult.answeringMetadata !== null
          ? (resolvedAnswerResult.answeringMetadata as Record<string, unknown>)
              .answerTextSource
          : null
      );
      const answerStatusSource = this.resolveAnswerStatusSource(
        resolvedAnswerResult.answeringMetadata
      );
      const rawAnswerStatusSource = this.readString(
        typeof resolvedAnswerResult.answeringMetadata === 'object' &&
          resolvedAnswerResult.answeringMetadata !== null
          ? (resolvedAnswerResult.answeringMetadata as Record<string, unknown>)
              .answerStatusSource
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
        answerAttributionSummary.readabilitySentence ??
        'Answer attribution is unknown; source evidence is unknown.';
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
      const missingInformationSource = this.resolveMissingInformationSource(
        resolvedAnswerResult.answeringMetadata
      );
      const missingInformationProvenanceSentence =
        buildMissingInformationProvenanceSentence({
          missingInformationSource,
          insufficientContextReason: this.resolveInsufficientContextReason(
            resolvedAnswerResult.answeringMetadata
          ),
          missingInformationCount: this.resolveMissingInformationCount({
            answeringMetadata: resolvedAnswerResult.answeringMetadata,
            missingInformation: resolvedAnswerResult.missingInformation
          })
        });
      const finalResult = {
        routeType: input.routeDecision.routeType,
        routeReason: input.routeDecision.routeReason,
        routeDecisionSummary: input.routeDecision,
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
        answerAttribution: this.resolveAnswerAttribution(
          resolvedAnswerResult.answeringMetadata
        ),
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
        missingInformationSourceReadabilityLabel:
          buildMissingInformationSourceReadabilityLabel({
            missingInformationSource
          }),
        answeringMetadata: this.withPromptSnapshot(
          resolvedAnswerResult.answeringMetadata,
          promptSnapshot
        ),
        modelName: resolvedAnswerResult.modelName,
        answerStatus: resolvedAnswerResult.answerStatus,
        missingInformation: resolvedAnswerResult.missingInformation,
        qualityEvaluation: resolvedAnswerResult.qualityEvaluation
      };

      await input.onEvent({
        type: 'final',
        data: finalResult
      });

      return finalResult;
    } catch (error) {
      if (this.isAbortError(error)) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'Unknown ask pipeline error.';
      const { conversation, conversationLoadMs, userMessagePersistMs } =
        await conversationAndUserMessagePromise;
      const { retrievalScoresJson, retrievalMetadata } =
        await retrievalArtifactsPromise;
      const resolvedTrace = trace ?? (await tracePromise);
      trace = resolvedTrace;
      const promptSnapshot = this.buildPromptSnapshot({
        question: input.question,
        systemPrompt: input.assistant.systemPrompt,
        answerPolicy: input.normalizedAnswerPolicy,
        chunks: retrievedChunks,
        contextGroups
      });
      const retrievalMetadataWithPrompt = this.withPromptContextMetrics(
        retrievalMetadata,
        promptSnapshot
      );
      const failureTimingSummary = this.buildTimingSummary({
        totalMs: Date.now() - input.startedAt,
        firstTokenMs: null,
        preGenerationMs: null,
        llmFirstTokenMs: null,
        conversationLoadMs,
        userMessagePersistMs,
        rewriteMs: input.rewriteMs,
        retrievalMs,
        traceCreateMs,
        answerGenerationMs: null,
        assistantMessagePersistMs: null,
        traceFinalizeMs: null,
        llmQueueWaitMs,
        retrievalQueueWaitMs
      });
      this.logAskTiming({
        route: 'ask_stream',
        status: 'failed',
        assistantId: input.assistant.id,
        conversationId: conversation.id,
        traceId: resolvedTrace.id,
        retrievalMode:
          retrievalMetadataWithPrompt.strategySummary?.retrievalMode ?? null,
        timing: failureTimingSummary,
        retrievalExecution:
          typeof retrievalMetadataWithPrompt.execution === 'object' &&
          retrievalMetadataWithPrompt.execution !== null
            ? retrievalMetadataWithPrompt.execution
            : null,
        retrievalDiagnostics: this.buildRetrievalLogDiagnostics(
          retrievalMetadataWithPrompt
        ),
        errorMessage: message
      });
      await this.tracesService.updateTrace(resolvedTrace.id, {
        latencyMs: Date.now() - input.startedAt,
        modelName: input.rewritten.modelName ?? undefined,
        rewrittenQuery:
          input.retrievalQuery !== input.question ? input.retrievalQuery : null,
        retrievedChunkIdsJson: retrievedChunks.map(
          (chunk: AskResultChunk) => chunk.chunkId
        ),
        retrievalScoresJson,
        retrievalMetadataJson: this.withFailureMetadata(
          {
            ...(retrievalMetadataWithPrompt as Record<string, unknown>),
            timing: failureTimingSummary
          } as AskRetrievalMetadataJson,
          {
            stage: 'answering',
            message
          }
        ),
        status: TraceStatus.failed,
        errorMessage: message
      });
      throw new AskAssistantError({
        traceId: resolvedTrace.id,
        details: {
          stage: 'answering',
          cause: message
        }
      });
    }
  }

  private async findReusableConversationAnswer(input: {
    conversationId: string;
    assistantId: string;
    question: string;
    authContext: AuthIdentity;
  }) {
    const normalizedQuestion = this.normalizeReuseQuestion(input.question);
    if (normalizedQuestion.length === 0) {
      return null;
    }

    const messages = (await this.messagesService.listConversationMessages(
      input.conversationId,
      input.authContext
    )) as AskReusableConversationMessage[];

    for (let index = messages.length - 2; index >= 0; index -= 1) {
      const candidate = messages[index];
      const nextMessage = messages[index + 1];
      if (
        candidate.role !== MessageRole.user ||
        this.normalizeReuseQuestion(candidate.content) !== normalizedQuestion
      ) {
        continue;
      }

      if (
        nextMessage?.role !== MessageRole.assistant ||
        nextMessage.traceId == null
      ) {
        continue;
      }

      const trace = await this.tracesService.getTrace(
        nextMessage.traceId,
        input.authContext
      );

      if (trace.assistantId !== input.assistantId) {
        continue;
      }

      return {
        conversationId: input.conversationId,
        userMessageId: candidate.id,
        assistantMessageId: nextMessage.id,
        traceId: trace.id,
        answer: nextMessage.content,
        citations: Array.isArray(trace.citationsJson)
          ? trace.citationsJson
          : [],
        modelName: trace.modelName ?? 'reused-answer',
        routeType: trace.traceSummary?.routeType ?? null,
        routeReason: trace.traceSummary?.routeReason ?? null,
        strategySummary: trace.traceSummary?.strategySummary ?? undefined,
        retrievalMetadata: trace.retrievalMetadataJson ?? undefined,
        timingSummary: trace.traceSummary?.timingSummary ?? undefined,
        timingReadabilitySentence:
          trace.traceSummary?.timingReadabilitySentence ?? undefined,
        strategyReadabilityLabel:
          trace.traceSummary?.strategyReadabilityLabel ?? undefined,
        retrievalModeProvenanceSentence:
          trace.traceSummary?.retrievalModeProvenanceSentence ?? undefined,
        rewriteReadabilityLabel:
          trace.traceSummary?.rewriteReadabilityLabel ?? undefined,
        answerAttributionSummary:
          trace.traceSummary?.answerAttributionSummary ?? undefined,
        answerAttributionReadabilitySentence:
          trace.traceSummary?.answerAttributionReadabilitySentence ?? undefined,
        answerAttribution: trace.traceSummary?.answerAttribution ?? undefined,
        answerAttributionSource:
          trace.traceSummary?.answerAttributionSource ?? undefined,
        answerEvidenceSource:
          trace.traceSummary?.answerEvidenceSource ?? undefined,
        answerEvidenceSourceReadabilityLabel:
          trace.traceSummary?.answerEvidenceSourceReadabilityLabel ?? undefined,
        answerEvidenceSourceReadabilitySentence:
          trace.traceSummary?.answerEvidenceSourceReadabilitySentence ??
          undefined,
        answerTextSource: trace.traceSummary?.answerTextSource ?? undefined,
        answerTextSourceReadabilityLabel:
          trace.traceSummary?.answerTextSourceReadabilityLabel ?? undefined,
        answerTextSourceReadabilitySentence:
          trace.traceSummary?.answerTextSourceReadabilitySentence ?? undefined,
        answerStatusSource: trace.traceSummary?.answerStatusSource ?? undefined,
        answerStatusSourceReadabilityLabel:
          trace.traceSummary?.answerStatusSourceReadabilityLabel ?? undefined,
        answerStatusSourceReadabilitySentence:
          trace.traceSummary?.answerStatusSourceReadabilitySentence ??
          undefined,
        failureReadabilitySentence:
          trace.traceSummary?.failureReadabilitySentence ?? undefined,
        answerProvenanceSentence:
          trace.traceSummary?.answerProvenanceSentence ?? undefined,
        answerProvenanceReadabilitySentence:
          trace.traceSummary?.answerProvenanceReadabilitySentence ?? undefined,
        missingInformationSource:
          trace.traceSummary?.missingInformationSource ?? undefined,
        missingInformationProvenanceSentence:
          trace.traceSummary?.missingInformationProvenanceSentence ?? undefined,
        missingInformationSourceReadabilityLabel:
          trace.traceSummary?.missingInformationSourceReadabilityLabel ??
          undefined,
        answeringMetadata: trace.answeringMetadataJson ?? undefined,
        answerStatus: trace.traceSummary?.answerStatus ?? undefined,
        missingInformation: [],
        qualityEvaluation: trace.qualityEvaluationJson ?? undefined
      };
    }

    return null;
  }

  private isAbortError(error: unknown) {
    return error instanceof Error && error.name === 'AbortError';
  }

  private resolveRewriteDecision(
    question: string,
    retrievalStrategy: ReturnType<typeof resolveRetrievalStrategy>
  ): AskRewriteDecision {
    const mode = retrievalStrategy.queryRewrite.mode;
    if (!retrievalStrategy.queryRewrite.enabled || mode === 'off') {
      return {
        shouldRewrite: false,
        skippedReason: 'disabled_by_default'
      };
    }

    if (mode === 'always') {
      return {
        shouldRewrite: true,
        skippedReason: null
      };
    }

    const normalizedQuestion = this.normalizeQuestion(question);
    const termCount =
      normalizedQuestion.length === 0
        ? 0
        : normalizedQuestion.split(/\s+/).length;
    const isSummaryOrComplexQuestion =
      this.isSummaryOrComplexQuestion(question);
    if (
      !isSummaryOrComplexQuestion &&
      (normalizedQuestion.length < 18 || termCount < 6)
    ) {
      return {
        shouldRewrite: false,
        skippedReason: 'query_too_short'
      };
    }

    if (!isSummaryOrComplexQuestion) {
      return {
        shouldRewrite: false,
        skippedReason: 'not_summary_or_complex_question'
      };
    }

    const estimatedRewriteLatencyMs =
      180 + termCount * 30 + Math.ceil(normalizedQuestion.length / 12);
    if (
      retrievalStrategy.queryRewrite.maxAddedLatencyMs <
      estimatedRewriteLatencyMs
    ) {
      return {
        shouldRewrite: false,
        skippedReason: 'latency_budget_exceeded'
      };
    }

    return {
      shouldRewrite: true,
      skippedReason: null
    };
  }

  private isSummaryOrComplexQuestion(question: string) {
    return /summary|compare|difference|list|steps|why|how|issue|problem|debug|error|tradeoff|versus|vs\b|\?|benefit|benefits|importance|important|impact|value|role|meaning|what.*for|what.*benefit|\u603b\u7ed3|\u6982\u62ec|\u5217\u51fa|\u6bd4\u8f83|\u533a\u522b|\u6392\u67e5|\u95ee\u9898|\u539f\u56e0|\u6b65\u9aa4|\u6709\u54ea\u4e9b|\u610f\u4e49|\u4f5c\u7528|\u4ef7\u503c|\u5f71\u54cd|\u91cd\u8981|\u597d\u5904|\u6709\u4ec0\u4e48\u7528|\u6709\u4ec0\u4e48\u4ef7\u503c|\u4e3a\u4ec0\u4e48\u91cd\u8981/i.test(
      question
    );
  }

  private normalizeQuestion(question: string) {
    return question.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private approximateTokenCount(value: string) {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return 0;
    }

    return Math.ceil(normalized.length / 4);
  }

  private resolveAnswerAttribution(
    answeringMetadata: unknown
  ): TraceCitationAttribution | null {
    if (typeof answeringMetadata !== 'object' || answeringMetadata === null) {
      return null;
    }

    const attribution = (answeringMetadata as Record<string, unknown>)
      .citationAttribution;
    return attribution === 'explicit' ||
      attribution === 'heuristic' ||
      attribution === 'none'
      ? attribution
      : null;
  }

  private resolveAnswerAttributionSource(
    answeringMetadata: unknown
  ): TraceCitationSelectionSource | null {
    if (typeof answeringMetadata !== 'object' || answeringMetadata === null) {
      return null;
    }

    const source = (answeringMetadata as Record<string, unknown>)
      .citationSelectionSource;
    return source === 'structured' ||
      source === 'inline_markers' ||
      source === 'heuristic' ||
      source === 'none'
      ? source
      : null;
  }

  private resolveAnswerAttributionSummary(
    answeringMetadata: unknown
  ): TraceAnswerAttributionSummary {
    return buildAnswerAttributionSummary({
      attribution: this.resolveAnswerAttribution(answeringMetadata),
      source: this.resolveAnswerAttributionSource(answeringMetadata)
    });
  }

  private resolveAnswerTextSource(
    answeringMetadata: unknown
  ): TraceSummary['answerTextSource'] {
    if (typeof answeringMetadata !== 'object' || answeringMetadata === null) {
      return null;
    }

    const source = (answeringMetadata as Record<string, unknown>)
      .answerTextSource;
    return source === 'model' || source === 'deterministic_policy'
      ? source
      : null;
  }

  private resolveAnswerStatusSource(
    answeringMetadata: unknown
  ): TraceSummary['answerStatusSource'] {
    if (typeof answeringMetadata !== 'object' || answeringMetadata === null) {
      return null;
    }

    const source = (answeringMetadata as Record<string, unknown>)
      .answerStatusSource;
    return source === 'model' ||
      source === 'inferred_from_retrieval' ||
      source === 'deterministic_policy'
      ? source
      : null;
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private readNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private buildAnswerEvidenceSourceReadabilitySentence(
    answerEvidenceSourceReadabilityLabel: TraceSummary['answerEvidenceSourceReadabilityLabel']
  ): TraceSummary['answerEvidenceSourceReadabilitySentence'] {
    return `Answer evidence source is ${answerEvidenceSourceReadabilityLabel}.`;
  }

  private resolveMissingInformationSource(
    answeringMetadata: unknown
  ): TraceSummary['missingInformationSource'] {
    if (typeof answeringMetadata !== 'object' || answeringMetadata === null) {
      return null;
    }

    const source = (answeringMetadata as Record<string, unknown>)
      .missingInformationSource;
    return source === 'none' ||
      source === 'model' ||
      source === 'deterministic_default' ||
      source === 'suppressed_by_policy'
      ? source
      : null;
  }

  private resolveInsufficientContextReason(
    answeringMetadata: unknown
  ): TraceSummary['insufficientContextReason'] {
    if (typeof answeringMetadata !== 'object' || answeringMetadata === null) {
      return null;
    }

    const reason = (answeringMetadata as Record<string, unknown>)
      .insufficientContextReason;
    return reason === 'no_retrieval_hits' ||
      reason === 'retrieved_context_insufficient'
      ? reason
      : null;
  }

  private resolveMissingInformationCount(input: {
    answeringMetadata: unknown;
    missingInformation: unknown;
  }) {
    if (
      typeof input.answeringMetadata === 'object' &&
      input.answeringMetadata !== null
    ) {
      const count = (input.answeringMetadata as Record<string, unknown>)
        .missingInformationCount;
      if (typeof count === 'number') {
        return count;
      }
    }

    return Array.isArray(input.missingInformation)
      ? input.missingInformation.length
      : 0;
  }

  private buildRetrievalScoresJson(
    chunks: AskResultChunk[]
  ): Prisma.InputJsonValue {
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
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (normalized.length <= 220) {
      return normalized;
    }

    return `${normalized.slice(0, 217)}...`;
  }

  private buildRetrievalMetadata(input: {
    strategy: ReturnType<typeof resolveRetrievalStrategy>;
    filters?: RetrievalProfileFilters;
    rewrittenQuery: string | null;
    rewriteSkippedReason: RetrievalStrategySummary['rewriteSkippedReason'];
    rewriteModelName: string | null;
    rewritePromptId: string | null;
    rewriteUsedFallback: boolean | null;
    routeDecision: AskRouteDecision;
    originalQuestion: string;
    topK: number;
    scoreThreshold: number;
    chunkWindow: number;
    retrievedChunks: AskResultChunk[];
    contextGroups: Array<{ primaryChunkIds: string[] }>;
    embedding: VectorStoreEmbeddingDiagnostics | null;
    knowledgeBaseMultiStep?: TraceKnowledgeBaseMultiStepSummary;
    promptContextChars: number | null;
    promptContextApproxTokens: number | null;
    execution: {
      actualMode: 'vector' | 'hybrid' | 'lexical';
      usedFallback: boolean;
      fallbackReason: 'vector_error' | 'no_ranked_candidates' | null;
      rerankApplied: boolean;
      rerankMode?: 'off' | 'local_heuristic' | 'llm_judge';
      rerankJudgeSkippedReason?:
        | 'candidate_set_too_large'
        | 'query_too_simple'
        | 'judge_dependencies_missing'
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
    const rewriteApplied = Boolean(
      input.rewrittenQuery && input.rewrittenQuery !== input.originalQuestion
    );
    const retrievalQuerySource = !input.strategy.queryRewrite.enabled
      ? 'original_disabled'
      : rewriteApplied
        ? 'rewritten'
        : 'original_unchanged';

    const primaryChunks = input.retrievedChunks.filter(
      (chunk) => chunk.isPrimary ?? true
    );
    const primaryChunkScores = primaryChunks.map(
      (chunk: AskResultChunk) => chunk.score
    );
    const primaryChunkScoreAvg =
      primaryChunkScores.length > 0
        ? Number(
            (
              primaryChunkScores.reduce((sum, score) => sum + score, 0) /
              primaryChunkScores.length
            ).toFixed(4)
          )
        : null;
    const primaryChunkScoreMin =
      primaryChunkScores.length > 0
        ? Number(Math.min(...primaryChunkScores).toFixed(4))
        : null;
    const contextGroupAvgLength =
      input.contextGroups.length > 0
        ? Number(
            (
              input.contextGroups.reduce((sum, group) => {
                const groupLength =
                  (group as { mergedContent?: string }).mergedContent?.length ??
                  0;
                return sum + groupLength;
              }, 0) / input.contextGroups.length
            ).toFixed(2)
          )
        : null;

    const executionPlan = buildTraceExecutionPlan({
      routeType: input.routeDecision.routeType,
      routeReason: input.routeDecision.routeReason,
      sourceCount: input.retrievedChunks.length,
      knowledgeBaseMultiStep: input.knowledgeBaseMultiStep
    });

    return {
      strategy: input.strategy,
      filters: input.filters ?? null,
      ...buildTraceMetadataCanonicalSurface({
        routeDecision: input.routeDecision,
        executionPlan
      }),
      knowledgeBaseMultiStep: input.knowledgeBaseMultiStep ?? null,
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
        usedFallback: input.strategy.queryRewrite.enabled
          ? input.rewriteUsedFallback
          : null,
        modelName: input.strategy.queryRewrite.enabled
          ? input.rewriteModelName
          : null,
        promptId: input.strategy.queryRewrite.enabled
          ? input.rewritePromptId
          : null
      },
      strategySummary: {
        retrievalMode: input.execution.actualMode,
        strategyMode: input.strategy.candidateSelection.mode,
        retrievalQuerySource,
        rewriteEnabled: input.strategy.queryRewrite.enabled,
        rewriteApplied,
        rewriteSkippedReason: input.rewriteSkippedReason,
        rewriteUsedFallback: input.strategy.queryRewrite.enabled
          ? input.rewriteUsedFallback
          : null,
        rewritePromptId: input.strategy.queryRewrite.enabled
          ? input.rewritePromptId
          : null,
        rewriteModelName: input.strategy.queryRewrite.enabled
          ? input.rewriteModelName
          : null,
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
        rerankMode:
          input.execution.rerankMode ??
          (input.execution.rerankApplied ? 'local_heuristic' : 'off'),
        rerankJudgeSkippedReason:
          input.execution.rerankJudgeSkippedReason ?? null,
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
        primaryChunkCount: input.retrievedChunks.filter(
          (chunk) => chunk.isPrimary ?? true
        ).length,
        neighborChunkCount: input.retrievedChunks.filter(
          (chunk) => !(chunk.isPrimary ?? true)
        ).length
      }
    } as Prisma.InputJsonValue;
  }

  private async retrieveOrCreateFailedTrace(input: {
    assistantId: string;
    assistantKbId: string;
    conversationPromise: Promise<TimedResult<AskConversationRef>>;
    getUserMessagePromise: () => Promise<TimedResult<AskPersistedMessage>>;
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
        throw new Error('Retrieval returned no result.');
      }

      return retrievalResult;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown retrieval pipeline error.';
      const embeddingDiagnostics =
        error instanceof VectorStoreCompatibilityError
          ? error.embeddingDiagnostics
          : null;
      const [{ value: conversation }, { value: userMessage }] =
        await Promise.all([
          input.conversationPromise,
          input.getUserMessagePromise()
        ]);
      const failedTrace = await this.tracesService.createTrace({
        conversationId: conversation.id,
        assistantId: input.assistantId,
        userMessageId: userMessage.id,
        userQuery: input.userQuery,
        rewrittenQuery:
          input.retrievalQuery !== input.userQuery
            ? input.retrievalQuery
            : null,
        retrievalMetadataJson: this.buildRetrievalFailureMetadata({
          strategy: input.retrievalStrategy,
          filters: input.retrievalFilters,
          rewrittenQuery: input.rewritten.rewrittenQuery,
          rewriteSkippedReason: input.rewritten.skippedReason,
          rewriteModelName: input.retrievalStrategy.queryRewrite.enabled
            ? input.rewritten.modelName
            : null,
          rewritePromptId: input.retrievalStrategy.queryRewrite.enabled
            ? input.rewritten.promptId
            : null,
          rewriteUsedFallback: input.retrievalStrategy.queryRewrite.enabled
            ? input.rewritten.usedFallback
            : null,
          routeDecision: {
            routeType: 'knowledge_base',
            routeReason: 'default_kb_ask'
          },
          originalQuestion: input.userQuery,
          topK: input.retrievalProfile.topK,
          scoreThreshold: input.retrievalProfile.scoreThreshold,
          chunkWindow: input.retrievalProfile.chunkWindow,
          embedding: embeddingDiagnostics,
          failure: {
            stage: 'retrieval',
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
          stage: 'retrieval',
          cause: message
        }
      });
    }
  }

  private buildRetrievalFailureMetadata(input: {
    strategy: ReturnType<typeof resolveRetrievalStrategy>;
    filters?: RetrievalProfileFilters;
    rewrittenQuery: string | null;
    rewriteSkippedReason: RetrievalStrategySummary['rewriteSkippedReason'];
    rewriteModelName: string | null;
    rewritePromptId: string | null;
    rewriteUsedFallback: boolean | null;
    routeDecision: AskRouteDecision;
    originalQuestion: string;
    topK: number;
    scoreThreshold: number;
    chunkWindow: number;
    embedding?: VectorStoreEmbeddingDiagnostics | null;
    failure: {
      stage: 'retrieval';
      message: string;
    };
  }): Prisma.InputJsonValue {
    const rewriteApplied = Boolean(
      input.rewrittenQuery && input.rewrittenQuery !== input.originalQuestion
    );
    const retrievalQuerySource = !input.strategy.queryRewrite.enabled
      ? 'original_disabled'
      : rewriteApplied
        ? 'rewritten'
        : 'original_unchanged';

    return {
      strategy: input.strategy,
      filters: input.filters ?? null,
      ...buildTraceMetadataCanonicalSurface({
        routeDecision: input.routeDecision,
        executionPlan: buildTraceExecutionPlan({
          routeType: input.routeDecision.routeType,
          routeReason: input.routeDecision.routeReason
        })
      }),
      queryRewrite: {
        enabled: input.strategy.queryRewrite.enabled,
        applied: rewriteApplied,
        finalQuerySource: retrievalQuerySource,
        skippedReason: input.rewriteSkippedReason,
        usedFallback: input.strategy.queryRewrite.enabled
          ? input.rewriteUsedFallback
          : null,
        modelName: input.strategy.queryRewrite.enabled
          ? input.rewriteModelName
          : null,
        promptId: input.strategy.queryRewrite.enabled
          ? input.rewritePromptId
          : null
      },
      strategySummary: {
        retrievalMode: null,
        strategyMode: input.strategy.candidateSelection.mode,
        retrievalQuerySource,
        rewriteEnabled: input.strategy.queryRewrite.enabled,
        rewriteApplied,
        rewriteSkippedReason: input.rewriteSkippedReason,
        rewriteUsedFallback: input.strategy.queryRewrite.enabled
          ? input.rewriteUsedFallback
          : null,
        rewritePromptId: input.strategy.queryRewrite.enabled
          ? input.rewritePromptId
          : null,
        rewriteModelName: input.strategy.queryRewrite.enabled
          ? input.rewriteModelName
          : null,
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
    failure: { stage: 'answering'; message: string }
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
    if (
      typeof answeringMetadata !== 'object' ||
      answeringMetadata == null ||
      Array.isArray(answeringMetadata)
    ) {
      return answeringMetadata == null
        ? undefined
        : (answeringMetadata as Prisma.InputJsonValue);
    }

    return {
      ...(answeringMetadata as Record<string, unknown>),
      promptSnapshot
    } as Prisma.InputJsonValue;
  }
}
