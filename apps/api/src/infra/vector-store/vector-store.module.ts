import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { PgVectorStoreService } from "./pg-vector-store.service";
import { resolveVectorStoreRuntimeConfig } from "./vector-store-runtime-config";
import { VectorStoreService } from "./vector-store.service";
import { VECTOR_STORE } from "./vector-store.types";

@Module({
  imports: [DatabaseModule],
  providers: [
    VectorStoreService,
    PgVectorStoreService,
    {
      provide: VECTOR_STORE,
      useFactory: (filesystemVectorStore: VectorStoreService, pgVectorStore: PgVectorStoreService) => {
        const runtimeConfig = resolveVectorStoreRuntimeConfig();
        return runtimeConfig.provider === "pgvector" ? pgVectorStore : filesystemVectorStore;
      },
      inject: [VectorStoreService, PgVectorStoreService]
    }
  ],
  exports: [VECTOR_STORE]
})
export class VectorStoreModule {}
