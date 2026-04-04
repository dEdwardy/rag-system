const assert = require("node:assert/strict");
const test = require("node:test");
const { IngestionService } = require("../src/modules/ingestion/ingestion.service.ts");

test("IngestionService records a terminal ingestion failure when worker retries are exhausted", async () => {
  const documentUpdates = [];
  const failedRuns = [];

  const service = Object.assign(Object.create(IngestionService.prototype), {
    logger: {
      error: () => {}
    },
    prisma: {
      document: {
        findUnique: async () => ({
          version: 4,
          status: "processing",
          processingStage: "indexing"
        }),
        updateMany: async args => {
          documentUpdates.push(args);
          return { count: 1 };
        }
      }
    },
    documentRunsService: {
      markRunFailed: async (documentId, version, input) => {
        failedRuns.push({ documentId, version, ...input });
      }
    }
  });

  await IngestionService.prototype.handleFailedJob.call(
    service,
    {
      id: "ingest-document-job-1",
      data: {
        documentId: "document-terminal-failure-1",
        documentVersion: 4
      },
      attemptsMade: 3,
      opts: {
        attempts: 3
      }
    },
    new Error("Queue worker exhausted all attempts.")
  );

  assert.deepEqual(documentUpdates, [
    {
      where: {
        id: "document-terminal-failure-1",
        version: 4,
        status: {
          in: ["pending", "processing"]
        }
      },
      data: {
        status: "failed",
        processingStage: "failed",
        errorMessage: "Queue worker exhausted all attempts.",
        diagnosticsJson: {
          code: "INGESTION_QUEUE_JOB_FAILED",
          failedStage: "indexing",
          retryable: true,
          documentVersion: 4,
          message: "Queue worker exhausted all attempts."
        }
      }
    }
  ]);
  assert.deepEqual(failedRuns, [
    {
      documentId: "document-terminal-failure-1",
      version: 4,
      failedStage: "indexing",
      diagnosticsJson: {
        code: "INGESTION_QUEUE_JOB_FAILED",
        failedStage: "indexing",
        retryable: true,
        documentVersion: 4,
        message: "Queue worker exhausted all attempts."
      }
    }
  ]);
});

test("IngestionService skips worker failure reconciliation until retries are exhausted", async () => {
  const documentUpdates = [];
  const failedRuns = [];

  const service = Object.assign(Object.create(IngestionService.prototype), {
    logger: {
      error: () => {}
    },
    prisma: {
      document: {
        findUnique: async () => ({
          version: 4,
          status: "processing",
          processingStage: "parsing"
        }),
        updateMany: async args => {
          documentUpdates.push(args);
          return { count: 1 };
        }
      }
    },
    documentRunsService: {
      markRunFailed: async (documentId, version, input) => {
        failedRuns.push({ documentId, version, ...input });
      }
    }
  });

  await IngestionService.prototype.handleFailedJob.call(
    service,
    {
      id: "ingest-document-job-2",
      data: {
        documentId: "document-retry-pending-1",
        documentVersion: 4
      },
      attemptsMade: 1,
      opts: {
        attempts: 3
      }
    },
    new Error("Queue worker still has retries left.")
  );

  assert.deepEqual(documentUpdates, []);
  assert.deepEqual(failedRuns, []);
});

test("IngestionService skips run failure write when guarded document update affects zero rows", async () => {
  const documentUpdates = [];
  const failedRuns = [];

  const service = Object.assign(Object.create(IngestionService.prototype), {
    logger: {
      error: () => {}
    },
    prisma: {
      document: {
        findUnique: async () => ({
          version: 7,
          status: "processing",
          processingStage: "chunking"
        }),
        updateMany: async args => {
          documentUpdates.push(args);
          return { count: 0 };
        }
      }
    },
    documentRunsService: {
      markRunFailed: async (documentId, version, input) => {
        failedRuns.push({ documentId, version, ...input });
      }
    }
  });

  await IngestionService.prototype.handleFailedJob.call(
    service,
    {
      id: "ingest-document-job-3",
      data: {
        documentId: "document-race-guarded-1",
        documentVersion: 7
      },
      attemptsMade: 2,
      opts: {
        attempts: 2
      }
    },
    new Error("Queue worker failed after supersede race.")
  );

  assert.equal(documentUpdates.length, 1);
  assert.deepEqual(failedRuns, []);
});

test("IngestionService logs and swallows worker poll failures", async () => {
  const loggedErrors = [];
  const service = Object.assign(Object.create(IngestionService.prototype), {
    logger: {
      error: (message, stack) => {
        loggedErrors.push({ message, stack });
      }
    }
  });

  await IngestionService.prototype.runWorkerPollSafely.call(service, "pgmq", async () => {
    throw new Error("database temporarily unavailable");
  });

  assert.equal(loggedErrors.length, 1);
  assert.match(loggedErrors[0].message, /Document ingestion pgmq worker poll failed/);
  assert.match(loggedErrors[0].message, /database temporarily unavailable/);
});

test("IngestionService logs and swallows pgmq startup failures", async () => {
  const loggedErrors = [];
  const fakeService = Object.assign(Object.create(IngestionService.prototype), {
    logger: {
      log: () => {},
      error: (message, stack) => {
        loggedErrors.push({ message, stack });
      }
    },
    runtimeConfig: {
      provider: "pgmq",
      enableDocumentIngestionWorker: true,
      databasePollIntervalMs: 1000,
      databaseRetryDelayMs: 5000,
      databaseMaxAttempts: 3,
      pgmqVisibilityTimeoutSeconds: 300
    },
    queueRuntimeConfigService: {
      getConfig: () => ({
        provider: "pgmq",
        enableDocumentIngestionWorker: true,
        databasePollIntervalMs: 1000,
        databaseRetryDelayMs: 5000,
        databaseMaxAttempts: 3,
        pgmqVisibilityTimeoutSeconds: 300
      })
    },
    startPgmqWorker: async () => {
      throw new Error("database unavailable during queue startup");
    }
  });

  IngestionService.prototype.onModuleInit.call(fakeService);
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(loggedErrors.length, 1);
  assert.match(loggedErrors[0].message, /Document ingestion pgmq startup worker poll failed/);
  assert.match(loggedErrors[0].message, /database unavailable during queue startup/);
});
