import { Inject, Injectable } from "@nestjs/common";

const IORedis = require("ioredis");

export type QueueProvider = "bullmq" | "database" | "pgmq";

export type QueueRuntimeConfig = {
  provider: QueueProvider;
  redisUrl: string | null;
  enableDocumentIngestionWorker: boolean;
  databasePollIntervalMs: number;
  databaseRetryDelayMs: number;
  databaseMaxAttempts: number;
  pgmqVisibilityTimeoutSeconds: number;
};

export const QUEUE_RUNTIME_CONFIG = Symbol("QUEUE_RUNTIME_CONFIG");

export class QueueRuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueRuntimeConfigError";
  }
}

export function resolveQueueRuntimeConfig(env: NodeJS.ProcessEnv = process.env): QueueRuntimeConfig {
  const provider = (env.QUEUE_PROVIDER?.trim() || "bullmq") as QueueProvider;

  if (provider !== "bullmq" && provider !== "database" && provider !== "pgmq") {
    throw new QueueRuntimeConfigError(
      `Unsupported QUEUE_PROVIDER \"${env.QUEUE_PROVIDER}\". Expected \"bullmq\", \"database\", or \"pgmq\".`
    );
  }

  const databasePollIntervalMs = parsePositiveInteger(env.QUEUE_DATABASE_POLL_INTERVAL_MS, 1000, "QUEUE_DATABASE_POLL_INTERVAL_MS");
  const databaseRetryDelayMs = parsePositiveInteger(env.QUEUE_DATABASE_RETRY_DELAY_MS, 5000, "QUEUE_DATABASE_RETRY_DELAY_MS");
  const databaseMaxAttempts = parsePositiveInteger(env.QUEUE_DATABASE_MAX_ATTEMPTS, 3, "QUEUE_DATABASE_MAX_ATTEMPTS");
  const pgmqVisibilityTimeoutSeconds = parsePositiveInteger(
    env.QUEUE_PGMQ_VISIBILITY_TIMEOUT_SECONDS,
    300,
    "QUEUE_PGMQ_VISIBILITY_TIMEOUT_SECONDS"
  );

  return {
    provider,
    redisUrl: provider === "bullmq" ? env.REDIS_URL?.trim() || "redis://localhost:6379" : null,
    enableDocumentIngestionWorker: env.DOCUMENT_INGESTION_WORKER_ENABLED !== "false",
    databasePollIntervalMs,
    databaseRetryDelayMs,
    databaseMaxAttempts,
    pgmqVisibilityTimeoutSeconds
  };
}

export function createQueueRedisConnection(config: QueueRuntimeConfig) {
  if (config.provider !== "bullmq" || !config.redisUrl) {
    throw new QueueRuntimeConfigError("Redis connection is only available when QUEUE_PROVIDER=bullmq.");
  }

  return new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null
  });
}

function parsePositiveInteger(value: string | undefined, fallback: number, envName: string) {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new QueueRuntimeConfigError(`${envName} must be a positive integer when set.`);
  }

  return parsed;
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
