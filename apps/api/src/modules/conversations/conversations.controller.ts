import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { MessagesService } from '../messages/messages.service';
import { TracesService } from '../traces/traces.service';
import {
  ListConversationTracesInput,
  listConversationTracesSchema
} from '../documents/document.schemas';
import {
  resolveRequestAuthContext,
  type ApiRequestWithAuthContext
} from '../auth/auth-identity.contract';
import { AuthenticatedRoute } from '../auth/auth-route-policy';
import {
  nonEmptyStringParamSchema,
  ZodValidationPipe
} from '../../common/zod-validation.pipe';
import { z } from 'zod';

const updateConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional()
});
const listPagedConversationsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(12),
  page: z.coerce.number().int().min(1).default(1)
});
const listConversationMessagesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(80),
  before: z.string().trim().min(1).max(100).optional()
});

type ListPagedConversationsInput = z.infer<typeof listPagedConversationsSchema>;
type ListConversationMessagesInput = z.infer<
  typeof listConversationMessagesSchema
>;

@AuthenticatedRoute()
@Controller('conversations')
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

  @Get('paged')
  listPagedConversations(
    @Query(new ZodValidationPipe(listPagedConversationsSchema))
    query: ListPagedConversationsInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return this.conversationsService.listPagedConversations(
      authContext.identity,
      query
    );
  }

  @Get(':id')
  getConversation(
    @Param('id', new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return this.conversationsService.getConversation(id, authContext.identity);
  }

  @Patch(':id')
  updateConversation(
    @Param('id', new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateConversationSchema))
    body: z.infer<typeof updateConversationSchema>,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return this.conversationsService.updateConversation(
      id,
      authContext.identity,
      body
    );
  }

  @Delete(':id')
  deleteConversation(
    @Param('id', new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return this.conversationsService.deleteConversation(
      id,
      authContext.identity
    );
  }

  @Get(':id/messages')
  async listConversationMessages(
    @Param('id', new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Req() request?: ApiRequestWithAuthContext,
    @Query(new ZodValidationPipe(listConversationMessagesSchema))
    query?: ListConversationMessagesInput
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    const messages = await this.messagesService.listConversationMessages(
      id,
      authContext.identity,
      query
    );

    if (messages.length === 0) {
      await this.conversationsService.getConversation(id, authContext.identity);
    }

    return messages;
  }

  @Get(':id/traces')
  async listConversationTraces(
    @Param('id', new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Query(new ZodValidationPipe(listConversationTracesSchema))
    query: ListConversationTracesInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    const traces = await this.tracesService.listConversationTraces(
      id,
      query,
      authContext.identity
    );

    if (traces.length === 0) {
      await this.conversationsService.getConversation(id, authContext.identity);
    }

    return traces;
  }
}
