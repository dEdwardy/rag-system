import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { PrismaService } from "../database/prisma.service";
import {
  QUEUE_RUNTIME_CONFIG,
  QueueRuntimeConfigService,
  resolveQueueRuntimeConfig,
  type QueueRuntimeConfig
} from "./queue-runtime-config";
import {
  DatabaseQueueProviderService,
  PgmqQueueProviderService,
  QUEUE_PROVIDER_SERVICE,
  type QueueProviderService
} from "./queue-provider.service";
import { QueueService } from "./queue.service";

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: QUEUE_RUNTIME_CONFIG,
      useFactory: () => resolveQueueRuntimeConfig()
    },
    QueueRuntimeConfigService,
    {
      provide: QUEUE_PROVIDER_SERVICE,
      inject: [QUEUE_RUNTIME_CONFIG, QueueRuntimeConfigService, PrismaService],
      useFactory: (
        runtimeConfig: QueueRuntimeConfig,
        queueRuntimeConfigService: QueueRuntimeConfigService,
        prisma: PrismaService
      ): QueueProviderService => {
        if (runtimeConfig.provider === "database") {
          return new DatabaseQueueProviderService(queueRuntimeConfigService, prisma);
        }

        return new PgmqQueueProviderService(prisma);
      }
    },
    QueueService
  ],
  exports: [QUEUE_RUNTIME_CONFIG, QueueRuntimeConfigService, QUEUE_PROVIDER_SERVICE, QueueService]
})
export class QueueModule {}
