import { Injectable, NotFoundException } from "@nestjs/common";
import { DocumentProcessingStage, DocumentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import { FeedSourceService } from "../../infra/feed-source/feed-source.service";
import { SitemapSourceService } from "../../infra/sitemap-source/sitemap-source.service";
import { StorageService } from "../../infra/storage/storage.service";
import { WebPageService } from "../../infra/web-page/web-page.service";
import { IngestionService } from "../ingestion/ingestion.service";
import { IndexingService } from "../indexing/indexing.service";
import { KnowledgeBasesService } from "../knowledge-bases/knowledge-bases.service";
import {
  CreateDocumentInput,
  CreateFeedDocumentInput,
  CreateSitemapDocumentInput,
  CreateWebPageDocumentInput
} from "./document.schemas";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeBasesService: KnowledgeBasesService,
    private readonly storageService: StorageService,
    private readonly feedSourceService: FeedSourceService,
    private readonly sitemapSourceService: SitemapSourceService,
    private readonly webPageService: WebPageService,
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

    await this.ingestionService.enqueueDocument(document.id, document.version);

    return document;
  }

  async createWebPageDocument(knowledgeBaseId: string, input: CreateWebPageDocumentInput) {
    const normalizedUrl = this.normalizeRemoteSourceUrl(input.url);
    const reservedDocument = await this.reserveExternalDocument(knowledgeBaseId, {
      sourceType: "web_page",
      sourceName: normalizedUrl,
      title: input.title ?? this.buildRemoteSourceFallbackTitle(normalizedUrl)
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
      title: input.title ?? this.buildRemoteSourceFallbackTitle(normalizedUrl)
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
      title: input.title ?? this.buildRemoteSourceFallbackTitle(normalizedUrl)
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

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.failed,
          processingStage: DocumentProcessingStage.failed,
          errorMessage: message,
          diagnosticsJson: {
            code: "EXTERNAL_SOURCE_FETCH_FAILED",
            failedStage: "source_fetch",
            retryable: true,
            documentVersion: document.version,
            message
          }
        }
      });

      throw error;
    }
  }

  private normalizeRemoteSourceUrl(url: string) {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  }
}
