import { Module } from '@nestjs/common';
import { LlmModule } from '../../infra/llm/llm.module';
import { AskRouteClassifier } from '../assistants/ask-route-classifier';
import { AssistantsModule } from '../assistants/assistants.module';
import { DocumentsModule } from '../documents/documents.module';
import { TracesModule } from '../traces/traces.module';
import { AgentAskStreamController } from './agent-ask-stream.controller';
import { AgentToolsController } from './agent-tools.controller';
import { LangGraphAgentLoopService } from './langgraph-agent-loop.service';
import { LangGraphAnswerService } from './langgraph-answer.service';

@Module({
  imports: [LlmModule, AssistantsModule, DocumentsModule, TracesModule],
  controllers: [AgentToolsController, AgentAskStreamController],
  providers: [
    AskRouteClassifier,
    LangGraphAnswerService,
    LangGraphAgentLoopService
  ],
  exports: [LangGraphAnswerService]
})
export class AgentToolsModule {}
