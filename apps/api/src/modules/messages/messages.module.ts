import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infra/database/database.module';
import { MessageFeedbackController } from './message-feedback.controller';
import { MessageFeedbackService } from './message-feedback.service';
import { MessagesService } from './messages.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MessageFeedbackController],
  providers: [MessagesService, MessageFeedbackService],
  exports: [MessagesService, MessageFeedbackService]
})
export class MessagesModule {}
