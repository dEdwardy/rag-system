import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import {
  createRetrievalProfileSchema,
  updateRetrievalProfileSchema
} from "./retrieval-profile.schemas";
import { AuthenticatedRoute } from "../auth/auth-route-policy";
import { resolveRequestAuthContext, type ApiRequestWithAuthContext } from "../auth/auth-identity.contract";
import { RetrievalProfilesService } from "./retrieval-profiles.service";

@AuthenticatedRoute()
@Controller("retrieval-profiles")
export class RetrievalProfilesController {
  constructor(private readonly retrievalProfilesService: RetrievalProfilesService) {}

  @Get()
  listRetrievalProfiles(@Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });
    return this.retrievalProfilesService.listRetrievalProfiles(authContext.identity);
  }

  @Get(":id")
  getRetrievalProfile(@Param("id") id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });
    return this.retrievalProfilesService.getRetrievalProfile(id, authContext.identity);
  }

  @Post()
  createRetrievalProfile(@Body() body: unknown, @Req() request?: ApiRequestWithAuthContext) {
    const input = createRetrievalProfileSchema.parse(body);
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });
    return this.retrievalProfilesService.createRetrievalProfile(input, authContext.identity);
  }

  @Patch(":id")
  updateRetrievalProfile(@Param("id") id: string, @Body() body: unknown, @Req() request?: ApiRequestWithAuthContext) {
    const input = updateRetrievalProfileSchema.parse(body);
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });
    return this.retrievalProfilesService.updateRetrievalProfile(id, input, authContext.identity);
  }
}
