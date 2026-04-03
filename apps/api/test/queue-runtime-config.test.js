const assert = require("node:assert/strict");

const {
  QueueRuntimeConfigError,
  resolveQueueRuntimeConfig
} = require("../src/infra/queue/queue-runtime-config.ts");

test("resolveQueueRuntimeConfig defaults to bullmq", () => {
  const config = resolveQueueRuntimeConfig({});

  assert.deepEqual(config, {
    provider: "bullmq",
    redisUrl: "redis://localhost:6379",
    enableDocumentIngestionWorker: true,
    databasePollIntervalMs: 1000,
    databaseRetryDelayMs: 5000,
    databaseMaxAttempts: 3
  });
});

test("resolveQueueRuntimeConfig supports database provider", () => {
  const config = resolveQueueRuntimeConfig({
    QUEUE_PROVIDER: "database",
    DOCUMENT_INGESTION_WORKER_ENABLED: "false",
    QUEUE_DATABASE_POLL_INTERVAL_MS: "250",
    QUEUE_DATABASE_RETRY_DELAY_MS: "3000",
    QUEUE_DATABASE_MAX_ATTEMPTS: "5"
  });

  assert.deepEqual(config, {
    provider: "database",
    redisUrl: null,
    enableDocumentIngestionWorker: false,
    databasePollIntervalMs: 250,
    databaseRetryDelayMs: 3000,
    databaseMaxAttempts: 5
  });
});

test("resolveQueueRuntimeConfig rejects invalid provider", () => {
  assert.throws(() => resolveQueueRuntimeConfig({ QUEUE_PROVIDER: "invalid" }), QueueRuntimeConfigError);
});
