import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { TracesService } from './traces.service';
import {
  resolveRequestAuthContext,
  type ApiRequestWithAuthContext
} from '../auth/auth-identity.contract';
import { AuthenticatedRoute } from '../auth/auth-route-policy';
import {
  ListLatestConversationTracesInput,
  ListTracesInput,
  listLatestConversationTracesSchema,
  listTracesSchema
} from '../documents/document.schemas';
import {
  nonEmptyStringParamSchema,
  ZodValidationPipe
} from '../../common/zod-validation.pipe';

const usageSummarySchema = z
  .object({
    sinceHours: z.coerce.number().int().min(1).max(720).default(24),
    limit: z.coerce.number().int().min(1).max(5000).default(2000)
  })
  .strict();

type UsageSummaryInput = z.infer<typeof usageSummarySchema>;

@AuthenticatedRoute()
@Controller('traces')
export class TracesController {
  constructor(private readonly tracesService: TracesService) {}

  @Get()
  listTraces(
    @Query(new ZodValidationPipe(listTracesSchema)) query: ListTracesInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return this.tracesService.listTraces(query, authContext.identity);
  }

  @Get('latest-by-conversation')
  listLatestConversationTraces(
    @Query(new ZodValidationPipe(listLatestConversationTracesSchema))
    query: ListLatestConversationTracesInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return this.tracesService.listLatestConversationTraces(
      query.conversationIds,
      authContext.identity
    );
  }

  @Get('usage-summary')
  getUsageSummary(
    @Query(new ZodValidationPipe(usageSummarySchema)) query: UsageSummaryInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return this.tracesService.getUsageSummary(query, authContext.identity);
  }

  @Get(':id')
  getTrace(
    @Param('id', new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });
    return this.tracesService.getTrace(id, authContext.identity);
  }
}
