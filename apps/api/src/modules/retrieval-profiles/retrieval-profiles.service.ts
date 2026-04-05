import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import {
  CreateRetrievalProfileInput,
  UpdateRetrievalProfileInput
} from "./retrieval-profile.schemas";

type RetrievalProfileAccessScope = {
  tenantId: string;
  userId: string;
};

@Injectable()
export class RetrievalProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  listRetrievalProfiles(scope?: RetrievalProfileAccessScope | null) {
    const effectiveScope = scope ?? { tenantId: "dev-tenant", userId: "default-user" };

    return this.prisma.retrievalProfile.findMany({
      ...(effectiveScope
        ? {
            where: {
              tenantId: effectiveScope.tenantId,
              ownerId: effectiveScope.userId
            }
          }
        : {}),
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async getRetrievalProfile(id: string, scope?: RetrievalProfileAccessScope | null) {
    const retrievalProfile = scope
      ? await this.prisma.retrievalProfile.findFirst({
          where: {
            id,
            tenantId: scope.tenantId,
            ownerId: scope.userId
          }
        })
      : await this.prisma.retrievalProfile.findUnique({
          where: { id }
        });

    if (!retrievalProfile) {
      throw new NotFoundException(`Retrieval profile ${id} not found.`);
    }

    return retrievalProfile;
  }

  createRetrievalProfile(input: CreateRetrievalProfileInput, scope: RetrievalProfileAccessScope) {
    return this.prisma.retrievalProfile.create({
      data: {
        tenantId: scope.tenantId,
        ownerId: scope.userId,
        name: input.name,
        topK: input.topK,
        chunkWindow: input.chunkWindow,
        enableHybrid: input.enableHybrid,
        enableRerank: input.enableRerank,
        scoreThreshold: input.scoreThreshold,
        ...(input.filtersJson !== undefined
          ? {
              filtersJson:
                input.filtersJson === null ? Prisma.JsonNull : (input.filtersJson as Prisma.InputJsonValue)
            }
          : {}),
        ...(input.strategyJson !== undefined
          ? {
              strategyJson: input.strategyJson as Prisma.InputJsonValue
            }
          : {})
      }
    });
  }

  async updateRetrievalProfile(id: string, input: UpdateRetrievalProfileInput, scope?: RetrievalProfileAccessScope | null) {
    await this.getRetrievalProfile(id, scope);

    return this.prisma.retrievalProfile.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.topK !== undefined ? { topK: input.topK } : {}),
        ...(input.chunkWindow !== undefined ? { chunkWindow: input.chunkWindow } : {}),
        ...(input.enableHybrid !== undefined ? { enableHybrid: input.enableHybrid } : {}),
        ...(input.enableRerank !== undefined ? { enableRerank: input.enableRerank } : {}),
        ...(input.scoreThreshold !== undefined ? { scoreThreshold: input.scoreThreshold } : {}),
        ...(input.filtersJson !== undefined
          ? {
              filtersJson: input.filtersJson as Prisma.InputJsonValue
            }
          : {}),
        ...(input.strategyJson !== undefined
          ? {
              strategyJson:
                input.strategyJson === null
                  ? Prisma.JsonNull
                  : (input.strategyJson as Prisma.InputJsonValue)
            }
          : {})
      }
    });
  }
}
