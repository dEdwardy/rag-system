import { Module } from "@nestjs/common";
import { VectorStoreService } from "./vector-store.service";
import { VECTOR_STORE } from "./vector-store.types";

@Module({
  providers: [
    VectorStoreService,
    {
      provide: VECTOR_STORE,
      useExisting: VectorStoreService
    }
  ],
  exports: [VECTOR_STORE]
})
export class VectorStoreModule {}
