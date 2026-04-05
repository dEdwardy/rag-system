import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import {
  CreateRetrievalProfileInput,
  createRetrievalProfileSchema,
  UpdateRetrievalProfileInput,
  updateRetrievalProfileSchema
} from "./retrieval-profile.schemas";
import { AuthenticatedRoute } from "../auth/auth-route-policy";
import { resolveRequestAuthContext, type ApiRequestWithAuthContext } from "../auth/auth-identity.contract";
import { RetrievalProfilesService } from "./retrieval-profiles.service";
import { nonEmptyStringParamSchema, ZodValidationPipe } from "../../common/zod-validation.pipe";

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
  getRetrievalProfile(@Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });
    return this.retrievalProfilesService.getRetrievalProfile(id, authContext.identity);
  }

  @Post()
  createRetrievalProfile(
    @Body(new ZodValidationPipe(createRetrievalProfileSchema)) input: CreateRetrievalProfileInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });
    return this.retrievalProfilesService.createRetrievalProfile(input, authContext.identity);
  }

  @Patch(":id")
  updateRetrievalProfile(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateRetrievalProfileSchema)) input: UpdateRetrievalProfileInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({ authContext: request?.authContext });
    return this.retrievalProfilesService.updateRetrievalProfile(id, input, authContext.identity);
  }
}
