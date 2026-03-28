import { Controller, Get, Param, Req } from "@nestjs/common";
import { TracesService } from "./traces.service";
import { resolveRequestAuthContext, type ApiRequestWithAuthContext } from "../auth/auth-identity.contract";

@Controller("traces")
export class TracesController {
  constructor(private readonly tracesService: TracesService) {}

  @Get(":id")
  getTrace(@Param("id") id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return this.tracesService.getTrace(id, authContext.identity);
  }
}
