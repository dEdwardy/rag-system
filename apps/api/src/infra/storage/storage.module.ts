import { Module } from "@nestjs/common";
import { resolveStorageRuntimeConfig, type StorageRuntimeConfig } from "./storage-runtime-config";
import {
  LocalStorageProviderService,
  STORAGE_PROVIDER_SERVICE,
  SupabaseStorageProviderService,
  type StorageProviderService
} from "./storage-provider.service";
import { StorageService } from "./storage.service";

export const STORAGE_RUNTIME_CONFIG = Symbol("STORAGE_RUNTIME_CONFIG");

@Module({
  providers: [
    {
      provide: STORAGE_RUNTIME_CONFIG,
      useFactory: () => resolveStorageRuntimeConfig()
    },
    {
      provide: STORAGE_PROVIDER_SERVICE,
      inject: [STORAGE_RUNTIME_CONFIG],
      useFactory: (runtimeConfig: StorageRuntimeConfig): StorageProviderService => {
        if (runtimeConfig.provider === "local") {
          return new LocalStorageProviderService();
        }

        return new SupabaseStorageProviderService(runtimeConfig);
      }
    },
    StorageService
  ],
  exports: [STORAGE_RUNTIME_CONFIG, STORAGE_PROVIDER_SERVICE, StorageService]
})
export class StorageModule {}
