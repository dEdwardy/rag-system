import { Injectable, NotFoundException } from "@nestjs/common";
import { DocumentProcessingStage, DocumentStatus } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import { StorageService } from "../../infra/storage/storage.service";
import { IngestionService } from "../ingestion/ingestion.service";
import { IndexingService } from "../indexing/indexing.service";
import { KnowledgeBasesService } from "../knowledge-bases/knowledge-bases.service";
import { CreateDocumentInput } from "./document.schemas";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeBasesService: KnowledgeBasesService,
    private readonly storageService: StorageService,
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
        processingStage: DocumentProcessingStage.uploaded
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

    await this.ingestionService.enqueueDocument(document.id);

    return document;
  }

  async reindexDocument(id: string) {
    const document = await this.getDocument(id);

    await this.prisma.document.update({
      where: { id },
      data: {
        status: DocumentStatus.pending,
        processingStage: DocumentProcessingStage.uploaded,
        chunkCount: 0,
        errorMessage: null
      }
    });

    await this.ingestionService.enqueueDocument(document.id);

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
}
