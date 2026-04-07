import { Injectable, NotFoundException } from "@nestjs/common";
import { ConversationStatus } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaultOrderBy = {
    updatedAt: "desc" as const
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

  listConversations(scope: { tenantId: string; userId: string }) {
    return this.prisma.conversation.findMany({
      select: this.conversationListSelect,
      where: {
        tenantId: scope.tenantId,
        userId: scope.userId
      },
      orderBy: this.defaultOrderBy
    });
  }

  async getConversation(id: string, scope: { tenantId: string; userId: string }) {
    const conversation = await this.prisma.conversation.findFirst({
      select: this.conversationListSelect,
      where: {
        id,
        tenantId: scope.tenantId,
        userId: scope.userId
      }
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found.`);
    }

    return conversation;
  }

  createConversation(input: { tenantId: string; userId: string; assistantId: string; title: string }) {
    return this.prisma.conversation.create({
      data: {
        ...input,
        status: ConversationStatus.active
      }
    });
  }

  async touchConversation(id: string, scope: { tenantId: string; userId: string }) {
    if (typeof this.prisma.conversation.updateMany !== "function") {
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
