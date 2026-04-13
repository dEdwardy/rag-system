import { Inject, Injectable } from "@nestjs/common";

export type QueueProvider = "database" | "pgmq" | "redis";

export type QueueRuntimeConfig = {
  provider: QueueProvider;
  redisUrl: string | null;
  queuePrefix: string | null;
  enableDocumentIngestionWorker: boolean;
  databasePollIntervalMs: number;
  databaseRetryDelayMs: number;
  databaseMaxAttempts: number;
  pgmqVisibilityTimeoutSeconds: number;
  maxConcurrentIngestionTasks: number;
  maxTaskTimeoutMs: number;
};

export const QUEUE_RUNTIME_CONFIG = Symbol("QUEUE_RUNTIME_CONFIG");

export class QueueRuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueRuntimeConfigError";
  }
}

export function resolveQueueRuntimeConfig(env: NodeJS.ProcessEnv = process.env): QueueRuntimeConfig {
  const provider = (env.QUEUE_PROVIDER?.trim() || "pgmq") as QueueProvider;

  if (provider !== "database" && provider !== "pgmq" && provider !== "redis") {
    throw new QueueRuntimeConfigError(
      `Unsupported QUEUE_PROVIDER "${env.QUEUE_PROVIDER}". Expected "database", "pgmq", or "redis".`
    );
  }

  const redisUrl = readOptionalString(env.REDIS_URL);
  if (provider === "redis" && !redisUrl) {
    throw new QueueRuntimeConfigError("REDIS_URL is required when QUEUE_PROVIDER=redis.");
  }

  const databasePollIntervalMs = parsePositiveInteger(env.QUEUE_DATABASE_POLL_INTERVAL_MS, 1000, "QUEUE_DATABASE_POLL_INTERVAL_MS");
  const databaseRetryDelayMs = parsePositiveInteger(env.QUEUE_DATABASE_RETRY_DELAY_MS, 5000, "QUEUE_DATABASE_RETRY_DELAY_MS");
  const databaseMaxAttempts = parsePositiveInteger(env.QUEUE_DATABASE_MAX_ATTEMPTS, 3, "QUEUE_DATABASE_MAX_ATTEMPTS");
  const pgmqVisibilityTimeoutSeconds = parsePositiveInteger(
    env.QUEUE_PGMQ_VISIBILITY_TIMEOUT_SECONDS,
    300,
    "QUEUE_PGMQ_VISIBILITY_TIMEOUT_SECONDS"
  );
  const maxConcurrentIngestionTasks = parsePositiveInteger(env.QUEUE_MAX_CONCURRENT_TASKS, 3, "QUEUE_MAX_CONCURRENT_TASKS");
  const maxTaskTimeoutMs = parsePositiveInteger(env.QUEUE_TASK_TIMEOUT_MS, 300000, "QUEUE_TASK_TIMEOUT_MS");

  return {
    provider,
    redisUrl,
    queuePrefix: readOptionalString(env.QUEUE_PREFIX),
    enableDocumentIngestionWorker: env.DOCUMENT_INGESTION_WORKER_ENABLED !== "false",
    databasePollIntervalMs,
    databaseRetryDelayMs,
    databaseMaxAttempts,
    pgmqVisibilityTimeoutSeconds,
    maxConcurrentIngestionTasks,
    maxTaskTimeoutMs
  };
}

function readOptionalString(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
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
}
