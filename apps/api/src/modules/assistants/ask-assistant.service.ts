import { Injectable } from "@nestjs/common";
import { MessageRole, Prisma, TraceStatus } from "@prisma/client";
import { LlmService } from "../../infra/llm/llm.service";
import { AnsweringService } from "../answering/answering.service";
import { ConversationsService } from "../conversations/conversations.service";
import { MessagesService } from "../messages/messages.service";
import { RetrievalService } from "../retrieval/retrieval.service";
import { retrievalProfileFiltersSchema } from "../retrieval-profiles/retrieval-profile.schemas";
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
    const rewritten = await this.llmService.rewriteQuery({
      question: input.question
    });
    const retrievalQuery = rewritten.rewrittenQuery || input.question;
    const retrievalFilters = retrievalProfileFiltersSchema.optional().parse(
      assistant.retrievalProfile.filtersJson ?? undefined
    );
    const answerPolicy = answerPolicySchema.nullable().optional().parse(assistant.answerPolicyJson ?? undefined) ?? undefined;
    const retrievalResult = await this.retrievalService.retrieve({
      kbId: assistant.kbId,
      query: retrievalQuery,
      topK: assistant.retrievalProfile.topK,
      scoreThreshold: assistant.retrievalProfile.scoreThreshold,
      chunkWindow: assistant.retrievalProfile.chunkWindow,
      enableHybrid: assistant.retrievalProfile.enableHybrid,
      enableRerank: assistant.retrievalProfile.enableRerank,
      filters: retrievalFilters
    });
    const retrievedChunks = retrievalResult.retrievedChunks;
    const contextGroups = retrievalResult.contextGroups;
    const retrievalScoresJson = this.buildRetrievalScoresJson(retrievedChunks);

    const trace = await this.tracesService.createTrace({
      conversationId: conversation.id,
      assistantId: assistant.id,
      userMessageId: userMessage.id,
      userQuery: input.question,
      rewrittenQuery: retrievalQuery !== input.question ? retrievalQuery : null,
      retrievedChunkIdsJson: retrievedChunks.map(chunk => chunk.chunkId),
      retrievalScoresJson,
      modelName: rewritten.modelName,
      status: TraceStatus.success
    });
    try {
      const resolvedAnswerResult = await this.answeringService.generateAnswer({
        question: input.question,
        systemPrompt: assistant.systemPrompt,
        answerPolicy,
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
        modelName: resolvedAnswerResult.modelName,
        answerStatus: resolvedAnswerResult.answerStatus,
        missingInformation: resolvedAnswerResult.missingInformation
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown ask pipeline error.";
      await this.tracesService.updateTrace(trace.id, {
        latencyMs: Date.now() - startedAt,
        modelName: rewritten.modelName,
        rewrittenQuery: retrievalQuery !== input.question ? retrievalQuery : null,
        retrievedChunkIdsJson: retrievedChunks.map(chunk => chunk.chunkId),
        retrievalScoresJson,
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
}
