import { Injectable } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import type { RequestAuthContext } from '../auth/auth-identity.contract';
import { AskAssistantService } from '../assistants/ask-assistant.service';
import {
  resolveAskRouteDecision,
  type AskRouteDecision
} from '../assistants/ask-route-decision';

type LangGraphAnswerInput = {
  assistantId: string;
  question: string;
  conversationId?: string;
  authContext: RequestAuthContext;
  boundedMultiStep?: {
    enabled?: boolean;
    rewrittenQuery?: string;
    requestSecondPass?: boolean;
  };
};

type LangGraphStepStatus = 'completed' | 'skipped';

export type LangGraphAnswerStep = {
  name: string;
  toolName: string | null;
  status: LangGraphStepStatus;
  summary: string;
  diagnostics?: Record<string, unknown>;
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

  constructor(private readonly askAssistantService: AskAssistantService) {
    this.tools = this.buildTools();
    const graphBuilder = new StateGraph(LangGraphAnswerState)
      .addNode('route_question', async (state) => {
        const routeDecision = resolveAskRouteDecision(state.question);
        return {
          routeDecision,
          steps: [
            {
              name: 'route_question',
              toolName: null,
              status: 'completed' as const,
              summary: `selected ${routeDecision.routeType}`,
              diagnostics: {
                routeType: routeDecision.routeType,
                routeReason: routeDecision.routeReason
              }
            }
          ]
        };
      })
      .addNode('run_primary_retrieval', async (state) => {
        if (state.routeDecision?.routeType !== 'knowledge_base') {
          return {
            primarySearchResult: null,
            steps: [
              {
                name: 'run_primary_retrieval',
                toolName: 'rag_search',
                status: 'skipped' as const,
                summary: 'primary retrieval skipped for non-KB route'
              }
            ]
          };
        }

        const primarySearchResult = await this.tools.ragSearch.invoke({
          assistantId: state.assistantId,
          question: state.question,
          authContext: state.authContext
        });
        return {
          primarySearchResult,
          steps: [
            {
              name: 'run_primary_retrieval',
              toolName: 'rag_search',
              status: 'completed' as const,
              summary: `retrieved ${primarySearchResult.chunks.length} chunks`,
              diagnostics: this.buildRetrievalStepDiagnostics({
                pass: 'first_pass',
                searchResult: primarySearchResult,
                requestedQuestion: state.question
              })
            }
          ]
        };
      })
      .addNode('judge_missing_information', async (state) => {
        const secondPassQuery = this.resolveSecondPassQuery({
          originalQuestion: state.question,
          boundedMultiStep: state.boundedMultiStep,
          primarySearchResult: state.primarySearchResult
        });
        return {
          secondPassQuery,
          steps: [
            {
              name: 'judge_missing_information',
              toolName: null,
              status: 'completed' as const,
              summary:
                secondPassQuery == null
                  ? 'second pass not needed'
                  : 'second pass query selected',
              diagnostics: {
                secondPassQuery,
                requested:
                  state.boundedMultiStep?.enabled === true ||
                  state.boundedMultiStep?.requestSecondPass === true ||
                  this.readString(state.boundedMultiStep?.rewrittenQuery) !=
                    null
              }
            }
          ]
        };
      })
      .addNode('run_second_pass', async (state) => {
        if (state.secondPassQuery == null) {
          return {
            secondPassResult: null,
            steps: [
              {
                name: 'run_second_pass',
                toolName: 'rag_search',
                status: 'skipped' as const,
                summary: 'second pass skipped'
              }
            ]
          };
        }

        const secondPassResult = await this.tools.ragSearch.invoke({
          assistantId: state.assistantId,
          question: state.secondPassQuery,
          authContext: state.authContext
        });
        return {
          secondPassResult,
          steps: [
            {
              name: 'run_second_pass',
              toolName: 'rag_search',
              status: 'completed' as const,
              summary: `retrieved ${secondPassResult.chunks.length} chunks`,
              diagnostics: this.buildRetrievalStepDiagnostics({
                pass: 'second_pass',
                searchResult: secondPassResult,
                requestedQuestion: state.secondPassQuery
              })
            }
          ]
        };
      })
      .addNode('finalize_answer', async (state) => {
        const answerResult = await this.tools.ragAnswer.invoke({
          assistantId: state.assistantId,
          question: state.question,
          conversationId: state.conversationId ?? undefined,
          authContext: state.authContext
        });
        return {
          answerResult,
          steps: [
            {
              name: 'finalize_answer',
              toolName: 'rag_answer',
              status: 'completed' as const,
              summary: 'answer finalized',
              diagnostics: {
                routeType: this.readStringFromRecord(answerResult, 'routeType'),
                answerStatus: this.readStringFromRecord(
                  answerResult,
                  'answerStatus'
                ),
                traceId: this.readStringFromRecord(answerResult, 'traceId'),
                mergedRetrieval:
                  state.primarySearchResult == null
                    ? null
                    : this.buildMergedRetrievalDiagnostics(
                        state.primarySearchResult,
                        state.secondPassResult
                      )
              }
            }
          ]
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
    const result = await this.graph.invoke({
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
    });

    return {
      answerResult: result.answerResult,
      routeDecision: result.routeDecision,
      primarySearchResult: result.primarySearchResult,
      secondPassResult: result.secondPassResult,
      secondPassQuery: result.secondPassQuery,
      steps: result.steps
    };
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
            authContext: z.custom<RequestAuthContext>()
          })
        }
      ),
      ragAnswer: tool(
        async (input) =>
          this.askAssistantService.askAssistant({
            assistantId: input.assistantId,
            question: input.question,
            conversationId: input.conversationId,
            authContext: input.authContext
          }),
        {
          name: 'rag_answer',
          description: 'Run the existing RAG answer path.',
          schema: z.object({
            assistantId: z.string().min(1),
            question: z.string().min(1),
            conversationId: z.string().min(1).optional(),
            authContext: z.custom<RequestAuthContext>()
          })
        }
      )
    };
  }

  private resolveSecondPassQuery(input: {
    originalQuestion: string;
    boundedMultiStep?: LangGraphAnswerInput['boundedMultiStep'];
    primarySearchResult: AssistantSearchResult | null;
  }) {
    const explicitQuery = this.readString(
      input.boundedMultiStep?.rewrittenQuery
    );
    const firstPassRewrittenQuery = this.readString(
      input.primarySearchResult?.query.rewritten
    );
    const firstPassQuery = this.readString(
      input.primarySearchResult?.query.retrieval
    );
    const candidateQuery = explicitQuery ?? firstPassRewrittenQuery;

    if (candidateQuery == null) {
      return null;
    }

    if (
      candidateQuery === input.originalQuestion ||
      candidateQuery === firstPassQuery
    ) {
      return null;
    }

    return candidateQuery;
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

  private buildMergedRetrievalDiagnostics(
    primarySearchResult: AssistantSearchResult,
    secondPassResult: AssistantSearchResult | null
  ) {
    const mergedChunks = this.mergeChunks(
      primarySearchResult.chunks,
      secondPassResult?.chunks ?? []
    );
    const mergedContextGroups = this.mergeContextGroups(
      primarySearchResult.contextGroups,
      secondPassResult?.contextGroups ?? []
    );

    return {
      chunkCount: mergedChunks.length,
      sourceCount: mergedContextGroups.length,
      chunkIds: mergedChunks.map((chunk) => chunk.chunkId),
      documentIds: mergedContextGroups.map((group) => group.documentId)
    };
  }

  private mergeChunks<T extends { chunkId: string }>(first: T[], second: T[]) {
    const seen = new Set<string>();
    return [...first, ...second].filter((chunk) => {
      if (seen.has(chunk.chunkId)) {
        return false;
      }
      seen.add(chunk.chunkId);
      return true;
    });
  }

  private mergeContextGroups<
    T extends {
      documentId: string;
      startChunkIndex: number;
      endChunkIndex: number;
      chunkIds: string[];
    }
  >(first: T[], second: T[]) {
    const seen = new Set<string>();
    return [...first, ...second].filter((group) => {
      const key = [
        group.documentId,
        group.startChunkIndex,
        group.endChunkIndex,
        ...group.chunkIds
      ].join(':');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private readStringFromRecord(value: unknown, key: string) {
    if (typeof value !== 'object' || value == null) {
      return null;
    }
    return this.readString((value as Record<string, unknown>)[key]);
  }
}
