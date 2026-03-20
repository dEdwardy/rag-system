import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import { RetrievalProfilesService } from "../retrieval-profiles/retrieval-profiles.service";
import { UpdateAssistantInput } from "./assistant.schemas";

@Injectable()
export class AssistantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retrievalProfilesService: RetrievalProfilesService
  ) {}

  listAssistants() {
    return this.prisma.assistant.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async getAssistant(id: string) {
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

  async updateAssistant(id: string, input: UpdateAssistantInput) {
    await this.getAssistant(id);

    if (input.retrievalProfileId) {
      await this.retrievalProfilesService.getRetrievalProfile(input.retrievalProfileId);
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
