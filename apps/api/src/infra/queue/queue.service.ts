import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { getDocumentIngestionQueueName } from "./queue.constants";
import { QueueRuntimeConfigService } from "./queue-runtime-config";

const { Queue } = require("bullmq");

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection;

  private readonly documentIngestionQueue;

  private readonly runtimeConfig;

  constructor(
    @Inject(QueueRuntimeConfigService) private readonly queueRuntimeConfigService: QueueRuntimeConfigService,
    private readonly prisma: PrismaService
  ) {
    this.runtimeConfig = this.queueRuntimeConfigService.getConfig();

    if (this.runtimeConfig.provider === "bullmq") {
      this.connection = this.queueRuntimeConfigService.createRedisConnection();
      this.documentIngestionQueue = new Queue(getDocumentIngestionQueueName(), {
        connection: this.connection,
        defaultJobOptions: {
          attempts: this.runtimeConfig.databaseMaxAttempts,
          removeOnComplete: 100,
          removeOnFail: 100
        }
      });
    }
  }

  addDocumentIngestionJob(documentId: string, documentVersion?: number) {
    if (this.runtimeConfig.provider === "database") {
      return this.addDatabaseDocumentIngestionJob(documentId, documentVersion);
    }

    const jobId =
      documentVersion === undefined ? undefined : this.buildDocumentIngestionJobId(documentId, documentVersion);

    return this.documentIngestionQueue.add("ingest-document", {
      documentId,
      documentVersion
    }, jobId ? { jobId } : undefined);
  }

  private buildDocumentIngestionJobId(documentId: string, documentVersion: number) {
    return `ingest-document-${documentId}-${documentVersion}`;
  }

  private async addDatabaseDocumentIngestionJob(documentId: string, documentVersion?: number) {
    const queueName = getDocumentIngestionQueueName();
    const jobKey = this.buildDatabaseJobKey(documentId, documentVersion);
    const now = new Date();
    const payloadJson = JSON.stringify({ documentId, documentVersion });

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "IngestionQueueJob"
        SET
          "status" = 'pending',
          "availableAt" = ${now},
          "lockedAt" = NULL,
          "lastError" = NULL,
          "payloadJson" = ${payloadJson}::jsonb,
          "maxAttempts" = ${this.runtimeConfig.databaseMaxAttempts},
          "updatedAt" = ${now}
        WHERE "queueName" = ${queueName}
          AND "jobKey" = ${jobKey}
          AND "status" IN ('failed', 'completed')
      `
    );

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "IngestionQueueJob" (
          "id",
          "queueName",
          "jobKey",
          "documentId",
          "documentVersion",
          "status",
          "attempts",
          "maxAttempts",
          "availableAt",
          "lockedAt",
          "lastError",
          "payloadJson",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${randomUUID()},
          ${queueName},
          ${jobKey},
          ${documentId},
          ${documentVersion ?? null},
          'pending',
          0,
          ${this.runtimeConfig.databaseMaxAttempts},
          ${now},
          NULL,
          NULL,
          ${payloadJson}::jsonb,
          ${now},
          ${now}
        )
        ON CONFLICT ("queueName", "jobKey") DO NOTHING
      `
    );
  }

  private buildDatabaseJobKey(documentId: string, documentVersion?: number) {
    return documentVersion === undefined ? `ingest-document-${documentId}` : this.buildDocumentIngestionJobId(documentId, documentVersion);
  }

  async onModuleDestroy() {
    await this.documentIngestionQueue?.close();
    await this.connection?.quit();
  }
}
