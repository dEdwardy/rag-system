import { Injectable, NotFoundException } from "@nestjs/common";
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
      data: input
    });
  }

  async updateRetrievalProfile(id: string, input: UpdateRetrievalProfileInput) {
    await this.getRetrievalProfile(id);

    return this.prisma.retrievalProfile.update({
      where: { id },
      data: input
    });
  }
}
