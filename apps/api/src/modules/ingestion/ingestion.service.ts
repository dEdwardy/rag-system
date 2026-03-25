import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { getDocumentIngestionQueueName } from "../../infra/queue/queue.constants";
import { QueueRuntimeConfigService } from "../../infra/queue/queue-runtime-config";
import { QueueService } from "../../infra/queue/queue.service";
import { DocumentIngestionProcessor } from "./document-ingestion.processor";
import type { DocumentIngestionJob } from "./document-ingestion.processor";

const { Worker } = require("bullmq");

@Injectable()
export class IngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionService.name);
  private readonly connection;
  private worker?: any;

  constructor(
    private readonly queueService: QueueService,
    private readonly queueRuntimeConfigService: QueueRuntimeConfigService,
    private readonly documentIngestionProcessor: DocumentIngestionProcessor
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

    this.worker.on("failed", (job: { id?: string } | undefined, error: Error) => {
      this.logger.error(`Document ingestion failed for job ${job?.id}: ${error.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.connection.quit();
  }
}
