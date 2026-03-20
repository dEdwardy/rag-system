import { Module } from "@nestjs/common";
import { LlmModule } from "../../infra/llm/llm.module";
import { DatabaseModule } from "../../infra/database/database.module";
import { AnsweringModule } from "../answering/answering.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { MessagesModule } from "../messages/messages.module";
import { RetrievalModule } from "../retrieval/retrieval.module";
import { RetrievalProfilesModule } from "../retrieval-profiles/retrieval-profiles.module";
import { TracesModule } from "../traces/traces.module";
import { AssistantsController } from "./assistants.controller";
import { AskAssistantService } from "./ask-assistant.service";
import { AssistantsService } from "./assistants.service";

@Module({
  imports: [
    DatabaseModule,
    LlmModule,
    ConversationsModule,
    MessagesModule,
    RetrievalModule,
    AnsweringModule,
    TracesModule,
    RetrievalProfilesModule
  ],
  controllers: [AssistantsController],
  providers: [AssistantsService, AskAssistantService],
  exports: [AssistantsService]
})
export class AssistantsModule {}
