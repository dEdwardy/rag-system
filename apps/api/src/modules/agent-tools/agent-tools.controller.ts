import {
  Body,
  Controller,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import {
  resolveRequestAuthContext,
  type RequestAuthContext
} from '../auth/auth-identity.contract';
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

type ToolRequest = {
  authContext?: RequestAuthContext;
  headers?: Record<string, string | string[] | undefined>;
};

type BoundedMultiStepInput = {
  enabled?: boolean;
  rewrittenQuery?: string;
  requestSecondPass?: boolean;
};

type AssistantSearchResult = Awaited<
  ReturnType<AskAssistantService['searchAssistant']>
>;

type BoundedMultiStepDiagnostics = {
  enabled: boolean;
  requested: boolean;
  rewrittenQuery: string | null;
  secondPassRequested: boolean;
  secondPassUsed: boolean;
  mode: string;
  reason: string;
  firstPassChunkCount: number;
  firstPassSourceCount: number;
  secondPassQuery: string | null;
  secondPassChunkCount: number;
  secondPassSourceCount: number;
  mergedChunkCount: number;
  mergedSourceCount: number;
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
    const authContext = this.resolveToolAuthContext(input, request);
    const result = await this.askAssistantService.searchAssistant({
      assistantId: input.assistantId,
      question: input.question,
      authContext
    });

    const secondPassResult = await this.resolveSecondPassSearchResult({
      assistantId: input.assistantId,
      originalQuestion: input.question,
      boundedMultiStepInput: input.boundedMultiStep,
      authContext,
      firstPassResult: result
    });
    const mergedChunks = this.mergeChunks(
      result.chunks,
      secondPassResult?.chunks ?? []
    );
    const mergedContextGroups = this.mergeContextGroups(
      result.contextGroups,
      secondPassResult?.contextGroups ?? []
    );
    const boundedMultiStep = this.buildBoundedMultiStepDiagnostics({
      boundedMultiStepInput: input.boundedMultiStep,
      originalQuestion: input.question,
      firstPassResult: result,
      secondPassResult,
      mergedChunks,
      mergedContextGroups
    });

    return {
      query: result.query,
      chunks: mergedChunks.map((chunk) => ({
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
      citations: mergedChunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        chunkIndex: chunk.chunkIndex,
        pageNo: chunk.pageNo ?? null,
        sectionTitle: chunk.sectionTitle ?? null,
        score: chunk.score
      })),
      sources: mergedContextGroups.map((group) => ({
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
        chunkCount: mergedChunks.length,
        sourceCount: mergedContextGroups.length,
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
    const authContext = this.resolveToolAuthContext(input, request);
    const result = await this.askAssistantService.askAssistant({
      assistantId: input.assistantId,
      question: input.question,
      conversationId: input.conversationId,
      authContext
    });

    const boundedRequest = this.hasBoundedMultiStepRequest(
      input.boundedMultiStep
    );
    const firstPassResult = boundedRequest
      ? await this.askAssistantService.searchAssistant({
          assistantId: input.assistantId,
          question: input.question,
          authContext
        })
      : null;
    const secondPassResult =
      firstPassResult == null
        ? null
        : await this.resolveSecondPassSearchResult({
            assistantId: input.assistantId,
            originalQuestion: input.question,
            boundedMultiStepInput: input.boundedMultiStep,
            authContext,
            firstPassResult
          });
    const boundedMultiStep =
      firstPassResult == null
        ? this.buildDisabledBoundedMultiStepDiagnostics()
        : this.buildBoundedMultiStepDiagnostics({
            boundedMultiStepInput: input.boundedMultiStep,
            originalQuestion: input.question,
            firstPassResult,
            secondPassResult,
            mergedChunks: this.mergeChunks(
              firstPassResult.chunks,
              secondPassResult?.chunks ?? []
            ),
            mergedContextGroups: this.mergeContextGroups(
              firstPassResult.contextGroups,
              secondPassResult?.contextGroups ?? []
            )
          });

    return this.normalizeRagAnswerResult(result, boundedMultiStep);
  }

  @Post('trace_lookup')
  async traceLookup(
    @Body(new ZodValidationPipe(traceLookupSchema))
    input: Omit<ReturnType<typeof traceLookupSchema.parse>, 'secret'> & {
      secret: string;
    },
    @Req() request?: ToolRequest
  ) {
    this.assertToolSecret(input.secret);
    const traceId = input.traceId;

    try {
      const trace = await this.tracesService.getTrace(
        traceId,
        this.resolveScope(input, request)
      );
      return this.normalizeTraceLookupResult(traceId, trace);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return this.normalizeTraceLookupResult(traceId, null);
      }

      throw error;
    }
  }

  @Post('document_lookup')
  async documentLookup(
    @Body(new ZodValidationPipe(documentLookupSchema))
    input: Omit<ReturnType<typeof documentLookupSchema.parse>, 'secret'> & {
      secret: string;
    },
    @Req() request?: ToolRequest
  ) {
    this.assertToolSecret(input.secret);
    const documentId = input.documentId;
    const scope = this.resolveScope(input, request);

    try {
      const document = await this.documentsService.getDocument(
        documentId,
        scope
      );
      const chunks = await this.documentsService.listDocumentChunks(
        documentId,
        scope
      );

      return this.normalizeDocumentLookupResult(documentId, document, chunks);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return this.normalizeDocumentLookupResult(documentId, null, []);
      }

      throw error;
    }
  }

  private resolveToolAuthContext(
    _input: { tenantId?: string; userId?: string },
    request?: ToolRequest
  ) {
    const { identity } = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return {
      identity,
      currentIdentity: identity
    } satisfies RequestAuthContext;
  }

  private resolveScope(
    _input: { tenantId?: string; userId?: string },
    request?: ToolRequest
  ) {
    const { identity } = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return { tenantId: identity.tenantId, userId: identity.userId };
  }

  private assertToolSecret(secret: string) {
    const expected = (process.env.AGENT_TOOL_GATEWAY_SECRET ?? '').trim();
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Unauthorized agent tool request.');
    }
  }

  private normalizeRagAnswerResult(
    result: unknown,
    boundedMultiStep: BoundedMultiStepDiagnostics
  ) {
    const payload =
      typeof result === 'object' && result !== null
        ? (result as Record<string, unknown>)
        : {};
    const traceId = this.readString(payload.traceId);
    const conversationId = this.readString(payload.conversationId);
    const userMessageId = this.readString(payload.userMessageId);
    const assistantMessageId = this.readString(payload.assistantMessageId);
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

  private normalizeTraceLookupResult(traceId: string, trace: unknown) {
    const traceRecord =
      typeof trace === 'object' && trace !== null
        ? (trace as Record<string, unknown>)
        : null;

    return {
      traceId,
      found: traceRecord != null,
      trace: traceRecord,
      diagnostics: {
        found: traceRecord != null,
        status: this.readString(traceRecord?.status) ?? 'not_found',
        hasSummary: traceRecord?.traceSummary != null
      }
    };
  }

  private normalizeDocumentLookupResult(
    documentId: string,
    document: unknown,
    chunks: unknown[]
  ) {
    const documentRecord =
      typeof document === 'object' && document !== null
        ? (document as Record<string, unknown>)
        : null;
    const found = documentRecord != null;
    const status = this.readString(documentRecord?.status);

    return {
      documentId,
      found,
      document: documentRecord,
      chunks,
      diagnostics: {
        found,
        status:
          status == null
            ? 'not_found'
            : status === DocumentStatus.ready
              ? 'ready'
              : status,
        chunkCount: chunks.length
      }
    };
  }

  private async resolveSecondPassSearchResult(input: {
    assistantId: string;
    originalQuestion: string;
    boundedMultiStepInput?: BoundedMultiStepInput;
    authContext: RequestAuthContext;
    firstPassResult: AssistantSearchResult;
  }) {
    const secondPassQuery = this.resolveSecondPassQuery(input);
    if (secondPassQuery == null) {
      return null;
    }

    return this.askAssistantService.searchAssistant({
      assistantId: input.assistantId,
      question: secondPassQuery,
      authContext: input.authContext
    });
  }

  private buildBoundedMultiStepDiagnostics(input: {
    boundedMultiStepInput?: BoundedMultiStepInput;
    originalQuestion: string;
    firstPassResult: AssistantSearchResult;
    secondPassResult: AssistantSearchResult | null;
    mergedChunks: AssistantSearchResult['chunks'];
    mergedContextGroups: AssistantSearchResult['contextGroups'];
  }): BoundedMultiStepDiagnostics {
    const enabled = input.boundedMultiStepInput?.enabled === true;
    const rewrittenQuery = this.readString(
      input.boundedMultiStepInput?.rewrittenQuery
    );
    const requested = this.hasBoundedMultiStepRequest(
      input.boundedMultiStepInput
    );
    const secondPassRequested =
      input.boundedMultiStepInput?.requestSecondPass === true ||
      rewrittenQuery != null;
    const secondPassQuery = this.resolveSecondPassQuery({
      originalQuestion: input.originalQuestion,
      boundedMultiStepInput: input.boundedMultiStepInput,
      firstPassResult: input.firstPassResult
    });

    if (!requested) {
      return this.buildDisabledBoundedMultiStepDiagnostics({
        firstPassChunkCount: input.firstPassResult.chunks.length,
        firstPassSourceCount: input.firstPassResult.contextGroups.length
      });
    }

    return {
      enabled,
      requested,
      rewrittenQuery,
      secondPassRequested,
      secondPassUsed: input.secondPassResult != null,
      mode:
        input.secondPassResult != null
          ? 'bounded_second_pass'
          : secondPassRequested
            ? 'first_pass_only'
            : 'contract_requested',
      reason:
        input.secondPassResult != null
          ? 'second_pass_completed'
          : secondPassRequested
            ? 'no_distinct_second_pass_query'
            : 'first_pass_only',
      firstPassChunkCount: input.firstPassResult.chunks.length,
      firstPassSourceCount: input.firstPassResult.contextGroups.length,
      secondPassQuery,
      secondPassChunkCount: input.secondPassResult?.chunks.length ?? 0,
      secondPassSourceCount: input.secondPassResult?.contextGroups.length ?? 0,
      mergedChunkCount: input.mergedChunks.length,
      mergedSourceCount: input.mergedContextGroups.length
    };
  }

  private resolveSecondPassQuery(input: {
    originalQuestion: string;
    boundedMultiStepInput?: BoundedMultiStepInput;
    firstPassResult: AssistantSearchResult;
  }) {
    const explicitQuery = this.readString(
      input.boundedMultiStepInput?.rewrittenQuery
    );
    const firstPassRewrittenQuery = this.readString(
      input.firstPassResult.query.rewritten
    );
    const firstPassQuery = this.readString(
      input.firstPassResult.query.retrieval
    );
    const candidateQuery = explicitQuery ?? firstPassRewrittenQuery;

    if (candidateQuery == null) {
      return null;
    }

    if (
      candidateQuery === input.originalQuestion ||
      candidateQuery === firstPassQuery
    ) {
      return null;
    }

    return candidateQuery;
  }

  private hasBoundedMultiStepRequest(input?: BoundedMultiStepInput) {
    return (
      input?.enabled === true ||
      this.readString(input?.rewrittenQuery) != null ||
      input?.requestSecondPass === true
    );
  }

  private buildDisabledBoundedMultiStepDiagnostics(input?: {
    firstPassChunkCount?: number;
    firstPassSourceCount?: number;
  }): BoundedMultiStepDiagnostics {
    const firstPassChunkCount = input?.firstPassChunkCount ?? 0;
    const firstPassSourceCount = input?.firstPassSourceCount ?? 0;

    return {
      enabled: false,
      requested: false,
      rewrittenQuery: null,
      secondPassRequested: false,
      secondPassUsed: false,
      mode: 'disabled',
      reason: 'not_requested',
      firstPassChunkCount,
      firstPassSourceCount,
      secondPassQuery: null,
      secondPassChunkCount: 0,
      secondPassSourceCount: 0,
      mergedChunkCount: firstPassChunkCount,
      mergedSourceCount: firstPassSourceCount
    };
  }

  private mergeChunks<T extends { chunkId: string }>(first: T[], second: T[]) {
    const seen = new Set<string>();
    return [...first, ...second].filter((chunk) => {
      if (seen.has(chunk.chunkId)) {
        return false;
      }
      seen.add(chunk.chunkId);
      return true;
    });
  }

  private mergeContextGroups<
    T extends {
      documentId: string;
      startChunkIndex: number;
      endChunkIndex: number;
      chunkIds: string[];
    }
  >(first: T[], second: T[]) {
    const seen = new Set<string>();
    return [...first, ...second].filter((group) => {
      const key = [
        group.documentId,
        group.startChunkIndex,
        group.endChunkIndex,
        ...group.chunkIds
      ].join(':');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private readStringValue(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private readString(value: unknown) {
    return this.readStringValue(value);
  }
}
