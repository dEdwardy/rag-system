import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DocumentProcessingStage, DocumentRunFailedStage, DocumentRunTrigger, DocumentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import { FeedSourceService } from "../../infra/feed-source/feed-source.service";
import { SitemapSourceService } from "../../infra/sitemap-source/sitemap-source.service";
import { StorageService } from "../../infra/storage/storage.service";
import { WebPageService } from "../../infra/web-page/web-page.service";
import { DocumentRunsService } from "../document-runs/document-runs.service";
import { IngestionService } from "../ingestion/ingestion.service";
import { IndexingService } from "../indexing/indexing.service";
import { KnowledgeBasesService } from "../knowledge-bases/knowledge-bases.service";
import {
  CompareKnowledgeBaseDocumentRunsInput,
  CreateDocumentInput,
  CreateFeedDocumentInput,
  CreateSitemapDocumentInput,
  CreateWebPageDocumentInput,
  ListDocumentRunsInput,
  ListKnowledgeBaseDocumentsInput,
  ListKnowledgeBaseDocumentRunsInput
} from "./document.schemas";

type ExternalSourceConfig =
  | { kind: "web_page"; url: string }
  | { kind: "feed"; url: string; maxItems: number }
  | { kind: "sitemap"; url: string; maxPages: number };

type FetchedExternalSource = {
  title: string | null;
  content: string;
  diagnostics?: ExternalSourcePartialDiagnostics | null;
};

type ExternalSourcePartialDiagnostics = Record<string, Prisma.InputJsonValue> & {
  partial: boolean;
};

type DocumentAccessScope = {
  tenantId: string;
  userId: string;
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeBasesService: KnowledgeBasesService,
    private readonly storageService: StorageService,
    private readonly feedSourceService: FeedSourceService,
    private readonly sitemapSourceService: SitemapSourceService,
    private readonly webPageService: WebPageService,
    private readonly documentRunsService: DocumentRunsService,
    private readonly ingestionService: IngestionService,
    private readonly indexingService: IndexingService
  ) {}

  async listKnowledgeBaseDocuments(
    knowledgeBaseId: string,
    input: ListKnowledgeBaseDocumentsInput,
    scope?: DocumentAccessScope | null
  ) {
    await this.knowledgeBasesService.getKnowledgeBase(knowledgeBaseId, scope);

    return this.prisma.document.findMany({
      where: {
        kbId: knowledgeBaseId
      },
      ...(input.limit === undefined ? {} : { take: input.limit }),
      orderBy: {
        updatedAt: "desc"
      }
    });
  }

  async listKnowledgeBaseDocumentRuns(
    knowledgeBaseId: string,
    input: ListKnowledgeBaseDocumentRunsInput,
    scope?: DocumentAccessScope | null
  ) {
    await this.knowledgeBasesService.getKnowledgeBase(knowledgeBaseId, scope);
    return this.documentRunsService.listKnowledgeBaseRuns(knowledgeBaseId, input);
  }

  async getKnowledgeBaseDocumentRunSummary(
    knowledgeBaseId: string,
    input?: Pick<
      ListKnowledgeBaseDocumentRunsInput,
      "documentId" | "sourceType" | "status" | "trigger" | "issueOnly" | "sinceHours"
    >,
    scope?: DocumentAccessScope | null
  ) {
    await this.knowledgeBasesService.getKnowledgeBase(knowledgeBaseId, scope);
    return this.documentRunsService.getKnowledgeBaseRunSummary(knowledgeBaseId, input);
  }

  async getKnowledgeBaseDocumentRunComparison(
    knowledgeBaseId: string,
    input: CompareKnowledgeBaseDocumentRunsInput,
    scope?: DocumentAccessScope | null
  ) {
    await this.knowledgeBasesService.getKnowledgeBase(knowledgeBaseId, scope);
    return this.documentRunsService.getKnowledgeBaseRunComparison(knowledgeBaseId, input);
  }

  async getDocument(id: string, scope?: DocumentAccessScope | null) {
    const document = await this.prisma.document.findUnique({
      where: {
        id
      }
    });

    if (!document) {
      throw new NotFoundException(`Document ${id} not found.`);
    }

    if (scope) {
      await this.knowledgeBasesService.getKnowledgeBase(document.kbId, scope);
    }

    return document;
  }

  async listDocumentChunks(id: string, scope?: DocumentAccessScope | null) {
    await this.getDocument(id, scope);

    return this.prisma.documentChunk.findMany({
      where: {
        documentId: id
      },
      orderBy: {
        chunkIndex: "asc"
      }
    });
  }

  async listDocumentRuns(id: string, input: ListDocumentRunsInput, scope?: DocumentAccessScope | null) {
    await this.getDocument(id, scope);
    return this.documentRunsService.listDocumentRuns(id, input);
  }

  async createDocument(knowledgeBaseId: string, input: CreateDocumentInput, scope?: DocumentAccessScope | null) {
    await this.knowledgeBasesService.getKnowledgeBase(knowledgeBaseId, scope);

    return this.prisma.document.create({
      data: {
        kbId: knowledgeBaseId,
        sourceType: input.sourceType,
        sourceName: input.sourceName,
        title: input.title,
        mimeType: input.mimeType,
        storageKey: input.storageKey,
        sourceConfigJson: Prisma.JsonNull,
        status: DocumentStatus.pending,
        processingStage: DocumentProcessingStage.uploaded,
        diagnosticsJson: Prisma.JsonNull
      }
    });
  }

  async uploadDocument(
    knowledgeBaseId: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    },
    scope?: DocumentAccessScope | null
  ) {
    const storedFile = await this.storageService.saveUploadedFile({
      buffer: file.buffer,
      originalName: file.originalname
    });

    const document = await this.createDocument(
      knowledgeBaseId,
      {
      sourceType: "upload",
      sourceName: file.originalname,
      title: file.originalname,
      mimeType: file.mimetype || "application/octet-stream",
      storageKey: storedFile.storageKey
      },
      scope
    );

    await this.documentRunsService.createRun({
      documentId: document.id,
      version: document.version,
      trigger: DocumentRunTrigger.upload
    });
    await this.enqueueIngestionDocumentOrRecordFailure(document);

    return document;
  }

  async createWebPageDocument(
    knowledgeBaseId: string,
    input: CreateWebPageDocumentInput,
    scope?: DocumentAccessScope | null
  ) {
    const normalizedUrl = this.normalizeRemoteSourceUrl(input.url);
    const reservedDocument = await this.reserveExternalDocument(
      knowledgeBaseId,
      {
      sourceType: "web_page",
      sourceName: normalizedUrl,
      title: input.title ?? null,
      sourceConfig: {
        kind: "web_page",
        url: normalizedUrl
      }
      },
      scope
    );
    await this.documentRunsService.createRun({
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      trigger: DocumentRunTrigger.external_resync
    });

    if (!(await this.shouldContinueCurrentExternalRun(reservedDocument))) {
      return this.getDocument(reservedDocument.id);
    }

    const fetchedPage = await this.fetchExternalSourceOrRecordFailure(
      reservedDocument,
      () => this.webPageService.fetchWebPage(normalizedUrl)
    );
    const finalizedDocument = await this.persistExternalSourceResultOrRecordFailure(reservedDocument, async () => {
      const storedFile = await this.storageService.saveGeneratedTextFile({
        content: fetchedPage.content
      });

      return this.finalizeExternalDocument(reservedDocument, {
        title: input.title ?? fetchedPage.title ?? reservedDocument.title ?? this.buildRemoteSourceFallbackTitle(normalizedUrl),
        mimeType: "text/plain",
        storageKey: storedFile.storageKey,
        diagnosticsJson: this.buildExternalSourcePartialDiagnostics(
          reservedDocument.version,
          fetchedPage.diagnostics,
          this.buildWebPartialDiagnosticsMessage(fetchedPage.diagnostics),
          false,
          "web"
        )
      });
    });

    if (finalizedDocument.applied) {
      await this.enqueueExternalDocumentOrRecordFailure(finalizedDocument.document);
    }

    return finalizedDocument.document;
  }

  async createFeedDocument(knowledgeBaseId: string, input: CreateFeedDocumentInput, scope?: DocumentAccessScope | null) {
    const normalizedUrl = this.normalizeRemoteSourceUrl(input.url);
    const reservedDocument = await this.reserveExternalDocument(
      knowledgeBaseId,
      {
      sourceType: "feed",
      sourceName: normalizedUrl,
      title: input.title ?? null,
      sourceConfig: {
        kind: "feed",
        url: normalizedUrl,
        maxItems: input.maxItems
      }
      },
      scope
    );
    await this.documentRunsService.createRun({
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      trigger: DocumentRunTrigger.external_resync
    });

    if (!(await this.shouldContinueCurrentExternalRun(reservedDocument))) {
      return this.getDocument(reservedDocument.id);
    }

    const fetchedFeed = await this.fetchExternalSourceOrRecordFailure(reservedDocument, () =>
      this.feedSourceService.fetchFeed({
        url: normalizedUrl,
        maxItems: input.maxItems
      })
    );
    const finalizedDocument = await this.persistExternalSourceResultOrRecordFailure(reservedDocument, async () => {
      const storedFile = await this.storageService.saveGeneratedTextFile({
        content: fetchedFeed.content
      });

      return this.finalizeExternalDocument(reservedDocument, {
        title: input.title ?? fetchedFeed.title ?? reservedDocument.title ?? this.buildRemoteSourceFallbackTitle(normalizedUrl),
        mimeType: "text/plain",
        storageKey: storedFile.storageKey,
        diagnosticsJson: this.buildExternalSourcePartialDiagnostics(
          reservedDocument.version,
          fetchedFeed.diagnostics,
          this.buildFeedPartialDiagnosticsMessage(fetchedFeed.diagnostics),
          false,
          "feed"
        )
      });
    });

    if (finalizedDocument.applied) {
      await this.enqueueExternalDocumentOrRecordFailure(finalizedDocument.document);
    }

    return finalizedDocument.document;
  }

  async createSitemapDocument(
    knowledgeBaseId: string,
    input: CreateSitemapDocumentInput,
    scope?: DocumentAccessScope | null
  ) {
    const normalizedUrl = this.normalizeRemoteSourceUrl(input.url);
    const reservedDocument = await this.reserveExternalDocument(
      knowledgeBaseId,
      {
      sourceType: "sitemap",
      sourceName: normalizedUrl,
      title: input.title ?? null,
      sourceConfig: {
        kind: "sitemap",
        url: normalizedUrl,
        maxPages: input.maxPages
      }
      },
      scope
    );
    await this.documentRunsService.createRun({
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      trigger: DocumentRunTrigger.external_resync
    });

    if (!(await this.shouldContinueCurrentExternalRun(reservedDocument))) {
      return this.getDocument(reservedDocument.id);
    }

    const fetchedSitemap = await this.fetchExternalSourceOrRecordFailure(reservedDocument, () =>
      this.sitemapSourceService.fetchSitemap({
        url: normalizedUrl,
        maxPages: input.maxPages
      })
    );
    const finalizedDocument = await this.persistExternalSourceResultOrRecordFailure(reservedDocument, async () => {
      const storedFile = await this.storageService.saveGeneratedTextFile({
        content: fetchedSitemap.content
      });

      return this.finalizeExternalDocument(reservedDocument, {
        title: input.title ?? reservedDocument.title ?? this.buildRemoteSourceFallbackTitle(normalizedUrl),
        mimeType: "text/plain",
        storageKey: storedFile.storageKey,
        diagnosticsJson: this.buildExternalSourcePartialDiagnostics(
          reservedDocument.version,
          fetchedSitemap.diagnostics,
          this.buildSitemapPartialDiagnosticsMessage(fetchedSitemap.diagnostics),
          true,
          "sitemap"
        )
      });
    });

    if (finalizedDocument.applied) {
      await this.enqueueExternalDocumentOrRecordFailure(finalizedDocument.document);
    }

    return finalizedDocument.document;
  }

  async reindexDocument(id: string, scope?: DocumentAccessScope | null) {
    const document = await this.getDocument(id, scope);

    if (this.isExternalSourceType(document.sourceType)) {
      return this.resyncExternalDocument(document);
    }

    const updatedDocument = await this.prisma.document.update({
      where: { id },
      data: {
        status: DocumentStatus.pending,
        processingStage: DocumentProcessingStage.uploaded,
        chunkCount: 0,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    });

    await this.documentRunsService.createRun({
      documentId: updatedDocument.id,
      version: updatedDocument.version,
      trigger: DocumentRunTrigger.reindex
    });
    await this.enqueueIngestionDocumentOrRecordFailure(updatedDocument);

    return this.getDocument(id);
  }

  async deleteDocument(id: string, scope?: DocumentAccessScope | null) {
    const document = await this.getDocument(id, scope);
    await this.indexingService.deleteDocumentIndex(document.id);
    await this.prisma.document.delete({
      where: { id }
    });

    return {
      success: true
    };
  }

  private buildRemoteSourceFallbackTitle(url: string) {
    const parsed = new URL(url);
    const path = `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
    return path.slice(0, 255);
  }

  private async reserveExternalDocument(
    knowledgeBaseId: string,
    input: {
      sourceType: string;
      sourceName: string;
      title: string | null;
      sourceConfig: ExternalSourceConfig;
    },
    scope?: DocumentAccessScope | null
  ) {
    await this.knowledgeBasesService.getKnowledgeBase(knowledgeBaseId, scope);

    const existingDocument = await this.prisma.document.findFirst({
      where: {
        kbId: knowledgeBaseId,
        sourceType: input.sourceType,
        sourceName: input.sourceName
      }
    });

    if (!existingDocument) {
      return this.prisma.document.create({
        data: {
          kbId: knowledgeBaseId,
          sourceType: input.sourceType,
          sourceName: input.sourceName,
          title: input.title ?? this.buildRemoteSourceFallbackTitle(input.sourceName),
          mimeType: "text/plain",
          storageKey: "external-source:pending",
          sourceConfigJson: input.sourceConfig,
          status: DocumentStatus.pending,
          processingStage: DocumentProcessingStage.uploaded,
          diagnosticsJson: Prisma.JsonNull
        }
      });
    }

    return this.prisma.document.update({
      where: {
        id: existingDocument.id
      },
      data: {
        sourceName: input.sourceName,
        title: input.title ?? existingDocument.title ?? this.buildRemoteSourceFallbackTitle(input.sourceName),
        sourceConfigJson: input.sourceConfig,
        status: DocumentStatus.pending,
        processingStage: DocumentProcessingStage.uploaded,
        chunkCount: 0,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    });
  }

  private async finalizeExternalDocument(
    document: {
      id: string;
      version: number;
    },
    input: Pick<CreateDocumentInput, "title" | "mimeType" | "storageKey"> & {
      diagnosticsJson?: Prisma.InputJsonValue | null;
    }
  ) {
    const applied = await this.updateExternalDocumentIfCurrent(document, {
      title: input.title,
      mimeType: input.mimeType,
      storageKey: input.storageKey,
      status: DocumentStatus.pending,
      processingStage: DocumentProcessingStage.uploaded,
      errorMessage: null,
      diagnosticsJson: input.diagnosticsJson ?? Prisma.JsonNull
    });

    if (!applied) {
      return {
        document: await this.getDocument(document.id),
        applied: false
      };
    }

    return {
      document: await this.resolveExternalDocumentAfterUpdate(document),
      applied: true
    };
  }

  private async resolveExternalDocumentAfterUpdate(document: { id: string; version: number }) {
    if (typeof this.prisma.document.findUnique === "function") {
      const currentDocument = await this.prisma.document.findUnique({
        where: { id: document.id }
      });

      if (currentDocument) {
        return {
          ...currentDocument,
          id: document.id
        };
      }
    }

    return {
      id: document.id,
      version: document.version
    };
  }

  private async recordExternalFailureIfCurrent(
    document: {
      id: string;
      version: number;
    },
    diagnostics: Prisma.InputJsonValue,
    message: string
  ) {
    const applied = await this.updateExternalDocumentIfCurrent(document, {
      status: DocumentStatus.failed,
      processingStage: DocumentProcessingStage.failed,
      errorMessage: message,
      diagnosticsJson: diagnostics
    });

    if (!applied) {
      return false;
    }

    await this.documentRunsService.markRunFailed(document.id, document.version, {
      failedStage: DocumentRunFailedStage.source_fetch,
      diagnosticsJson: diagnostics
    });

    return true;
  }

  private async updateExternalDocumentIfCurrent(
    document: {
      id: string;
      version: number;
    },
    data: Prisma.DocumentUpdateManyMutationInput
  ) {
    if (typeof this.prisma.document.updateMany === "function") {
      const result = await this.prisma.document.updateMany({
        where: {
          id: document.id,
          version: document.version
        },
        data
      });

      if (result.count > 0) {
        return true;
      }

      await this.ensureCurrentExternalDocumentVersion(document);
      return false;
    }

    if (!(await this.ensureCurrentExternalDocumentVersion(document))) {
      return false;
    }

    await this.prisma.document.update({
      where: { id: document.id },
      data
    });

    return true;
  }

  private async fetchExternalSourceOrRecordFailure<T>(
    document: {
      id: string;
      version: number;
      sourceType?: string;
      sourceName?: string;
    },
    operation: () => Promise<T>
  ) {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown external source fetch error.";
      const retryable = this.isRetryableExternalSourceError(error);
      const diagnostics: Record<string, Prisma.InputJsonValue> = {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable,
        documentVersion: document.version,
        message
      };

      if (typeof document.sourceType === "string") {
        diagnostics.sourceType = document.sourceType;
      }

      if (typeof document.sourceName === "string") {
        diagnostics.sourceName = document.sourceName;
      }

      await this.recordExternalFailureIfCurrent(document, diagnostics, message);

      throw error;
    }
  }

  private async persistExternalSourceResultOrRecordFailure<T>(
    document: {
      id: string;
      version: number;
    },
    operation: () => Promise<T>
  ) {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown external source persistence error.";
      const retryable = this.isRetryableExternalSourceError(error);
      const diagnostics = {
        code: "EXTERNAL_SOURCE_PERSIST_FAILED",
        failedStage: "source_fetch",
        retryable,
        documentVersion: document.version,
        message
      } satisfies Prisma.InputJsonValue;

      await this.recordExternalFailureIfCurrent(document, diagnostics, message);

      throw error;
    }
  }

  private async enqueueIngestionDocumentOrRecordFailure(document: { id: string; version: number }) {
    try {
      await this.ingestionService.enqueueDocument(document.id, document.version);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown ingestion enqueue error.";
      const diagnostics = {
        code: "INGESTION_ENQUEUE_FAILED",
        failedStage: "parsing",
        retryable: true,
        documentVersion: document.version,
        message
      } satisfies Prisma.InputJsonValue;

      await this.recordIngestionFailureIfCurrent(document, diagnostics, message);

      throw error;
    }
  }

  private async enqueueExternalDocumentOrRecordFailure(document: { id: string; version: number }) {
    try {
      await this.ingestionService.enqueueDocument(document.id, document.version);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown external enqueue error.";
      const diagnostics = {
        code: "EXTERNAL_SOURCE_ENQUEUE_FAILED",
        failedStage: "source_fetch",
        retryable: true,
        documentVersion: document.version,
        message
      } satisfies Prisma.InputJsonValue;

      await this.recordExternalFailureIfCurrent(document, diagnostics, message);

      throw error;
    }
  }

  private normalizeRemoteSourceUrl(url: string) {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  }

  private async resyncExternalDocument(document: Awaited<ReturnType<DocumentsService["getDocument"]>>) {
    const queuedDocument = await this.prisma.document.update({
      where: { id: document.id },
      data: {
        status: DocumentStatus.pending,
        processingStage: DocumentProcessingStage.uploaded,
        chunkCount: 0,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    });
    await this.documentRunsService.createRun({
      documentId: queuedDocument.id,
      version: queuedDocument.version,
      trigger: DocumentRunTrigger.external_resync
    });

    if (!(await this.shouldContinueCurrentExternalRun(queuedDocument))) {
      return this.getDocument(document.id);
    }

    const sourceConfig = await this.parseExternalSourceConfigOrRecordFailure(
      queuedDocument,
      document.sourceConfigJson,
      {
        sourceType: queuedDocument.sourceType ?? document.sourceType,
        sourceName: queuedDocument.sourceName ?? document.sourceName
      }
    );

    const fetchedSource = await this.fetchExternalSourceOrRecordFailure(queuedDocument, () =>
      this.fetchExternalSourceFromConfig(sourceConfig)
    );
    const finalizedDocument = await this.persistExternalSourceResultOrRecordFailure(queuedDocument, async () => {
      const storedFile = await this.storageService.saveGeneratedTextFile({
        content: fetchedSource.content
      });

      return this.finalizeExternalDocument(queuedDocument, {
        title: fetchedSource.title ?? document.title ?? this.buildRemoteSourceFallbackTitle(document.sourceName),
        mimeType: "text/plain",
        storageKey: storedFile.storageKey,
        diagnosticsJson:
          sourceConfig.kind === "sitemap"
               ? (this.buildExternalSourcePartialDiagnostics(
                   queuedDocument.version,
                   fetchedSource.diagnostics ?? null,
                   this.buildSitemapPartialDiagnosticsMessage(fetchedSource.diagnostics ?? null),
                   true,
                   "sitemap"
                 ) ??
                null)
              : sourceConfig.kind === "feed"
                ? (this.buildExternalSourcePartialDiagnostics(
                    queuedDocument.version,
                    fetchedSource.diagnostics ?? null,
                    this.buildFeedPartialDiagnosticsMessage(fetchedSource.diagnostics ?? null),
                    false,
                    "feed"
                  ) ??
                null)
             : sourceConfig.kind === "web_page"
                ? (this.buildExternalSourcePartialDiagnostics(
                    queuedDocument.version,
                    fetchedSource.diagnostics ?? null,
                    this.buildWebPartialDiagnosticsMessage(fetchedSource.diagnostics ?? null),
                    false,
                    "web"
                  ) ??
               null)
             : null
      });
    });

    if (finalizedDocument.applied) {
      await this.enqueueExternalDocumentOrRecordFailure(finalizedDocument.document);
    }

    return this.getDocument(document.id);
  }

  private async parseExternalSourceConfigOrRecordFailure(
    document: {
      id: string;
      version: number;
    },
    value: Prisma.JsonValue | null,
    legacyExternalIdentity?: {
      sourceType?: string;
      sourceName?: string;
    }
  ) {
    try {
      return this.parseExternalSourceConfig(value, legacyExternalIdentity);
    } catch (error) {
      const message = error instanceof Error ? error.message : "External source config is invalid.";
      const diagnostics = {
        code: "EXTERNAL_SOURCE_CONFIG_INVALID",
        failedStage: "source_fetch",
        retryable: false,
        documentVersion: document.version,
        message
      } satisfies Prisma.InputJsonValue;

      await this.recordExternalFailureIfCurrent(document, diagnostics, message);

      throw error;
    }
  }

  private async ensureCurrentExternalDocumentVersion(document: { id: string; version: number }) {
    if (typeof this.prisma.document.findUnique !== "function") {
      return true;
    }

    const currentDocument = await this.prisma.document.findUnique({
      where: { id: document.id },
      select: {
        version: true
      }
    });

    if (!currentDocument || currentDocument.version === document.version) {
      return true;
    }

    await this.documentRunsService.markRunSkipped(document.id, document.version, {
      failedStage: DocumentRunFailedStage.stale_guard,
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_RUN_SUPERSEDED",
          failedStage: "stale_guard",
          retryable: false,
          documentVersion: document.version,
          message: "Skipped stale external source update because a newer document version is already active.",
          currentDocumentVersion: currentDocument.version
      }
    });

    return false;
  }

  private async shouldContinueCurrentExternalRun(document: { id: string; version: number }) {
    return this.ensureCurrentExternalDocumentVersion(document);
  }

  private async recordIngestionFailureIfCurrent(
    document: {
      id: string;
      version: number;
    },
    diagnostics: Prisma.InputJsonValue,
    message: string
  ) {
    if (!(await this.ensureCurrentIngestionDocumentVersion(document))) {
      return false;
    }

    await this.prisma.document.update({
      where: { id: document.id },
      data: {
        status: DocumentStatus.failed,
        processingStage: DocumentProcessingStage.failed,
        errorMessage: message,
        diagnosticsJson: diagnostics
      }
    });
    await this.documentRunsService.markRunFailed(document.id, document.version, {
      failedStage: DocumentRunFailedStage.parsing,
      diagnosticsJson: diagnostics
    });

    return true;
  }

  private async ensureCurrentIngestionDocumentVersion(document: { id: string; version: number }) {
    if (typeof this.prisma.document.findUnique !== "function") {
      return true;
    }

    const currentDocument = await this.prisma.document.findUnique({
      where: { id: document.id },
      select: {
        version: true
      }
    });

    if (!currentDocument || currentDocument.version === document.version) {
      return true;
    }

    await this.documentRunsService.markRunSkipped(document.id, document.version, {
      failedStage: DocumentRunFailedStage.stale_guard,
      diagnosticsJson: {
        code: "INGESTION_RUN_SUPERSEDED",
        failedStage: "stale_guard",
        retryable: false,
        documentVersion: document.version,
        message: "Skipped stale ingestion enqueue failure handling because a newer document version is already active.",
        currentDocumentVersion: currentDocument.version
      }
    });

    return false;
  }

  private parseExternalSourceConfig(
    value: Prisma.JsonValue | null,
    legacyExternalIdentity?: {
      sourceType?: string;
      sourceName?: string;
    }
  ): ExternalSourceConfig {
    const legacyFallbackConfig = this.resolveLegacyExternalSourceConfigFromDocumentIdentity(
      legacyExternalIdentity
    );

    if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.kind !== "string") {
      if (legacyFallbackConfig) {
        return legacyFallbackConfig;
      }

      throw new Error("External source config is missing.");
    }

    if (value.kind === "web_page" && typeof value.url === "string") {
      return {
        kind: "web_page",
        url: value.url
      };
    }

    if (value.kind === "feed" && typeof value.url === "string") {
      const maxItems = this.resolveExternalSourceBoundOrLegacyDefault(value.maxItems);

      if (maxItems !== null) {
        return {
          kind: "feed",
          url: value.url,
          maxItems
        };
      }
    }

    if (value.kind === "sitemap" && typeof value.url === "string") {
      const maxPages = this.resolveExternalSourceBoundOrLegacyDefault(value.maxPages);

      if (maxPages !== null) {
        return {
          kind: "sitemap",
          url: value.url,
          maxPages
        };
      }
    }

    if (legacyFallbackConfig) {
      return legacyFallbackConfig;
    }

    throw new Error("External source config is invalid.");
  }

  private resolveLegacyExternalSourceConfigFromDocumentIdentity(identity?: {
    sourceType?: string;
    sourceName?: string;
  }): ExternalSourceConfig | null {
    if (!identity || typeof identity.sourceName !== "string") {
      return null;
    }

    const normalizedSourceType =
      typeof identity.sourceType === "string" ? identity.sourceType.trim().toLowerCase() : undefined;

    let normalizedSourceName: string;
    try {
      normalizedSourceName = this.normalizeRemoteSourceUrl(identity.sourceName);
    } catch {
      return null;
    }

    if (normalizedSourceType === "web_page") {
      return {
        kind: "web_page",
        url: normalizedSourceName
      };
    }

    if (normalizedSourceType === "feed") {
      return {
        kind: "feed",
        url: normalizedSourceName,
        maxItems: 20
      };
    }

    if (normalizedSourceType === "sitemap") {
      return {
        kind: "sitemap",
        url: normalizedSourceName,
        maxPages: 20
      };
    }

    return null;
  }

  private async fetchExternalSourceFromConfig(sourceConfig: ExternalSourceConfig): Promise<FetchedExternalSource> {
    if (sourceConfig.kind === "web_page") {
      return this.webPageService.fetchWebPage(sourceConfig.url);
    }

    if (sourceConfig.kind === "feed") {
      return this.feedSourceService.fetchFeed({
        url: sourceConfig.url,
        maxItems: sourceConfig.maxItems
      });
    }

    const fetchedSitemap = await this.sitemapSourceService.fetchSitemap({
      url: sourceConfig.url,
      maxPages: sourceConfig.maxPages
    });

    return {
      title: null,
      content: fetchedSitemap.content,
      diagnostics: fetchedSitemap.diagnostics
    };
  }

  private isExternalSourceType(sourceType: string) {
    const normalizedSourceType = sourceType.trim().toLowerCase();
    return normalizedSourceType === "web_page" || normalizedSourceType === "feed" || normalizedSourceType === "sitemap";
  }

  private isRetryableExternalSourceError(error: unknown) {
    return !(error instanceof BadRequestException);
  }

  private buildExternalSourcePartialDiagnostics(
    documentVersion: number,
    diagnostics: ExternalSourcePartialDiagnostics | null | undefined,
    message: string,
    retryable: boolean,
    sourceKind: "feed" | "sitemap" | "web"
  ) {
    if (!diagnostics?.partial) {
      return null;
    }

    const retryableFailureCount = this.getNumericDiagnosticField(diagnostics, "retryableFailureCount");
    const nonRetryableFailureCount = this.getNumericDiagnosticField(diagnostics, "nonRetryableFailureCount");
    const contentTypeFallbackApplied = diagnostics.contentTypeFallbackApplied === true;
    const bodyMissing = diagnostics.bodyMissing === true;
    const bodyQualityLow = diagnostics.bodyQualityLow === true;
    const partialFailureCount =
      this.getNumericDiagnosticField(diagnostics, "failedEntryCount") +
      this.getNumericDiagnosticField(diagnostics, "failedPageCount") +
      this.getNumericDiagnosticField(diagnostics, "failedChildSitemapCount") +
      this.getNumericDiagnosticField(diagnostics, "skippedDuplicateEntryCount");
    const partialSignalCount =
      partialFailureCount + (contentTypeFallbackApplied ? 1 : 0) + (bodyMissing ? 1 : 0) + (bodyQualityLow ? 1 : 0);
    const boundaryHit = diagnostics.boundaryHit === true;
    const boundaryReasons = Array.isArray(diagnostics.boundaryReasons)
      ? diagnostics.boundaryReasons.filter((reason): reason is string => typeof reason === "string")
      : [];
    const resolvedRetryable =
      typeof diagnostics.retryable === "boolean"
        ? diagnostics.retryable
        : retryableFailureCount > 0
          ? true
          : retryable;

    return {
      ...diagnostics,
      code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
      failedStage: "source_fetch",
      retryable: resolvedRetryable,
      documentVersion,
      sourceKind,
      schemaVersion: 2,
      category: "external_source_partial",
      partialFailureCount: partialSignalCount,
      retryableFailureCount,
      nonRetryableFailureCount,
      boundaryHit,
      boundaryReasons,
      message,
      partial: true
    } satisfies Prisma.InputJsonValue;
  }

  private buildSitemapPartialDiagnosticsMessage(diagnostics: ExternalSourcePartialDiagnostics | null | undefined) {
    const failedPageCount = this.getNumericDiagnosticField(diagnostics, "failedPageCount");
    const failedChildSitemapCount = this.getNumericDiagnosticField(diagnostics, "failedChildSitemapCount");
    const contentTypeFallbackApplied = diagnostics?.contentTypeFallbackApplied === true;

    if (failedPageCount > 0 && failedChildSitemapCount > 0) {
      return "Sitemap source completed with partial child sitemap and page fetch failures.";
    }

    if (failedChildSitemapCount > 0) {
      return "Sitemap source completed with partial child sitemap fetch failures.";
    }

    if (contentTypeFallbackApplied) {
      return "Sitemap source completed with content-type fallback sniffing.";
    }

    return "Sitemap source completed with partial page fetch failures.";
  }

  private buildFeedPartialDiagnosticsMessage(diagnostics: ExternalSourcePartialDiagnostics | null | undefined) {
    const failedEntryCount = this.getNumericDiagnosticField(diagnostics, "failedEntryCount");
    const skippedDuplicateEntryCount = this.getNumericDiagnosticField(diagnostics, "skippedDuplicateEntryCount");
    const boundaryHit = diagnostics?.boundaryHit === true;
    const contentTypeFallbackApplied = diagnostics?.contentTypeFallbackApplied === true;

    if (failedEntryCount > 0) {
      return "Feed source completed with partial entry validation failures.";
    }

    if (skippedDuplicateEntryCount > 0) {
      return "Feed source completed with duplicate entries skipped.";
    }

    if (boundaryHit) {
      return "Feed source completed with max-items boundary truncation.";
    }

    if (contentTypeFallbackApplied) {
      return "Feed source completed with content-type fallback sniffing.";
    }

    return "Feed source completed with partial diagnostics.";
  }

  private buildWebPartialDiagnosticsMessage(diagnostics: ExternalSourcePartialDiagnostics | null | undefined) {
    const bodyMissing = diagnostics?.bodyMissing === true;
    const bodyQualityLow = diagnostics?.bodyQualityLow === true;
    const contentTypeFallbackApplied = diagnostics?.contentTypeFallbackApplied === true;

    if (bodyMissing && contentTypeFallbackApplied) {
      return "Web page source completed with content-type fallback sniffing and body-missing diagnostics.";
    }

    if (bodyMissing) {
      return "Web page source completed with body-missing diagnostics.";
    }

    if (bodyQualityLow && contentTypeFallbackApplied) {
      return "Web page source completed with content-type fallback sniffing and low body-quality diagnostics.";
    }

    if (bodyQualityLow) {
      return "Web page source completed with low body-quality diagnostics.";
    }

    if (contentTypeFallbackApplied) {
      return "Web page source completed with content-type fallback sniffing.";
    }

    return "Web page source completed with partial diagnostics.";
  }

  private getNumericDiagnosticField(
    diagnostics: ExternalSourcePartialDiagnostics | null | undefined,
    key: string
  ) {
    const value = diagnostics?.[key];
    return typeof value === "number" ? value : 0;
  }

  private resolveExternalSourceBoundOrLegacyDefault(value: unknown) {
    if (typeof value === "number") {
      return value;
    }

    if (value === undefined || value === null) {
      return 20;
    }

    return null;
  }
}
