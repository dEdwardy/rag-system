const assert = require("node:assert/strict");
const test = require("node:test");

const { QueueService } = require("../src/infra/queue/queue.service.ts");
const { PgmqQueueProviderService } = require("../src/infra/queue/queue-provider.service.ts");
const { IngestionService } = require("../src/modules/ingestion/ingestion.service.ts");

test("QueueService stores ingestion jobs in pgmq when QUEUE_PROVIDER=pgmq", async () => {
  const queryCalls = [];
  const executeCalls = [];
  const fakePrisma = {
    async $queryRaw(query) {
      queryCalls.push(query);
      return [];
    },
    async $executeRaw(query) {
      executeCalls.push(query);
      return 1;
    }
  };

  const queueProviderService = new PgmqQueueProviderService(
    {
      $queryRaw: fakePrisma.$queryRaw,
      $executeRaw: fakePrisma.$executeRaw
    }
  );
  const queueService = new QueueService(queueProviderService);

  await queueService.addDocumentIngestionJob("document-1", 4);

  assert.equal(queryCalls.length, 1);
  assert.match(String(queryCalls[0].strings.join(" ")), /pgmq\.list_queues/);
  assert.equal(executeCalls.length, 2);
  assert.match(String(executeCalls[0].strings.join(" ")), /pgmq\.create/);
  assert.match(String(executeCalls[1].strings.join(" ")), /pgmq\.send/);
});

test("IngestionService completes pgmq jobs and deletes processed messages", async () => {
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
      databaseRetryDelayMs: 5000,
      databaseMaxAttempts: 3,
      pgmqVisibilityTimeoutSeconds: 300
    },
    handleFailedJob: async () => {
      throw new Error("handleFailedJob should not be called on success");
    }
  });

  await IngestionService.prototype.processPgmqJob.call(fakeService, {
    msg_id: 42n,
    read_ct: 1,
    message: {
      documentId: "document-1",
      documentVersion: 2
    }
  });

  assert.deepEqual(processedJobs, [
    {
      id: "pgmq-42",
      data: {
        documentId: "document-1",
        documentVersion: 2
      }
    }
  ]);
  assert.equal(executeCalls.length, 1);
  assert.match(String(executeCalls[0].strings.join(" ")), /pgmq\.delete/);
});

test("IngestionService retries failed pgmq jobs with set_vt and forwards final failure metadata", async () => {
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
        throw new Error("synthetic pgmq processing failure");
      }
    },
    runtimeConfig: {
      databaseRetryDelayMs: 5000,
      databaseMaxAttempts: 3,
      pgmqVisibilityTimeoutSeconds: 300
    },
    handleFailedJob: async (job, error) => {
      failedJobs.push({ job, error });
    }
  });

  await IngestionService.prototype.processPgmqJob.call(fakeService, {
    msg_id: 44n,
    read_ct: 1,
    message: {
      documentId: "document-2",
      documentVersion: 3
    }
  });

  assert.equal(executeCalls.length, 1);
  assert.match(String(executeCalls[0].strings.join(" ")), /pgmq\.set_vt/);
  assert.equal(failedJobs.length, 1);
  assert.equal(failedJobs[0].job.id, "pgmq-44");
  assert.equal(failedJobs[0].job.attemptsMade, 1);
  assert.match(failedJobs[0].error.message, /synthetic pgmq processing failure/);
});
