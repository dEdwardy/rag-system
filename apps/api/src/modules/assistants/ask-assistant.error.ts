import { BadGatewayException } from "@nestjs/common";

export class AskAssistantError extends BadGatewayException {
  constructor(input: { traceId?: string; details?: Record<string, unknown> | null }) {
    super({
      statusCode: 502,
      error: "Bad Gateway",
      message: "Ask pipeline failed.",
      code: "ASK_PIPELINE_FAILED",
      traceId: input.traceId ?? null,
      details: input.details ?? null
    });
  }
}
