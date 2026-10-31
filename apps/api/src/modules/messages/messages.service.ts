import { Injectable } from '@nestjs/common';
import { MessageRole } from '@prisma/client';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly messageListSelect = {
    id: true,
    conversationId: true,
    role: true,
    content: true,
    traceId: true,
    createdAt: true
  } as const;

  private readonly reuseMessageListSelect = {
    id: true,
    role: true,
    content: true,
    traceId: true
  } as const;

  async listConversationMessages(
    conversationId: string,
    scope?: { tenantId: string; userId: string } | null
  ) {
    const messages = await this.prisma.message.findMany({
      select: this.messageListSelect,
      where: {
        conversationId,
        ...(scope == null
          ? {}
          : {
              conversation: {
                tenantId: scope.tenantId,
                userId: scope.userId
              }
            })
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return this.withTraceCitations(messages);
  }

  /**
   * Messages do not store citations themselves, so they are read back from the
   * answer trace. Without this the chat UI could not resolve the `[n]` markers
   * an answer carries once the conversation was reloaded from the server.
   */
  private async withTraceCitations<
    T extends { role: MessageRole; traceId: string | null }
  >(messages: T[]) {
    const traceIds = messages
      .filter(
        (message) =>
          message.role === MessageRole.assistant && message.traceId != null
      )
      .map((message) => message.traceId as string);

    if (traceIds.length === 0) {
      return messages;
    }

    const traces = await this.prisma.answerTrace.findMany({
      where: { id: { in: [...new Set(traceIds)] } },
      select: {
        id: true,
        citationsJson: true,
        answeringMetadataJson: true
      }
    });
    const citationsByTraceId = new Map<string, unknown[]>(
      traces.map((trace) => [
        trace.id,
        Array.isArray(trace.citationsJson)
          ? (trace.citationsJson as unknown[])
          : []
      ])
    );
    const agentStepsByTraceId = new Map<string, unknown[]>(
      traces.map((trace) => [
        trace.id,
        this.readAgentSteps(trace.answeringMetadataJson)
      ])
    );

    return messages.map((message) =>
      message.role === MessageRole.assistant && message.traceId != null
        ? {
            ...message,
            citations: citationsByTraceId.get(message.traceId) ?? [],
            agentSteps: agentStepsByTraceId.get(message.traceId) ?? []
          }
        : message
    );
  }

  private readAgentSteps(answeringMetadataJson: unknown) {
    if (
      typeof answeringMetadataJson !== 'object' ||
      answeringMetadataJson === null
    ) {
      return [];
    }

    const agentExecution = (answeringMetadataJson as Record<string, unknown>)
      .agentExecution;
    if (typeof agentExecution !== 'object' || agentExecution === null) {
      return [];
    }

    const steps = (agentExecution as Record<string, unknown>).steps;
    return Array.isArray(steps) ? steps : [];
  }

  async listRecentConversationMessages(
    conversationId: string,
    input: {
      limit: number;
      createdBefore?: Date;
    },
    scope?: { tenantId: string; userId: string } | null
  ) {
    const messages = await this.prisma.message.findMany({
      select: this.reuseMessageListSelect,
      where: {
        conversationId,
        ...(input.createdBefore == null
          ? {}
          : { createdAt: { lt: input.createdBefore } }),
        ...(scope == null
          ? {}
          : {
              conversation: {
                tenantId: scope.tenantId,
                userId: scope.userId
              }
            })
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: Math.max(1, input.limit)
    });

    return messages.slice().reverse();
  }

  listConversationMessagesForReuse(
    conversationId: string,
    scope?: { tenantId: string; userId: string } | null
  ) {
    return this.prisma.message.findMany({
      select: this.reuseMessageListSelect,
      where: {
        conversationId,
        ...(scope == null
          ? {}
          : {
              conversation: {
                tenantId: scope.tenantId,
                userId: scope.userId
              }
            })
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  createMessage(input: {
    conversationId: string;
    role: MessageRole;
    content: string;
    traceId?: string;
  }) {
    return this.prisma.message.create({
      data: input
    });
  }

  attachTrace(messageId: string, traceId: string) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: { traceId }
    });
  }
}
