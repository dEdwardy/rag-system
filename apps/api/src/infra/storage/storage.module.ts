import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { resolveStorageRuntimeConfig, type StorageRuntimeConfig, type SupabaseStorageRuntimeConfig } from "./storage-runtime-config";
import {
  STORAGE_PROVIDER_SERVICE,
  SupabaseStorageProviderService,
  LocalStorageProviderService,
  type StorageProviderService
} from "./storage-provider.service";
import { StorageService } from "./storage.service";

export const STORAGE_RUNTIME_CONFIG = Symbol("STORAGE_RUNTIME_CONFIG");

@Module({
  providers: [
    {
      provide: STORAGE_RUNTIME_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): StorageRuntimeConfig => {
        const env = {
          STORAGE_PROVIDER: configService.get("STORAGE_PROVIDER"),
          STORAGE_ROOT: configService.get("STORAGE_ROOT"),
          SUPABASE_URL: configService.get("SUPABASE_URL"),
          SUPABASE_SERVICE_ROLE_KEY: configService.get("SUPABASE_SERVICE_ROLE_KEY"),
          SUPABASE_STORAGE_BUCKET_UPLOADS: configService.get("SUPABASE_STORAGE_BUCKET_UPLOADS"),
          SUPABASE_STORAGE_BUCKET_GENERATED: configService.get("SUPABASE_STORAGE_BUCKET_GENERATED")
        };
        return resolveStorageRuntimeConfig(env);
      }
    },
    {
      provide: STORAGE_PROVIDER_SERVICE,
      inject: [STORAGE_RUNTIME_CONFIG],
      useFactory: (runtimeConfig: StorageRuntimeConfig): StorageProviderService => {
        if (runtimeConfig.provider === "local") {
          return new LocalStorageProviderService();
        } else {
          return new SupabaseStorageProviderService(runtimeConfig as SupabaseStorageRuntimeConfig);
        }
      }
    },
    StorageService
  ],
  exports: [STORAGE_RUNTIME_CONFIG, STORAGE_PROVIDER_SERVICE, StorageService]
})
export class StorageModule {}
