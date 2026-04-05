import { Inject, Injectable } from "@nestjs/common";
import { QUEUE_PROVIDER_SERVICE, type QueueProviderService } from "./queue-provider.service";

@Injectable()
export class QueueService {
  constructor(@Inject(QUEUE_PROVIDER_SERVICE) private readonly queueProviderService: QueueProviderService) {}

  addDocumentIngestionJob(documentId: string, documentVersion?: number) {
    return this.queueProviderService.addDocumentIngestionJob(documentId, documentVersion);
  }

  ensureDocumentIngestionQueueReady() {
    return this.queueProviderService.ensureDocumentIngestionQueueReady();
  }
}
