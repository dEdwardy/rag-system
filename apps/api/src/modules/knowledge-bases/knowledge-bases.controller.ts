import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { resolveRequestAuthContext, type ApiRequestWithAuthContext } from "../auth/auth-identity.contract";
import { createKnowledgeBaseSchema, updateKnowledgeBaseSchema } from "./knowledge-base.schemas";
import { KnowledgeBasesService } from "./knowledge-bases.service";

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
  getKnowledgeBase(@Param("id") id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.knowledgeBasesService.getKnowledgeBase(id, authContext.identity);
  }

  @Post()
  createKnowledgeBase(@Body() body: unknown, @Req() request?: ApiRequestWithAuthContext) {
    const input = createKnowledgeBaseSchema.parse(body);
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.knowledgeBasesService.createKnowledgeBase(input, authContext.identity);
  }

  @Patch(":id")
  updateKnowledgeBase(@Param("id") id: string, @Body() body: unknown, @Req() request?: ApiRequestWithAuthContext) {
    const input = updateKnowledgeBaseSchema.parse(body);
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.knowledgeBasesService.updateKnowledgeBase(id, input, authContext.identity);
  }
}
