import { Injectable, Optional } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { AgentStep as SharedAgentStep } from '@rag-system/shared';
import { z } from 'zod';
import type { RequestAuthContext } from '../auth/auth-identity.contract';
import { AskAssistantService } from '../assistants/ask-assistant.service';
import type { AskRouteDecision } from '../assistants/ask-route-decision';
import {
  AskRouteClassifier,
  resolveAskRouteDecisionWithLlm
} from '../assistants/ask-route-classifier';
import {
  buildRetrievalEvidence,
  resolveSecondPassDecision
} from '../assistants/retrieval-evidence';

type LangGraphAnswerInput = {
  assistantId: string;
  question: string;
  conversationId?: string;
  authContext: RequestAuthContext;
  boundedMultiStep?: {
    enabled?: boolean;
    rewrittenQuery?: string;
    suggestedQuery?: string;
    requestSecondPass?: boolean;
  };
  signal?: AbortSignal;
  onEvent?: (event: Record<string, unknown>) => void | Promise<void>;
};

export type LangGraphAnswerStep = SharedAgentStep & {
  diagnostics?: Record<string, unknown>;
};

type LangGraphRunnableConfig = {
  configurable?: {
    onEvent?: (event: Record<string, unknown>) => void | Promise<void>;
    signal?: AbortSignal;
  };
};

type AssistantSearchResult = Awaited<
  ReturnType<AskAssistantService['searchAssistant']>
>;

type AssistantAnswerResult = Awaited<
  ReturnType<AskAssistantService['askAssistant']>
>;

const LangGraphAnswerState = Annotation.Root({
  assistantId: Annotation<string>(),
  question: Annotation<string>(),
  conversationId: Annotation<string | null>(),
  authContext: Annotation<RequestAuthContext>(),
  boundedMultiStep: Annotation<LangGraphAnswerInput['boundedMultiStep']>(),
  routeDecision: Annotation<AskRouteDecision | null>(),
  primarySearchResult: Annotation<AssistantSearchResult | null>(),
  secondPassQuery: Annotation<string | null>(),
  secondPassResult: Annotation<AssistantSearchResult | null>(),
  answerResult: Annotation<AssistantAnswerResult | null>(),
  steps: Annotation<LangGraphAnswerStep[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  })
});

@Injectable()
export class LangGraphAnswerService {
  private readonly graph;
  private readonly tools;

  constructor(
    private readonly askAssistantService: AskAssistantService,
    @Optional() private readonly routeClassifier?: AskRouteClassifier
  ) {
    this.tools = this.buildTools();
    const graphBuilder = new StateGraph(LangGraphAnswerState)
      .addNode('route_question', async (state, config) => {
        await this.emitLiveStep(config, {
          name: 'route_question',
          toolName: null,
          status: 'running',
          summary: 'classifying question'
        });
        const resolved = this.routeClassifier
          ? await this.routeClassifier.classify(state.question)
          : await resolveAskRouteDecisionWithLlm({
              question: state.question,
              complete: null
            });
        const step: LangGraphAnswerStep = {
          name: 'route_question',
          toolName: null,
          status: 'completed',
          summary: `selected ${resolved.decision.routeType}`,
          diagnostics: {
            routeType: resolved.decision.routeType,
            routeReason: resolved.decision.routeReason,
            routeSource: resolved.source,
            routeDetail: resolved.detail
          }
        };
        await this.emitLiveStep(config, step);
        return {
          routeDecision: resolved.decision,
          steps: [step]
        };
      })
      .addNode('run_primary_retrieval', async (state, config) => {
        if (state.routeDecision?.routeType !== 'knowledge_base') {
          const step: LangGraphAnswerStep = {
            name: 'run_primary_retrieval',
            toolName: 'rag_search',
            status: 'skipped',
            summary: 'primary retrieval skipped for non-KB route'
          };
          await this.emitLiveStep(config, step);
          return {
            primarySearchResult: null,
            steps: [step]
          };
        }

        await this.emitLiveStep(config, {
          name: 'run_primary_retrieval',
          toolName: 'rag_search',
          status: 'running',
          summary: 'retrieving primary evidence'
        });
        const primarySearchResult = await this.tools.ragSearch.invoke({
          assistantId: state.assistantId,
          question: state.question,
          conversationId: state.conversationId ?? undefined,
          authContext: state.authContext
        });
        const step: LangGraphAnswerStep = {
          name: 'run_primary_retrieval',
          toolName: 'rag_search',
          status: 'completed',
          summary: `retrieved ${primarySearchResult.chunks.length} chunks`,
          diagnostics: this.buildRetrievalStepDiagnostics({
            pass: 'first_pass',
            searchResult: primarySearchResult,
            requestedQuestion: state.question
          })
        };
        await this.emitLiveStep(config, step);
        return {
          primarySearchResult,
          steps: [step]
        };
      })
      .addNode('judge_missing_information', async (state, config) => {
        await this.emitLiveStep(config, {
          name: 'judge_missing_information',
          toolName: null,
          status: 'running',
          summary: 'checking evidence gaps'
        });
        const suggestedQuery =
          await this.resolveSuggestedSecondPassQuery(state);
        const boundedMultiStep =
          suggestedQuery == null
            ? state.boundedMultiStep
            : {
                ...state.boundedMultiStep,
                enabled: true,
                suggestedQuery
              };
        const decision = resolveSecondPassDecision({
          originalQuestion: state.question,
          boundedMultiStep,
          primary: state.primarySearchResult
        });
        const step: LangGraphAnswerStep = {
          name: 'judge_missing_information',
          toolName: null,
          status: 'completed',
          summary:
            decision.query == null
              ? 'second pass not needed'
              : 'second pass query selected',
          diagnostics: {
            secondPassQuery: decision.query,
            secondPassReason: decision.reason,
            suggestedQuery,
            requested: decision.requested,
            evidenceSufficient: decision.evidenceSufficient,
            evidenceReasons: decision.evidenceReasons,
            firstPassChunkCount: state.primarySearchResult?.chunks.length ?? 0,
            firstPassSourceCount:
              state.primarySearchResult?.contextGroups.length ?? 0,
            firstPassTopScore:
              state.primarySearchResult?.chunks[0]?.score ?? null
          }
        };
        await this.emitLiveStep(config, step);
        return {
          secondPassQuery: decision.query,
          steps: [step]
        };
      })
      .addNode('run_second_pass', async (state, config) => {
        if (state.secondPassQuery == null) {
          const step: LangGraphAnswerStep = {
            name: 'run_second_pass',
            toolName: 'rag_search',
            status: 'skipped',
            summary: 'second pass skipped'
          };
          await this.emitLiveStep(config, step);
          return {
            secondPassResult: null,
            steps: [step]
          };
        }

        await this.emitLiveStep(config, {
          name: 'run_second_pass',
          toolName: 'rag_search',
          status: 'running',
          summary: 'running second retrieval pass'
        });
        const secondPassResult = await this.tools.ragSearch.invoke({
          assistantId: state.assistantId,
          question: state.secondPassQuery,
          conversationId: state.conversationId ?? undefined,
          authContext: state.authContext
        });
        const step: LangGraphAnswerStep = {
          name: 'run_second_pass',
          toolName: 'rag_search',
          status: 'completed',
          summary: `retrieved ${secondPassResult.chunks.length} chunks`,
          diagnostics: this.buildRetrievalStepDiagnostics({
            pass: 'second_pass',
            searchResult: secondPassResult,
            requestedQuestion: state.secondPassQuery
          })
        };
        await this.emitLiveStep(config, step);
        return {
          secondPassResult,
          steps: [step]
        };
      })
      .addNode('finalize_answer', async (state, config) => {
        const retrievalEvidence =
          state.primarySearchResult == null
            ? null
            : buildRetrievalEvidence({
                primary: state.primarySearchResult,
                secondary: state.secondPassResult
              });
        const step: LangGraphAnswerStep = {
          name: 'finalize_answer',
          toolName: 'rag_answer',
          status: 'completed',
          summary: 'answer finalized from bounded evidence',
          diagnostics: {
            routeType: state.routeDecision?.routeType ?? null,
            mergedRetrieval:
              retrievalEvidence == null
                ? null
                : {
                    chunkCount: retrievalEvidence.retrievedChunks.length,
                    sourceCount: retrievalEvidence.contextGroups.length,
                    chunkIds: retrievalEvidence.retrievedChunks.map(
                      (chunk) => chunk.chunkId
                    ),
                    documentIds: retrievalEvidence.contextGroups.map(
                      (group) => group.documentId
                    )
                  }
          }
        };
        await this.emitLiveStep(config, {
          ...step,
          status: 'running',
          summary: 'finalizing answer'
        });
        const onEvent = this.readOnEvent(config);
        const answerResult =
          onEvent == null
            ? await this.askAssistantService.askAssistant({
                assistantId: state.assistantId,
                question: state.question,
                conversationId: state.conversationId ?? undefined,
                authContext: state.authContext,
                routeDecision: state.routeDecision ?? undefined,
                ...(retrievalEvidence == null ? {} : { retrievalEvidence })
              })
            : await this.askAssistantService.askAssistantStream({
                assistantId: state.assistantId,
                question: state.question,
                conversationId: state.conversationId ?? undefined,
                authContext: state.authContext,
                routeDecision: state.routeDecision ?? undefined,
                retrievalEvidence,
                agentExecution: {
                  routeDecision: state.routeDecision,
                  steps: [...state.steps, step]
                },
                signal: this.readSignal(config),
                onEvent
              });
        await this.emitLiveStep(config, step);
        return {
          answerResult,
          steps: [step]
        };
      })
      .addEdge(START, 'route_question')
      .addEdge('route_question', 'run_primary_retrieval')
      .addEdge('run_primary_retrieval', 'judge_missing_information')
      .addEdge('judge_missing_information', 'run_second_pass')
      .addEdge('run_second_pass', 'finalize_answer')
      .addEdge('finalize_answer', END);

    this.graph = graphBuilder.compile();
  }

  async answer(input: LangGraphAnswerInput) {
    const result = await this.graph.invoke(this.buildInitialState(input));
    return this.normalizeResult(result);
  }

  async answerStream(input: LangGraphAnswerInput) {
    const result = await this.graph.invoke(this.buildInitialState(input), {
      configurable: {
        onEvent: input.onEvent,
        signal: input.signal
      }
    });
    return this.normalizeResult(result);
  }

  private buildInitialState(input: LangGraphAnswerInput) {
    return {
      assistantId: input.assistantId,
      question: input.question,
      conversationId: input.conversationId ?? null,
      authContext: input.authContext,
      boundedMultiStep: input.boundedMultiStep,
      routeDecision: null,
      primarySearchResult: null,
      secondPassQuery: null,
      secondPassResult: null,
      answerResult: null,
      steps: []
    };
  }

  private normalizeResult(result: {
    answerResult: AssistantAnswerResult | null;
    routeDecision: AskRouteDecision | null;
    primarySearchResult: AssistantSearchResult | null;
    secondPassResult: AssistantSearchResult | null;
    secondPassQuery: string | null;
    steps: LangGraphAnswerStep[];
  }) {
    return {
      answerResult: result.answerResult,
      routeDecision: result.routeDecision,
      primarySearchResult: result.primarySearchResult,
      secondPassResult: result.secondPassResult,
      secondPassQuery: result.secondPassQuery,
      steps: result.steps
    };
  }

  private async resolveSuggestedSecondPassQuery(state: {
    routeDecision: AskRouteDecision | null;
    question: string;
    conversationId: string | null;
    authContext: RequestAuthContext;
    primarySearchResult: AssistantSearchResult | null;
    boundedMultiStep: LangGraphAnswerInput['boundedMultiStep'];
  }) {
    if (state.routeDecision?.routeType !== 'knowledge_base') {
      return null;
    }

    if (
      state.boundedMultiStep?.rewrittenQuery != null ||
      state.boundedMultiStep?.suggestedQuery != null
    ) {
      return null;
    }

    const suggest = this.askAssistantService.suggestAgentSecondPassQuery;
    if (typeof suggest !== 'function') {
      return null;
    }

    return suggest.call(this.askAssistantService, {
      question: state.question,
      conversationId: state.conversationId ?? undefined,
      authContext: state.authContext,
      primary: state.primarySearchResult
    });
  }

  private readOnEvent(config: LangGraphRunnableConfig | undefined) {
    return config?.configurable?.onEvent ?? null;
  }

  private readSignal(config: LangGraphRunnableConfig | undefined) {
    return config?.configurable?.signal;
  }

  private async emitLiveStep(
    config: LangGraphRunnableConfig | undefined,
    step: LangGraphAnswerStep
  ) {
    const onEvent = this.readOnEvent(config);
    if (onEvent == null) {
      return;
    }

    await onEvent({
      type: 'step',
      step
    });
  }

  private buildTools() {
    return {
      ragSearch: tool(
        async (input) =>
          this.askAssistantService.searchAssistant({
            assistantId: input.assistantId,
            question: input.question,
            authContext: input.authContext
          }),
        {
          name: 'rag_search',
          description: 'Run the existing bounded RAG retrieval path.',
          schema: z.object({
            assistantId: z.string().min(1),
            question: z.string().min(1),
            conversationId: z.string().optional(),
            authContext: z.custom<RequestAuthContext>()
          })
        }
      )
    };
  }

  private readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private buildRetrievalStepDiagnostics(input: {
    pass: 'first_pass' | 'second_pass';
    searchResult: AssistantSearchResult;
    requestedQuestion: string | null;
  }) {
    return {
      pass: input.pass,
      requestedQuestion: input.requestedQuestion,
      query: {
        original: this.readString(input.searchResult.query.original),
        retrieval: this.readString(input.searchResult.query.retrieval),
        rewritten: this.readString(input.searchResult.query.rewritten)
      },
      chunkCount: input.searchResult.chunks.length,
      sourceCount: input.searchResult.contextGroups.length,
      chunkIds: input.searchResult.chunks.map((chunk) => chunk.chunkId),
      documentIds: input.searchResult.contextGroups.map(
        (group) => group.documentId
      ),
      strategySummary: input.searchResult.diagnostics?.strategySummary ?? null,
      execution: input.searchResult.diagnostics?.execution ?? null,
      profile: input.searchResult.diagnostics?.profile ?? null
    };
  }

  private readStringFromRecord(value: unknown, key: string) {
    if (typeof value !== 'object' || value == null) {
      return null;
    }
    return this.readString((value as Record<string, unknown>)[key]);
  }
}
