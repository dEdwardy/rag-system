import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import { TracesService } from "./traces.service";
import { resolveRequestAuthContext, type ApiRequestWithAuthContext } from "../auth/auth-identity.contract";
import { AuthenticatedRoute } from "../auth/auth-route-policy";
import { ListTracesInput, listTracesSchema } from "../documents/document.schemas";
import { nonEmptyStringParamSchema, ZodValidationPipe } from "../../common/zod-validation.pipe";

@AuthenticatedRoute()
@Controller("traces")
export class TracesController {
  constructor(private readonly tracesService: TracesService) {}

  @Get()
  listTraces(@Query(new ZodValidationPipe(listTracesSchema)) query: ListTracesInput, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return this.tracesService.listTraces(query, authContext.identity);
  }

  @Get(":id")
  getTrace(@Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return this.tracesService.getTrace(id, authContext.identity);
  }
}
