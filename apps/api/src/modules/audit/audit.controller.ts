import { Controller, Get, Query, Req } from "@nestjs/common";
import { resolveRequestAuthContext, type ApiRequestWithAuthContext } from "../auth/auth-identity.contract";
import { AuthenticatedRoute } from "../auth/auth-route-policy";
import { listAuditEventsSchema } from "./audit.schemas";
import { AuditService } from "./audit.service";

@AuthenticatedRoute()
@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get("events")
  listAuditEvents(@Query() query: unknown, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    const input = listAuditEventsSchema.parse(query);
    return this.auditService.listAuditEvents(input, authContext.identity);
  }
}
