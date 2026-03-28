import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { resolveRequestAuthContext, type ApiRequestWithAuthContext } from "../auth/auth-identity.contract";
import {
  createDocumentSchema,
  createFeedDocumentSchema,
  listDocumentRunsSchema,
  listKnowledgeBaseDocumentsSchema,
  listKnowledgeBaseDocumentRunsSchema,
  createSitemapDocumentSchema,
  createWebPageDocumentSchema
} from "./document.schemas";
import { DocumentsService } from "./documents.service";

@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get("knowledge-bases/:id/documents")
  listKnowledgeBaseDocuments(
    @Param("id") knowledgeBaseId: string,
    @Query() query: unknown,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const input = listKnowledgeBaseDocumentsSchema.parse(query);
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.listKnowledgeBaseDocuments(knowledgeBaseId, input, authContext.identity);
  }

  @Get("knowledge-bases/:id/document-runs")
  listKnowledgeBaseDocumentRuns(
    @Param("id") knowledgeBaseId: string,
    @Query() query: unknown,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const input = listKnowledgeBaseDocumentRunsSchema.parse(query);
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.listKnowledgeBaseDocumentRuns(knowledgeBaseId, input, authContext.identity);
  }

  @Get("knowledge-bases/:id/document-runs/summary")
  getKnowledgeBaseDocumentRunSummary(
    @Param("id") knowledgeBaseId: string,
    @Query() query: unknown,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const input = listKnowledgeBaseDocumentRunsSchema
      .pick({ documentId: true, sourceType: true, status: true, trigger: true, issueOnly: true, sinceHours: true })
      .parse(query);
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.getKnowledgeBaseDocumentRunSummary(knowledgeBaseId, input, authContext.identity);
  }

  @Post("knowledge-bases/:id/documents")
  createDocument(
    @Param("id") knowledgeBaseId: string,
    @Body() body: unknown,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const input = createDocumentSchema.parse(body);
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.createDocument(knowledgeBaseId, input, authContext.identity);
  }

  @Post("knowledge-bases/:id/documents/web-page")
  createWebPageDocument(
    @Param("id") knowledgeBaseId: string,
    @Body() body: unknown,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const input = createWebPageDocumentSchema.parse(body);
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.createWebPageDocument(knowledgeBaseId, input, authContext.identity);
  }

  @Post("knowledge-bases/:id/documents/feed")
  createFeedDocument(
    @Param("id") knowledgeBaseId: string,
    @Body() body: unknown,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const input = createFeedDocumentSchema.parse(body);
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.createFeedDocument(knowledgeBaseId, input, authContext.identity);
  }

  @Post("knowledge-bases/:id/documents/sitemap")
  createSitemapDocument(
    @Param("id") knowledgeBaseId: string,
    @Body() body: unknown,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const input = createSitemapDocumentSchema.parse(body);
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.createSitemapDocument(knowledgeBaseId, input, authContext.identity);
  }

  @Post("knowledge-bases/:id/documents/upload")
  @UseInterceptors(FileInterceptor("file"))
  uploadDocument(
    @Param("id") knowledgeBaseId: string,
    @Req() request: ApiRequestWithAuthContext | undefined,
    @UploadedFile() file?: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    }
  ) {
    if (!file) {
      throw new BadRequestException("File is required.");
    }

    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.uploadDocument(knowledgeBaseId, file, authContext.identity);
  }

  @Get("documents/:id")
  getDocument(@Param("id") id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });
    return this.documentsService.getDocument(id, authContext.identity);
  }

  @Get("documents/:id/runs")
  listDocumentRuns(@Param("id") id: string, @Query() query: unknown, @Req() request?: ApiRequestWithAuthContext) {
    const input = listDocumentRunsSchema.parse(query);
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.listDocumentRuns(id, input, authContext.identity);
  }

  @Get("documents/:id/chunks")
  listDocumentChunks(@Param("id") id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.listDocumentChunks(id, authContext.identity);
  }

  @Delete("documents/:id")
  deleteDocument(@Param("id") id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.deleteDocument(id, authContext.identity);
  }

  @Post("documents/:id/reindex")
  reindexDocument(@Param("id") id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.reindexDocument(id, authContext.identity);
  }
}
