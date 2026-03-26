import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { getDocumentIngestionQueueName } from "./queue.constants";
import { QueueRuntimeConfigService } from "./queue-runtime-config";

const { Queue } = require("bullmq");

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection;

  private readonly documentIngestionQueue;

  constructor(private readonly queueRuntimeConfigService: QueueRuntimeConfigService) {
    this.connection = this.queueRuntimeConfigService.createRedisConnection();
    this.documentIngestionQueue = new Queue(getDocumentIngestionQueueName(), {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: 100,
        removeOnFail: 100
      }
    });
  }

  addDocumentIngestionJob(documentId: string, documentVersion?: number) {
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

  async onModuleDestroy() {
    await this.documentIngestionQueue.close();
    await this.connection.quit();
  }
}
