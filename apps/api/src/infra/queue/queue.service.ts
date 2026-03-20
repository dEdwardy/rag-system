import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { DOCUMENT_INGESTION_QUEUE } from "./queue.constants";

const { Queue } = require("bullmq");
const IORedis = require("ioredis");

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null
  });

  private readonly documentIngestionQueue = new Queue(DOCUMENT_INGESTION_QUEUE, {
    connection: this.connection,
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: 100,
      removeOnFail: 100
    }
  });

  addDocumentIngestionJob(documentId: string) {
    return this.documentIngestionQueue.add("ingest-document", { documentId });
  }

  async onModuleDestroy() {
    await this.documentIngestionQueue.close();
    await this.connection.quit();
  }
}
