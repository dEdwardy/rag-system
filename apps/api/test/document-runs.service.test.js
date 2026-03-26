const assert = require("node:assert/strict");
const test = require("node:test");
const { Prisma } = require("@prisma/client");
const { DocumentRunsService } = require("../src/modules/document-runs/document-runs.service.ts");

test("DocumentRunsService reopens retryable failed runs but blocks non-retryable failed runs", async () => {
  const updateManyCalls = [];
  const queuedRuns = [
    {
      status: "failed",
      diagnosticsJson: {
        retryable: true,
        code: "INGESTION_STORAGE_READ_FAILED"
      }
    },
    {
      status: "failed",
      diagnosticsJson: {
        retryable: false,
        code: "INGESTION_PARSING_UNSUPPORTED_TYPE"
      }
    }
  ];

  const service = new DocumentRunsService({
    documentRun: {
      findUnique: async () => queuedRuns.shift() ?? null,
      updateMany: async args => {
        updateManyCalls.push(args);
        return { count: 1 };
      }
    }
  });

  const retryableResult = await service.markRunProcessing("document-retryable-1", 3, Prisma.JsonNull);
  const nonRetryableResult = await service.markRunProcessing("document-nonretryable-1", 4, Prisma.JsonNull);

  assert.deepEqual(retryableResult, { count: 1 });
  assert.deepEqual(nonRetryableResult, { count: 0 });
  assert.deepEqual(updateManyCalls, [
    {
      where: {
        documentId: "document-retryable-1",
        version: 3
      },
      data: {
        status: "processing",
        failedStage: null,
        diagnosticsJson: Prisma.JsonNull,
        finishedAt: null
      }
    }
  ]);
});
