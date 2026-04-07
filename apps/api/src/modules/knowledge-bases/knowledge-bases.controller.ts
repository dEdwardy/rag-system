import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { resolveRequestAuthContext, type ApiRequestWithAuthContext } from "../auth/auth-identity.contract";
import { AuthenticatedRoute } from "../auth/auth-route-policy";
import {
  CreateKnowledgeBaseInput,
  createKnowledgeBaseSchema,
  UpdateKnowledgeBaseInput,
  updateKnowledgeBaseSchema
} from "./knowledge-base.schemas";
import { KnowledgeBasesService } from "./knowledge-bases.service";
import { nonEmptyStringParamSchema, ZodValidationPipe } from "../../common/zod-validation.pipe";

@AuthenticatedRoute()
@Controller("knowledge-bases")
export class KnowledgeBasesController {
  constructor(private readonly knowledgeBasesService: KnowledgeBasesService) {}

  @Get()
  listKnowledgeBases(@Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.knowledgeBasesService.listKnowledgeBases(authContext.identity);
  }

  @Get(":id")
  getKnowledgeBase(@Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.knowledgeBasesService.getKnowledgeBase(id, authContext.identity, { preserveForbiddenOnMiss: true });
  }

  @Post()
  createKnowledgeBase(
    @Body(new ZodValidationPipe(createKnowledgeBaseSchema)) input: CreateKnowledgeBaseInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.knowledgeBasesService.createKnowledgeBase(input, authContext.identity);
  }

  @Patch(":id")
  updateKnowledgeBase(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateKnowledgeBaseSchema)) input: UpdateKnowledgeBaseInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.knowledgeBasesService.updateKnowledgeBase(id, input, authContext.identity);
  }
}
