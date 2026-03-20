import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infra/database/database.module";
import { MessagesService } from "./messages.service";

@Module({
  imports: [DatabaseModule],
  providers: [MessagesService],
  exports: [MessagesService]
})
export class MessagesModule {}
