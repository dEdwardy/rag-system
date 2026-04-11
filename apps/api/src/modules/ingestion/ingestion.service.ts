import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DocumentProcessingStage, DocumentRunFailedStage, DocumentStatus } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import { getDocumentIngestionQueueName } from "../../infra/queue/queue.constants";
import { QueueRuntimeConfigService } from "../../infra/queue/queue-runtime-config";
import { QueueService } from "../../infra/queue/queue.service";
import { QUEUE_PROVIDER_SERVICE, type QueueProviderService, type RedisQueuedDocumentJob } from "../../infra/queue/queue-provider.service";
import { DocumentRunsService } from "../document-runs/document-runs.service";
import { DocumentIngestionProcessor } from "./document-ingestion.processor";
import type { DocumentIngestionJob } from "./document-ingestion.processor";

@Injectable()
export class IngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionService.name);
  private readonly runtimeConfig;
  private databasePollTimer?: NodeJS.Timeout;
  private databasePollInFlight = false;
  private activeTasks = new Set<string>();
  private taskAbortControllers = new Map<string, AbortController>();

  constructor(
    @Inject(QueueService) private readonly queueService: QueueService,
    @Inject(QUEUE_PROVIDER_SERVICE) private readonly queueProviderService: QueueProviderService,
    @Inject(QueueRuntimeConfigService) private readonly queueRuntimeConfigService: QueueRuntimeConfigService,
    private readonly documentIngestionProcessor: DocumentIngestionProcessor,
    private readonly prisma: PrismaService,
    private readonly documentRunsService: DocumentRunsService
  ) {
    this.runtimeConfig = this.queueRuntimeConfigService.getConfig();
  }

  enqueueDocument(documentId: string, documentVersion?: number) {
    return this.queueService.addDocumentIngestionJob(documentId, documentVersion);
  }

  onModuleInit() {
    this.logger.log("IngestionService onModuleInit entered.");
    const runtimeConfig = this.runtimeConfig ?? this.queueRuntimeConfigService.getConfig();

    if (!runtimeConfig.enableDocumentIngestionWorker) {
      this.logger.log("Document ingestion worker startup disabled by runtime config.");
      return;
    }

    if (runtimeConfig.provider === "database") {
      this.startDatabaseWorker();
      return;
    }

    if (runtimeConfig.provider === "pgmq") {
      void Promise.resolve().then(() => this.startPgmqWorker()).catch(error => {
        this.logWorkerLoopError("pgmq startup", error);
      });
      return;
    }

    if (runtimeConfig.provider === "redis") {
      void Promise.resolve().then(() => this.startRedisWorker()).catch(error => {
        this.logWorkerLoopError("redis startup", error);
      });
    }
  }

  private startDatabaseWorker() {
    this.logger.log("Starting database-backed document ingestion worker.");
    this.databasePollTimer = setInterval(() => {
      void this.runWorkerPollSafely("database", () => this.pollDatabaseQueue());
    }, this.runtimeConfig.databasePollIntervalMs);

    void this.runWorkerPollSafely("database", () => this.pollDatabaseQueue());
  }

  private async startPgmqWorker() {
    this.logger.log("Starting pgmq-backed document ingestion worker.");
    this.logger.log("Ensuring pgmq ingestion queue is ready.");
    await this.queueService.ensureDocumentIngestionQueueReady();
    this.logger.log("Pgmq ingestion queue is ready.");

    this.databasePollTimer = setInterval(() => {
      void this.runWorkerPollSafely("pgmq", () => this.pollPgmqQueue());
    }, this.runtimeConfig.databasePollIntervalMs);

    void this.runWorkerPollSafely("pgmq", () => this.pollPgmqQueue());
  }

  private async startRedisWorker() {
    this.logger.log("Starting redis-backed document ingestion worker.");
    await this.queueService.ensureDocumentIngestionQueueReady();

    this.databasePollTimer = setInterval(() => {
      void this.runWorkerPollSafely("redis", () => this.pollRedisQueue());
    }, this.runtimeConfig.databasePollIntervalMs);

    void this.runWorkerPollSafely("redis", () => this.pollRedisQueue());
  }

  private async runWorkerPollSafely(workerName: string, operation: () => Promise<void>) {
    try {
      await operation();
    } catch (error) {
      this.logWorkerLoopError(workerName, error);
    }
  }

  private async pollDatabaseQueue() {
    if (this.databasePollInFlight) {
      return;
    }

    this.databasePollInFlight = true;

    try {
      while (this.activeTasks.size < this.runtimeConfig.maxConcurrentIngestionTasks) {
        const job = await this.claimNextDatabaseJob();
        if (!job) {
          break;
        }

        const taskId = `db-${job.id}`;
        if (this.activeTasks.has(taskId)) {
          continue;
        }

        this.activeTasks.add(taskId);
        this.processDatabaseJobWithTimeout(job, taskId).finally(() => {
          this.activeTasks.delete(taskId);
          this.taskAbortControllers.delete(taskId);
        });
      }
    } finally {
      this.databasePollInFlight = false;
    }
  }

  private async pollPgmqQueue() {
    if (this.databasePollInFlight) {
      return;
    }

    this.databasePollInFlight = true;

    try {
      while (this.activeTasks.size < this.runtimeConfig.maxConcurrentIngestionTasks) {
        const job = await this.claimNextPgmqJob();
        if (!job) {
          break;
        }

        const taskId = `pgmq-${String(job.msg_id)}`;
        if (this.activeTasks.has(taskId)) {
          continue;
        }

        this.activeTasks.add(taskId);
        this.processPgmqJobWithTimeout(job, taskId).finally(() => {
          this.activeTasks.delete(taskId);
          this.taskAbortControllers.delete(taskId);
        });
      }
    } finally {
      this.databasePollInFlight = false;
    }
  }

  private async pollRedisQueue() {
    if (this.databasePollInFlight) {
      return;
    }

    this.databasePollInFlight = true;

    try {
      while (this.activeTasks.size < this.runtimeConfig.maxConcurrentIngestionTasks) {
        const job = await this.queueProviderService.claimNextDocumentIngestionJob?.();
        if (!job) {
          break;
        }

        const taskId = `redis-${job.id}`;
        if (this.activeTasks.has(taskId)) {
          continue;
        }

        this.activeTasks.add(taskId);
        this.processRedisJobWithTimeout(job, taskId).finally(() => {
          this.activeTasks.delete(taskId);
          this.taskAbortControllers.delete(taskId);
        });
      }
    } finally {
      this.databasePollInFlight = false;
    }
  }

  private async claimNextDatabaseJob() {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; documentId: string; documentVersion: number | null; attempts: number; maxAttempts: number }>>(
      Prisma.sql`
        WITH next_job AS (
          SELECT "id"
          FROM "IngestionQueueJob"
          WHERE "queueName" = ${getDocumentIngestionQueueName()}
            AND "status" = 'pending'
            AND "availableAt" <= NOW()
          ORDER BY "availableAt" ASC, "createdAt" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "IngestionQueueJob"
        SET
          "status" = 'processing',
          "lockedAt" = NOW(),
          "attempts" = "attempts" + 1,
          "updatedAt" = NOW()
        WHERE "id" IN (SELECT "id" FROM next_job)
        RETURNING "id", "documentId", "documentVersion", "attempts", "maxAttempts"
      `
    );

    return rows[0] ?? null;
  }

  private async claimNextPgmqJob() {
    const rows = await this.prisma.$queryRaw<
      Array<{
        msg_id: bigint | number;
        read_ct: number;
        message: { documentId?: string; documentVersion?: number | null } | null;
      }>
    >(
      Prisma.sql`
        SELECT msg_id, read_ct, message
        FROM pgmq.read(
          ${getDocumentIngestionQueueName()},
          ${this.runtimeConfig.pgmqVisibilityTimeoutSeconds}::integer,
          1::integer,
          NULL::jsonb
        )
      `
    );

    return rows[0] ?? null;
  }

  private async processDatabaseJob(job: { id: string; documentId: string; documentVersion: number | null; attempts: number; maxAttempts: number }) {
    try {
      await this.documentIngestionProcessor.processDocument({
        id: job.id,
        data: {
          documentId: job.documentId,
          documentVersion: job.documentVersion ?? undefined
        }
      });

      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "IngestionQueueJob"
          SET
            "status" = 'completed',
            "lockedAt" = NULL,
            "lastError" = NULL,
            "updatedAt" = NOW()
          WHERE "id" = ${job.id}
        `
      );
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error("Unknown ingestion worker error.");
      const shouldRetry = job.attempts < job.maxAttempts;
      const nextAvailableAt = new Date(Date.now() + this.runtimeConfig.databaseRetryDelayMs);

      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "IngestionQueueJob"
          SET
            "status" = ${shouldRetry ? "pending" : "failed"},
            "availableAt" = ${shouldRetry ? nextAvailableAt : new Date()},
            "lockedAt" = NULL,
            "lastError" = ${normalizedError.message},
            "updatedAt" = NOW()
          WHERE "id" = ${job.id}
        `
      );

      await this.handleFailedJob(
        {
          id: job.id,
          data: {
            documentId: job.documentId,
            documentVersion: job.documentVersion ?? undefined
          },
          attemptsMade: job.attempts,
          opts: {
            attempts: job.maxAttempts
          }
        },
        normalizedError
      );
    }
  }

  private async processPgmqJob(job: {
    msg_id: bigint | number;
    read_ct: number;
    message: { documentId?: string; documentVersion?: number | null } | null;
  }) {
    const message = job.message ?? {};
    const documentId = typeof message.documentId === "string" ? message.documentId : undefined;
    const documentVersion = typeof message.documentVersion === "number" ? message.documentVersion : undefined;

    if (!documentId) {
      await this.prisma.$executeRaw(
        Prisma.sql`SELECT pgmq.delete(${getDocumentIngestionQueueName()}, ${job.msg_id})`
      );
      return;
    }

    try {
      await this.documentIngestionProcessor.processDocument({
        id: `pgmq-${String(job.msg_id)}`,
        data: {
          documentId,
          documentVersion
        }
      });

      await this.prisma.$executeRaw(
        Prisma.sql`SELECT pgmq.delete(${getDocumentIngestionQueueName()}, ${job.msg_id})`
      );
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error("Unknown ingestion worker error.");
      const shouldRetry = job.read_ct < this.runtimeConfig.databaseMaxAttempts;

      if (shouldRetry) {
        await this.prisma.$executeRaw(
          Prisma.sql`
            SELECT pgmq.set_vt(
              ${getDocumentIngestionQueueName()},
              ${job.msg_id},
              ${Math.max(1, Math.ceil(this.runtimeConfig.databaseRetryDelayMs / 1000))}::integer
            )
          `
        );
      } else {
        await this.prisma.$executeRaw(
          Prisma.sql`SELECT pgmq.delete(${getDocumentIngestionQueueName()}, ${job.msg_id})`
        );
      }

      await this.handleFailedJob(
        {
          id: `pgmq-${String(job.msg_id)}`,
          data: {
            documentId,
            documentVersion
          },
          attemptsMade: job.read_ct,
          opts: {
            attempts: this.runtimeConfig.databaseMaxAttempts
          }
        },
        normalizedError
      );
    }
  }

  private async processRedisJob(job: RedisQueuedDocumentJob) {
    try {
      await this.documentIngestionProcessor.processDocument({
        id: `redis-${job.id}`,
        data: {
          documentId: job.documentId,
          documentVersion: job.documentVersion
        }
      });

      await this.queueProviderService.completeDocumentIngestionJob?.(job);
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error("Unknown ingestion worker error.");
      await this.queueProviderService.retryDocumentIngestionJob?.(job, normalizedError);
      await this.handleFailedJob(
        {
          id: `redis-${job.id}`,
          data: {
            documentId: job.documentId,
            documentVersion: job.documentVersion
          },
          attemptsMade: job.attempts + 1,
          opts: {
            attempts: job.maxAttempts
          }
        },
        normalizedError
      );
    }
  }

  private async handleFailedJob(
    job: { id?: string; data?: DocumentIngestionJob["data"]; attemptsMade?: number; opts?: { attempts?: number } } | undefined,
    error: Error
  ) {
    try {
      this.logger.error(`Document ingestion failed for job ${job?.id}: ${error.message}`);

      if (!job?.data || typeof job.data.documentVersion !== "number") {
        return;
      }

      const attempts = job.opts?.attempts ?? 1;
      if (typeof job.attemptsMade === "number" && job.attemptsMade < attempts) {
        return;
      }

      const currentDocument = await this.prisma.document.findUnique({
        where: {
          id: job.data.documentId
        },
        select: {
          version: true,
          status: true,
          processingStage: true
        }
      });

      if (
        !currentDocument ||
        currentDocument.version !== job.data.documentVersion ||
        (currentDocument.status !== DocumentStatus.pending && currentDocument.status !== DocumentStatus.processing)
      ) {
        return;
      }

      const failedStage = this.resolveFailedStage(currentDocument.processingStage);
      const diagnosticsJson = {
        code: "INGESTION_QUEUE_JOB_FAILED",
        failedStage,
        retryable: true,
        documentVersion: job.data.documentVersion,
        message: error.message
      };

      const updateResult = await this.prisma.document.updateMany({
        where: {
          id: job.data.documentId,
          version: job.data.documentVersion,
          status: {
            in: [DocumentStatus.pending, DocumentStatus.processing]
          }
        },
        data: {
          status: DocumentStatus.failed,
          processingStage: DocumentProcessingStage.failed,
          errorMessage: error.message,
          diagnosticsJson
        }
      });

      if (updateResult.count === 0) {
        return;
      }

      await this.documentRunsService.markRunFailed(job.data.documentId, job.data.documentVersion, {
        failedStage,
        diagnosticsJson
      });
    } catch (reconciliationError) {
      const message = reconciliationError instanceof Error ? reconciliationError.message : "Unknown ingestion reconciliation error.";
      this.logger.error(`Document ingestion failure reconciliation failed for job ${job?.id}: ${message}`);
    }
  }

  private resolveFailedStage(processingStage?: DocumentProcessingStage | null) {
    if (processingStage === DocumentProcessingStage.chunking) {
      return DocumentRunFailedStage.chunking;
    }

    if (processingStage === DocumentProcessingStage.indexing) {
      return DocumentRunFailedStage.indexing;
    }

    return DocumentRunFailedStage.parsing;
  }

  private logWorkerLoopError(workerName: string, error: unknown) {
    const normalizedError = error instanceof Error ? error : new Error("Unknown ingestion worker polling error.");
    this.logger.error(`Document ingestion ${workerName} worker poll failed: ${normalizedError.message}`, normalizedError.stack);
  }

  private async processDatabaseJobWithTimeout(job: { id: string; documentId: string; documentVersion: number | null; attempts: number; maxAttempts: number }, taskId: string) {
    const abortController = new AbortController();
    this.taskAbortControllers.set(taskId, abortController);

    try {
      await Promise.race([
        this.processDatabaseJob(job),
        new Promise<void>((_, reject) => {
          const timeout = setTimeout(() => {
            abortController.abort();
            reject(new Error(`Task ${taskId} timed out after ${this.runtimeConfig.maxTaskTimeoutMs}ms`));
          }, this.runtimeConfig.maxTaskTimeoutMs);
          abortController.signal.addEventListener('abort', () => clearTimeout(timeout));
        })
      ]);
    } catch (error) {
      this.logger.error(`Database job ${job.id} failed: ${error instanceof Error ? error.message : String(error)}`);
      
      const shouldRetry = job.attempts < job.maxAttempts;
      if (!shouldRetry) {
        await this.prisma.$executeRaw(
          Prisma.sql`
            UPDATE "IngestionQueueJob"
            SET
              "status" = 'failed',
              "availableAt" = NOW(),
              "lockedAt" = NULL,
              "lastError" = ${error instanceof Error ? error.message : String(error)},
              "updatedAt" = NOW()
            WHERE "id" = ${job.id}
          `
        );
      }
    }
  }

  private async processPgmqJobWithTimeout(job: {
    msg_id: bigint | number;
    read_ct: number;
    message: { documentId?: string; documentVersion?: number | null } | null;
  }, taskId: string) {
    const abortController = new AbortController();
    this.taskAbortControllers.set(taskId, abortController);

    try {
      await Promise.race([
        this.processPgmqJob(job),
        new Promise<void>((_, reject) => {
          const timeout = setTimeout(() => {
            abortController.abort();
            reject(new Error(`Task ${taskId} timed out after ${this.runtimeConfig.maxTaskTimeoutMs}ms`));
          }, this.runtimeConfig.maxTaskTimeoutMs);
          abortController.signal.addEventListener('abort', () => clearTimeout(timeout));
        })
      ]);
    } catch (error) {
      this.logger.error(`PGMQ job ${String(job.msg_id)} failed: ${error instanceof Error ? error.message : String(error)}`);
      
      const shouldRetry = job.read_ct < this.runtimeConfig.databaseMaxAttempts;
      if (!shouldRetry) {
        await this.prisma.$executeRaw(
          Prisma.sql`SELECT pgmq.delete(${getDocumentIngestionQueueName()}, ${job.msg_id})`
        );
      }
    }
  }

  private async processRedisJobWithTimeout(job: RedisQueuedDocumentJob, taskId: string) {
    const abortController = new AbortController();
    this.taskAbortControllers.set(taskId, abortController);

    try {
      await Promise.race([
        this.processRedisJob(job),
        new Promise<void>((_, reject) => {
          const timeout = setTimeout(() => {
            abortController.abort();
            reject(new Error(`Task ${taskId} timed out after ${this.runtimeConfig.maxTaskTimeoutMs}ms`));
          }, this.runtimeConfig.maxTaskTimeoutMs);
          abortController.signal.addEventListener("abort", () => clearTimeout(timeout));
        })
      ]);
    } catch (error) {
      this.logger.error(`Redis job ${job.id} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async onModuleDestroy() {
    for (const abortController of this.taskAbortControllers.values()) {
      abortController.abort();
    }
    this.taskAbortControllers.clear();
    this.activeTasks.clear();
    
    if (this.databasePollTimer) {
      clearInterval(this.databasePollTimer);
      this.databasePollTimer = undefined;
    }
  }
}
