import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/database/prisma.service";
import { CreateKnowledgeBaseInput, UpdateKnowledgeBaseInput } from "./knowledge-base.schemas";

@Injectable()
export class KnowledgeBasesService {
  constructor(private readonly prisma: PrismaService) {}

  listKnowledgeBases() {
    return this.prisma.knowledgeBase.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async getKnowledgeBase(id: string) {
    const knowledgeBase = await this.prisma.knowledgeBase.findUnique({
      where: { id }
    });

    if (!knowledgeBase) {
      throw new NotFoundException(`Knowledge base ${id} not found.`);
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

  async updateKnowledgeBase(id: string, input: UpdateKnowledgeBaseInput) {
    await this.getKnowledgeBase(id);

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
