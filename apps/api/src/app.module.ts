import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { HealthController } from "./common/health.controller";
import { KnowledgeBasesModule } from "./modules/knowledge-bases/knowledge-bases.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { AssistantsModule } from "./modules/assistants/assistants.module";
import { RetrievalProfilesModule } from "./modules/retrieval-profiles/retrieval-profiles.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { TracesModule } from "./modules/traces/traces.module";
import { IngestionModule } from "./modules/ingestion/ingestion.module";
import { IndexingModule } from "./modules/indexing/indexing.module";
import { RetrievalModule } from "./modules/retrieval/retrieval.module";
import { AnsweringModule } from "./modules/answering/answering.module";
import { DatabaseModule } from "./infra/database/database.module";
import { StorageModule } from "./infra/storage/storage.module";
import { VectorStoreModule } from "./infra/vector-store/vector-store.module";
import { LlmModule } from "./infra/llm/llm.module";
import { EmbeddingModule } from "./infra/embedding/embedding.module";
import { ParsingModule } from "./infra/parsing/parsing.module";
import { QueueModule } from "./infra/queue/queue.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AuthContextMiddleware } from "./modules/auth/auth-context.middleware";

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    VectorStoreModule,
    LlmModule,
    EmbeddingModule,
    ParsingModule,
    QueueModule,
    AuthModule,
    KnowledgeBasesModule,
    DocumentsModule,
    AssistantsModule,
    RetrievalProfilesModule,
    ConversationsModule,
    MessagesModule,
    TracesModule,
    IngestionModule,
    IndexingModule,
    RetrievalModule,
    AnsweringModule
  ],
  controllers: [HealthController]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthContextMiddleware).forRoutes("*");
  }
}
