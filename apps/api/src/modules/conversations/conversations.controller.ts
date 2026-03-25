import { Controller, Get, Param, Query } from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { MessagesService } from "../messages/messages.service";
import { TracesService } from "../traces/traces.service";
import { listConversationTracesSchema } from "../documents/document.schemas";

@Controller("conversations")
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly tracesService: TracesService
  ) {}

  @Get()
  listConversations() {
    return this.conversationsService.listConversations();
  }

  @Get(":id")
  getConversation(@Param("id") id: string) {
    return this.conversationsService.getConversation(id);
  }

  @Get(":id/messages")
  listConversationMessages(@Param("id") id: string) {
    return this.messagesService.listConversationMessages(id);
  }

  @Get(":id/traces")
  listConversationTraces(@Param("id") id: string, @Query() query: unknown) {
    const input = listConversationTracesSchema.parse(query);
    return this.tracesService.listConversationTraces(id, input);
  }
}
