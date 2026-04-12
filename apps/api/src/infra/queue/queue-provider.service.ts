import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { getDocumentIngestionQueueName } from "./queue.constants";
import { QueueRuntimeConfigService } from "./queue-runtime-config";

export const QUEUE_PROVIDER_SERVICE = Symbol("QUEUE_PROVIDER_SERVICE");

export type RedisQueuedDocumentJob = {
  id: string;
  documentId: string;
  documentVersion?: number;
  attempts: number;
  maxAttempts: number;
};

type RedisQueueClient = {
  isOpen?: boolean;
  connect?: () => Promise<unknown>;
  quit?: () => Promise<void>;
  rPush: (key: string, value: string) => Promise<number>;
  lPop: (key: string) => Promise<string | null>;
  zAdd: (key: string, members: Array<{ score: number; value: string }>) => Promise<number>;
  zRangeByScore: (key: string, min: number, max: number) => Promise<string[]>;
  zRem: (key: string, members: string[]) => Promise<number>;
};

export interface QueueProviderService {
  addDocumentIngestionJob(documentId: string, documentVersion?: number): Promise<unknown>;
  ensureDocumentIngestionQueueReady(): Promise<void>;
  claimNextDocumentIngestionJob?(): Promise<RedisQueuedDocumentJob | null>;
  completeDocumentIngestionJob?(job: RedisQueuedDocumentJob): Promise<void>;
  retryDocumentIngestionJob?(job: RedisQueuedDocumentJob, error: Error): Promise<void>;
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

@Injectable()
export class RedisQueueProviderService implements QueueProviderService {
  private readonly runtimeConfig;
  private clientPromise: Promise<RedisQueueClient> | null = null;

  constructor(
    @Inject(QueueRuntimeConfigService) queueRuntimeConfigService: QueueRuntimeConfigService,
    @Optional()
    private readonly clientFactory?: () => Promise<RedisQueueClient> | RedisQueueClient
  ) {
    this.runtimeConfig = queueRuntimeConfigService.getConfig();
  }

  async addDocumentIngestionJob(documentId: string, documentVersion?: number) {
    const client = await this.getClient();
    const job: RedisQueuedDocumentJob = {
      id: randomUUID(),
      documentId,
      documentVersion,
      attempts: 0,
      maxAttempts: this.runtimeConfig.databaseMaxAttempts
    };
    await client.rPush(this.getPendingQueueKey(), JSON.stringify(job));
    return job.id;
  }

  async ensureDocumentIngestionQueueReady() {
    await this.getClient();
  }

  async claimNextDocumentIngestionJob() {
    const client = await this.getClient();
    await this.moveDueDelayedJobs(client);
    const payload = await client.lPop(this.getPendingQueueKey());
    if (!payload) {
      return null;
    }

    return this.parseQueuedJob(payload);
  }

  async completeDocumentIngestionJob() {}

  async retryDocumentIngestionJob(job: RedisQueuedDocumentJob) {
    const client = await this.getClient();
    const nextAttemptJob = {
      ...job,
      attempts: job.attempts + 1
    } satisfies RedisQueuedDocumentJob;

    if (nextAttemptJob.attempts >= nextAttemptJob.maxAttempts) {
      return;
    }

    await client.zAdd(this.getDelayedQueueKey(), [{
      score: Date.now() + this.runtimeConfig.databaseRetryDelayMs,
      value: JSON.stringify(nextAttemptJob)
    }]);
  }

  private async getClient() {
    if (!this.clientPromise) {
      this.clientPromise = this.createClient();
    }

    return this.clientPromise;
  }

  private async createClient(): Promise<RedisQueueClient> {
    if (this.clientFactory) {
      const client = await this.clientFactory();
      if (client.connect && client.isOpen !== true) {
        await client.connect();
      }
      return client;
    }

    const redisUrl = this.runtimeConfig.redisUrl;
    if (!redisUrl) {
      throw new Error("REDIS_URL is required when QUEUE_PROVIDER=redis.");
    }

    const redisModule = await import("redis");
    const client = redisModule.createClient({ url: redisUrl }) as unknown as RedisQueueClient;
    if (client.connect && client.isOpen !== true) {
      await client.connect();
    }
    return client;
  }

  private async moveDueDelayedJobs(client: RedisQueueClient) {
    const dueJobs = await client.zRangeByScore(this.getDelayedQueueKey(), 0, Date.now());
    if (dueJobs.length === 0) {
      return;
    }

    await client.zRem(this.getDelayedQueueKey(), dueJobs);
    for (const payload of dueJobs) {
      await client.rPush(this.getPendingQueueKey(), payload);
    }
  }

  private parseQueuedJob(payload: string): RedisQueuedDocumentJob | null {
    try {
      const parsed = JSON.parse(payload) as Partial<RedisQueuedDocumentJob>;
      if (typeof parsed.id !== "string" || typeof parsed.documentId !== "string") {
        return null;
      }

      return {
        id: parsed.id,
        documentId: parsed.documentId,
        documentVersion: typeof parsed.documentVersion === "number" ? parsed.documentVersion : undefined,
        attempts: typeof parsed.attempts === "number" ? parsed.attempts : 0,
        maxAttempts: typeof parsed.maxAttempts === "number" ? parsed.maxAttempts : this.runtimeConfig.databaseMaxAttempts
      };
    } catch {
      return null;
    }
  }

  private getPendingQueueKey() {
    const prefix = this.runtimeConfig.queuePrefix ?? "rag-system";
    return `${prefix}:${getDocumentIngestionQueueName()}:pending`;
  }

  private getDelayedQueueKey() {
    const prefix = this.runtimeConfig.queuePrefix ?? "rag-system";
    return `${prefix}:${getDocumentIngestionQueueName()}:delayed`;
  }
}
