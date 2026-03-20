import { Injectable } from "@nestjs/common";
import { MessageRole } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  listConversationMessages(conversationId: string) {
    return this.prisma.message.findMany({
      where: {
        conversationId
      },
      orderBy: {
        createdAt: "asc"
      }
    });
  }

  createMessage(input: { conversationId: string; role: MessageRole; content: string; traceId?: string }) {
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

