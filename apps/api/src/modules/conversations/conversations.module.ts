import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infra/database/database.module";
import { MessagesModule } from "../messages/messages.module";
import { TracesModule } from "../traces/traces.module";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";

@Module({
  imports: [DatabaseModule, MessagesModule, TracesModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService]
})
export class ConversationsModule {}
