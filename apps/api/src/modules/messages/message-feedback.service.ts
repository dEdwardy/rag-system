import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { MessageRole } from '@prisma/client';
import type { MessageFeedbackRating } from '@rag-system/shared';
import { PrismaService } from '../../infra/database/prisma.service';
import type { AuthIdentity } from '../auth/auth-identity.contract';

@Injectable()
export class MessageFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submitFeedback(input: {
    messageId: string;
    rating: MessageFeedbackRating;
    reason?: string | null;
    comment?: string | null;
    identity: AuthIdentity;
  }) {
    const message = await this.prisma.message.findFirst({
      where: {
        id: input.messageId,
        conversation: {
          tenantId: input.identity.tenantId,
          userId: input.identity.userId
        }
      },
      select: {
        id: true,
        role: true,
        conversationId: true,
        traceId: true
      }
    });

    if (message == null) {
      throw new NotFoundException(
        `Message ${input.messageId} was not found for the current user.`
      );
    }

    if (message.role !== MessageRole.assistant) {
      throw new BadRequestException(
        'Feedback can only be submitted for assistant messages.'
      );
    }

    return this.prisma.messageFeedback.upsert({
      where: {
        messageId_ownerId: {
          messageId: message.id,
          ownerId: input.identity.userId
        }
      },
      create: {
        tenantId: input.identity.tenantId,
        ownerId: input.identity.userId,
        messageId: message.id,
        conversationId: message.conversationId,
        traceId: message.traceId,
        rating: input.rating,
        reason: input.reason ?? null,
        comment: input.comment ?? null
      },
      update: {
        rating: input.rating,
        reason: input.reason ?? null,
        comment: input.comment ?? null,
        traceId: message.traceId
      }
    });
  }
}
