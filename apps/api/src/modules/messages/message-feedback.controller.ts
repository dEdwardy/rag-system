import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import {
  nonEmptyStringParamSchema,
  ZodValidationPipe
} from '../../common/zod-validation.pipe';
import {
  resolveRequestAuthContext,
  type ApiRequestWithAuthContext
} from '../auth/auth-identity.contract';
import { AuthenticatedRoute } from '../auth/auth-route-policy';
import { MessageFeedbackService } from './message-feedback.service';

const submitMessageFeedbackSchema = z
  .object({
    rating: z.enum(['up', 'down']),
    reason: z.string().trim().max(120).optional(),
    comment: z.string().trim().max(2000).optional()
  })
  .strict();

type SubmitMessageFeedbackInput = z.infer<typeof submitMessageFeedbackSchema>;

@AuthenticatedRoute()
@Controller('messages')
export class MessageFeedbackController {
  constructor(
    private readonly messageFeedbackService: MessageFeedbackService
  ) {}

  @Post(':id/feedback')
  submitFeedback(
    @Param('id', new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Body(new ZodValidationPipe(submitMessageFeedbackSchema))
    input: SubmitMessageFeedbackInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.messageFeedbackService.submitFeedback({
      messageId: id,
      rating: input.rating,
      reason: input.reason,
      comment: input.comment,
      identity: authContext.identity
    });
  }
}
