import { Inject, Injectable } from "@nestjs/common";

const IORedis = require("ioredis");

export type QueueRuntimeConfig = {
  redisUrl: string;
  enableDocumentIngestionWorker: boolean;
};

export const QUEUE_RUNTIME_CONFIG = Symbol("QUEUE_RUNTIME_CONFIG");

export function resolveQueueRuntimeConfig(env: NodeJS.ProcessEnv = process.env): QueueRuntimeConfig {
  return {
    redisUrl: env.REDIS_URL?.trim() || "redis://localhost:6379",
    enableDocumentIngestionWorker: env.DOCUMENT_INGESTION_WORKER_ENABLED !== "false"
  };
}

export function createQueueRedisConnection(config: QueueRuntimeConfig) {
  return new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null
  });
}

@Injectable()
export class QueueRuntimeConfigService {
  constructor(@Inject(QUEUE_RUNTIME_CONFIG) private readonly config: QueueRuntimeConfig) {}

  getConfig() {
    return this.config;
  }

  createRedisConnection() {
    return createQueueRedisConnection(this.config);
  }
}
