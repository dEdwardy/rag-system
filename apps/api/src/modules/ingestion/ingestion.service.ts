import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { DocumentProcessingStage, DocumentStatus } from "@prisma/client";
import { ChunkingService } from "../../infra/parsing/chunking.service";
import { PrismaService } from "../../infra/database/prisma.service";
import { ParsingService } from "../../infra/parsing/parsing.service";
import { DOCUMENT_INGESTION_QUEUE } from "../../infra/queue/queue.constants";
import { QueueService } from "../../infra/queue/queue.service";
import { StorageService } from "../../infra/storage/storage.service";
import { IndexingService } from "../indexing/indexing.service";

const { Worker } = require("bullmq");
const IORedis = require("ioredis");

type DocumentIngestionJobData = {
  documentId: string;
};

@Injectable()
export class IngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionService.name);
  private readonly connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null
  });
  private worker?: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly parsingService: ParsingService,
    private readonly chunkingService: ChunkingService,
    private readonly queueService: QueueService,
    private readonly indexingService: IndexingService
  ) {}

  enqueueDocument(documentId: string) {
    return this.queueService.addDocumentIngestionJob(documentId);
  }

  onModuleInit() {
    this.worker = new Worker(
      DOCUMENT_INGESTION_QUEUE,
      async (job: { data: DocumentIngestionJobData; id?: string }) => this.processDocument(job),
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

  private async processDocument(job: { data: DocumentIngestionJobData }) {
    const document = await this.prisma.document.findUnique({
      where: {
        id: job.data.documentId
      }
    });

    if (!document) {
      return;
    }

    await this.prisma.document.update({
      where: { id: document.id },
      data: {
        status: DocumentStatus.processing,
        processingStage: DocumentProcessingStage.parsing,
        errorMessage: null
      }
    });

    try {
      const fileBuffer = await this.storageService.readFileByStorageKey(document.storageKey);
      const content = await this.parsingService.parseDocument({
        sourceName: document.sourceName,
        mimeType: document.mimeType,
        fileBuffer
      });
      const normalizedContent = content.trim();

      await this.prisma.documentChunk.deleteMany({
        where: {
          documentId: document.id
        }
      });

      if (!normalizedContent) {
        throw new Error("Parsed content is empty.");
      }

      const chunks = this.chunkingService.buildChunks(normalizedContent).map((chunk, index) => ({
        documentId: document.id,
        kbId: document.kbId,
        chunkIndex: index,
        content: chunk.content,
        tokenCount: chunk.content.length,
        sectionTitle: chunk.sectionTitle
      }));

      await this.prisma.documentChunk.createMany({
        data: chunks
      });

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          processingStage: DocumentProcessingStage.indexing
        }
      });

      await this.indexingService.indexDocument(document.id);

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.ready,
          processingStage: DocumentProcessingStage.completed,
          chunkCount: chunks.length,
          errorMessage: null
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown ingestion error.";

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.failed,
          processingStage: DocumentProcessingStage.failed,
          errorMessage: message
        }
      });

      throw error;
    }
  }
}
