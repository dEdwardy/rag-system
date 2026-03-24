import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  createDocumentSchema,
  createFeedDocumentSchema,
  listKnowledgeBaseDocumentRunsSchema,
  createSitemapDocumentSchema,
  createWebPageDocumentSchema
} from "./document.schemas";
import { DocumentsService } from "./documents.service";

@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get("knowledge-bases/:id/documents")
  listKnowledgeBaseDocuments(@Param("id") knowledgeBaseId: string) {
    return this.documentsService.listKnowledgeBaseDocuments(knowledgeBaseId);
  }

  @Get("knowledge-bases/:id/document-runs")
  listKnowledgeBaseDocumentRuns(@Param("id") knowledgeBaseId: string, @Query() query: unknown) {
    const input = listKnowledgeBaseDocumentRunsSchema.parse(query);
    return this.documentsService.listKnowledgeBaseDocumentRuns(knowledgeBaseId, input);
  }

  @Get("knowledge-bases/:id/document-runs/summary")
  getKnowledgeBaseDocumentRunSummary(@Param("id") knowledgeBaseId: string, @Query() query: unknown) {
    const input = listKnowledgeBaseDocumentRunsSchema
      .pick({ documentId: true, sourceType: true, status: true, trigger: true, issueOnly: true, sinceHours: true })
      .parse(query);
    return this.documentsService.getKnowledgeBaseDocumentRunSummary(knowledgeBaseId, input);
  }

  @Post("knowledge-bases/:id/documents")
  createDocument(@Param("id") knowledgeBaseId: string, @Body() body: unknown) {
    const input = createDocumentSchema.parse(body);
    return this.documentsService.createDocument(knowledgeBaseId, input);
  }

  @Post("knowledge-bases/:id/documents/web-page")
  createWebPageDocument(@Param("id") knowledgeBaseId: string, @Body() body: unknown) {
    const input = createWebPageDocumentSchema.parse(body);
    return this.documentsService.createWebPageDocument(knowledgeBaseId, input);
  }

  @Post("knowledge-bases/:id/documents/feed")
  createFeedDocument(@Param("id") knowledgeBaseId: string, @Body() body: unknown) {
    const input = createFeedDocumentSchema.parse(body);
    return this.documentsService.createFeedDocument(knowledgeBaseId, input);
  }

  @Post("knowledge-bases/:id/documents/sitemap")
  createSitemapDocument(@Param("id") knowledgeBaseId: string, @Body() body: unknown) {
    const input = createSitemapDocumentSchema.parse(body);
    return this.documentsService.createSitemapDocument(knowledgeBaseId, input);
  }

  @Post("knowledge-bases/:id/documents/upload")
  @UseInterceptors(FileInterceptor("file"))
  uploadDocument(
    @Param("id") knowledgeBaseId: string,
    @UploadedFile() file?: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    }
  ) {
    if (!file) {
      throw new BadRequestException("File is required.");
    }

    return this.documentsService.uploadDocument(knowledgeBaseId, file);
  }

  @Get("documents/:id")
  getDocument(@Param("id") id: string) {
    return this.documentsService.getDocument(id);
  }

  @Get("documents/:id/runs")
  listDocumentRuns(@Param("id") id: string) {
    return this.documentsService.listDocumentRuns(id);
  }

  @Get("documents/:id/chunks")
  listDocumentChunks(@Param("id") id: string) {
    return this.documentsService.listDocumentChunks(id);
  }

  @Delete("documents/:id")
  deleteDocument(@Param("id") id: string) {
    return this.documentsService.deleteDocument(id);
  }

  @Post("documents/:id/reindex")
  reindexDocument(@Param("id") id: string) {
    return this.documentsService.reindexDocument(id);
  }
}
