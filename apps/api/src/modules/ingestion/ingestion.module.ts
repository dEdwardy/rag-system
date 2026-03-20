import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infra/database/database.module";
import { ParsingModule } from "../../infra/parsing/parsing.module";
import { QueueModule } from "../../infra/queue/queue.module";
import { StorageModule } from "../../infra/storage/storage.module";
import { IndexingModule } from "../indexing/indexing.module";
import { IngestionService } from "./ingestion.service";

@Module({
  imports: [DatabaseModule, StorageModule, QueueModule, IndexingModule, ParsingModule],
  providers: [IngestionService],
  exports: [IngestionService]
})
export class IngestionModule {}
