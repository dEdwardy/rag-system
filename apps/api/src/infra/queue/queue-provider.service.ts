import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { getDocumentIngestionQueueName } from "./queue.constants";
import { QueueRuntimeConfigService } from "./queue-runtime-config";

export const QUEUE_PROVIDER_SERVICE = Symbol("QUEUE_PROVIDER_SERVICE");

export interface QueueProviderService {
  addDocumentIngestionJob(documentId: string, documentVersion?: number): Promise<unknown>;
  ensureDocumentIngestionQueueReady(): Promise<void>;
}

@Injectable()
export class DatabaseQueueProviderService implements QueueProviderService {
  private readonly runtimeConfig;

  constructor(
    @Inject(QueueRuntimeConfigService) queueRuntimeConfigService: QueueRuntimeConfigService,
    private readonly prisma: PrismaService
  ) {
    this.runtimeConfig = queueRuntimeConfigService.getConfig();
  }

  async addDocumentIngestionJob(documentId: string, documentVersion?: number) {
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

  async ensureDocumentIngestionQueueReady() {}

  private buildDocumentIngestionJobId(documentId: string, documentVersion: number) {
    return `ingest-document-${documentId}-${documentVersion}`;
  }

  private buildDatabaseJobKey(documentId: string, documentVersion?: number) {
    return documentVersion === undefined ? `ingest-document-${documentId}` : this.buildDocumentIngestionJobId(documentId, documentVersion);
  }
}

@Injectable()
export class PgmqQueueProviderService implements QueueProviderService {
  private readonly ensuredPgmqQueues = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async addDocumentIngestionJob(documentId: string, documentVersion?: number) {
    const queueName = getDocumentIngestionQueueName();
    await this.ensurePgmqQueueExists(queueName);

    await this.prisma.$executeRaw(
      Prisma.sql`
        SELECT pgmq.send(
          ${queueName},
          ${JSON.stringify({ documentId, documentVersion: documentVersion ?? null })}::jsonb,
          ${JSON.stringify({ jobKey: this.buildDatabaseJobKey(documentId, documentVersion) })}::jsonb
        )
      `
    );
  }

  async ensureDocumentIngestionQueueReady() {
    await this.ensurePgmqQueueExists(getDocumentIngestionQueueName());
  }

  private async ensurePgmqQueueExists(queueName: string) {
    if (this.ensuredPgmqQueues.has(queueName)) {
      return;
    }

    const existingRows = await this.prisma.$queryRaw<Array<{ queue_name: string }>>(
      Prisma.sql`SELECT queue_name FROM pgmq.list_queues() WHERE queue_name = ${queueName}`
    );

    if (existingRows.length === 0) {
      await this.prisma.$executeRaw(Prisma.sql`SELECT pgmq.create(${queueName})`);
    }

    this.ensuredPgmqQueues.add(queueName);
  }

  private buildDocumentIngestionJobId(documentId: string, documentVersion: number) {
    return `ingest-document-${documentId}-${documentVersion}`;
  }

  private buildDatabaseJobKey(documentId: string, documentVersion?: number) {
    return documentVersion === undefined ? `ingest-document-${documentId}` : this.buildDocumentIngestionJobId(documentId, documentVersion);
  }
}
