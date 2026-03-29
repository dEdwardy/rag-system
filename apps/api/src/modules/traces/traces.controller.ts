import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import { TracesService } from "./traces.service";
import { resolveRequestAuthContext, type ApiRequestWithAuthContext } from "../auth/auth-identity.contract";
import { AuthenticatedRoute } from "../auth/auth-route-policy";
import { listTracesSchema } from "../documents/document.schemas";

@AuthenticatedRoute()
@Controller("traces")
export class TracesController {
  constructor(private readonly tracesService: TracesService) {}

  @Get()
  listTraces(@Query() query: unknown, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    const input = listTracesSchema.parse(query);
    return this.tracesService.listTraces(input, authContext.identity);
  }

  @Get(":id")
  getTrace(@Param("id") id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return this.tracesService.getTrace(id, authContext.identity);
  }
}
