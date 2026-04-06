import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/database/prisma.service";
import { buildResourceAccessDeniedHint, evaluateOwnerResourceAccess } from "../auth/resource-access-policy.contract";
import { CreateKnowledgeBaseInput, UpdateKnowledgeBaseInput } from "./knowledge-base.schemas";

type KnowledgeBaseAccessScope = {
  tenantId: string;
  userId: string;
};

@Injectable()
export class KnowledgeBasesService {
  private readonly knowledgeBaseListSelect = {
    id: true,
    tenantId: true,
    ownerId: true,
    name: true,
    description: true,
    status: true,
    createdAt: true,
    updatedAt: true
  } as const;

  constructor(private readonly prisma: PrismaService) {}

  listKnowledgeBases(scope?: KnowledgeBaseAccessScope | null) {
    return this.prisma.knowledgeBase.findMany({
      select: this.knowledgeBaseListSelect,
      ...(scope
        ? {
            where: {
              tenantId: scope.tenantId,
              ownerId: scope.userId
            }
          }
        : {}),
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async getKnowledgeBase(id: string, scope?: KnowledgeBaseAccessScope | null) {
    const knowledgeBase = await this.prisma.knowledgeBase.findUnique({
      where: {
        id
      }
    });

    if (!knowledgeBase) {
      throw new NotFoundException(`Knowledge base ${id} not found.`);
    }

    if (scope) {
      const accessDecision = evaluateOwnerResourceAccess({
        identity: scope,
        action: "read",
        resource: {
          kind: "knowledge_base",
          resourceId: knowledgeBase.id,
          tenantId: knowledgeBase.tenantId,
          ownerId: knowledgeBase.ownerId
        }
      });

      if (!accessDecision.allowed) {
        throw new ForbiddenException(buildResourceAccessDeniedHint(accessDecision));
      }
    }

    return knowledgeBase;
  }

  async createKnowledgeBase(input: CreateKnowledgeBaseInput, identity: { tenantId: string; userId: string }) {
    await this.ensureTenantExists(identity.tenantId);
    await this.ensureOwnerExists(identity.userId);

    return this.prisma.knowledgeBase.create({
      data: {
        ...input,
        tenantId: identity.tenantId,
        ownerId: identity.userId
      }
    });
  }

  async updateKnowledgeBase(id: string, input: UpdateKnowledgeBaseInput, scope?: KnowledgeBaseAccessScope | null) {
    await this.getKnowledgeBase(id, scope);

    return this.prisma.knowledgeBase.update({
      where: { id },
      data: input
    });
  }

  private async ensureTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found.`);
    }
  }

  private async ensureOwnerExists(ownerId: string) {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId }
    });

    if (!owner) {
      throw new NotFoundException(`User ${ownerId} not found.`);
    }
  }
}
