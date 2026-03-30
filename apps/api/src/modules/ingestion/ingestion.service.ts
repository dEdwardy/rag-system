import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { DocumentProcessingStage, DocumentRunFailedStage, DocumentStatus } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import { getDocumentIngestionQueueName } from "../../infra/queue/queue.constants";
import { QueueRuntimeConfigService } from "../../infra/queue/queue-runtime-config";
import { QueueService } from "../../infra/queue/queue.service";
import { DocumentRunsService } from "../document-runs/document-runs.service";
import { DocumentIngestionProcessor } from "./document-ingestion.processor";
import type { DocumentIngestionJob } from "./document-ingestion.processor";

const { Worker } = require("bullmq");

@Injectable()
export class IngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionService.name);
  private readonly connection;
  private worker?: any;

  constructor(
    @Inject(QueueService) private readonly queueService: QueueService,
    @Inject(QueueRuntimeConfigService) private readonly queueRuntimeConfigService: QueueRuntimeConfigService,
    private readonly documentIngestionProcessor: DocumentIngestionProcessor,
    private readonly prisma: PrismaService,
    private readonly documentRunsService: DocumentRunsService
  ) {
    this.connection = this.queueRuntimeConfigService.createRedisConnection();
  }

  enqueueDocument(documentId: string, documentVersion?: number) {
    return this.queueService.addDocumentIngestionJob(documentId, documentVersion);
  }

  onModuleInit() {
    if (!this.queueRuntimeConfigService.getConfig().enableDocumentIngestionWorker) {
      this.logger.log("Document ingestion worker startup disabled by runtime config.");
      return;
    }

    this.worker = new Worker(
      getDocumentIngestionQueueName(),
      async (job: DocumentIngestionJob) => this.documentIngestionProcessor.processDocument(job),
      {
        connection: this.connection
      }
    );

    this.worker.on("failed", (job: { id?: string; data?: DocumentIngestionJob["data"]; attemptsMade?: number; opts?: { attempts?: number } } | undefined, error: Error) => {
      void this.handleFailedJob(job, error);
    });
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
    await this.worker?.close();
    await this.connection.quit();
  }
}
