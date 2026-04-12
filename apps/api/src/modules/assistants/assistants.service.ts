import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import { buildResourceAccessDeniedHint, evaluateOwnerResourceAccess } from "../auth/resource-access-policy.contract";
import { RetrievalProfilesService } from "../retrieval-profiles/retrieval-profiles.service";
import { UpdateAssistantInput } from "./assistant.schemas";

type AssistantAccessScope = {
  tenantId: string;
  userId: string;
};

@Injectable()
export class AssistantsService {
  private readonly assistantListSelect = {
    id: true,
    tenantId: true,
    kbId: true,
    name: true,
    description: true,
    systemPrompt: true,
    retrievalProfileId: true,
    answerPolicyJson: true,
    status: true
  } satisfies Prisma.AssistantSelect;

  constructor(
    private readonly prisma: PrismaService,
    private readonly retrievalProfilesService: RetrievalProfilesService
  ) {}

  listAssistants(scope?: AssistantAccessScope | null) {
    return this.prisma.assistant.findMany({
      select: this.assistantListSelect,
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
    if (scope && typeof this.prisma.assistant.findFirst !== "function") {
      const existingAssistant = await this.prisma.assistant.findUnique({
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

      if (!existingAssistant) {
        throw new NotFoundException(`Assistant ${id} not found.`);
      }

      const accessDecision = evaluateOwnerResourceAccess({
        identity: scope,
        action: "read",
        resource: {
          kind: "knowledge_base",
          resourceId: existingAssistant.knowledgeBase.id,
          tenantId: existingAssistant.knowledgeBase.tenantId,
          ownerId: existingAssistant.knowledgeBase.ownerId
        }
      });

      if (!accessDecision.allowed) {
        throw new ForbiddenException(buildResourceAccessDeniedHint(accessDecision));
      }

      const { knowledgeBase, ...scopedAssistant } = existingAssistant;
      void knowledgeBase;
      return scopedAssistant;
    }

    const assistant = scope
      ? typeof this.prisma.assistant.findFirst === "function"
        ? await this.prisma.assistant.findFirst({
            where: {
              id,
              tenantId: scope.tenantId,
              knowledgeBase: {
                ownerId: scope.userId
              }
            },
            include: {
              retrievalProfile: true
            }
          })
        : null
      : await this.prisma.assistant.findUnique({
          where: { id },
          include: {
            retrievalProfile: true
          }
        });

    if (assistant) {
      return assistant;
    }

    if (!scope) {
      throw new NotFoundException(`Assistant ${id} not found.`);
    }

    const existingAssistant = await this.prisma.assistant.findUnique({
      where: { id },
      select: {
        id: true,
        knowledgeBase: {
          select: {
            id: true,
            tenantId: true,
            ownerId: true
          }
        }
      }
    });

    if (!existingAssistant) {
      throw new NotFoundException(`Assistant ${id} not found.`);
    }

    const accessDecision = evaluateOwnerResourceAccess({
      identity: scope,
      action: "read",
      resource: {
        kind: "knowledge_base",
        resourceId: existingAssistant.knowledgeBase.id,
        tenantId: existingAssistant.knowledgeBase.tenantId,
        ownerId: existingAssistant.knowledgeBase.ownerId
      }
    });

    if (!accessDecision.allowed) {
      throw new ForbiddenException(buildResourceAccessDeniedHint(accessDecision));
    }

    throw new NotFoundException(`Assistant ${id} not found.`);
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
