import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { DocumentProcessingStage, DocumentStatus, Prisma } from "@prisma/client";
import { ChunkingService } from "../../infra/parsing/chunking.service";
import { PrismaService } from "../../infra/database/prisma.service";
import { ParsingService } from "../../infra/parsing/parsing.service";
import { getDocumentIngestionQueueName } from "../../infra/queue/queue.constants";
import { QueueService } from "../../infra/queue/queue.service";
import { StorageService } from "../../infra/storage/storage.service";
import { IndexingService } from "../indexing/indexing.service";

const { Worker } = require("bullmq");
const IORedis = require("ioredis");

type DocumentIngestionJobData = {
  documentId: string;
  documentVersion?: number;
};

type IngestionFailedStage = "parsing" | "chunking" | "indexing";

type IngestionDiagnostics = {
  code: string;
  failedStage: IngestionFailedStage;
  retryable: boolean;
  documentVersion: number;
  message: string;
};

class IngestionProcessError extends Error {
  constructor(readonly diagnostics: IngestionDiagnostics) {
    super(diagnostics.message);
    this.name = "IngestionProcessError";
  }
}

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

  enqueueDocument(documentId: string, documentVersion?: number) {
    return this.queueService.addDocumentIngestionJob(documentId, documentVersion);
  }

  onModuleInit() {
    this.worker = new Worker(
      getDocumentIngestionQueueName(),
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

    if (typeof job.data.documentVersion === "number" && document.version !== job.data.documentVersion) {
      this.logger.warn(
        `Skipping stale ingestion job for document ${document.id}: job version ${job.data.documentVersion}, current version ${document.version}.`
      );
      return;
    }

    await this.prisma.document.update({
      where: { id: document.id },
      data: {
        status: DocumentStatus.processing,
        processingStage: DocumentProcessingStage.parsing,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull
      }
    });

    try {
      const fileBuffer = await this.readDocumentFile(document);
      const content = await this.parseDocumentContent(document, fileBuffer);
      const normalizedContent = content.trim();

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          processingStage: DocumentProcessingStage.chunking
        }
      });

      if (!normalizedContent) {
        throw new IngestionProcessError({
          code: "INGESTION_EMPTY_CONTENT",
          failedStage: "parsing",
          retryable: false,
          documentVersion: document.version,
          message: "Parsed content is empty."
        });
      }

      const chunks = await this.rebuildDocumentChunks(document, normalizedContent);

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          processingStage: DocumentProcessingStage.indexing
        }
      });

      await this.indexDocument(document);

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.ready,
          processingStage: DocumentProcessingStage.completed,
          chunkCount: chunks.length,
          errorMessage: null,
          diagnosticsJson: Prisma.JsonNull
        }
      });
    } catch (error) {
      const diagnostics = this.buildIngestionDiagnostics(document.version, error);

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.failed,
          processingStage: DocumentProcessingStage.failed,
          errorMessage: diagnostics.message,
          diagnosticsJson: diagnostics
        }
      });

      throw error;
    }
  }

  private async readDocumentFile(document: {
    storageKey: string;
    version: number;
  }) {
    try {
      return await this.storageService.readFileByStorageKey(document.storageKey);
    } catch (error) {
      throw new IngestionProcessError({
        code: "INGESTION_STORAGE_READ_FAILED",
        failedStage: "parsing",
        retryable: true,
        documentVersion: document.version,
        message: error instanceof Error ? error.message : "Unknown storage read error."
      });
    }
  }

  private async parseDocumentContent(
    document: {
      sourceName: string;
      mimeType: string;
      version: number;
    },
    fileBuffer: Buffer
  ) {
    try {
      return await this.parsingService.parseDocument({
        sourceName: document.sourceName,
        mimeType: document.mimeType,
        fileBuffer
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown parsing error.";

      throw new IngestionProcessError({
        code: this.resolveParsingErrorCode(message),
        failedStage: "parsing",
        retryable: false,
        documentVersion: document.version,
        message
      });
    }
  }

  private buildIngestionDiagnostics(documentVersion: number, error: unknown): IngestionDiagnostics {
    if (error instanceof IngestionProcessError) {
      return error.diagnostics;
    }

    return this.buildGenericIngestionDiagnostics("indexing", documentVersion, error);
  }

  private resolveParsingErrorCode(message: string) {
    if (message.startsWith("Unsupported file type for ingestion:")) {
      return "INGESTION_UNSUPPORTED_FILE_TYPE";
    }

    if (message.includes("content is empty")) {
      return "INGESTION_EMPTY_CONTENT";
    }

    return "INGESTION_PARSING_FAILED";
  }

  private async rebuildDocumentChunks(
    document: {
      id: string;
      kbId: string;
      version: number;
    },
    normalizedContent: string
  ) {
    try {
      await this.prisma.documentChunk.deleteMany({
        where: {
          documentId: document.id
        }
      });

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

      return chunks;
    } catch (error) {
      throw new IngestionProcessError(
        this.buildGenericIngestionDiagnostics("chunking", document.version, error)
      );
    }
  }

  private async indexDocument(document: { id: string; version: number }) {
    try {
      await this.indexingService.indexDocument(document.id);
    } catch (error) {
      throw new IngestionProcessError(
        this.buildGenericIngestionDiagnostics("indexing", document.version, error)
      );
    }
  }

  private buildGenericIngestionDiagnostics(
    failedStage: IngestionFailedStage,
    documentVersion: number,
    error: unknown
  ): IngestionDiagnostics {
    const message = error instanceof Error ? error.message : "Unknown ingestion error.";

    return {
      code:
        failedStage === "chunking"
          ? "INGESTION_CHUNKING_FAILED"
          : failedStage === "indexing"
            ? "INGESTION_INDEXING_FAILED"
            : "INGESTION_PARSING_FAILED",
      failedStage,
      retryable: failedStage !== "parsing",
      documentVersion,
      message
    };
  }
}
