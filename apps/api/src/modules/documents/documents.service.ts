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
  CreateDocumentInput,
  CreateFeedDocumentInput,
  CreateSitemapDocumentInput,
  CreateWebPageDocumentInput,
  ListKnowledgeBaseDocumentRunsInput
} from "./document.schemas";

type ExternalSourceConfig =
  | { kind: "web_page"; url: string }
  | { kind: "feed"; url: string; maxItems: number }
  | { kind: "sitemap"; url: string; maxPages: number };

type FetchedExternalSource = {
  title: string | null;
  content: string;
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

  async listKnowledgeBaseDocuments(knowledgeBaseId: string) {
    await this.knowledgeBasesService.getKnowledgeBase(knowledgeBaseId);

    return this.prisma.document.findMany({
      where: {
        kbId: knowledgeBaseId
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async listKnowledgeBaseDocumentRuns(
    knowledgeBaseId: string,
    input: ListKnowledgeBaseDocumentRunsInput
  ) {
    await this.knowledgeBasesService.getKnowledgeBase(knowledgeBaseId);
    return this.documentRunsService.listKnowledgeBaseRuns(knowledgeBaseId, input);
  }

  async getKnowledgeBaseDocumentRunSummary(
    knowledgeBaseId: string,
    input?: Pick<ListKnowledgeBaseDocumentRunsInput, "sinceHours">
  ) {
    await this.knowledgeBasesService.getKnowledgeBase(knowledgeBaseId);
    return this.documentRunsService.getKnowledgeBaseRunSummary(knowledgeBaseId, input);
  }

  async getDocument(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id }
    });

    if (!document) {
      throw new NotFoundException(`Document ${id} not found.`);
    }

    return document;
  }

  async listDocumentChunks(id: string) {
    await this.getDocument(id);

    return this.prisma.documentChunk.findMany({
      where: {
        documentId: id
      },
      orderBy: {
        chunkIndex: "asc"
      }
    });
  }

  async listDocumentRuns(id: string) {
    await this.getDocument(id);
    return this.documentRunsService.listDocumentRuns(id);
  }

  async createDocument(knowledgeBaseId: string, input: CreateDocumentInput) {
    await this.knowledgeBasesService.getKnowledgeBase(knowledgeBaseId);

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
    }
  ) {
    const storedFile = await this.storageService.saveUploadedFile({
      buffer: file.buffer,
      originalName: file.originalname
    });

    const document = await this.createDocument(knowledgeBaseId, {
      sourceType: "upload",
      sourceName: file.originalname,
      title: file.originalname,
      mimeType: file.mimetype || "application/octet-stream",
      storageKey: storedFile.storageKey
    });

    await this.documentRunsService.createRun({
      documentId: document.id,
      version: document.version,
      trigger: DocumentRunTrigger.upload
    });
    await this.ingestionService.enqueueDocument(document.id, document.version);

    return document;
  }

  async createWebPageDocument(knowledgeBaseId: string, input: CreateWebPageDocumentInput) {
    const normalizedUrl = this.normalizeRemoteSourceUrl(input.url);
    const reservedDocument = await this.reserveExternalDocument(knowledgeBaseId, {
      sourceType: "web_page",
      sourceName: normalizedUrl,
      title: input.title ?? this.buildRemoteSourceFallbackTitle(normalizedUrl),
      sourceConfig: {
        kind: "web_page",
        url: normalizedUrl
      }
    });
    await this.documentRunsService.createRun({
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      trigger: DocumentRunTrigger.external_resync
    });

    const fetchedPage = await this.fetchExternalSourceOrRecordFailure(
      reservedDocument,
      () => this.webPageService.fetchWebPage(normalizedUrl)
    );
    const storedFile = await this.storageService.saveGeneratedTextFile({
      content: fetchedPage.content
    });

    const document = await this.finalizeExternalDocument(reservedDocument.id, {
      title: input.title ?? fetchedPage.title ?? this.buildRemoteSourceFallbackTitle(normalizedUrl),
      mimeType: "text/plain",
      storageKey: storedFile.storageKey
    });

    await this.ingestionService.enqueueDocument(document.id, document.version);

    return document;
  }

  async createFeedDocument(knowledgeBaseId: string, input: CreateFeedDocumentInput) {
    const normalizedUrl = this.normalizeRemoteSourceUrl(input.url);
    const reservedDocument = await this.reserveExternalDocument(knowledgeBaseId, {
      sourceType: "feed",
      sourceName: normalizedUrl,
      title: input.title ?? this.buildRemoteSourceFallbackTitle(normalizedUrl),
      sourceConfig: {
        kind: "feed",
        url: normalizedUrl,
        maxItems: input.maxItems
      }
    });
    await this.documentRunsService.createRun({
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      trigger: DocumentRunTrigger.external_resync
    });

    const fetchedFeed = await this.fetchExternalSourceOrRecordFailure(reservedDocument, () =>
      this.feedSourceService.fetchFeed({
        url: normalizedUrl,
        maxItems: input.maxItems
      })
    );
    const storedFile = await this.storageService.saveGeneratedTextFile({
      content: fetchedFeed.content
    });

    const document = await this.finalizeExternalDocument(reservedDocument.id, {
      title: input.title ?? fetchedFeed.title ?? this.buildRemoteSourceFallbackTitle(normalizedUrl),
      mimeType: "text/plain",
      storageKey: storedFile.storageKey
    });

    await this.ingestionService.enqueueDocument(document.id, document.version);

    return document;
  }

  async createSitemapDocument(knowledgeBaseId: string, input: CreateSitemapDocumentInput) {
    const normalizedUrl = this.normalizeRemoteSourceUrl(input.url);
    const reservedDocument = await this.reserveExternalDocument(knowledgeBaseId, {
      sourceType: "sitemap",
      sourceName: normalizedUrl,
      title: input.title ?? this.buildRemoteSourceFallbackTitle(normalizedUrl),
      sourceConfig: {
        kind: "sitemap",
        url: normalizedUrl,
        maxPages: input.maxPages
      }
    });
    await this.documentRunsService.createRun({
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      trigger: DocumentRunTrigger.external_resync
    });

    const fetchedSitemap = await this.fetchExternalSourceOrRecordFailure(reservedDocument, () =>
      this.sitemapSourceService.fetchSitemap({
        url: normalizedUrl,
        maxPages: input.maxPages
      })
    );
    const storedFile = await this.storageService.saveGeneratedTextFile({
      content: fetchedSitemap.content
    });

    const document = await this.finalizeExternalDocument(reservedDocument.id, {
      title: input.title ?? this.buildRemoteSourceFallbackTitle(normalizedUrl),
      mimeType: "text/plain",
      storageKey: storedFile.storageKey
    });

    await this.ingestionService.enqueueDocument(document.id, document.version);

    return document;
  }

  async reindexDocument(id: string) {
    const document = await this.getDocument(id);

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
    await this.ingestionService.enqueueDocument(document.id, updatedDocument.version);

    return this.getDocument(id);
  }

  async deleteDocument(id: string) {
    const document = await this.getDocument(id);
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
      title: string;
      sourceConfig: ExternalSourceConfig;
    }
  ) {
    await this.knowledgeBasesService.getKnowledgeBase(knowledgeBaseId);

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
          title: input.title,
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
        title: input.title,
        sourceConfigJson: input.sourceConfig,
        status: DocumentStatus.pending,
        processingStage: DocumentProcessingStage.uploaded,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    });
  }

  private finalizeExternalDocument(
    id: string,
    input: Pick<CreateDocumentInput, "title" | "mimeType" | "storageKey">
  ) {
    return this.prisma.document.update({
      where: { id },
      data: {
        title: input.title,
        mimeType: input.mimeType,
        storageKey: input.storageKey,
        status: DocumentStatus.pending,
        processingStage: DocumentProcessingStage.uploaded,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull
      }
    });
  }

  private async fetchExternalSourceOrRecordFailure<T>(
    document: {
      id: string;
      version: number;
    },
    operation: () => Promise<T>
  ) {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown external source fetch error.";
      const retryable = this.isRetryableExternalSourceError(error);
      const diagnostics = {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable,
        documentVersion: document.version,
        message
      } satisfies Prisma.InputJsonValue;

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
        failedStage: DocumentRunFailedStage.source_fetch,
        diagnosticsJson: diagnostics
      });

      throw error;
    }
  }

  private normalizeRemoteSourceUrl(url: string) {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  }

  private async resyncExternalDocument(document: Awaited<ReturnType<DocumentsService["getDocument"]>>) {
    const sourceConfig = this.parseExternalSourceConfig(document.sourceConfigJson);
    const queuedDocument = await this.prisma.document.update({
      where: { id: document.id },
      data: {
        status: DocumentStatus.pending,
        processingStage: DocumentProcessingStage.uploaded,
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

    const fetchedSource = await this.fetchExternalSourceOrRecordFailure(queuedDocument, () =>
      this.fetchExternalSourceFromConfig(sourceConfig)
    );
    const storedFile = await this.storageService.saveGeneratedTextFile({
      content: fetchedSource.content
    });

    const updatedDocument = await this.prisma.document.update({
      where: { id: document.id },
      data: {
        title: fetchedSource.title ?? this.buildRemoteSourceFallbackTitle(document.sourceName),
        mimeType: "text/plain",
        storageKey: storedFile.storageKey,
        status: DocumentStatus.pending,
        processingStage: DocumentProcessingStage.uploaded,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull
      }
    });

    await this.ingestionService.enqueueDocument(updatedDocument.id, updatedDocument.version);

    return this.getDocument(document.id);
  }

  private parseExternalSourceConfig(value: Prisma.JsonValue | null): ExternalSourceConfig {
    if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.kind !== "string") {
      throw new Error("External source config is missing.");
    }

    if (value.kind === "web_page" && typeof value.url === "string") {
      return {
        kind: "web_page",
        url: value.url
      };
    }

    if (value.kind === "feed" && typeof value.url === "string" && typeof value.maxItems === "number") {
      return {
        kind: "feed",
        url: value.url,
        maxItems: value.maxItems
      };
    }

    if (value.kind === "sitemap" && typeof value.url === "string" && typeof value.maxPages === "number") {
      return {
        kind: "sitemap",
        url: value.url,
        maxPages: value.maxPages
      };
    }

    throw new Error("External source config is invalid.");
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
      content: fetchedSitemap.content
    };
  }

  private isExternalSourceType(sourceType: string) {
    return sourceType === "web_page" || sourceType === "feed" || sourceType === "sitemap";
  }

  private isRetryableExternalSourceError(error: unknown) {
    return !(error instanceof BadRequestException);
  }
}
