import { Injectable, NotFoundException } from "@nestjs/common";
import { ConversationStatus } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  listConversations() {
    return this.prisma.conversation.findMany({
      orderBy: {
        updatedAt: "desc"
      }
    });
  }

  async getConversation(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
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

