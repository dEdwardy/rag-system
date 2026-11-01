import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infra/database/database.module';
import { AgentToolsModule } from '../agent-tools/agent-tools.module';
import { AssistantsModule } from '../assistants/assistants.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { EvalQuestionSetsController } from './eval-question-sets.controller';
import { EvalQuestionSetsService } from './eval-question-sets.service';

@Module({
  imports: [
    DatabaseModule,
    AssistantsModule,
    AgentToolsModule,
    ConversationsModule
  ],
  controllers: [EvalQuestionSetsController],
  providers: [EvalQuestionSetsService],
  exports: [EvalQuestionSetsService]
})
export class EvalQuestionSetsModule {}
