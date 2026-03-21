import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TraceStatus } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";

@Injectable()
export class TracesService {
  constructor(private readonly prisma: PrismaService) {}

  getTrace(id: string) {
    return this.prisma.answerTrace.findUnique({
      where: { id }
    }).then((trace) => {
      if (!trace) {
        throw new NotFoundException(`Trace ${id} not found.`);
      }

      return trace;
    });
  }

  listConversationTraces(conversationId: string) {
    return this.prisma.answerTrace.findMany({
      where: { conversationId },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  createTrace(input: {
    conversationId: string;
    assistantId: string;
    userMessageId?: string;
    assistantMessageId?: string;
    userQuery: string;
    rewrittenQuery?: string | null;
    retrievedChunkIdsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    retrievalScoresJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    citationsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    qualityEvaluationJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    modelName?: string;
    latencyMs?: number;
    status: TraceStatus;
    errorMessage?: string;
  }) {
    return this.prisma.answerTrace.create({
      data: input
    });
  }

  updateTrace(id: string, input: {
    assistantMessageId?: string;
    rewrittenQuery?: string | null;
    citationsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    qualityEvaluationJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    latencyMs?: number;
    modelName?: string;
    status?: TraceStatus;
    errorMessage?: string;
    retrievedChunkIdsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    retrievalScoresJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  }) {
    return this.prisma.answerTrace.update({
      where: { id },
      data: input
    });
  }
}
