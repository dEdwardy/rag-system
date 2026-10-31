import { Injectable, Logger } from '@nestjs/common';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { RequestAuthContext } from '../auth/auth-identity.contract';
import { AskAssistantService } from '../assistants/ask-assistant.service';
import { LlmService } from '../../infra/llm/llm.service';
import { LlmToolCallingUnavailableError } from '../../infra/llm/tool-calling';
import type {
  LlmChatMessage,
  LlmToolCall,
  LlmToolDefinition
} from '../../infra/llm/llm.types';

export const AGENT_LOOP_MAX_ITERATIONS = 3;
export const AGENT_LOOP_MAX_EVIDENCE_CHUNKS = 6;
export const AGENT_LOOP_TOOL_TIMEOUT_MS = 20_000;

const MAX_SNIPPET_CHARS = 240;
const MAX_SNIPPETS_PER_SEARCH = 3;

export type AgentLoopStep = {
  name: string;
  toolName: string | null;
  status: 'completed' | 'skipped';
  summary: string;
  diagnostics?: Record<string, unknown>;
};

type AssistantSearchResult = Awaited<
  ReturnType<AskAssistantService['searchAssistant']>
>;
type AssistantAnswerResult = Awaited<
  ReturnType<AskAssistantService['askAssistant']>
>;

const AgentLoopState = Annotation.Root({
  assistantId: Annotation<string>(),
  question: Annotation<string>(),
  conversationId: Annotation<string | null>(),
  authContext: Annotation<RequestAuthContext>(),
  messages: Annotation<LlmChatMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  }),
  toolCalls: Annotation<LlmToolCall[]>({
    reducer: (_left, right) => right,
    default: () => []
  }),
  iterations: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0
  }),
  searchedQueries: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  }),
  retrievedChunkCount: Annotation<number>({
    reducer: (left, right) => left + right,
    default: () => 0
  }),
  planUnavailableReason: Annotation<string | null>({
    reducer: (_left, right) => right,
    default: () => null
  }),
  answerResult: Annotation<AssistantAnswerResult | null>({
    reducer: (_left, right) => right,
    default: () => null
  }),
  steps: Annotation<AgentLoopStep[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  })
});

const RAG_SEARCH_TOOL: LlmToolDefinition = {
  name: 'rag_search',
  description:
    'Search the knowledge base and return the most relevant chunks with their source titles.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'A focused retrieval query derived from the user question.'
      }
    },
    required: ['query'],
    additionalProperties: false
  }
};

const PLANNER_SYSTEM_PROMPT = `You plan retrieval for a knowledge-base assistant.
Call rag_search to gather evidence, then stop calling tools once the evidence is sufficient.
Rules:
- The planner runs at most ${AGENT_LOOP_MAX_ITERATIONS} turns, which allows at most two searches.
- Never repeat a query you already ran.
- Do not repeat the user question verbatim if it contains no useful keywords.
- When you stop, reply with one short sentence describing what you found.
- Never invent document content; only the tool provides evidence.`;

@Injectable()
export class LangGraphAgentLoopService {
  private readonly logger = new Logger(LangGraphAgentLoopService.name);
  private readonly graph;

  constructor(
    private readonly askAssistantService: AskAssistantService,
    private readonly llmService: LlmService
  ) {
    this.graph = this.buildGraph();
  }

  async answer(input: {
    assistantId: string;
    question: string;
    conversationId?: string;
    authContext: RequestAuthContext;
  }) {
    const result = await this.graph.invoke({
      assistantId: input.assistantId,
      question: input.question,
      conversationId: input.conversationId ?? null,
      authContext: input.authContext,
      messages: [],
      toolCalls: [],
      iterations: 0,
      searchedQueries: [],
      retrievedChunkCount: 0,
      planUnavailableReason: null,
      answerResult: null,
      steps: []
    });

    return {
      answerResult: result.answerResult,
      steps: result.steps,
      iterations: result.iterations,
      searchedQueries: result.searchedQueries,
      retrievedChunkCount: result.retrievedChunkCount,
      planUnavailableReason: result.planUnavailableReason
    };
  }

  private buildGraph() {
    return new StateGraph(AgentLoopState)
      .addNode('plan', async (state) => {
        const messages =
          state.iterations === 0 ? this.buildInitialMessages(state.question) : state.messages;

        const abortController = new AbortController();

        try {
          const completion = await this.llmService.generateWithTools({
            messages,
            tools: [RAG_SEARCH_TOOL],
            temperature: 0,
            signal: abortController.signal
          });

          const assistantMessage: LlmChatMessage = {
            role: 'assistant',
            content: completion.content,
            toolCalls: completion.toolCalls
          };

          return {
            messages: [...messages, assistantMessage],
            toolCalls: completion.toolCalls,
            iterations: state.iterations + 1,
            planUnavailableReason: null,
            steps: [
              {
                name: 'plan',
                toolName: null,
                status: 'completed' as const,
                summary:
                  completion.toolCalls.length === 0
                    ? 'model stopped requesting tools'
                    : `model requested ${completion.toolCalls.map((call) => call.name).join(', ')}`,
                diagnostics: {
                  modelName: completion.modelName,
                  toolCallCount: completion.toolCalls.length,
                  iteration: state.iterations + 1
                }
              }
            ]
          };
        } catch (error) {
          const reason =
            error instanceof LlmToolCallingUnavailableError
              ? 'tool_calling_unavailable'
              : error instanceof Error
                ? error.message.slice(0, 160)
                : 'unknown_error';

          this.logger.warn(`Agent loop plan step failed: ${reason}`);

          return {
            messages,
            toolCalls: [],
            iterations: state.iterations + 1,
            planUnavailableReason: reason,
            steps: [
              {
                name: 'plan',
                toolName: null,
                status: 'skipped' as const,
                summary: 'planner unavailable; finalizing through the default answer path',
                diagnostics: { reason }
              }
            ]
          };
        }
      })
      .addNode('act', async (state) => {
        const messages: LlmChatMessage[] = [];
        const steps: AgentLoopStep[] = [];
        const executedQueries: string[] = [];
        let chunkDelta = 0;

        for (const toolCall of state.toolCalls) {
          const guardReason = this.resolveToolGuardReason({
            toolCall,
            state
          });

          if (guardReason != null) {
            messages.push({
              role: 'tool',
              toolCallId: toolCall.id,
              name: toolCall.name,
              content: JSON.stringify({ skipped: true, reason: guardReason })
            });
            steps.push({
              name: 'act',
              toolName: toolCall.name,
              status: 'skipped' as const,
              summary: `skipped tool call: ${guardReason}`,
              diagnostics: { reason: guardReason, toolCallId: toolCall.id }
            });
            continue;
          }

          const query = this.readQuery(toolCall, state.question);
          const searchResult = await this.runToolWithTimeout(() =>
            this.askAssistantService.searchAssistant({
              assistantId: state.assistantId,
              question: query,
              authContext: state.authContext
            })
          );

          const chunkCount = searchResult.chunks.length;
          chunkDelta += chunkCount;
          executedQueries.push(query);

          messages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            name: toolCall.name,
            content: this.buildToolResultContent({
              query,
              searchResult
            })
          });

          steps.push({
            name: 'act',
            toolName: toolCall.name,
            status: 'completed' as const,
            summary: `retrieved ${chunkCount} chunks`,
            diagnostics: {
              query,
              chunkCount,
              sourceCount: searchResult.contextGroups.length,
              chunkIds: searchResult.chunks.map((chunk) => chunk.chunkId)
            }
          });
        }

        return {
          messages,
          toolCalls: [],
          searchedQueries: executedQueries,
          retrievedChunkCount: chunkDelta,
          steps
        };
      })
      .addNode('finalize', async (state) => {
        const answerResult = await this.askAssistantService.askAssistant({
          assistantId: state.assistantId,
          question: state.question,
          conversationId: state.conversationId ?? undefined,
          authContext: state.authContext
        });

        return {
          answerResult,
          steps: [
            {
              name: 'finalize',
              toolName: 'rag_answer',
              status: 'completed' as const,
              summary: 'answer finalized through the deterministic answer path',
              diagnostics: {
                iterations: state.iterations,
                searchedQueryCount: state.searchedQueries.length,
                retrievedChunkCount: state.retrievedChunkCount
              }
            }
          ]
        };
      })
      .addEdge(START, 'plan')
      .addConditionalEdges(
        'plan',
        (state: typeof AgentLoopState.State) => {
          if (state.toolCalls.length === 0) {
            return 'finalize';
          }

          if (state.iterations >= AGENT_LOOP_MAX_ITERATIONS) {
            return 'finalize';
          }

          return 'act';
        },
        { act: 'act', finalize: 'finalize' }
      )
      .addEdge('act', 'plan')
      .addEdge('finalize', END)
      .compile();
  }

  private buildInitialMessages(question: string): LlmChatMessage[] {
    return [
      { role: 'system', content: PLANNER_SYSTEM_PROMPT },
      { role: 'user', content: question }
    ];
  }

  /**
   * Guards run before any tool executes so a bad plan costs nothing:
   * unknown tools never run, repeats are refused, and further searching stops
   * once enough evidence is already in hand.
   */
  private resolveToolGuardReason(input: {
    toolCall: LlmToolCall;
    state: typeof AgentLoopState.State;
  }): string | null {
    if (input.toolCall.name !== RAG_SEARCH_TOOL.name) {
      return 'tool_not_allowed';
    }

    if (input.state.retrievedChunkCount >= AGENT_LOOP_MAX_EVIDENCE_CHUNKS) {
      return 'evidence_sufficient';
    }

    const query = this.readQuery(input.toolCall, input.state.question);
    if (input.state.searchedQueries.includes(query)) {
      return 'duplicate_query';
    }

    return null;
  }

  private readQuery(toolCall: LlmToolCall, fallbackQuestion: string): string {
    try {
      const parsed = JSON.parse(toolCall.argumentsJson) as { query?: unknown };
      if (typeof parsed.query === 'string' && parsed.query.trim().length > 0) {
        return parsed.query.trim();
      }
    } catch {
      // fall through to the original question
    }

    return fallbackQuestion;
  }

  private buildToolResultContent(input: {
    query: string;
    searchResult: AssistantSearchResult;
  }): string {
    return JSON.stringify({
      query: input.query,
      chunkCount: input.searchResult.chunks.length,
      sources: input.searchResult.contextGroups.map((group) => ({
        documentId: group.documentId,
        title: group.documentTitle
      })),
      snippets: input.searchResult.chunks
        .slice(0, MAX_SNIPPETS_PER_SEARCH)
        .map((chunk) => ({
          documentTitle: chunk.documentTitle,
          sectionTitle: chunk.sectionTitle,
          content: chunk.content.slice(0, MAX_SNIPPET_CHARS)
        }))
    });
  }

  private async runToolWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  `Agent tool timed out after ${AGENT_LOOP_TOOL_TIMEOUT_MS}ms`
                )
              ),
            AGENT_LOOP_TOOL_TIMEOUT_MS
          );
        })
      ]);
    } finally {
      if (timer != null) {
        clearTimeout(timer);
      }
    }
  }
}
