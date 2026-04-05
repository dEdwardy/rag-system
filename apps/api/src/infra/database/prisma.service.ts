import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    this.logger.log("Connecting Prisma client in background.");
    void this.$connect()
      .then(() => {
        this.logger.log("Prisma client connected.");
      })
      .catch(error => {
        this.logger.error("Prisma client connection failed during startup.", error instanceof Error ? error.stack : String(error));
      });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
