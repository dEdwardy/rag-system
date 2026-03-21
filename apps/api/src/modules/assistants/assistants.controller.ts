import { Body, Controller, Get, HttpException, Param, Patch, Post, Res } from "@nestjs/common";
import { askAssistantSchema, updateAssistantSchema } from "./assistant.schemas";
import { AssistantsService } from "./assistants.service";
import { AskAssistantService } from "./ask-assistant.service";

@Controller("assistants")
export class AssistantsController {
  constructor(
    private readonly assistantsService: AssistantsService,
    private readonly askAssistantService: AskAssistantService
  ) {}

  @Get()
  listAssistants() {
    return this.assistantsService.listAssistants();
  }

  @Get(":id")
  getAssistant(@Param("id") id: string) {
    return this.assistantsService.getAssistant(id);
  }

  @Patch(":id")
  updateAssistant(@Param("id") id: string, @Body() body: unknown) {
    const input = updateAssistantSchema.parse(body);
    return this.assistantsService.updateAssistant(id, input);
  }

  @Post(":id/ask")
  async askAssistant(@Param("id") id: string, @Body() body: unknown) {
    const input = askAssistantSchema.parse(body);
    return this.askAssistantService.askAssistant({
      assistantId: id,
      question: input.question,
      conversationId: input.conversationId
    });
  }

  @Post(":id/ask/stream")
  async askAssistantStream(@Param("id") id: string, @Body() body: unknown, @Res() response: any) {
    const input = askAssistantSchema.parse(body);

    response.status(200);
    response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");

    const writeEvent = (event: Record<string, unknown>) => {
      response.write(`${JSON.stringify(event)}\n`);
    };

    writeEvent({
      type: "status",
      phase: "started"
    });

    try {
      const result = await this.askAssistantService.askAssistant({
        assistantId: id,
        question: input.question,
        conversationId: input.conversationId
      });

      writeEvent({
        type: "status",
        phase: "generating"
      });

      for (const delta of this.chunkAnswer(result.answer)) {
        writeEvent({
          type: "answer_delta",
          delta
        });
      }

      writeEvent({
        type: "final",
        data: result
      });
    } catch (error) {
      const diagnostics = this.buildStreamErrorDiagnostics(error);
      writeEvent({
        type: "error",
        ...diagnostics
      });
    } finally {
      response.end();
    }
  }

  private chunkAnswer(answer: string) {
    return answer.match(/\S+\s*|\s+/g) ?? [answer];
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
