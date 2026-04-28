import { Module } from '@nestjs/common';
import { AssistantsModule } from '../assistants/assistants.module';
import { DocumentsModule } from '../documents/documents.module';
import { TracesModule } from '../traces/traces.module';
import { AgentToolsController } from './agent-tools.controller';
import { LangGraphAnswerService } from './langgraph-answer.service';

@Module({
  imports: [AssistantsModule, DocumentsModule, TracesModule],
  controllers: [AgentToolsController],
  providers: [LangGraphAnswerService]
})
export class AgentToolsModule {}
