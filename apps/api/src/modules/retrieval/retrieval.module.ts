import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infra/database/database.module";
import { EmbeddingModule } from "../../infra/embedding/embedding.module";
import { VectorStoreModule } from "../../infra/vector-store/vector-store.module";
import { RetrievalService } from "./retrieval.service";

@Module({
  imports: [DatabaseModule, EmbeddingModule, VectorStoreModule],
  providers: [RetrievalService],
  exports: [RetrievalService]
})
export class RetrievalModule {}
