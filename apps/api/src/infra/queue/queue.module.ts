import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { QUEUE_RUNTIME_CONFIG, QueueRuntimeConfigService, resolveQueueRuntimeConfig } from "./queue-runtime-config";
import { QueueService } from "./queue.service";

@Module({
  imports: [DatabaseModule],
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
