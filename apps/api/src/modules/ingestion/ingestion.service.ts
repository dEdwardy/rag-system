import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DocumentProcessingStage, DocumentRunFailedStage, DocumentStatus } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import { getDocumentIngestionQueueName } from "../../infra/queue/queue.constants";
import { QueueRuntimeConfigService } from "../../infra/queue/queue-runtime-config";
import { QueueService } from "../../infra/queue/queue.service";
import { DocumentRunsService } from "../document-runs/document-runs.service";
import { DocumentIngestionProcessor } from "./document-ingestion.processor";
import type { DocumentIngestionJob } from "./document-ingestion.processor";

@Injectable()
export class IngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionService.name);
  private readonly runtimeConfig;
  private databasePollTimer?: NodeJS.Timeout;
  private databasePollInFlight = false;

  constructor(
    @Inject(QueueService) private readonly queueService: QueueService,
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
      void this.startPgmqWorker();
      return;
    }
  }

  private startDatabaseWorker() {
    this.logger.log("Starting database-backed document ingestion worker.");
    this.databasePollTimer = setInterval(() => {
      void this.pollDatabaseQueue();
    }, this.runtimeConfig.databasePollIntervalMs);

    void this.pollDatabaseQueue();
  }

  private async startPgmqWorker() {
    this.logger.log("Starting pgmq-backed document ingestion worker.");
    await this.queueService.ensureDocumentIngestionQueueReady();

    this.databasePollTimer = setInterval(() => {
      void this.pollPgmqQueue();
    }, this.runtimeConfig.databasePollIntervalMs);

    void this.pollPgmqQueue();
  }

  private async pollDatabaseQueue() {
    if (this.databasePollInFlight) {
      return;
    }

    this.databasePollInFlight = true;

    try {
      while (true) {
        const job = await this.claimNextDatabaseJob();
        if (!job) {
          break;
        }

        await this.processDatabaseJob(job);
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
      while (true) {
        const job = await this.claimNextPgmqJob();
        if (!job) {
          break;
        }

        await this.processPgmqJob(job);
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

  async onModuleDestroy() {
    if (this.databasePollTimer) {
      clearInterval(this.databasePollTimer);
      this.databasePollTimer = undefined;
    }
  }
}
