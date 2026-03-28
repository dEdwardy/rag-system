import { Injectable, NotFoundException } from "@nestjs/common";
import { ConversationStatus } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaultOrderBy = {
    updatedAt: "desc" as const
  };

  listConversations(scope?: { tenantId: string; userId: string } | null) {
    return this.prisma.conversation.findMany({
      where:
        scope != null
          ? {
              tenantId: scope.tenantId,
              userId: scope.userId
            }
          : undefined,
      orderBy: this.defaultOrderBy
    });
  }

  async getConversation(id: string, scope?: { tenantId: string; userId: string } | null) {
    const conversation =
      scope != null
        ? await this.prisma.conversation.findFirst({
            where: {
              id,
              tenantId: scope.tenantId,
              userId: scope.userId
            }
          })
        : await this.prisma.conversation.findUnique({
            where: { id }
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

  touchConversation(id: string) {
    return this.prisma.conversation.update({
      where: { id },
      data: {
        updatedAt: new Date()
      }
    });
  }
}
