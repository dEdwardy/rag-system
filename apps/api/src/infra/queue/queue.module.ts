import { Module } from "@nestjs/common";
import { QUEUE_RUNTIME_CONFIG, QueueRuntimeConfigService, resolveQueueRuntimeConfig } from "./queue-runtime-config";
import { QueueService } from "./queue.service";

@Module({
  providers: [
    {
      provide: QUEUE_RUNTIME_CONFIG,
      useFactory: () => resolveQueueRuntimeConfig()
    },
    QueueRuntimeConfigService,
    QueueService
  ],
  exports: [QUEUE_RUNTIME_CONFIG, QueueRuntimeConfigService, QueueService]
})
export class QueueModule {}
