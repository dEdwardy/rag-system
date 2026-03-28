import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { MessagesService } from "../messages/messages.service";
import { TracesService } from "../traces/traces.service";
import { listConversationTracesSchema } from "../documents/document.schemas";
import { resolveRequestAuthContext, type ApiRequestWithAuthContext } from "../auth/auth-identity.contract";

@Controller("conversations")
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly tracesService: TracesService
  ) {}

  @Get()
  listConversations(@Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return this.conversationsService.listConversations(authContext.identity);
  }

  @Get(":id")
  getConversation(@Param("id") id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return this.conversationsService.getConversation(id, authContext.identity);
  }

  @Get(":id/messages")
  async listConversationMessages(@Param("id") id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    await this.conversationsService.getConversation(id, authContext.identity);
    return this.messagesService.listConversationMessages(id);
  }

  @Get(":id/traces")
  async listConversationTraces(@Param("id") id: string, @Query() query: unknown, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    await this.conversationsService.getConversation(id, authContext.identity);
    const input = listConversationTracesSchema.parse(query);
    return this.tracesService.listConversationTraces(id, input);
  }
}
