import { Body, Controller, Get, HttpException, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { askAssistantSchema, updateAssistantSchema } from "./assistant.schemas";
import { AssistantsService } from "./assistants.service";
import { AskAssistantService } from "./ask-assistant.service";
import { resolveRequestAuthContext, type ApiRequestWithAuthContext } from "../auth/auth-identity.contract";
import { AuthenticatedRoute } from "../auth/auth-route-policy";
import { buildHttpExceptionResponse } from "../../common/http-exception.filter";

@AuthenticatedRoute()
@Controller("assistants")
export class AssistantsController {
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

  @Get(":id")
  getAssistant(@Param("id") id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.assistantsService.getAssistant(id, authContext.identity);
  }

  @Patch(":id")
  updateAssistant(@Param("id") id: string, @Body() body: unknown, @Req() request?: ApiRequestWithAuthContext) {
    const input = updateAssistantSchema.parse(body);
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.assistantsService.updateAssistant(id, input, authContext.identity);
  }

  @Post(":id/ask")
  async askAssistant(@Param("id") id: string, @Body() body: unknown, @Req() request?: ApiRequestWithAuthContext) {
    const input = askAssistantSchema.parse(body);
    return this.askAssistantService.askAssistant({
      assistantId: id,
      question: input.question,
      conversationId: input.conversationId,
      authContext: request?.authContext
    });
  }

  @Post(":id/ask/stream")
  async askAssistantStream(
    @Param("id") id: string,
    @Body() body: unknown,
    @Res() response: any,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const input = askAssistantSchema.parse(body);
    let streamStarted = false;
    let streamFinished = false;
    const abortController = new AbortController();
    const requestWithEvents = request as ApiRequestWithAuthContext & {
      on?: (event: string, listener: () => void) => void;
    };

    const abortStream = () => {
      if (!streamFinished && !abortController.signal.aborted) {
        abortController.abort();
      }
    };

    requestWithEvents?.on?.("aborted", abortStream);
    requestWithEvents?.on?.("close", abortStream);
    response?.on?.("close", abortStream);

    const writeEvent = (event: Record<string, unknown>) => {
      if (!streamStarted) {
        streamStarted = true;
        response.status(200);
        response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
        response.setHeader("Cache-Control", "no-cache, no-transform");
        response.setHeader("Connection", "keep-alive");
      }
      response.write(`${JSON.stringify(event)}\n`);
    };

    try {
      await this.askAssistantService.askAssistantStream({
        assistantId: id,
        question: input.question,
        conversationId: input.conversationId,
        authContext: request?.authContext,
        signal: abortController.signal,
        onEvent: event => {
          writeEvent(event);
        }
      });
    } catch (error) {
      if (this.isAbortError(error) || abortController.signal.aborted) {
        return;
      }

      if (!streamStarted) {
        const result = buildHttpExceptionResponse(error, `/assistants/${id}/ask/stream`);
        response.status(result.statusCode).json(result.body);
        return;
      }

      const diagnostics = this.buildStreamErrorDiagnostics(error);
      writeEvent({
        type: "error",
        ...diagnostics
      });
    } finally {
      streamFinished = true;
      response.end();
    }
  }

  private isAbortError(error: unknown) {
    return error instanceof Error && error.name === "AbortError";
  }

  private buildStreamErrorDiagnostics(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === "object" && response != null) {
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
      message: error instanceof Error ? error.message : "Ask request failed.",
      code: undefined,
      traceId: null,
      details: null
    };
  }
}
