import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    this.logger.log("Connecting Prisma client.");
    await this.$connect();
    this.logger.log("Prisma client connected.");
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
