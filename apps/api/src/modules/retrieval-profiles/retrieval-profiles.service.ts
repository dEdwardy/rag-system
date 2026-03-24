import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import {
  CreateRetrievalProfileInput,
  UpdateRetrievalProfileInput
} from "./retrieval-profile.schemas";

@Injectable()
export class RetrievalProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  listRetrievalProfiles() {
    return this.prisma.retrievalProfile.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async getRetrievalProfile(id: string) {
    const retrievalProfile = await this.prisma.retrievalProfile.findUnique({
      where: { id }
    });

    if (!retrievalProfile) {
      throw new NotFoundException(`Retrieval profile ${id} not found.`);
    }

    return retrievalProfile;
  }

  createRetrievalProfile(input: CreateRetrievalProfileInput) {
    return this.prisma.retrievalProfile.create({
      data: {
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

  async updateRetrievalProfile(id: string, input: UpdateRetrievalProfileInput) {
    await this.getRetrievalProfile(id);

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
