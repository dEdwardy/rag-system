import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infra/database/database.module";
import { StorageModule } from "../../infra/storage/storage.module";
import { IngestionModule } from "../ingestion/ingestion.module";
import { IndexingModule } from "../indexing/indexing.module";
import { KnowledgeBasesModule } from "../knowledge-bases/knowledge-bases.module";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";

@Module({
  imports: [DatabaseModule, KnowledgeBasesModule, StorageModule, IngestionModule, IndexingModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService]
})
export class DocumentsModule {}
