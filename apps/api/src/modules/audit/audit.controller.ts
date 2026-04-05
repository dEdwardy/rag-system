import { Controller, Get, Query, Req } from "@nestjs/common";
import { resolveRequestAuthContext, type ApiRequestWithAuthContext } from "../auth/auth-identity.contract";
import { AuthenticatedRoute } from "../auth/auth-route-policy";
import { ListAuditEventsInput, listAuditEventsSchema } from "./audit.schemas";
import { AuditService } from "./audit.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

@AuthenticatedRoute()
@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get("events")
  listAuditEvents(@Query(new ZodValidationPipe(listAuditEventsSchema)) query: ListAuditEventsInput, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return this.auditService.listAuditEvents(query, authContext.identity);
  }
}
