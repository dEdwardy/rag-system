const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const test = require("node:test");
const { QueueService } = require("../src/infra/queue/queue.service.ts");
const { getDocumentIngestionQueueName } = require("../src/infra/queue/queue.constants.ts");
const { QueueRuntimeConfigService } = require("../src/infra/queue/queue-runtime-config.ts");

const { Queue } = require("bullmq");

test("QueueService deduplicates duplicate ingestion enqueue for the same document version", async () => {
  const previousQueuePrefix = process.env.QUEUE_PREFIX;
  const queuePrefix = `queue-service-test-${randomUUID()}`;
  process.env.QUEUE_PREFIX = queuePrefix;

  const queueRuntimeConfigService = new QueueRuntimeConfigService({
    redisUrl: process.env.REDIS_URL?.trim() || "redis://localhost:6379",
    enableDocumentIngestionWorker: false
  });

  const queueService = new QueueService(queueRuntimeConfigService);
  const inspectionConnection = queueRuntimeConfigService.createRedisConnection();
  const inspectionQueue = new Queue(getDocumentIngestionQueueName(), {
    connection: inspectionConnection
  });

  try {
    await queueService.addDocumentIngestionJob("document-duplicate-1", 4);
    await queueService.addDocumentIngestionJob("document-duplicate-1", 4);

    const jobs = await inspectionQueue.getJobs(["waiting", "active", "delayed", "prioritized"]);

    assert.equal(jobs.length, 1);
    assert.deepEqual(jobs.map(job => job.data), [
      {
        documentId: "document-duplicate-1",
        documentVersion: 4
      }
    ]);
  } finally {
    await inspectionQueue.obliterate({ force: true });
    await inspectionQueue.close();
    await inspectionConnection.quit();
    await queueService.onModuleDestroy();

    if (previousQueuePrefix === undefined) {
      delete process.env.QUEUE_PREFIX;
    } else {
      process.env.QUEUE_PREFIX = previousQueuePrefix;
    }
  }
});
