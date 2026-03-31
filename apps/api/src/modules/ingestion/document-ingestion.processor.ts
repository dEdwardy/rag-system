import { Injectable, Logger } from "@nestjs/common";
import { DocumentProcessingStage, DocumentRunFailedStage, DocumentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import { ChunkingService } from "../../infra/parsing/chunking.service";
import { ParsingService } from "../../infra/parsing/parsing.service";
import { StorageService } from "../../infra/storage/storage.service";
import { DocumentRunsService } from "../document-runs/document-runs.service";
import { IndexingService } from "../indexing/indexing.service";
import { ErrorCode, createErrorDiagnostics } from "../../common/error-codes";

export type DocumentIngestionJobData = {
  documentId: string;
  documentVersion?: number;
};

export type DocumentIngestionJob = {
  data: DocumentIngestionJobData;
  id?: string;
};

type IngestionFailedStage = "parsing" | "chunking" | "indexing";

type IngestionDiagnostics = {
  code: ErrorCode;
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
export class DocumentIngestionProcessor {
  private readonly logger = new Logger(DocumentIngestionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly parsingService: ParsingService,
    private readonly chunkingService: ChunkingService,
    private readonly documentRunsService: DocumentRunsService,
    private readonly indexingService: IndexingService
  ) {}

  async processDocument(job: DocumentIngestionJob) {
    const document = await this.prisma.document.findUnique({
      where: {
        id: job.data.documentId
      }
    });

    if (!document) {
      return;
    }

    if (this.isNonRetryableFailedDocument(document)) {
      this.logger.warn(
        `Skipping non-retryable ingestion retry for document ${document.id} version ${document.version} because the current failure is terminal.`
      );
      return;
    }

    if (typeof job.data.documentVersion === "number" && document.version !== job.data.documentVersion) {
      await this.documentRunsService.markRunSkipped(document.id, job.data.documentVersion, {
        failedStage: DocumentRunFailedStage.stale_guard,
        diagnosticsJson: createErrorDiagnostics(
          ErrorCode.INGESTION_RUN_SUPERSEDED,
          "stale_guard",
          false,
          job.data.documentVersion,
          "Skipped stale ingestion job because a newer document version is already active.",
          {
            currentDocumentVersion: document.version
          }
        )
      });
      this.logger.warn(
        `Skipping stale ingestion job for document ${document.id}: job version ${job.data.documentVersion}, current version ${document.version}.`
      );
      return;
    }

    const preservedDiagnostics = this.getPreservedReadyDiagnostics(document.diagnosticsJson);

    const runActivation = await this.documentRunsService.markRunProcessing(
      document.id,
      document.version,
      preservedDiagnostics
    );

    if (!this.wasRunTransitionApplied(runActivation)) {
      this.logger.warn(
        `Skipping duplicate ingestion activation for document ${document.id} version ${document.version} because the run is no longer pending or retryable failed.`
      );
      return;
    }

    try {
      await this.markDocumentProcessing(document.id, document.version, preservedDiagnostics);

      const fileBuffer = await this.readDocumentFile(document);
      const content = await this.parseDocumentContent(document, fileBuffer);
      const normalizedContent = content.trim();

      if (!normalizedContent) {
        throw new IngestionProcessError({
          code: "INGESTION_EMPTY_CONTENT",
          failedStage: "parsing",
          retryable: false,
          documentVersion: document.version,
          message: "Parsed content is empty."
        });
      }

      if (!(await this.ensureCurrentDocumentVersion(document))) {
        return;
      }

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          processingStage: DocumentProcessingStage.chunking
        }
      });

      const chunks = await this.rebuildDocumentChunks(document, normalizedContent);

      if (!(await this.ensureCurrentDocumentVersion(document))) {
        return;
      }

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          processingStage: DocumentProcessingStage.indexing
        }
      });

      await this.indexDocument(document);

      if (!(await this.ensureCurrentDocumentVersion(document))) {
        return;
      }

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.ready,
          processingStage: DocumentProcessingStage.completed,
          chunkCount: chunks.length,
          errorMessage: null,
          diagnosticsJson: preservedDiagnostics ?? Prisma.JsonNull
        }
      });
      await this.documentRunsService.markRunCompleted(document.id, document.version, preservedDiagnostics);
    } catch (error) {
      const diagnostics = this.buildIngestionDiagnostics(document.version, error);

      if (!(await this.ensureCurrentDocumentVersion(document))) {
        return;
      }

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.failed,
          processingStage: DocumentProcessingStage.failed,
          errorMessage: diagnostics.message,
          diagnosticsJson: diagnostics
        }
      });
      await this.documentRunsService.markRunFailed(document.id, document.version, {
        failedStage: this.toDocumentRunFailedStage(diagnostics.failedStage),
        diagnosticsJson: diagnostics
      });

      throw error;
    }
  }

  private async readDocumentFile(document: { storageKey: string; version: number }) {
    try {
      return await this.storageService.readFileByStorageKey(document.storageKey);
    } catch (error) {
      throw new IngestionProcessError(
        createErrorDiagnostics(
          ErrorCode.INGESTION_PARSING_FAILED,
          "parsing",
          true,
          document.version,
          error instanceof Error ? error.message : "Unknown storage read error."
        )
      );
    }
  }

  private async parseDocumentContent(
    document: { sourceName: string; mimeType: string; version: number },
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

      throw new IngestionProcessError(
        createErrorDiagnostics(
          this.resolveParsingErrorCode(message),
          "parsing",
          false,
          document.version,
          message
        )
      );
    }
  }

  private buildIngestionDiagnostics(documentVersion: number, error: unknown): IngestionDiagnostics {
    if (error instanceof IngestionProcessError) {
      return error.diagnostics;
    }

    return this.buildGenericIngestionDiagnostics("indexing", documentVersion, error);
  }

  private resolveParsingErrorCode(message: string): ErrorCode {
    if (message.startsWith("Unsupported file type for ingestion:")) {
      return ErrorCode.INGESTION_UNSUPPORTED_FILE_TYPE;
    }

    if (message.includes("content is empty")) {
      return ErrorCode.INGESTION_EMPTY_CONTENT;
    }

    return ErrorCode.INGESTION_PARSING_FAILED;
  }

  private async rebuildDocumentChunks(
    document: { id: string; kbId: string; version: number },
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
      await this.indexingService.indexDocument(document.id, document.version);
    } catch (error) {
      throw new IngestionProcessError(
        this.buildGenericIngestionDiagnostics("indexing", document.version, error)
      );
    }
  }

  private async markDocumentProcessing(
    documentId: string,
    documentVersion: number,
    preservedDiagnostics: Prisma.JsonValue | null
  ) {
    try {
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.processing,
          processingStage: DocumentProcessingStage.parsing,
          errorMessage: null,
          diagnosticsJson: preservedDiagnostics ?? Prisma.JsonNull
        }
      });
    } catch (error) {
      throw new IngestionProcessError({
        code: "INGESTION_STATE_WRITE_FAILED",
        failedStage: "parsing",
        retryable: true,
        documentVersion,
        message: error instanceof Error ? error.message : "Unknown document state update error."
      });
    }
  }

  private buildGenericIngestionDiagnostics(
    failedStage: IngestionFailedStage,
    documentVersion: number,
    error: unknown
  ): IngestionDiagnostics {
    const message = error instanceof Error ? error.message : "Unknown ingestion error.";
    let errorCode: ErrorCode;

    switch (failedStage) {
      case "chunking":
        errorCode = ErrorCode.INGESTION_PARSING_FAILED;
        break;
      case "indexing":
        errorCode = ErrorCode.INGESTION_PARSING_FAILED;
        break;
      default:
        errorCode = ErrorCode.INGESTION_PARSING_FAILED;
    }

    return createErrorDiagnostics(
      errorCode,
      failedStage,
      failedStage !== "parsing",
      documentVersion,
      message
    );
  }

  private toDocumentRunFailedStage(failedStage: IngestionFailedStage) {
    if (failedStage === "chunking") {
      return DocumentRunFailedStage.chunking;
    }

    if (failedStage === "indexing") {
      return DocumentRunFailedStage.indexing;
    }

    return DocumentRunFailedStage.parsing;
  }

  private getPreservedReadyDiagnostics(diagnosticsJson: Prisma.JsonValue | null) {
    if (!diagnosticsJson || typeof diagnosticsJson !== "object" || Array.isArray(diagnosticsJson)) {
      return null;
    }

    return diagnosticsJson.partial === true ? diagnosticsJson : null;
  }

  private isNonRetryableFailedDocument(document: { status?: DocumentStatus; diagnosticsJson?: Prisma.JsonValue | null }) {
    if (document.status !== DocumentStatus.failed) {
      return false;
    }

    if (!document.diagnosticsJson || typeof document.diagnosticsJson !== "object" || Array.isArray(document.diagnosticsJson)) {
      return false;
    }

    return document.diagnosticsJson.retryable === false;
  }

  private wasRunTransitionApplied(result: unknown) {
    if (typeof result === "number") {
      return result === 1;
    }

    if (result && typeof result === "object" && "count" in result && typeof result.count === "number") {
      return result.count === 1;
    }

    return true;
  }

  private async ensureCurrentDocumentVersion(document: { id: string; version: number }) {
    const currentDocument = await this.prisma.document.findUnique({
      where: {
        id: document.id
      },
      select: {
        version: true
      }
    });

    if (!currentDocument || currentDocument.version === document.version) {
      return true;
    }

    await this.documentRunsService.markRunSkipped(document.id, document.version, {
      failedStage: DocumentRunFailedStage.stale_guard,
      diagnosticsJson: createErrorDiagnostics(
        ErrorCode.INGESTION_RUN_SUPERSEDED,
        "stale_guard",
        false,
        document.version,
        "Skipped stale ingestion job because a newer document version became active during processing.",
        {
          currentDocumentVersion: currentDocument.version
        }
      )
    });
    this.logger.warn(
      `Stopping stale ingestion job for document ${document.id}: job version ${document.version}, current version ${currentDocument.version}.`
    );

    return false;
  }
}
