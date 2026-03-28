import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import { evaluateOwnerResourceAccess } from "../auth/resource-access-policy.contract";
import { RetrievalProfilesService } from "../retrieval-profiles/retrieval-profiles.service";
import { UpdateAssistantInput } from "./assistant.schemas";

type AssistantAccessScope = {
  tenantId: string;
  userId: string;
};

@Injectable()
export class AssistantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retrievalProfilesService: RetrievalProfilesService
  ) {}

  listAssistants(scope?: AssistantAccessScope | null) {
    return this.prisma.assistant.findMany({
      ...(scope
        ? {
            where: {
              tenantId: scope.tenantId,
              knowledgeBase: {
                is: {
                  ownerId: scope.userId
                }
              }
            }
          }
        : {}),
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async getAssistant(id: string, scope?: AssistantAccessScope | null) {
    if (scope) {
      const assistant = await this.prisma.assistant.findUnique({
        where: { id },
        include: {
          knowledgeBase: {
            select: {
              id: true,
              tenantId: true,
              ownerId: true
            }
          },
          retrievalProfile: true
        }
      });

      if (!assistant) {
        throw new NotFoundException(`Assistant ${id} not found.`);
      }

      const accessDecision = evaluateOwnerResourceAccess({
        identity: scope,
        action: "read",
        resource: {
          kind: "knowledge_base",
          resourceId: assistant.knowledgeBase.id,
          tenantId: assistant.knowledgeBase.tenantId,
          ownerId: assistant.knowledgeBase.ownerId
        }
      });

      if (!accessDecision.allowed) {
        throw new NotFoundException(`Assistant ${id} not found.`);
      }

      const { knowledgeBase: _, ...scopedAssistant } = assistant;
      return scopedAssistant;
    }

    const assistant = await this.prisma.assistant.findUnique({
      where: { id },
      include: {
        retrievalProfile: true
      }
    });

    if (!assistant) {
      throw new NotFoundException(`Assistant ${id} not found.`);
    }

    return assistant;
  }

  async updateAssistant(id: string, input: UpdateAssistantInput, scope?: AssistantAccessScope | null) {
    await this.getAssistant(id, scope);

    if (input.retrievalProfileId) {
      await this.retrievalProfilesService.getRetrievalProfile(input.retrievalProfileId, scope);
    }

    const data: Prisma.AssistantUncheckedUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt } : {}),
      ...(input.retrievalProfileId !== undefined ? { retrievalProfileId: input.retrievalProfileId } : {}),
      ...(input.answerPolicyJson !== undefined
        ? {
            answerPolicyJson:
              input.answerPolicyJson === null ? Prisma.JsonNull : (input.answerPolicyJson as Prisma.InputJsonValue)
          }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {})
    };

    return this.prisma.assistant.update({
      where: { id },
      data,
      include: {
        retrievalProfile: true
      }
    });
  }
}
