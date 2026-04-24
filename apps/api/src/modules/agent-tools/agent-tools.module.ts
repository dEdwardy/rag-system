import { Module } from '@nestjs/common';
import { AssistantsModule } from '../assistants/assistants.module';
import { DocumentsModule } from '../documents/documents.module';
import { TracesModule } from '../traces/traces.module';
import { AgentToolsController } from './agent-tools.controller';

@Module({
  imports: [AssistantsModule, DocumentsModule, TracesModule],
  controllers: [AgentToolsController]
})
export class AgentToolsModule {}
