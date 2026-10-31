import {
  Body,
  Controller,
  Get,
  HttpException,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  Res
} from '@nestjs/common';
import {
  AskAssistantInput,
  askAssistantSchema,
  UpdateAssistantInput,
  updateAssistantSchema
} from './assistant.schemas';
import { AssistantsService } from './assistants.service';
import { AskAssistantService } from './ask-assistant.service';
import {
  classifyAskStreamError,
  isRetryableAskStreamError
} from './ask-stream.error';
import {
  resolveRequestAuthContext,
  type ApiRequestWithAuthContext
} from '../auth/auth-identity.contract';
import { AuthenticatedRoute } from '../auth/auth-route-policy';
import { buildHttpExceptionResponse } from '../../common/http-exception.filter';
import {
  getSseReplayStream,
  SseStreamWriter,
  type SseStreamCloseReason,
  type SseWritableResponse
} from '../../common/sse-stream-writer';
import {
  nonEmptyStringParamSchema,
  ZodValidationPipe
} from '../../common/zod-validation.pipe';

type StreamResponse = Omit<SseWritableResponse, 'status'> & {
  status: (code: number) => StreamResponse;
  json: (payload: unknown) => unknown;
};

@AuthenticatedRoute()
@Controller('assistants')
export class AssistantsController {
  private readonly logger = new Logger(AssistantsController.name);

  constructor(
    private readonly assistantsService: AssistantsService,
    private readonly askAssistantService: AskAssistantService
  ) {}

  @Get()
  listAssistants(@Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.assistantsService.listAssistants(authContext.identity);
  }

  @Get(':id')
  getAssistant(
    @Param('id', new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.assistantsService.getAssistant(id, authContext.identity);
  }

  @Patch(':id')
  updateAssistant(
    @Param('id', new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateAssistantSchema))
    input: UpdateAssistantInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.assistantsService.updateAssistant(
      id,
      input,
      authContext.identity
    );
  }

  @Post(':id/ask')
  async askAssistant(
    @Param('id', new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Body(new ZodValidationPipe(askAssistantSchema)) input: AskAssistantInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    return this.askAssistantService.askAssistant({
      assistantId: id,
      question: input.question,
      conversationId: input.conversationId,
      authContext: request?.authContext
    });
  }

  @Post(':id/ask/stream')
  async askAssistantStream(
    @Param('id', new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Body(new ZodValidationPipe(askAssistantSchema)) input: AskAssistantInput,
    @Res() response: StreamResponse,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    let streamFinished = false;
    const abortController = new AbortController();
    const requestWithEvents = request as ApiRequestWithAuthContext & {
      headers?: Record<string, string | string[] | undefined>;
      on?: (event: string, listener: () => void) => void;
    };
    const resumeStreamId = readHeader(
      requestWithEvents?.headers,
      'x-sse-stream-id'
    );
    const resumeFromEventId = readLastEventId(
      requestWithEvents?.headers,
      'last-event-id'
    );
    const canResume =
      resumeStreamId != null &&
      resumeFromEventId != null &&
      getSseReplayStream(resumeStreamId) != null;
    const writer = new SseStreamWriter(
      response,
      canResume
        ? {
            streamId: resumeStreamId,
            resumeFromEventId,
            follow: true
          }
        : {}
    );

    if (canResume) {
      try {
        await writer.waitForReplayToFinish();
      } finally {
        streamFinished = true;
        await writer.close('completed');
      }
      return;
    }

    const abortStream = () => {
      if (!streamFinished && !abortController.signal.aborted) {
        abortController.abort();
      }
    };
    const resumeGraceTimer = setTimeout(() => {
      if (!writer.hasActiveResponse()) {
        abortStream();
      }
    }, 60_000);
    resumeGraceTimer.unref?.();

    const detachStream = () => {
      writer.detach();
    };

    requestWithEvents?.on?.('close', detachStream);
    response?.on?.('close', detachStream);

    let closeReason: SseStreamCloseReason = 'completed';

    try {
      await this.askAssistantService.askAssistantStream({
        assistantId: id,
        question: input.question,
        conversationId: input.conversationId,
        authContext: request?.authContext,
        signal: abortController.signal,
        onEvent: (event) => writer.writeEvent(event)
      });
    } catch (error) {
      const errorKind = classifyAskStreamError(error);

      if (
        errorKind === 'aborted' ||
        errorKind === 'slow_client' ||
        this.isAbortError(error) ||
        abortController.signal.aborted
      ) {
        closeReason = errorKind === 'slow_client' ? 'slow_client' : 'aborted';
        return;
      }

      if (!writer.isStarted) {
        const result = buildHttpExceptionResponse(
          error,
          `/assistants/${id}/ask/stream`
        );
        response.status(result.statusCode).json(result.body);
        closeReason = 'error';
        return;
      }

      const diagnostics = this.buildStreamErrorDiagnostics(error);
      await writer.writeEvent({
        type: 'error',
        ...diagnostics,
        retryable: isRetryableAskStreamError(error)
      });
      closeReason = 'error';
    } finally {
      streamFinished = true;
      clearTimeout(resumeGraceTimer);
      await writer.close(closeReason);
      this.logger.log(
        JSON.stringify({
          event: 'ask_stream_diagnostics',
          assistantId: id,
          ...writer.streamStats
        })
      );
    }
  }

  private isAbortError(error: unknown) {
    return error instanceof Error && error.name === 'AbortError';
  }

  private buildStreamErrorDiagnostics(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'object' && response != null) {
        const payload = response as {
          message?: string;
          code?: string;
          traceId?: string | null;
          details?: Record<string, unknown> | null;
        };

        return {
          message: payload.message ?? error.message,
          code: payload.code,
          traceId: payload.traceId ?? null,
          details: payload.details ?? null
        };
      }
    }

    return {
      message: error instanceof Error ? error.message : 'Ask request failed.',
      code: undefined,
      traceId: null,
      details: null
    };
  }
}

function readHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string
) {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

function readLastEventId(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string
) {
  const raw = readHeader(headers, name);
  if (raw == null) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}
