import { Body, Controller, Get, HttpException, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { askAssistantSchema, updateAssistantSchema } from "./assistant.schemas";
import { AssistantsService } from "./assistants.service";
import { AskAssistantService } from "./ask-assistant.service";
import { resolveRequestAuthContext, type ApiRequestWithAuthContext } from "../auth/auth-identity.contract";
import { AuthenticatedRoute } from "../auth/auth-route-policy";

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
        onEvent: event => {
          writeEvent(event);
        }
      });
    } catch (error) {
      if (!streamStarted && this.isAuthDenialHttpException(error)) {
        const payload = error.getResponse();
        response.status(error.getStatus());
        if (typeof payload === "string") {
          response.json({
            message: payload
          });
        } else {
          response.json(payload);
        }
        return;
      }

      const diagnostics = this.buildStreamErrorDiagnostics(error);
      writeEvent({
        type: "error",
        ...diagnostics
      });
    } finally {
      response.end();
    }
  }

  private isAuthDenialHttpException(error: unknown): error is HttpException {
    return error instanceof HttpException && (error.getStatus() === 401 || error.getStatus() === 403);
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
