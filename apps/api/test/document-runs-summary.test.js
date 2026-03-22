const test = require("node:test");
const assert = require("node:assert/strict");
const { DocumentRunsService } = require("../dist/modules/document-runs/document-runs.service.js");

test("DocumentRunsService summary exposes latest retryable failure and latest skipped run", async () => {
  const startedAt = new Date("2026-03-22T10:00:00.000Z");

  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async () => [
          {
            documentId: "doc-failed",
            version: 3,
            trigger: "external_resync",
            status: "failed",
            failedStage: "source_fetch",
            diagnosticsJson: {
              retryable: true,
              message: "temporary upstream failure"
            },
            startedAt: new Date("2026-03-22T10:03:00.000Z"),
            finishedAt: new Date("2026-03-22T10:04:00.000Z"),
            document: {
              sourceType: "web_page",
              sourceName: "https://example.com/down"
            }
          },
          {
            documentId: "doc-skipped",
            version: 2,
            trigger: "reindex",
            status: "skipped",
            failedStage: "stale_guard",
            diagnosticsJson: {
              retryable: false,
              message: "superseded by a newer run"
            },
            startedAt: new Date("2026-03-22T10:02:00.000Z"),
            finishedAt: new Date("2026-03-22T10:02:30.000Z"),
            document: {
              sourceType: "upload",
              sourceName: "guide.md"
            }
          },
          {
            documentId: "doc-ready",
            version: 1,
            trigger: "upload",
            status: "ready",
            failedStage: null,
            diagnosticsJson: null,
            startedAt,
            finishedAt: new Date("2026-03-22T10:01:00.000Z"),
            document: {
              sourceType: "upload",
              sourceName: "guide.md"
            }
          }
        ]
      }
    }
  });

  const summary = await DocumentRunsService.prototype.getKnowledgeBaseRunSummary.call(fakeService, "default-kb");

  assert.deepEqual(summary.latestRetryableFailure, {
    documentId: "doc-failed",
    version: 3,
    trigger: "external_resync",
    failedStage: "source_fetch",
    sourceType: "web_page",
    sourceName: "https://example.com/down",
    message: "temporary upstream failure",
    finishedAt: new Date("2026-03-22T10:04:00.000Z")
  });
  assert.deepEqual(summary.latestSkipped, {
    documentId: "doc-skipped",
    version: 2,
    trigger: "reindex",
    failedStage: "stale_guard",
    sourceType: "upload",
    sourceName: "guide.md",
    message: "superseded by a newer run",
    finishedAt: new Date("2026-03-22T10:02:30.000Z")
  });
});
