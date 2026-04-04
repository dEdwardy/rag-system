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
import { AuthenticatedRoute } from "../auth/auth-route-policy";
import {
  CompareKnowledgeBaseDocumentRunsInput,
  CreateDocumentInput,
  CreateFeedDocumentInput,
  CreateSitemapDocumentInput,
  CreateWebPageDocumentInput,
  compareKnowledgeBaseDocumentRunsSchema,
  createDocumentSchema,
  createFeedDocumentSchema,
  ListDocumentRunsInput,
  ListKnowledgeBaseDocumentRunsInput,
  ListKnowledgeBaseDocumentsInput,
  listDocumentRunsSchema,
  listKnowledgeBaseDocumentsSchema,
  listKnowledgeBaseDocumentRunsSchema,
  createSitemapDocumentSchema,
  createWebPageDocumentSchema
} from "./document.schemas";
import { DocumentsService } from "./documents.service";
import { nonEmptyStringParamSchema, ZodValidationPipe } from "../../common/zod-validation.pipe";

const knowledgeBaseDocumentRunSummarySchema = listKnowledgeBaseDocumentRunsSchema.pick({
  documentId: true,
  sourceType: true,
  status: true,
  trigger: true,
  issueOnly: true,
  sinceHours: true
});

@AuthenticatedRoute()
@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get("knowledge-bases/:id/documents")
  listKnowledgeBaseDocuments(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) knowledgeBaseId: string,
    @Query(new ZodValidationPipe(listKnowledgeBaseDocumentsSchema)) query: ListKnowledgeBaseDocumentsInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.listKnowledgeBaseDocuments(knowledgeBaseId, query, authContext.identity);
  }

  @Get("knowledge-bases/:id/document-runs")
  listKnowledgeBaseDocumentRuns(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) knowledgeBaseId: string,
    @Query(new ZodValidationPipe(listKnowledgeBaseDocumentRunsSchema)) query: ListKnowledgeBaseDocumentRunsInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.listKnowledgeBaseDocumentRuns(knowledgeBaseId, query, authContext.identity);
  }

  @Get("knowledge-bases/:id/document-runs/summary")
  getKnowledgeBaseDocumentRunSummary(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) knowledgeBaseId: string,
    @Query(new ZodValidationPipe(knowledgeBaseDocumentRunSummarySchema)) query: Pick<
      ListKnowledgeBaseDocumentRunsInput,
      "documentId" | "sourceType" | "status" | "trigger" | "issueOnly" | "sinceHours"
    >,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.getKnowledgeBaseDocumentRunSummary(knowledgeBaseId, query, authContext.identity);
  }

  @Get("knowledge-bases/:id/document-runs/comparison")
  getKnowledgeBaseDocumentRunComparison(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) knowledgeBaseId: string,
    @Query(new ZodValidationPipe(compareKnowledgeBaseDocumentRunsSchema)) query: CompareKnowledgeBaseDocumentRunsInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.getKnowledgeBaseDocumentRunComparison(knowledgeBaseId, query, authContext.identity);
  }

  @Post("knowledge-bases/:id/documents")
  createDocument(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) knowledgeBaseId: string,
    @Body(new ZodValidationPipe(createDocumentSchema)) body: CreateDocumentInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.createDocument(knowledgeBaseId, body, authContext.identity);
  }

  @Post("knowledge-bases/:id/reindex")
  reindexKnowledgeBase(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) knowledgeBaseId: string,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.reindexKnowledgeBase(knowledgeBaseId, authContext.identity);
  }

  @Post("knowledge-bases/:id/documents/web-page")
  createWebPageDocument(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) knowledgeBaseId: string,
    @Body(new ZodValidationPipe(createWebPageDocumentSchema)) body: CreateWebPageDocumentInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.createWebPageDocument(knowledgeBaseId, body, authContext.identity);
  }

  @Post("knowledge-bases/:id/documents/feed")
  createFeedDocument(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) knowledgeBaseId: string,
    @Body(new ZodValidationPipe(createFeedDocumentSchema)) body: CreateFeedDocumentInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.createFeedDocument(knowledgeBaseId, body, authContext.identity);
  }

  @Post("knowledge-bases/:id/documents/sitemap")
  createSitemapDocument(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) knowledgeBaseId: string,
    @Body(new ZodValidationPipe(createSitemapDocumentSchema)) body: CreateSitemapDocumentInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.createSitemapDocument(knowledgeBaseId, body, authContext.identity);
  }

  @Post("knowledge-bases/:id/documents/upload")
  @UseInterceptors(FileInterceptor("file"))
  uploadDocument(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) knowledgeBaseId: string,
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
  getDocument(@Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });
    return this.documentsService.getDocument(id, authContext.identity);
  }

  @Get("documents/:id/runs")
  listDocumentRuns(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Query(new ZodValidationPipe(listDocumentRunsSchema)) query: ListDocumentRunsInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.listDocumentRuns(id, query, authContext.identity);
  }

  @Get("documents/:id/chunks")
  listDocumentChunks(@Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.listDocumentChunks(id, authContext.identity);
  }

  @Delete("documents/:id")
  deleteDocument(@Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.deleteDocument(id, authContext.identity);
  }

  @Post("documents/:id/reindex")
  reindexDocument(@Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });

    return this.documentsService.reindexDocument(id, authContext.identity);
  }
}
