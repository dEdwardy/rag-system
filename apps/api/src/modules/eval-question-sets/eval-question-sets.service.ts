import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type EvalQuestionSetStatus } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import type { AuthIdentity } from "../auth/auth-identity.contract";
import {
  type CreateEvalQuestionSetInput,
  type UpdateEvalQuestionSetInput
} from "./eval-question-set.schemas";

@Injectable()
export class EvalQuestionSetsService {
  constructor(private readonly prisma: PrismaService) {}

  async createQuestionSet(input: CreateEvalQuestionSetInput, identity: AuthIdentity) {
    await this.ensureTenant(identity.tenantId);
    await this.ensureOwner(identity.userId);

    return this.prisma.evalQuestionSet.create({
      data: {
        tenantId: identity.tenantId,
        ownerId: identity.userId,
        name: input.name,
        ...(input.description !== undefined ? { description: input.description } : {}),
        questionsJson: input.questions as Prisma.InputJsonValue
      }
    });
  }

  async updateQuestionSet(id: string, input: UpdateEvalQuestionSetInput, identity: AuthIdentity) {
    const questionSet = await this.getOwnedQuestionSet(id, identity);
    this.assertEditable(questionSet.status, id);

    return this.prisma.evalQuestionSet.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? {
              description: input.description
            }
          : {}),
        ...(input.questions !== undefined
          ? {
              questionsJson: input.questions as Prisma.InputJsonValue
            }
          : {})
      }
    });
  }

  async lockQuestionSet(id: string, identity: AuthIdentity) {
    const questionSet = await this.getOwnedQuestionSet(id, identity);

    if (questionSet.status === "archived") {
      throw new ConflictException(`Eval question set ${id} is archived and cannot be locked.`);
    }

    if (questionSet.status === "locked") {
      return questionSet;
    }

    return this.prisma.evalQuestionSet.update({
      where: { id },
      data: {
        status: "locked",
        lockedAt: new Date()
      }
    });
  }

  async archiveQuestionSet(id: string, identity: AuthIdentity) {
    const questionSet = await this.getOwnedQuestionSet(id, identity);

    if (questionSet.status === "archived") {
      return questionSet;
    }

    return this.prisma.evalQuestionSet.update({
      where: { id },
      data: {
        status: "archived",
        archivedAt: new Date()
      }
    });
  }

  private async getOwnedQuestionSet(id: string, identity: AuthIdentity) {
    const questionSet = await this.prisma.evalQuestionSet.findFirst({
      where: {
        id,
        tenantId: identity.tenantId,
        ownerId: identity.userId
      }
    });

    if (!questionSet) {
      throw new NotFoundException(`Eval question set ${id} not found.`);
    }

    return questionSet;
  }

  private async ensureTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id }
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found.`);
    }
  }

  private async ensureOwner(id: string) {
    const owner = await this.prisma.user.findUnique({
      where: { id }
    });
    if (!owner) {
      throw new NotFoundException(`User ${id} not found.`);
    }
  }

  private assertEditable(status: EvalQuestionSetStatus, id: string) {
    if (status === "locked") {
      throw new ConflictException(`Eval question set ${id} is locked and cannot be edited.`);
    }

    if (status === "archived") {
      throw new ConflictException(`Eval question set ${id} is archived and cannot be edited.`);
    }
  }
}
