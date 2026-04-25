import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { type RequestAuthContext } from '../auth/auth-identity.contract';
import { AuthenticatedRoute } from '../auth/auth-route-policy';
import { AskAssistantService } from '../assistants/ask-assistant.service';
import { DocumentsService } from '../documents/documents.service';
import { TracesService } from '../traces/traces.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  documentLookupSchema,
  ragAnswerSchema,
  ragSearchSchema,
  traceLookupSchema
} from './agent-tools.schemas';
import {
  DEFAULT_DEV_TENANT_ID,
  DEFAULT_DEV_USER_ID
} from '../auth/auth.constants';

type ToolRequest = {
  authContext?: RequestAuthContext;
  headers?: Record<string, string | string[] | undefined>;
};

type BoundedMultiStepInput = {
  enabled?: boolean;
  rewrittenQuery?: string;
  requestSecondPass?: boolean;
};

@AuthenticatedRoute()
@Controller('agent-tools')
export class AgentToolsController {
  constructor(
    private readonly askAssistantService: AskAssistantService,
    private readonly tracesService: TracesService,
    private readonly documentsService: DocumentsService
  ) {}

  @Post('rag_search')
  async ragSearch(
    @Body(new ZodValidationPipe(ragSearchSchema))
    input: Omit<ReturnType<typeof ragSearchSchema.parse>, 'secret'> & {
      secret: string;
    },
    @Req() request?: ToolRequest
  ) {
    this.assertToolSecret(input.secret);
    const result = await this.askAssistantService.searchAssistant({
      assistantId: input.assistantId,
      question: input.question,
      authContext: this.resolveToolAuthContext(input, request)
    });

    const boundedMultiStep = this.resolveBoundedMultiStepDiagnostics(
      input.boundedMultiStep
    );

    return {
      query: result.query,
      chunks: result.chunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        score: chunk.score,
        isPrimary: chunk.isPrimary ?? true,
        pageNo: chunk.pageNo ?? null,
        sectionTitle: chunk.sectionTitle ?? null
      })),
      citations: result.chunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        chunkIndex: chunk.chunkIndex,
        pageNo: chunk.pageNo ?? null,
        sectionTitle: chunk.sectionTitle ?? null,
        score: chunk.score
      })),
      sources: result.contextGroups.map((group) => ({
        documentId: group.documentId,
        documentTitle: group.documentTitle,
        chunkIds: group.chunkIds,
        primaryChunkIds: group.primaryChunkIds,
        startChunkIndex: group.startChunkIndex,
        endChunkIndex: group.endChunkIndex,
        pageNumbers: group.pageNumbers,
        sectionTitles: group.sectionTitles
      })),
      diagnostics: {
        ...result.diagnostics,
        chunkCount: result.chunks.length,
        sourceCount: result.contextGroups.length,
        boundedMultiStep
      },
      boundedMultiStep
    };
  }

  @Post('rag_answer')
  async ragAnswer(
    @Body(new ZodValidationPipe(ragAnswerSchema))
    input: Omit<ReturnType<typeof ragAnswerSchema.parse>, 'secret'> & {
      secret: string;
    },
    @Req() request?: ToolRequest
  ) {
    this.assertToolSecret(input.secret);
    const result = await this.askAssistantService.askAssistant({
      assistantId: input.assistantId,
      question: input.question,
      conversationId: input.conversationId,
      authContext: this.resolveToolAuthContext(input, request)
    });

    return this.normalizeRagAnswerResult(result, input.boundedMultiStep);
  }

  @Post('trace_lookup')
  async traceLookup(
    @Body(new ZodValidationPipe(traceLookupSchema))
    input: Omit<ReturnType<typeof traceLookupSchema.parse>, 'secret'> & {
      secret: string;
    }
  ) {
    this.assertToolSecret(input.secret);
    return this.tracesService.getTrace(input.traceId, this.resolveScope(input));
  }

  @Post('document_lookup')
  async documentLookup(
    @Body(new ZodValidationPipe(documentLookupSchema))
    input: Omit<ReturnType<typeof documentLookupSchema.parse>, 'secret'> & {
      secret: string;
    }
  ) {
    this.assertToolSecret(input.secret);
    const document = await this.documentsService.getDocument(
      input.documentId,
      this.resolveScope(input)
    );
    const chunks = await this.documentsService.listDocumentChunks(
      input.documentId,
      this.resolveScope(input)
    );

    return {
      document,
      chunks,
      diagnostics: {
        chunkCount: chunks.length,
        status:
          document.status === DocumentStatus.ready ? 'ready' : document.status
      }
    };
  }

  private resolveToolAuthContext(
    input: { tenantId?: string; userId?: string },
    request?: ToolRequest
  ) {
    const tenantId =
      input.tenantId ??
      this.readHeader(request, 'x-agent-tenant-id') ??
      DEFAULT_DEV_TENANT_ID;
    const userId =
      input.userId ??
      this.readHeader(request, 'x-agent-user-id') ??
      DEFAULT_DEV_USER_ID;

    const identity = {
      tenantId,
      userId,
      role: 'owner',
      sessionId: null,
      authSource: 'agent_tool'
    } as const;

    return {
      identity,
      currentIdentity: identity
    } satisfies RequestAuthContext;
  }

  private resolveScope(
    input: { tenantId?: string; userId?: string },
    request?: ToolRequest
  ) {
    const tenantId =
      input.tenantId ??
      this.readHeader(request, 'x-agent-tenant-id') ??
      DEFAULT_DEV_TENANT_ID;
    const userId =
      input.userId ??
      this.readHeader(request, 'x-agent-user-id') ??
      DEFAULT_DEV_USER_ID;
    return { tenantId, userId };
  }

  private assertToolSecret(secret: string) {
    const expected = (process.env.AGENT_TOOL_GATEWAY_SECRET ?? '').trim();
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Unauthorized agent tool request.');
    }
  }

  private normalizeRagAnswerResult(
    result: unknown,
    boundedMultiStepInput?: BoundedMultiStepInput
  ) {
    const payload =
      typeof result === 'object' && result !== null
        ? (result as Record<string, unknown>)
        : {};
    const traceId = this.readString(payload.traceId);
    const conversationId = this.readString(payload.conversationId);
    const userMessageId = this.readString(payload.userMessageId);
    const assistantMessageId = this.readString(payload.assistantMessageId);

    const boundedMultiStep = this.resolveBoundedMultiStepDiagnostics(
      boundedMultiStepInput
    );

    return {
      answer: this.readString(payload.answer) ?? '',
      citations: Array.isArray(payload.citations) ? payload.citations : [],
      confidence:
        this.readString(payload.confidence) ??
        this.readString(payload.answerStatus),
      missingInformation: Array.isArray(payload.missingInformation)
        ? payload.missingInformation
        : [],
      diagnostics: {
        routeType: this.readString(payload.routeType),
        routeReason: this.readString(payload.routeReason),
        strategySummary: payload.strategySummary ?? null,
        retrievalMetadata: payload.retrievalMetadata ?? null,
        answeringMetadata: payload.answeringMetadata ?? null,
        qualityEvaluation: payload.qualityEvaluation ?? null,
        modelName: this.readString(payload.modelName),
        answerStatus: this.readString(payload.answerStatus),
        boundedMultiStep
      },
      boundedMultiStep,
      trace: {
        traceId,
        conversationId,
        userMessageId,
        assistantMessageId
      },
      traceId,
      conversationId,
      userMessageId,
      assistantMessageId
    };
  }

  private resolveBoundedMultiStepDiagnostics(input?: BoundedMultiStepInput) {
    const enabled = input?.enabled === true;
    const rewrittenQuery = this.readString(input?.rewrittenQuery);
    const secondPassRequested = input?.requestSecondPass === true;
    const contractRequested = enabled || rewrittenQuery != null;

    return {
      enabled,
      requested: contractRequested,
      rewrittenQuery,
      secondPassRequested,
      secondPassUsed: false,
      mode: contractRequested ? 'deterministic_noop' : 'disabled',
      reason: contractRequested ? 'agent_tool_contract_only' : 'not_requested'
    };
  }

  private readStringValue(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private readHeader(request: ToolRequest | undefined, name: string) {
    const value = request?.headers?.[name];
    return typeof value === 'string'
      ? this.readStringValue(value.trim())
      : null;
  }

  private readString(value: unknown) {
    return this.readStringValue(value);
  }
}
