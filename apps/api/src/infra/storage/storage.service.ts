import { Inject, Injectable } from "@nestjs/common";
import { STORAGE_PROVIDER_SERVICE, type StorageProviderService } from "./storage-provider.service";

@Injectable()
export class StorageService {
  constructor(@Inject(STORAGE_PROVIDER_SERVICE) private readonly storageProviderService: StorageProviderService) {}

  saveUploadedFile(input: { buffer: Buffer; originalName: string; mimeType?: string }) {
    return this.storageProviderService.saveUploadedFile(input);
  }

  saveGeneratedTextFile(input: { content: string }) {
    return this.storageProviderService.saveGeneratedTextFile(input);
  }

  saveFileByStorageKey(input: { storageKey: string; buffer: Buffer; contentType?: string }) {
    return this.storageProviderService.saveFileByStorageKey(input);
  }

  readFileByStorageKey(storageKey: string) {
    return this.storageProviderService.readFileByStorageKey(storageKey);
  }

  getStorageRoot() {
    return this.storageProviderService.getStorageRoot();
  }
}
