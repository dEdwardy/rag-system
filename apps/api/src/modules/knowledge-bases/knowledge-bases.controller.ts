import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { createKnowledgeBaseSchema, updateKnowledgeBaseSchema } from "./knowledge-base.schemas";
import { KnowledgeBasesService } from "./knowledge-bases.service";

@Controller("knowledge-bases")
export class KnowledgeBasesController {
  constructor(private readonly knowledgeBasesService: KnowledgeBasesService) {}

  @Get()
  listKnowledgeBases() {
    return this.knowledgeBasesService.listKnowledgeBases();
  }

  @Get(":id")
  getKnowledgeBase(@Param("id") id: string) {
    return this.knowledgeBasesService.getKnowledgeBase(id);
  }

  @Post()
  createKnowledgeBase(@Body() body: unknown) {
    const input = createKnowledgeBaseSchema.parse(body);
    return this.knowledgeBasesService.createKnowledgeBase(input);
  }

  @Patch(":id")
  updateKnowledgeBase(@Param("id") id: string, @Body() body: unknown) {
    const input = updateKnowledgeBaseSchema.parse(body);
    return this.knowledgeBasesService.updateKnowledgeBase(id, input);
  }
}
