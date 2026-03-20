import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infra/database/database.module";
import { EmbeddingModule } from "../../infra/embedding/embedding.module";
import { VectorStoreModule } from "../../infra/vector-store/vector-store.module";
import { IndexingService } from "./indexing.service";

@Module({
  imports: [DatabaseModule, EmbeddingModule, VectorStoreModule],
  providers: [IndexingService],
  exports: [IndexingService]
})
export class IndexingModule {}
