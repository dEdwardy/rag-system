const assert = require("node:assert/strict");
const test = require("node:test");

const { QueueService } = require("../src/infra/queue/queue.service.ts");
const { RedisQueueProviderService } = require("../src/infra/queue/queue-provider.service.ts");
const { IngestionService } = require("../src/modules/ingestion/ingestion.service.ts");

function createFakeRedisClient() {
  const pending = [];
  const delayed = [];

  return {
    pending,
    delayed,
    async rPush(key, value) {
      pending.push({ key, value });
      return pending.length;
    },
    async lPop(key) {
      const index = pending.findIndex(entry => entry.key === key);
      if (index === -1) {
        return null;
      }

      return pending.splice(index, 1)[0].value;
    },
    async zAdd(key, members) {
      for (const member of members) {
        delayed.push({ key, ...member });
      }
      return members.length;
    },
    async zRangeByScore(key, min, max) {
      return delayed
        .filter(entry => entry.key === key && entry.score >= min && entry.score <= max)
        .map(entry => entry.value);
    },
    async zRem(key, members) {
      let removed = 0;
      for (const member of members) {
        const index = delayed.findIndex(entry => entry.key === key && entry.value === member);
        if (index !== -1) {
          delayed.splice(index, 1);
          removed += 1;
        }
      }
      return removed;
    }
  };
}

test("QueueService stores ingestion jobs in redis when QUEUE_PROVIDER=redis", async () => {
  const fakeRedis = createFakeRedisClient();
  const queueProviderService = new RedisQueueProviderService(
    {
      getConfig: () => ({
        provider: "redis",
        redisUrl: "redis://127.0.0.1:6379",
        queuePrefix: "rag-local",
        enableDocumentIngestionWorker: true,
        databasePollIntervalMs: 1000,
        databaseRetryDelayMs: 5000,
        databaseMaxAttempts: 3,
        pgmqVisibilityTimeoutSeconds: 300,
        maxConcurrentIngestionTasks: 3,
        maxTaskTimeoutMs: 300000
      })
    },
    () => fakeRedis
  );
  const queueService = new QueueService(queueProviderService);

  await queueService.addDocumentIngestionJob("document-1", 4);

  assert.equal(fakeRedis.pending.length, 1);
  assert.match(fakeRedis.pending[0].key, /rag-local:.*:pending/);
});

test("IngestionService completes redis jobs through the queue provider", async () => {
  const completedJobs = [];
  const processedJobs = [];

  const fakeService = Object.assign(Object.create(IngestionService.prototype), {
    queueProviderService: {
      completeDocumentIngestionJob: async job => {
        completedJobs.push(job);
      }
    },
    documentIngestionProcessor: {
      async processDocument(job) {
        processedJobs.push(job);
      }
    },
    handleFailedJob: async () => {
      throw new Error("handleFailedJob should not be called on success");
    }
  });

  await IngestionService.prototype.processRedisJob.call(fakeService, {
    id: "job-1",
    documentId: "document-1",
    documentVersion: 2,
    attempts: 0,
    maxAttempts: 3
  });

  assert.deepEqual(processedJobs, [{
    id: "redis-job-1",
    data: {
      documentId: "document-1",
      documentVersion: 2
    }
  }]);
  assert.equal(completedJobs.length, 1);
});

test("IngestionService retries failed redis jobs and forwards final-failure metadata", async () => {
  const retriedJobs = [];
  const failedJobs = [];

  const fakeService = Object.assign(Object.create(IngestionService.prototype), {
    queueProviderService: {
      retryDocumentIngestionJob: async job => {
        retriedJobs.push(job);
      }
    },
    documentIngestionProcessor: {
      async processDocument() {
        throw new Error("synthetic redis processing failure");
      }
    },
    handleFailedJob: async (job, error) => {
      failedJobs.push({ job, error });
    }
  });

  await IngestionService.prototype.processRedisJob.call(fakeService, {
    id: "job-2",
    documentId: "document-2",
    documentVersion: 3,
    attempts: 0,
    maxAttempts: 3
  });

  assert.equal(retriedJobs.length, 1);
  assert.equal(failedJobs.length, 1);
  assert.equal(failedJobs[0].job.id, "redis-job-2");
  assert.equal(failedJobs[0].job.attemptsMade, 1);
  assert.match(failedJobs[0].error.message, /synthetic redis processing failure/);
});
