const assert = require("node:assert/strict");

const { QueueService } = require("../src/infra/queue/queue.service.ts");
const { IngestionService } = require("../src/modules/ingestion/ingestion.service.ts");

test("QueueService stores ingestion jobs in the database queue when QUEUE_PROVIDER=database", async () => {
  const executeCalls = [];
  const fakePrisma = {
    async $executeRaw(query) {
      executeCalls.push(query);
      return 1;
    }
  };

  const queueService = new QueueService(
    {
      getConfig: () => ({
        provider: "database",
        redisUrl: null,
        enableDocumentIngestionWorker: true,
        databasePollIntervalMs: 1000,
        databaseRetryDelayMs: 5000,
        databaseMaxAttempts: 3
      })
    },
    fakePrisma
  );

  await queueService.addDocumentIngestionJob("document-1", 4);

  assert.equal(executeCalls.length, 2);
  assert.match(String(executeCalls[0].strings.join(" ")), /UPDATE "IngestionQueueJob"/);
  assert.match(String(executeCalls[1].strings.join(" ")), /INSERT INTO "IngestionQueueJob"/);
});

test("IngestionService completes database-backed jobs without BullMQ", async () => {
  const executeCalls = [];
  const processedJobs = [];

  const fakeService = Object.assign(Object.create(IngestionService.prototype), {
    prisma: {
      async $executeRaw(query) {
        executeCalls.push(query);
        return 1;
      }
    },
    documentIngestionProcessor: {
      async processDocument(job) {
        processedJobs.push(job);
      }
    },
    runtimeConfig: {
      databaseRetryDelayMs: 5000
    },
    handleFailedJob: async () => {
      throw new Error("handleFailedJob should not be called on success");
    }
  });

  await IngestionService.prototype.processDatabaseJob.call(fakeService, {
    id: "job-1",
    documentId: "document-1",
    documentVersion: 2,
    attempts: 1,
    maxAttempts: 3
  });

  assert.deepEqual(processedJobs, [
    {
      id: "job-1",
      data: {
        documentId: "document-1",
        documentVersion: 2
      }
    }
  ]);
  assert.equal(executeCalls.length, 1);
  assert.match(String(executeCalls[0].strings.join(" ")), /"status" = 'completed'/);
});

test("IngestionService retries failed database-backed jobs and forwards final-failure reconciliation", async () => {
  const executeCalls = [];
  const failedJobs = [];

  const fakeService = Object.assign(Object.create(IngestionService.prototype), {
    prisma: {
      async $executeRaw(query) {
        executeCalls.push(query);
        return 1;
      }
    },
    documentIngestionProcessor: {
      async processDocument() {
        throw new Error("synthetic queue processing failure");
      }
    },
    runtimeConfig: {
      databaseRetryDelayMs: 5000
    },
    handleFailedJob: async (job, error) => {
      failedJobs.push({ job, error });
    }
  });

  await IngestionService.prototype.processDatabaseJob.call(fakeService, {
    id: "job-2",
    documentId: "document-2",
    documentVersion: 3,
    attempts: 1,
    maxAttempts: 3
  });

  assert.equal(executeCalls.length, 1);
  assert.match(String(executeCalls[0].strings.join(" ")), /"status" = /);
  assert.equal(failedJobs.length, 1);
  assert.equal(failedJobs[0].job.id, "job-2");
  assert.equal(failedJobs[0].job.attemptsMade, 1);
  assert.match(failedJobs[0].error.message, /synthetic queue processing failure/);
});
