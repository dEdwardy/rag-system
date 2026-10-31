import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { getDocumentIngestionQueueName } from './queue.constants';
import { QueueRuntimeConfigService } from './queue-runtime-config';

export const QUEUE_PROVIDER_SERVICE = Symbol('QUEUE_PROVIDER_SERVICE');

export type RedisQueuedDocumentJob = {
  id: string;
  documentId: string;
  documentVersion?: number;
  attempts: number;
  maxAttempts: number;
  raw?: string;
};

type RedisQueueClient = {
  isOpen?: boolean;
  connect?: () => Promise<unknown>;
  quit?: () => Promise<void>;
  rPush: (key: string, value: string) => Promise<number>;
  rPopLPush: (source: string, destination: string) => Promise<string | null>;
  lRem: (key: string, count: number, value: string) => Promise<number>;
  zAdd: (
    key: string,
    members: Array<{ score: number; value: string }>
  ) => Promise<number>;
  zRangeByScore: (key: string, min: number, max: number) => Promise<string[]>;
  zRem: (key: string, members: string[]) => Promise<number>;
};

export interface QueueProviderService {
  addDocumentIngestionJob(
    documentId: string,
    documentVersion?: number
  ): Promise<unknown>;
  ensureDocumentIngestionQueueReady(): Promise<void>;
  claimNextDocumentIngestionJob?(): Promise<RedisQueuedDocumentJob | null>;
  completeDocumentIngestionJob?(job: RedisQueuedDocumentJob): Promise<void>;
  retryDocumentIngestionJob?(
    job: RedisQueuedDocumentJob,
    error: Error
  ): Promise<void>;
  recoverStaleDocumentIngestionJobs?(): Promise<number>;
}

@Injectable()
export class DatabaseQueueProviderService implements QueueProviderService {
  private readonly runtimeConfig;

  constructor(
    @Inject(QueueRuntimeConfigService)
    queueRuntimeConfigService: QueueRuntimeConfigService,
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

  private buildDocumentIngestionJobId(
    documentId: string,
    documentVersion: number
  ) {
    return `ingest-document-${documentId}-${documentVersion}`;
  }

  private buildDatabaseJobKey(documentId: string, documentVersion?: number) {
    return documentVersion === undefined
      ? `ingest-document-${documentId}`
      : this.buildDocumentIngestionJobId(documentId, documentVersion);
  }
}

@Injectable()
export class RedisQueueProviderService implements QueueProviderService {
  private readonly runtimeConfig;
  private clientPromise: Promise<RedisQueueClient> | null = null;

  constructor(
    @Inject(QueueRuntimeConfigService)
    queueRuntimeConfigService: QueueRuntimeConfigService,
    @Optional()
    private readonly clientFactory?: () =>
      | Promise<RedisQueueClient>
      | RedisQueueClient
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
    const payload = await client.rPopLPush(
      this.getPendingQueueKey(),
      this.getProcessingQueueKey()
    );
    if (!payload) {
      return null;
    }

    await client.zAdd(this.getProcessingIndexKey(), [
      {
        score: Date.now(),
        value: payload
      }
    ]);

    const job = this.parseQueuedJob(payload);
    return job == null ? null : { ...job, raw: payload };
  }

  async completeDocumentIngestionJob(job: RedisQueuedDocumentJob) {
    const client = await this.getClient();
    const raw = job.raw ?? JSON.stringify(job);
    await client.lRem(this.getProcessingQueueKey(), 1, raw);
    await client.zRem(this.getProcessingIndexKey(), [raw]);
  }

  async retryDocumentIngestionJob(job: RedisQueuedDocumentJob) {
    const client = await this.getClient();
    const raw = job.raw ?? JSON.stringify(job);
    await client.lRem(this.getProcessingQueueKey(), 1, raw);
    await client.zRem(this.getProcessingIndexKey(), [raw]);

    const nextAttemptJob = {
      id: job.id,
      documentId: job.documentId,
      documentVersion: job.documentVersion,
      attempts: job.attempts + 1,
      maxAttempts: job.maxAttempts
    } satisfies RedisQueuedDocumentJob;

    if (nextAttemptJob.attempts >= nextAttemptJob.maxAttempts) {
      return;
    }

    await client.zAdd(this.getDelayedQueueKey(), [
      {
        score: Date.now() + this.runtimeConfig.databaseRetryDelayMs,
        value: JSON.stringify(nextAttemptJob)
      }
    ]);
  }

  async recoverStaleDocumentIngestionJobs() {
    const client = await this.getClient();
    const leaseMs = (this.runtimeConfig.maxTaskTimeoutMs ?? 300000) * 2;
    const stalePayloads = await client.zRangeByScore(
      this.getProcessingIndexKey(),
      0,
      Date.now() - leaseMs
    );

    let recovered = 0;
    for (const payload of stalePayloads) {
      await client.lRem(this.getProcessingQueueKey(), 1, payload);
      await client.zRem(this.getProcessingIndexKey(), [payload]);
      const job = this.parseQueuedJob(payload);
      if (job == null) {
        continue;
      }

      const nextAttemptJob = {
        id: job.id,
        documentId: job.documentId,
        documentVersion: job.documentVersion,
        attempts: job.attempts + 1,
        maxAttempts: job.maxAttempts
      } satisfies RedisQueuedDocumentJob;

      if (nextAttemptJob.attempts >= nextAttemptJob.maxAttempts) {
        continue;
      }

      await client.rPush(
        this.getPendingQueueKey(),
        JSON.stringify(nextAttemptJob)
      );
      recovered += 1;
    }

    return recovered;
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
      throw new Error('REDIS_URL is required when QUEUE_PROVIDER=redis.');
    }

    const redisModule = await import('redis');
    const client = redisModule.createClient({
      url: redisUrl
    }) as unknown as RedisQueueClient;
    if (client.connect && client.isOpen !== true) {
      await client.connect();
    }
    return client;
  }

  private async moveDueDelayedJobs(client: RedisQueueClient) {
    const dueJobs = await client.zRangeByScore(
      this.getDelayedQueueKey(),
      0,
      Date.now()
    );
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
      if (
        typeof parsed.id !== 'string' ||
        typeof parsed.documentId !== 'string'
      ) {
        return null;
      }

      return {
        id: parsed.id,
        documentId: parsed.documentId,
        documentVersion:
          typeof parsed.documentVersion === 'number'
            ? parsed.documentVersion
            : undefined,
        attempts: typeof parsed.attempts === 'number' ? parsed.attempts : 0,
        maxAttempts:
          typeof parsed.maxAttempts === 'number'
            ? parsed.maxAttempts
            : this.runtimeConfig.databaseMaxAttempts,
        raw: payload
      };
    } catch {
      return null;
    }
  }

  private getPendingQueueKey() {
    const prefix = this.runtimeConfig.queuePrefix ?? 'rag-system';
    return `${prefix}:${getDocumentIngestionQueueName()}:pending`;
  }

  private getDelayedQueueKey() {
    const prefix = this.runtimeConfig.queuePrefix ?? 'rag-system';
    return `${prefix}:${getDocumentIngestionQueueName()}:delayed`;
  }

  private getProcessingQueueKey() {
    const prefix = this.runtimeConfig.queuePrefix ?? 'rag-system';
    return `${prefix}:${getDocumentIngestionQueueName()}:processing`;
  }

  private getProcessingIndexKey() {
    const prefix = this.runtimeConfig.queuePrefix ?? 'rag-system';
    return `${prefix}:${getDocumentIngestionQueueName()}:processing-index`;
  }
}
