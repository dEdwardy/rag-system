const assert = require("node:assert/strict");
const { test } = require("node:test");

const { AuditService } = require("../src/modules/audit/audit.service.ts");

test("AuditService lists merged trace/document-run events in reverse chronological order", async () => {
  const answerTraceFindManyCalls = [];
  const documentRunFindManyCalls = [];

  const service = new AuditService({
    answerTrace: {
      findMany: async args => {
        answerTraceFindManyCalls.push(args);
        return [
          {
            id: "trace-failed",
            conversationId: "conversation-1",
            userQuery: "trace failed query",
            status: "failed",
            errorMessage: "trace failure",
            createdAt: new Date("2026-03-29T10:00:00.000Z")
          },
          {
            id: "trace-success",
            conversationId: "conversation-2",
            userQuery: "trace success query",
            status: "success",
            errorMessage: null,
            createdAt: new Date("2026-03-29T08:00:00.000Z")
          }
        ];
      }
    },
    documentRun: {
      findMany: async args => {
        documentRunFindManyCalls.push(args);
        return [
          {
            id: "run-ready",
            documentId: "doc-ready",
            status: "ready",
            trigger: "upload",
            failedStage: null,
            startedAt: new Date("2026-03-29T11:00:00.000Z"),
            document: {
              id: "doc-ready",
              kbId: "kb-1",
              title: "Ready document",
              sourceType: "web_page",
              sourceName: "https://example.com/ready"
            }
          },
          {
            id: "run-failed",
            documentId: "doc-failed",
            status: "failed",
            trigger: "reindex",
            failedStage: "indexing",
            startedAt: new Date("2026-03-29T09:00:00.000Z"),
            document: {
              id: "doc-failed",
              kbId: "kb-1",
              title: "Failed document",
              sourceType: "web_page",
              sourceName: "https://example.com/failed"
            }
          }
        ];
      }
    }
  });

  const result = await service.listAuditEvents(
    {
      source: "all",
      issueOnly: false,
      sinceHours: 12,
      query: "trace",
      limit: 4
    },
    {
      tenantId: "tenant-1",
      userId: "user-1"
    }
  );

  assert.equal(answerTraceFindManyCalls.length, 1);
  assert.equal(documentRunFindManyCalls.length, 1);
  assert.deepEqual(answerTraceFindManyCalls[0].where.conversation, {
    tenantId: "tenant-1",
    userId: "user-1"
  });
  assert.deepEqual(documentRunFindManyCalls[0].where.document.knowledgeBase, {
    tenantId: "tenant-1"
  });

  assert.deepEqual(
    result.map(event => ({ id: event.id, event: event.event })),
    [
      { id: "document_run:run-ready", event: "document_run.ready" },
      { id: "trace:trace-failed", event: "trace.failed" },
      { id: "document_run:run-failed", event: "document_run.failed" },
      { id: "trace:trace-success", event: "trace.completed" }
    ]
  );

  const readyRunEvent = result.find(event => event.id === "document_run:run-ready");
  assert.equal(readyRunEvent.issue, false);
  assert.equal(readyRunEvent.issueReadabilityLabel, null);
  assert.equal(readyRunEvent.summary, "Ready document");

  const failedTraceEvent = result.find(event => event.id === "trace:trace-failed");
  assert.equal(failedTraceEvent.issue, true);
  assert.equal(failedTraceEvent.issueReadabilityLabel, "trace failed");
  assert.equal(failedTraceEvent.summary, "Trace failed: trace failure");

  const failedRunEvent = result.find(event => event.id === "document_run:run-failed");
  assert.equal(failedRunEvent.issue, true);
  assert.equal(failedRunEvent.issueReadabilityLabel, "document run failed");
  assert.equal(failedRunEvent.summary, "Failed document · failed at indexing");
});

test("AuditService issueOnly mode filters to failed trace and failed/skipped runs", async () => {
  const answerTraceFindManyCalls = [];
  const documentRunFindManyCalls = [];

  const service = new AuditService({
    answerTrace: {
      findMany: async args => {
        answerTraceFindManyCalls.push(args);
        return [];
      }
    },
    documentRun: {
      findMany: async args => {
        documentRunFindManyCalls.push(args);
        return [];
      }
    }
  });

  await service.listAuditEvents({
    source: "all",
    issueOnly: true,
    limit: 20
  });

  assert.equal(answerTraceFindManyCalls[0].where.status, "failed");
  assert.deepEqual(documentRunFindManyCalls[0].where.status, {
    in: ["failed", "skipped"]
  });
});
