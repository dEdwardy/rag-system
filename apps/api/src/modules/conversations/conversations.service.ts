import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaultOrderBy = {
    updatedAt: 'desc' as const
  };

  private readonly conversationListSelect = {
    id: true,
    tenantId: true,
    userId: true,
    assistantId: true,
    title: true,
    status: true,
    createdAt: true,
    updatedAt: true
  } as const;

  private buildConversationWhere(scope: { tenantId: string; userId: string }) {
    return {
      tenantId: scope.tenantId,
      userId: scope.userId,
      status: ConversationStatus.active
    };
  }

  listConversations(scope: { tenantId: string; userId: string }) {
    return this.prisma.conversation.findMany({
      select: this.conversationListSelect,
      where: this.buildConversationWhere(scope),
      orderBy: this.defaultOrderBy
    });
  }

  async listPagedConversations(
    scope: { tenantId: string; userId: string },
    input: { page: number; limit: number }
  ) {
    const where = this.buildConversationWhere(scope);
    const skip = (input.page - 1) * input.limit;
    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        select: this.conversationListSelect,
        where,
        orderBy: this.defaultOrderBy,
        skip,
        take: input.limit
      }),
      this.prisma.conversation.count({ where })
    ]);

    return {
      items,
      total,
      page: input.page,
      pageSize: input.limit,
      totalPages: Math.max(1, Math.ceil(total / input.limit))
    };
  }

  async getConversation(
    id: string,
    scope: { tenantId: string; userId: string }
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: this.conversationListSelect
    });

    if (
      !conversation ||
      conversation.tenantId !== scope.tenantId ||
      conversation.userId !== scope.userId
    ) {
      throw new NotFoundException(`Conversation ${id} not found.`);
    }

    return conversation;
  }

  createConversation(input: {
    tenantId: string;
    userId: string;
    assistantId: string;
    title: string;
  }) {
    return this.prisma.conversation.create({
      data: {
        ...input,
        status: ConversationStatus.active
      }
    });
  }

  async updateConversation(
    id: string,
    scope: { tenantId: string; userId: string },
    input: { title?: string; status?: ConversationStatus }
  ) {
    await this.getConversation(id, scope);

    return this.prisma.conversation.update({
      where: { id },
      data: {
        ...(input.title != null ? { title: input.title.trim() } : {}),
        ...(input.status != null ? { status: input.status } : {})
      },
      select: this.conversationListSelect
    });
  }

  async deleteConversation(
    id: string,
    scope: { tenantId: string; userId: string }
  ) {
    await this.getConversation(id, scope);

    return this.prisma.conversation.update({
      where: { id },
      data: {
        status: ConversationStatus.archived
      },
      select: this.conversationListSelect
    });
  }

  async touchConversation(
    id: string,
    scope: { tenantId: string; userId: string }
  ) {
    if (typeof this.prisma.conversation.updateMany !== 'function') {
      await this.getConversation(id, scope);
      return this.prisma.conversation.update({
        where: { id },
        data: {
          updatedAt: new Date()
        }
      });
    }

    const updateResult = await this.prisma.conversation.updateMany({
      where: {
        id,
        tenantId: scope.tenantId,
        userId: scope.userId
      },
      data: {
        updatedAt: new Date()
      }
    });

    if (updateResult.count === 0) {
      throw new NotFoundException(`Conversation ${id} not found.`);
    }

    return updateResult;
  }
}
