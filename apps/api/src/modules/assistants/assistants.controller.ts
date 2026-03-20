import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { askAssistantSchema, updateAssistantSchema } from "./assistant.schemas";
import { AssistantsService } from "./assistants.service";
import { AskAssistantService } from "./ask-assistant.service";

@Controller("assistants")
export class AssistantsController {
  constructor(
    private readonly assistantsService: AssistantsService,
    private readonly askAssistantService: AskAssistantService
  ) {}

  @Get()
  listAssistants() {
    return this.assistantsService.listAssistants();
  }

  @Get(":id")
  getAssistant(@Param("id") id: string) {
    return this.assistantsService.getAssistant(id);
  }

  @Patch(":id")
  updateAssistant(@Param("id") id: string, @Body() body: unknown) {
    const input = updateAssistantSchema.parse(body);
    return this.assistantsService.updateAssistant(id, input);
  }

  @Post(":id/ask")
  async askAssistant(@Param("id") id: string, @Body() body: unknown) {
    const input = askAssistantSchema.parse(body);
    return this.askAssistantService.askAssistant({
      assistantId: id,
      question: input.question,
      conversationId: input.conversationId
    });
  }
}
