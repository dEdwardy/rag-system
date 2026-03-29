const assert = require("node:assert/strict");
const { DocumentRunsService } = require("../src/modules/document-runs/document-runs.service.ts");
const { DocumentsService } = require("../src/modules/documents/documents.service.ts");
const {
  compareKnowledgeBaseDocumentRunsSchema,
  listConversationTracesSchema,
  listDocumentRunsSchema,
  listKnowledgeBaseDocumentRunsSchema,
  listKnowledgeBaseDocumentsSchema
} = require("../src/modules/documents/document.schemas.ts");

test("operational list schemas keep explicit limit support while only bounded endpoints default to 20", () => {
  assert.deepEqual(listKnowledgeBaseDocumentsSchema.parse({}), {});
  assert.deepEqual(listKnowledgeBaseDocumentsSchema.parse({ limit: "100" }), {
    limit: 100
  });
  assert.deepEqual(listDocumentRunsSchema.parse({}), {});
  assert.deepEqual(listDocumentRunsSchema.parse({ limit: "100" }), {
    limit: 100
  });
  assert.equal(listKnowledgeBaseDocumentRunsSchema.parse({}).limit, 20);
  assert.deepEqual(listConversationTracesSchema.parse({}), {
    limit: 20
  });
  assert.throws(() => listKnowledgeBaseDocumentsSchema.parse({ limit: "101" }));
  assert.throws(() => listDocumentRunsSchema.parse({ limit: "0" }));
  assert.throws(() => listConversationTracesSchema.parse({ limit: "101" }));
});

test("document-run comparison schema supports run-pair or snapshot-pair modes", () => {
  assert.deepEqual(compareKnowledgeBaseDocumentRunsSchema.parse({ leftRunId: "run-a", rightRunId: "run-b" }), {
    issueOnly: false,
    leftRunId: "run-a",
    rightRunId: "run-b"
  });
  assert.deepEqual(
    compareKnowledgeBaseDocumentRunsSchema.parse({ leftSinceHours: "1", rightSinceHours: "24", issueOnly: "true" }),
    {
      issueOnly: true,
      leftSinceHours: 1,
      rightSinceHours: 24
    }
  );
  assert.throws(() => compareKnowledgeBaseDocumentRunsSchema.parse({ leftRunId: "run-a" }));
  assert.throws(() =>
    compareKnowledgeBaseDocumentRunsSchema.parse({ leftRunId: "run-a", rightRunId: "run-b", leftSinceHours: 1, rightSinceHours: 24 })
  );
});

test("DocumentsService listKnowledgeBaseDocuments applies bounded limit semantics", async () => {
  const queryArgs = [];
  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    knowledgeBasesService: {
      getKnowledgeBase: async () => ({ id: "default-kb" })
    },
    prisma: {
      document: {
        findMany: async args => {
          queryArgs.push(args);
          return [];
        }
      }
    }
  });

  const documents = await DocumentsService.prototype.listKnowledgeBaseDocuments.call(fakeService, "default-kb", {
    limit: 20
  });

  assert.deepEqual(documents, []);
  assert.deepEqual(queryArgs, [
    {
      where: {
        kbId: "default-kb"
      },
      take: 20,
      orderBy: {
        updatedAt: "desc"
      }
    }
  ]);
});

test("DocumentRunsService run comparison highlights meaningful run-level differences", async () => {
  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findFirst: async args => {
          if (args.where.id === "run-left") {
            return {
              id: "run-left",
              documentId: "doc-1",
              version: 2,
              trigger: "external_resync",
              status: "failed",
              failedStage: "source_fetch",
              diagnosticsJson: {
                code: "EXTERNAL_SOURCE_FETCH_FAILED",
                failedStage: "source_fetch",
                retryable: true,
                message: "temporary upstream failure"
              },
              startedAt: new Date("2026-03-22T10:01:00.000Z"),
              finishedAt: new Date("2026-03-22T10:02:00.000Z"),
              document: {
                sourceType: "web_page",
                sourceName: "https://example.com/down"
              }
            };
          }

          return {
            id: "run-right",
            documentId: "doc-1",
            version: 3,
            trigger: "external_resync",
            status: "ready",
            failedStage: null,
            diagnosticsJson: null,
            startedAt: new Date("2026-03-22T10:03:00.000Z"),
            finishedAt: new Date("2026-03-22T10:04:00.000Z"),
            document: {
              sourceType: "web_page",
              sourceName: "https://example.com/down"
            }
          };
        }
      }
    }
  });

  const result = await DocumentRunsService.prototype.getKnowledgeBaseRunComparison.call(fakeService, "default-kb", {
    leftRunId: "run-left",
    rightRunId: "run-right",
    issueOnly: false
  });

  assert.equal(result.mode, "run");
  assert.ok(result.meaningfulDifferences.some(diff => diff.metric === "status"));
  assert.ok(result.meaningfulDifferences.some(diff => diff.metric === "failureCode"));
  assert.ok(result.meaningfulDifferences.some(diff => diff.metric === "retryable"));
});

test("DocumentRunsService snapshot comparison highlights summary metric deltas", async () => {
  let callCount = 0;
  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async () => {
          callCount += 1;
          if (callCount === 1) {
            return [
              {
                documentId: "doc-1",
                version: 2,
                trigger: "external_resync",
                status: "failed",
                failedStage: "source_fetch",
                diagnosticsJson: {
                  code: "EXTERNAL_SOURCE_FETCH_FAILED",
                  failedStage: "source_fetch",
                  retryable: true,
                  message: "temporary upstream failure"
                },
                startedAt: new Date("2026-03-22T10:01:00.000Z"),
                finishedAt: new Date("2026-03-22T10:02:00.000Z"),
                document: {
                  sourceType: "web_page",
                  sourceName: "https://example.com/down"
                }
              }
            ];
          }

          return [
            {
              documentId: "doc-1",
              version: 3,
              trigger: "external_resync",
              status: "ready",
              failedStage: null,
              diagnosticsJson: {
                code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
                failedStage: "source_fetch",
                retryable: false,
                boundaryHit: true,
                boundaryReasons: ["MAX_ITEMS_LIMIT_REACHED"],
                boundary: {
                  droppedByLimitCount: 2
                },
                message: "partial"
              },
              startedAt: new Date("2026-03-22T10:03:00.000Z"),
              finishedAt: new Date("2026-03-22T10:04:00.000Z"),
              document: {
                sourceType: "feed",
                sourceName: "https://example.com/feed.xml"
              }
            }
          ];
        }
      }
    }
  });

  const result = await DocumentRunsService.prototype.getKnowledgeBaseRunComparison.call(fakeService, "default-kb", {
    leftSinceHours: 1,
    rightSinceHours: 24,
    issueOnly: false
  });

  assert.equal(result.mode, "snapshot");
  assert.ok(result.meaningfulDifferences.some(diff => diff.metric === "failedRuns"));
  assert.ok(result.meaningfulDifferences.some(diff => diff.metric === "retryableFailures"));
  assert.ok(result.meaningfulDifferences.some(diff => diff.metric === "runsWithBoundaryHit"));
});

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
    finishedAt: new Date("2026-03-22T10:04:00.000Z"),
    failureSummary: {
      code: null,
      failedStage: "source_fetch",
      retryable: true,
      message: "temporary upstream failure"
    }
  });
  assert.deepEqual(summary.latestSkipped, {
    documentId: "doc-skipped",
    version: 2,
    trigger: "reindex",
    failedStage: "stale_guard",
    sourceType: "upload",
    sourceName: "guide.md",
    message: "superseded by a newer run",
    finishedAt: new Date("2026-03-22T10:02:30.000Z"),
    failureSummary: {
      code: null,
      failedStage: "stale_guard",
      retryable: false,
      message: "superseded by a newer run"
    }
  });
});

test("DocumentRunsService list and summary expose a consistent minimal failure summary", async () => {
  const runs = [
    {
      id: "run-partial",
      documentId: "doc-partial",
      version: 3,
      trigger: "external_resync",
      status: "ready",
      failedStage: null,
      startedAt: new Date("2026-03-22T10:05:00.000Z"),
      finishedAt: new Date("2026-03-22T10:06:00.000Z"),
      createdAt: new Date("2026-03-22T10:05:00.000Z"),
      updatedAt: new Date("2026-03-22T10:06:00.000Z"),
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
        failedStage: "source_fetch",
        retryable: false,
        boundaryHit: true,
        boundaryReasons: ["MAX_ITEMS_LIMIT_REACHED"],
        boundary: {
          maxItems: 5,
          totalExtractedEntryCount: 7,
          selectedEntryCount: 5,
          droppedByLimitCount: 2
        },
        message: "Feed source completed with partial entry validation failures.",
        partial: true
      },
      document: {
        id: "doc-partial",
        kbId: "default-kb",
        sourceType: "feed",
        sourceName: "https://example.com/feed.xml",
        title: "Example Feed",
        status: "ready",
        processingStage: "completed",
        version: 3
      }
    },
    {
      id: "run-failed",
      documentId: "doc-failed",
      version: 2,
      trigger: "external_resync",
      status: "failed",
      failedStage: "source_fetch",
      startedAt: new Date("2026-03-22T10:03:00.000Z"),
      finishedAt: new Date("2026-03-22T10:04:00.000Z"),
      createdAt: new Date("2026-03-22T10:03:00.000Z"),
      updatedAt: new Date("2026-03-22T10:04:00.000Z"),
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: true,
        message: "temporary upstream failure"
      },
      document: {
        id: "doc-failed",
        kbId: "default-kb",
        sourceType: "web_page",
        sourceName: "https://example.com/down",
        title: "Down Page",
        status: "failed",
        processingStage: "failed",
        version: 2
      }
    },
    {
      id: "run-skipped",
      documentId: "doc-skipped",
      version: 1,
      trigger: "reindex",
      status: "skipped",
      failedStage: "stale_guard",
      startedAt: new Date("2026-03-22T10:01:00.000Z"),
      finishedAt: new Date("2026-03-22T10:01:30.000Z"),
      createdAt: new Date("2026-03-22T10:01:00.000Z"),
      updatedAt: new Date("2026-03-22T10:01:30.000Z"),
      diagnosticsJson: {
        code: "INGESTION_RUN_SUPERSEDED",
        failedStage: "stale_guard",
        retryable: false,
        message: "superseded by a newer run"
      },
      document: {
        id: "doc-skipped",
        kbId: "default-kb",
        sourceType: "upload",
        sourceName: "guide.md",
        title: "guide.md",
        status: "ready",
        processingStage: "completed",
        version: 2
      }
    }
  ];

  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async () => runs
      }
    }
  });

  const list = await DocumentRunsService.prototype.listKnowledgeBaseRuns.call(fakeService, "default-kb", {
    includeDiagnostics: false,
    limit: 20
  });
  const summary = await DocumentRunsService.prototype.getKnowledgeBaseRunSummary.call(fakeService, "default-kb");

  assert.deepEqual(
    list.map(run => ({
      status: run.status,
      failedStage: run.failedStage,
      failureSummary: run.failureSummary ?? null
    })),
    [
      {
        status: "ready",
        failedStage: "source_fetch",
        failureSummary: {
          code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
          failedStage: "source_fetch",
          retryable: false,
          message: "Feed source completed with partial entry validation failures."
        }
      },
      {
        status: "failed",
        failedStage: "source_fetch",
        failureSummary: {
          code: "EXTERNAL_SOURCE_FETCH_FAILED",
          failedStage: "source_fetch",
          retryable: true,
          message: "temporary upstream failure"
        }
      },
      {
        status: "skipped",
        failedStage: "stale_guard",
        failureSummary: {
          code: "INGESTION_RUN_SUPERSEDED",
          failedStage: "stale_guard",
          retryable: false,
          message: "superseded by a newer run"
        }
      }
    ]
  );
  assert.deepEqual(summary.latestRetryableFailure, {
    documentId: "doc-failed",
    version: 2,
    trigger: "external_resync",
    failedStage: "source_fetch",
    sourceType: "web_page",
    sourceName: "https://example.com/down",
    message: "temporary upstream failure",
    finishedAt: new Date("2026-03-22T10:04:00.000Z"),
    failureSummary: {
      code: "EXTERNAL_SOURCE_FETCH_FAILED",
      failedStage: "source_fetch",
      retryable: true,
      message: "temporary upstream failure"
    }
  });
  assert.deepEqual(summary.latestSkipped, {
    documentId: "doc-skipped",
    version: 1,
    trigger: "reindex",
    failedStage: "stale_guard",
    sourceType: "upload",
    sourceName: "guide.md",
    message: "superseded by a newer run",
    finishedAt: new Date("2026-03-22T10:01:30.000Z"),
    failureSummary: {
      code: "INGESTION_RUN_SUPERSEDED",
      failedStage: "stale_guard",
      retryable: false,
      message: "superseded by a newer run"
    }
  });
  assert.deepEqual(summary.latestFailure, {
    documentId: "doc-partial",
    version: 3,
    trigger: "external_resync",
    failedStage: "source_fetch",
    sourceType: "feed",
    sourceName: "https://example.com/feed.xml",
    message: "Feed source completed with partial entry validation failures.",
    finishedAt: new Date("2026-03-22T10:06:00.000Z"),
    failureSummary: {
      code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
      failedStage: "source_fetch",
      retryable: false,
      message: "Feed source completed with partial entry validation failures."
    }
  });
  assert.deepEqual(summary.latestPartialSourceFailure, {
    documentId: "doc-partial",
    version: 3,
    trigger: "external_resync",
    failedStage: "source_fetch",
    sourceType: "feed",
    sourceName: "https://example.com/feed.xml",
    message: "Feed source completed with partial entry validation failures.",
    finishedAt: new Date("2026-03-22T10:06:00.000Z"),
    failureSummary: {
      code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
      failedStage: "source_fetch",
      retryable: false,
      message: "Feed source completed with partial entry validation failures."
    }
  });
  assert.deepEqual(summary.latestBoundaryHit, {
    documentId: "doc-partial",
    version: 3,
    trigger: "external_resync",
    failedStage: "source_fetch",
    sourceType: "feed",
    sourceName: "https://example.com/feed.xml",
    message: "Feed source completed with partial entry validation failures.",
    finishedAt: new Date("2026-03-22T10:06:00.000Z"),
    failureSummary: {
      code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
      failedStage: "source_fetch",
      retryable: false,
      message: "Feed source completed with partial entry validation failures."
    },
    boundarySummary: {
      reasons: ["MAX_ITEMS_LIMIT_REACHED"],
      droppedPageUrlCount: 0,
      droppedChildSitemapCount: 0,
      droppedFeedEntryCount: 2
    }
  });
  assert.deepEqual(summary.boundaryStats, {
    runsWithBoundaryHit: 1,
    byReason: {
      MAX_ITEMS_LIMIT_REACHED: 1
    },
    droppedPageUrlCount: 0,
    droppedChildSitemapCount: 0,
    droppedFeedEntryCount: 2
  });
  assert.deepEqual(summary.bySourceFamily, {
    feed: {
      totalRuns: 1,
      failedRuns: 0,
      retryableFailures: 0,
      nonRetryableFailures: 1,
      runsWithBoundaryHit: 1
    },
    web: {
      totalRuns: 1,
      failedRuns: 1,
      retryableFailures: 1,
      nonRetryableFailures: 0,
      runsWithBoundaryHit: 0
    },
    upload: {
      totalRuns: 1,
      failedRuns: 0,
      retryableFailures: 0,
      nonRetryableFailures: 0,
      runsWithBoundaryHit: 0
    }
  });
});

test("DocumentRunsService summary counts partial ready runs as failure summaries", async () => {
  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async () => [
          {
            documentId: "doc-partial",
            version: 5,
            trigger: "external_resync",
            status: "ready",
            failedStage: null,
            diagnosticsJson: {
              code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
              failedStage: "source_fetch",
              retryable: false,
              message: "Feed source completed with partial entry validation failures.",
              partial: true
            },
            startedAt: new Date("2026-03-22T10:05:00.000Z"),
            finishedAt: new Date("2026-03-22T10:06:00.000Z"),
            document: {
              sourceType: "feed",
              sourceName: "https://example.com/feed.xml"
            }
          },
          {
            documentId: "doc-skipped",
            version: 4,
            trigger: "reindex",
            status: "skipped",
            failedStage: "stale_guard",
            diagnosticsJson: {
              code: "INGESTION_RUN_SUPERSEDED",
              failedStage: "stale_guard",
              retryable: false,
              message: "superseded by a newer run"
            },
            startedAt: new Date("2026-03-22T10:03:00.000Z"),
            finishedAt: new Date("2026-03-22T10:04:00.000Z"),
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

  assert.equal(summary.retryableFailures, 0);
  assert.equal(summary.nonRetryableFailures, 1);
  assert.deepEqual(summary.failureByStage, {
    source_fetch: 1
  });
  assert.deepEqual(summary.latestRetryableFailure, null);
  assert.deepEqual(summary.latestSkipped, {
    documentId: "doc-skipped",
    version: 4,
    trigger: "reindex",
    failedStage: "stale_guard",
    sourceType: "upload",
    sourceName: "guide.md",
    message: "superseded by a newer run",
    finishedAt: new Date("2026-03-22T10:04:00.000Z"),
    failureSummary: {
      code: "INGESTION_RUN_SUPERSEDED",
      failedStage: "stale_guard",
      retryable: false,
      message: "superseded by a newer run"
    }
  });
  assert.deepEqual(summary.latestFailure, {
    documentId: "doc-partial",
    version: 5,
    trigger: "external_resync",
    failedStage: "source_fetch",
    sourceType: "feed",
    sourceName: "https://example.com/feed.xml",
    message: "Feed source completed with partial entry validation failures.",
    finishedAt: new Date("2026-03-22T10:06:00.000Z"),
    failureSummary: {
      code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
      failedStage: "source_fetch",
      retryable: false,
      message: "Feed source completed with partial entry validation failures."
    }
  });
  assert.deepEqual(summary.boundaryStats, {
    runsWithBoundaryHit: 0,
    byReason: {},
    droppedPageUrlCount: 0,
    droppedChildSitemapCount: 0,
    droppedFeedEntryCount: 0
  });
});

test("DocumentRunsService ignores processing runs with preserved partial diagnostics in failure counters", async () => {
  const runs = [
    {
      id: "run-processing-partial",
      documentId: "doc-partial",
      version: 6,
      trigger: "external_resync",
      status: "processing",
      failedStage: null,
      startedAt: new Date("2026-03-22T10:07:00.000Z"),
      finishedAt: null,
      createdAt: new Date("2026-03-22T10:07:00.000Z"),
      updatedAt: new Date("2026-03-22T10:07:00.000Z"),
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
        failedStage: "source_fetch",
        retryable: false,
        message: "Feed source completed with partial entry validation failures.",
        partial: true
      },
      document: {
        id: "doc-partial",
        kbId: "default-kb",
        sourceType: "feed",
        sourceName: "https://example.com/feed.xml",
        title: "Example Feed",
        status: "processing",
        processingStage: "parsing",
        version: 6
      }
    },
    {
      id: "run-ready-partial",
      documentId: "doc-partial",
      version: 5,
      trigger: "external_resync",
      status: "ready",
      failedStage: null,
      startedAt: new Date("2026-03-22T10:05:00.000Z"),
      finishedAt: new Date("2026-03-22T10:06:00.000Z"),
      createdAt: new Date("2026-03-22T10:05:00.000Z"),
      updatedAt: new Date("2026-03-22T10:06:00.000Z"),
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
        failedStage: "source_fetch",
        retryable: false,
        message: "Feed source completed with partial entry validation failures.",
        partial: true
      },
      document: {
        id: "doc-partial",
        kbId: "default-kb",
        sourceType: "feed",
        sourceName: "https://example.com/feed.xml",
        title: "Example Feed",
        status: "ready",
        processingStage: "completed",
        version: 5
      }
    }
  ];

  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async () => runs
      }
    }
  });

  const list = await DocumentRunsService.prototype.listKnowledgeBaseRuns.call(fakeService, "default-kb", {
    includeDiagnostics: false,
    limit: 20
  });
  const summary = await DocumentRunsService.prototype.getKnowledgeBaseRunSummary.call(fakeService, "default-kb");

  assert.deepEqual(
    list.map(run => ({
      status: run.status,
      failedStage: run.failedStage,
      failureSummary: run.failureSummary
    })),
    [
      {
        status: "processing",
        failedStage: null,
        failureSummary: {
          code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
          failedStage: "source_fetch",
          retryable: false,
          message: "Feed source completed with partial entry validation failures."
        }
      },
      {
        status: "ready",
        failedStage: "source_fetch",
        failureSummary: {
          code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
          failedStage: "source_fetch",
          retryable: false,
          message: "Feed source completed with partial entry validation failures."
        }
      }
    ]
  );
  assert.equal(summary.nonRetryableFailures, 1);
  assert.deepEqual(summary.failureByStage, {
    source_fetch: 1
  });
  assert.deepEqual(summary.latestFailure, {
    documentId: "doc-partial",
    version: 5,
    trigger: "external_resync",
    failedStage: "source_fetch",
    sourceType: "feed",
    sourceName: "https://example.com/feed.xml",
    message: "Feed source completed with partial entry validation failures.",
    finishedAt: new Date("2026-03-22T10:06:00.000Z"),
    failureSummary: {
      code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
      failedStage: "source_fetch",
      retryable: false,
      message: "Feed source completed with partial entry validation failures."
    }
  });
});

test("DocumentRunsService issueOnly run list includes completed issue runs and excludes skipped or in-flight diagnostics", async () => {
  const queryArgs = [];
  const runs = [
    {
      id: "run-processing-partial",
      documentId: "doc-processing-partial",
      version: 6,
      trigger: "external_resync",
      status: "processing",
      failedStage: null,
      startedAt: new Date("2026-03-22T10:07:00.000Z"),
      finishedAt: null,
      createdAt: new Date("2026-03-22T10:07:00.000Z"),
      updatedAt: new Date("2026-03-22T10:07:00.000Z"),
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
        failedStage: "source_fetch",
        retryable: false,
        message: "Feed source completed with partial entry validation failures.",
        partial: true
      },
      document: {
        id: "doc-processing-partial",
        kbId: "default-kb",
        sourceType: "feed",
        sourceName: "https://example.com/feed.xml",
        title: "Example Feed",
        status: "processing",
        processingStage: "parsing",
        version: 6
      }
    },
    {
      id: "run-ready-partial",
      documentId: "doc-ready-partial",
      version: 5,
      trigger: "external_resync",
      status: "ready",
      failedStage: null,
      startedAt: new Date("2026-03-22T10:05:00.000Z"),
      finishedAt: new Date("2026-03-22T10:06:00.000Z"),
      createdAt: new Date("2026-03-22T10:05:00.000Z"),
      updatedAt: new Date("2026-03-22T10:06:00.000Z"),
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
        failedStage: "source_fetch",
        retryable: false,
        message: "Feed source completed with partial entry validation failures.",
        partial: true
      },
      document: {
        id: "doc-ready-partial",
        kbId: "default-kb",
        sourceType: "feed",
        sourceName: "https://example.com/feed.xml",
        title: "Example Feed",
        status: "ready",
        processingStage: "completed",
        version: 5
      }
    },
    {
      id: "run-failed",
      documentId: "doc-failed",
      version: 4,
      trigger: "external_resync",
      status: "failed",
      failedStage: "source_fetch",
      startedAt: new Date("2026-03-22T10:03:00.000Z"),
      finishedAt: new Date("2026-03-22T10:04:00.000Z"),
      createdAt: new Date("2026-03-22T10:03:00.000Z"),
      updatedAt: new Date("2026-03-22T10:04:00.000Z"),
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: true,
        message: "temporary upstream failure"
      },
      document: {
        id: "doc-failed",
        kbId: "default-kb",
        sourceType: "web_page",
        sourceName: "https://example.com/down",
        title: "Down Page",
        status: "failed",
        processingStage: "failed",
        version: 4
      }
    },
    {
      id: "run-skipped",
      documentId: "doc-skipped",
      version: 3,
      trigger: "reindex",
      status: "skipped",
      failedStage: "stale_guard",
      startedAt: new Date("2026-03-22T10:01:00.000Z"),
      finishedAt: new Date("2026-03-22T10:01:30.000Z"),
      createdAt: new Date("2026-03-22T10:01:00.000Z"),
      updatedAt: new Date("2026-03-22T10:01:30.000Z"),
      diagnosticsJson: {
        code: "INGESTION_RUN_SUPERSEDED",
        failedStage: "stale_guard",
        retryable: false,
        message: "superseded by a newer run"
      },
      document: {
        id: "doc-skipped",
        kbId: "default-kb",
        sourceType: "upload",
        sourceName: "guide.md",
        title: "guide.md",
        status: "ready",
        processingStage: "completed",
        version: 4
      }
    }
  ];

  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async args => {
          queryArgs.push(args);
          return runs;
        }
      }
    }
  });

  const list = await DocumentRunsService.prototype.listKnowledgeBaseRuns.call(fakeService, "default-kb", {
    includeDiagnostics: false,
    issueOnly: true,
    limit: 20
  });

  assert.deepEqual(queryArgs, [
    {
      where: {
        documentId: undefined,
        startedAt: undefined,
        status: undefined,
        trigger: undefined,
        document: {
          kbId: "default-kb",
          sourceType: undefined
        }
      },
      select: {
        id: true,
        documentId: true,
        version: true,
        trigger: true,
        status: true,
        failedStage: true,
        diagnosticsJson: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        updatedAt: true,
        document: {
          select: {
            id: true,
            kbId: true,
            sourceType: true,
            sourceName: true,
            title: true,
            status: true,
            processingStage: true,
            version: true
          }
        }
      },
      skip: 0,
      take: 100,
      orderBy: [{ startedAt: "desc" }, { version: "desc" }]
    }
  ]);
  assert.deepEqual(
    list.map(run => ({
      id: run.id,
      status: run.status,
      failedStage: run.failedStage,
      failureSummary: run.failureSummary
    })),
    [
      {
        id: "run-ready-partial",
        status: "ready",
        failedStage: "source_fetch",
        failureSummary: {
          code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
          failedStage: "source_fetch",
          retryable: false,
          message: "Feed source completed with partial entry validation failures."
        }
      },
      {
        id: "run-failed",
        status: "failed",
        failedStage: "source_fetch",
        failureSummary: {
          code: "EXTERNAL_SOURCE_FETCH_FAILED",
          failedStage: "source_fetch",
          retryable: true,
          message: "temporary upstream failure"
        }
      }
    ]
  );
});

test("DocumentRunsService issueOnly run list can include older issue runs beyond the first 100 rows", async () => {
  const queryArgs = [];
  const baseStartedAt = new Date("2026-03-22T10:10:00.000Z");
  const nonIssueRuns = Array.from({ length: 120 }, (_, index) => {
    const startedAt = new Date(baseStartedAt.getTime() - index * 1000);
    return {
      id: `run-non-issue-${index}`,
      documentId: `doc-non-issue-${index}`,
      version: 1,
      trigger: "external_resync",
      status: "ready",
      failedStage: null,
      startedAt,
      finishedAt: new Date(startedAt.getTime() + 500),
      createdAt: startedAt,
      updatedAt: new Date(startedAt.getTime() + 500),
      diagnosticsJson: null,
      document: {
        id: `doc-non-issue-${index}`,
        kbId: "default-kb",
        sourceType: "feed",
        sourceName: `https://example.com/non-issue-${index}.xml`,
        title: `Non issue ${index}`,
        status: "ready",
        processingStage: "completed",
        version: 1
      }
    };
  });
  const olderIssueRun = {
    id: "run-older-issue",
    documentId: "doc-older-issue",
    version: 1,
    trigger: "external_resync",
    status: "failed",
    failedStage: "source_fetch",
    startedAt: new Date(baseStartedAt.getTime() - 121000),
    finishedAt: new Date(baseStartedAt.getTime() - 120500),
    createdAt: new Date(baseStartedAt.getTime() - 121000),
    updatedAt: new Date(baseStartedAt.getTime() - 120500),
    diagnosticsJson: {
      code: "EXTERNAL_SOURCE_FETCH_FAILED",
      failedStage: "source_fetch",
      retryable: true,
      message: "temporary upstream failure"
    },
    document: {
      id: "doc-older-issue",
      kbId: "default-kb",
      sourceType: "feed",
      sourceName: "https://example.com/older-issue.xml",
      title: "Older issue",
      status: "failed",
      processingStage: "failed",
      version: 1
    }
  };
  const runs = [...nonIssueRuns, olderIssueRun];

  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async args => {
          queryArgs.push(args);
          const start = args.skip ?? 0;
          const end = start + (args.take ?? runs.length);
          return runs.slice(start, end);
        }
      }
    }
  });

  const list = await DocumentRunsService.prototype.listKnowledgeBaseRuns.call(fakeService, "default-kb", {
    includeDiagnostics: false,
    issueOnly: true,
    limit: 1
  });

  assert.equal(list.length, 1);
  assert.equal(list[0].id, "run-older-issue");
  assert.equal(queryArgs.length, 2);
  assert.equal(queryArgs[0].skip, 0);
  assert.equal(queryArgs[0].take, 100);
  assert.equal(queryArgs[1].skip, 100);
  assert.equal(queryArgs[1].take, 100);
});

test("DocumentRunsService summary applies narrow run filters before aggregating anchors and counters", async () => {
  const queryArgs = [];
  const runs = [
    {
      documentId: "doc-feed-failed",
      version: 5,
      trigger: "external_resync",
      status: "failed",
      failedStage: "source_fetch",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: true,
        message: "feed source is temporarily unavailable"
      },
      startedAt: new Date("2026-03-22T10:05:00.000Z"),
      finishedAt: new Date("2026-03-22T10:06:00.000Z"),
      document: {
        sourceType: "feed",
        sourceName: "https://example.com/feed.xml"
      }
    },
    {
      documentId: "doc-web-failed",
      version: 4,
      trigger: "external_resync",
      status: "failed",
      failedStage: "source_fetch",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: true,
        message: "web page is temporarily unavailable"
      },
      startedAt: new Date("2026-03-22T10:03:00.000Z"),
      finishedAt: new Date("2026-03-22T10:04:00.000Z"),
      document: {
        sourceType: "web_page",
        sourceName: "https://example.com/down"
      }
    },
    {
      documentId: "doc-feed-ready",
      version: 3,
      trigger: "external_resync",
      status: "ready",
      failedStage: null,
      diagnosticsJson: null,
      startedAt: new Date("2026-03-22T10:01:00.000Z"),
      finishedAt: new Date("2026-03-22T10:02:00.000Z"),
      document: {
        sourceType: "feed",
        sourceName: "https://example.com/feed.xml"
      }
    }
  ];

  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async args => {
          queryArgs.push(args);
          return runs.filter(
            run =>
              (!args.where.status || run.status === args.where.status) &&
              (!args.where.document.sourceType || run.document.sourceType === args.where.document.sourceType)
          );
        }
      }
    }
  });

  const summary = await DocumentRunsService.prototype.getKnowledgeBaseRunSummary.call(fakeService, "default-kb", {
    status: "failed",
    sourceType: "feed"
  });

  assert.deepEqual(queryArgs, [
    {
      where: {
        documentId: undefined,
        startedAt: undefined,
        status: "failed",
        trigger: undefined,
        document: {
          kbId: "default-kb",
          sourceType: "feed"
        }
      },
      orderBy: [{ startedAt: "desc" }, { version: "desc" }],
      select: {
        documentId: true,
        version: true,
        trigger: true,
        status: true,
        failedStage: true,
        diagnosticsJson: true,
        startedAt: true,
        finishedAt: true,
        document: {
          select: {
            sourceType: true,
            sourceName: true
          }
        }
      }
    }
  ]);
  assert.equal(summary.totalRuns, 1);
  assert.deepEqual(summary.byStatus, {
    pending: 0,
    processing: 0,
    ready: 0,
    failed: 1,
    skipped: 0
  });
  assert.deepEqual(summary.bySourceType, {
    feed: 1
  });
  assert.deepEqual(summary.bySourceFamily, {
    feed: {
      totalRuns: 1,
      failedRuns: 1,
      retryableFailures: 1,
      nonRetryableFailures: 0,
      runsWithBoundaryHit: 0
    }
  });
  assert.deepEqual(summary.latestFailure, {
    documentId: "doc-feed-failed",
    version: 5,
    trigger: "external_resync",
    failedStage: "source_fetch",
    sourceType: "feed",
    sourceName: "https://example.com/feed.xml",
    message: "feed source is temporarily unavailable",
    finishedAt: new Date("2026-03-22T10:06:00.000Z"),
    failureSummary: {
      code: "EXTERNAL_SOURCE_FETCH_FAILED",
      failedStage: "source_fetch",
      retryable: true,
      message: "feed source is temporarily unavailable"
    }
  });
});

test("DocumentRunsService issueOnly summary still exposes latest skipped run", async () => {
  const runs = [
    {
      documentId: "doc-ready-partial",
      version: 5,
      trigger: "external_resync",
      status: "ready",
      failedStage: null,
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
        failedStage: "source_fetch",
        retryable: false,
        message: "Feed source completed with partial entry validation failures.",
        partial: true
      },
      startedAt: new Date("2026-03-22T10:05:00.000Z"),
      finishedAt: new Date("2026-03-22T10:06:00.000Z"),
      document: {
        sourceType: "feed",
        sourceName: "https://example.com/feed.xml"
      }
    },
    {
      documentId: "doc-failed",
      version: 4,
      trigger: "external_resync",
      status: "failed",
      failedStage: "source_fetch",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
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
      version: 3,
      trigger: "reindex",
      status: "skipped",
      failedStage: "stale_guard",
      diagnosticsJson: {
        code: "INGESTION_RUN_SUPERSEDED",
        failedStage: "stale_guard",
        retryable: false,
        message: "superseded by a newer run"
      },
      startedAt: new Date("2026-03-22T10:01:00.000Z"),
      finishedAt: new Date("2026-03-22T10:01:30.000Z"),
      document: {
        sourceType: "upload",
        sourceName: "guide.md"
      }
    }
  ];

  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async () => runs
      }
    }
  });

  const summary = await DocumentRunsService.prototype.getKnowledgeBaseRunSummary.call(fakeService, "default-kb", {
    issueOnly: true
  });

  assert.equal(summary.totalRuns, 2);
  assert.deepEqual(summary.byStatus, {
    pending: 0,
    processing: 0,
    ready: 1,
    failed: 1,
    skipped: 0
  });
  assert.deepEqual(summary.latestSkipped, {
    documentId: "doc-skipped",
    version: 3,
    trigger: "reindex",
    failedStage: "stale_guard",
    sourceType: "upload",
    sourceName: "guide.md",
    message: "superseded by a newer run",
    finishedAt: new Date("2026-03-22T10:01:30.000Z"),
    failureSummary: {
      code: "INGESTION_RUN_SUPERSEDED",
      failedStage: "stale_guard",
      retryable: false,
      message: "superseded by a newer run"
    }
  });
});

test("DocumentRunsService summary anchors prefer the latest finished matching run over the latest started run", async () => {
  const runs = [
    {
      documentId: "doc-recent-started",
      version: 7,
      trigger: "external_resync",
      status: "ready",
      failedStage: null,
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
        failedStage: "source_fetch",
        retryable: false,
        message: "Newer started partial run."
      },
      startedAt: new Date("2026-03-22T10:10:00.000Z"),
      finishedAt: new Date("2026-03-22T10:11:00.000Z"),
      document: {
        sourceType: "feed",
        sourceName: "https://example.com/feed.xml"
      }
    },
    {
      documentId: "doc-latest-finished",
      version: 6,
      trigger: "external_resync",
      status: "failed",
      failedStage: "source_fetch",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: true,
        message: "Older started run that finished last."
      },
      startedAt: new Date("2026-03-22T10:09:00.000Z"),
      finishedAt: new Date("2026-03-22T10:12:00.000Z"),
      document: {
        sourceType: "web_page",
        sourceName: "https://example.com/down"
      }
    },
    {
      documentId: "doc-skipped-recent-started",
      version: 5,
      trigger: "reindex",
      status: "skipped",
      failedStage: "stale_guard",
      diagnosticsJson: {
        code: "INGESTION_RUN_SUPERSEDED",
        failedStage: "stale_guard",
        retryable: false,
        message: "Newer started skipped run."
      },
      startedAt: new Date("2026-03-22T10:08:00.000Z"),
      finishedAt: new Date("2026-03-22T10:08:30.000Z"),
      document: {
        sourceType: "upload",
        sourceName: "guide-a.md"
      }
    },
    {
      documentId: "doc-skipped-latest-finished",
      version: 4,
      trigger: "reindex",
      status: "skipped",
      failedStage: "stale_guard",
      diagnosticsJson: {
        code: "INGESTION_RUN_SUPERSEDED",
        failedStage: "stale_guard",
        retryable: false,
        message: "Older started skipped run that finished last."
      },
      startedAt: new Date("2026-03-22T10:07:00.000Z"),
      finishedAt: new Date("2026-03-22T10:09:30.000Z"),
      document: {
        sourceType: "upload",
        sourceName: "guide-b.md"
      }
    }
  ];

  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async () => runs
      }
    }
  });

  const summary = await DocumentRunsService.prototype.getKnowledgeBaseRunSummary.call(fakeService, "default-kb");

  assert.deepEqual(summary.latestFailure, {
    documentId: "doc-latest-finished",
    version: 6,
    trigger: "external_resync",
    failedStage: "source_fetch",
    sourceType: "web_page",
    sourceName: "https://example.com/down",
    message: "Older started run that finished last.",
    finishedAt: new Date("2026-03-22T10:12:00.000Z"),
    failureSummary: {
      code: "EXTERNAL_SOURCE_FETCH_FAILED",
      failedStage: "source_fetch",
      retryable: true,
      message: "Older started run that finished last."
    }
  });
  assert.deepEqual(summary.latestRetryableFailure, {
    documentId: "doc-latest-finished",
    version: 6,
    trigger: "external_resync",
    failedStage: "source_fetch",
    sourceType: "web_page",
    sourceName: "https://example.com/down",
    message: "Older started run that finished last.",
    finishedAt: new Date("2026-03-22T10:12:00.000Z"),
    failureSummary: {
      code: "EXTERNAL_SOURCE_FETCH_FAILED",
      failedStage: "source_fetch",
      retryable: true,
      message: "Older started run that finished last."
    }
  });
  assert.deepEqual(summary.latestSkipped, {
    documentId: "doc-skipped-latest-finished",
    version: 4,
    trigger: "reindex",
    failedStage: "stale_guard",
    sourceType: "upload",
    sourceName: "guide-b.md",
    message: "Older started skipped run that finished last.",
    finishedAt: new Date("2026-03-22T10:09:30.000Z"),
    failureSummary: {
      code: "INGESTION_RUN_SUPERSEDED",
      failedStage: "stale_guard",
      retryable: false,
      message: "Older started skipped run that finished last."
    }
  });
});

test("DocumentRunsService summary ignores an older failure once the same document later completes successfully", async () => {
  const runs = [
    {
      documentId: "doc-recovered",
      version: 2,
      trigger: "external_resync",
      status: "ready",
      failedStage: null,
      diagnosticsJson: null,
      startedAt: new Date("2026-03-22T10:05:00.000Z"),
      finishedAt: new Date("2026-03-22T10:06:00.000Z"),
      document: {
        sourceType: "web_page",
        sourceName: "https://example.com/recoverable"
      }
    },
    {
      documentId: "doc-recovered",
      version: 1,
      trigger: "external_resync",
      status: "failed",
      failedStage: "source_fetch",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: true,
        message: "temporary upstream failure"
      },
      startedAt: new Date("2026-03-22T10:03:00.000Z"),
      finishedAt: new Date("2026-03-22T10:04:00.000Z"),
      document: {
        sourceType: "web_page",
        sourceName: "https://example.com/recoverable"
      }
    }
  ];

  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async () => runs
      }
    }
  });

  const summary = await DocumentRunsService.prototype.getKnowledgeBaseRunSummary.call(fakeService, "default-kb");

  assert.equal(summary.retryableFailures, 0);
  assert.equal(summary.nonRetryableFailures, 0);
  assert.deepEqual(summary.failureByStage, {});
  assert.equal(summary.latestRetryableFailure, null);
  assert.equal(summary.latestFailure, null);
});

test("DocumentRunsService summary prefers a newer partial-ready run over an older terminal failure for the same document", async () => {
  const runs = [
    {
      documentId: "doc-partial-recovered",
      version: 2,
      trigger: "external_resync",
      status: "ready",
      failedStage: null,
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
        failedStage: "source_fetch",
        retryable: false,
        message: "Feed source completed with partial entry validation failures.",
        partial: true
      },
      startedAt: new Date("2026-03-22T10:05:00.000Z"),
      finishedAt: new Date("2026-03-22T10:06:00.000Z"),
      document: {
        sourceType: "feed",
        sourceName: "https://example.com/feed.xml"
      }
    },
    {
      documentId: "doc-partial-recovered",
      version: 1,
      trigger: "external_resync",
      status: "failed",
      failedStage: "source_fetch",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: true,
        message: "temporary upstream failure"
      },
      startedAt: new Date("2026-03-22T10:03:00.000Z"),
      finishedAt: new Date("2026-03-22T10:04:00.000Z"),
      document: {
        sourceType: "feed",
        sourceName: "https://example.com/feed.xml"
      }
    }
  ];

  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async () => runs
      }
    }
  });

  const summary = await DocumentRunsService.prototype.getKnowledgeBaseRunSummary.call(fakeService, "default-kb");

  assert.equal(summary.retryableFailures, 0);
  assert.equal(summary.nonRetryableFailures, 1);
  assert.deepEqual(summary.failureByStage, {
    source_fetch: 1
  });
  assert.equal(summary.latestRetryableFailure, null);
  assert.deepEqual(summary.latestFailure, {
    documentId: "doc-partial-recovered",
    version: 2,
    trigger: "external_resync",
    failedStage: "source_fetch",
    sourceType: "feed",
    sourceName: "https://example.com/feed.xml",
    message: "Feed source completed with partial entry validation failures.",
    finishedAt: new Date("2026-03-22T10:06:00.000Z"),
    failureSummary: {
      code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
      failedStage: "source_fetch",
      retryable: false,
      message: "Feed source completed with partial entry validation failures."
    }
  });
});

test("DocumentRunsService summary keeps the latest skipped run even if the same document later succeeds", async () => {
  const runs = [
    {
      documentId: "doc-recovered",
      version: 2,
      trigger: "external_resync",
      status: "ready",
      failedStage: null,
      diagnosticsJson: null,
      startedAt: new Date("2026-03-22T10:05:00.000Z"),
      finishedAt: new Date("2026-03-22T10:06:00.000Z"),
      document: {
        sourceType: "web_page",
        sourceName: "https://example.com/recoverable"
      }
    },
    {
      documentId: "doc-recovered",
      version: 1,
      trigger: "reindex",
      status: "skipped",
      failedStage: "stale_guard",
      diagnosticsJson: {
        code: "INGESTION_RUN_SUPERSEDED",
        failedStage: "stale_guard",
        retryable: false,
        message: "superseded by a newer run"
      },
      startedAt: new Date("2026-03-22T10:03:00.000Z"),
      finishedAt: new Date("2026-03-22T10:04:00.000Z"),
      document: {
        sourceType: "web_page",
        sourceName: "https://example.com/recoverable"
      }
    }
  ];

  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async () => runs
      }
    }
  });

  const summary = await DocumentRunsService.prototype.getKnowledgeBaseRunSummary.call(fakeService, "default-kb");

  assert.deepEqual(summary.latestSkipped, {
    documentId: "doc-recovered",
    version: 1,
    trigger: "reindex",
    failedStage: "stale_guard",
    sourceType: "web_page",
    sourceName: "https://example.com/recoverable",
    message: "superseded by a newer run",
    finishedAt: new Date("2026-03-22T10:04:00.000Z"),
    failureSummary: {
      code: "INGESTION_RUN_SUPERSEDED",
      failedStage: "stale_guard",
      retryable: false,
      message: "superseded by a newer run"
    }
  });
});

test("DocumentRunsService listDocumentRuns orders a document run history by startedAt before version", async () => {
  const queryArgs = [];
  const fakeRuns = [
    {
      id: "run-a",
      documentId: "doc-1",
      version: 2,
      trigger: "reindex",
      status: "ready",
      failedStage: null,
      diagnosticsJson: null,
      startedAt: new Date("2026-03-22T10:05:00.000Z"),
      finishedAt: new Date("2026-03-22T10:06:00.000Z"),
      createdAt: new Date("2026-03-22T10:05:00.000Z"),
      updatedAt: new Date("2026-03-22T10:06:00.000Z")
    }
  ];

  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async args => {
          queryArgs.push(args);
          return fakeRuns;
        }
      }
    }
  });

  const runs = await DocumentRunsService.prototype.listDocumentRuns.call(fakeService, "doc-1", {
    limit: 20
  });

  assert.equal(runs.length, 1);
  assert.deepEqual(queryArgs, [
    {
      where: {
        documentId: "doc-1"
      },
      take: 20,
      orderBy: [{ startedAt: "desc" }, { version: "desc" }]
    }
  ]);
});

test("DocumentRunsService listDocumentRuns leaves history unbounded when limit is omitted", async () => {
  const queryArgs = [];
  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async args => {
          queryArgs.push(args);
          return [];
        }
      }
    }
  });

  const runs = await DocumentRunsService.prototype.listDocumentRuns.call(fakeService, "doc-1", {});

  assert.deepEqual(runs, []);
  assert.deepEqual(queryArgs, [
    {
      where: {
        documentId: "doc-1"
      },
      orderBy: [{ startedAt: "desc" }, { version: "desc" }]
    }
  ]);
});

test("DocumentRunsService listDocumentRuns backfills failedStage from diagnostics for failed runs when column is null", async () => {
  const fakeRun = {
    id: "run-failed-null-stage",
    documentId: "doc-1",
    version: 7,
    trigger: "external_resync",
    status: "failed",
    failedStage: null,
    diagnosticsJson: {
      code: "EXTERNAL_SOURCE_FETCH_FAILED",
      failedStage: "source_fetch",
      retryable: true,
      message: "temporary upstream failure"
    },
    startedAt: new Date("2026-03-22T11:00:00.000Z"),
    finishedAt: new Date("2026-03-22T11:01:00.000Z"),
    createdAt: new Date("2026-03-22T11:00:00.000Z"),
    updatedAt: new Date("2026-03-22T11:01:00.000Z")
  };

  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async () => [fakeRun]
      }
    }
  });

  const runs = await DocumentRunsService.prototype.listDocumentRuns.call(fakeService, "doc-1", {
    limit: 20
  });

  assert.equal(runs.length, 1);
  assert.equal(runs[0].failedStage, "source_fetch");
  assert.deepEqual(runs[0].failureSummary, {
    code: "EXTERNAL_SOURCE_FETCH_FAILED",
    failedStage: "source_fetch",
    retryable: true,
    message: "temporary upstream failure"
  });
});

test("DocumentRunsService listDocumentRuns ignores invalid diagnostics failedStage values", async () => {
  const fakeRun = {
    id: "run-failed-invalid-stage",
    documentId: "doc-1",
    version: 8,
    trigger: "external_resync",
    status: "failed",
    failedStage: null,
    diagnosticsJson: {
      code: "EXTERNAL_SOURCE_FETCH_FAILED",
      failedStage: "not_a_real_stage",
      retryable: true,
      message: "temporary upstream failure"
    },
    startedAt: new Date("2026-03-22T11:10:00.000Z"),
    finishedAt: new Date("2026-03-22T11:11:00.000Z"),
    createdAt: new Date("2026-03-22T11:10:00.000Z"),
    updatedAt: new Date("2026-03-22T11:11:00.000Z")
  };

  const fakeService = Object.assign(Object.create(DocumentRunsService.prototype), {
    prisma: {
      documentRun: {
        findMany: async () => [fakeRun]
      }
    }
  });

  const runs = await DocumentRunsService.prototype.listDocumentRuns.call(fakeService, "doc-1", {
    limit: 20
  });

  assert.equal(runs.length, 1);
  assert.equal(runs[0].failedStage, null);
  assert.deepEqual(runs[0].failureSummary, {
    code: "EXTERNAL_SOURCE_FETCH_FAILED",
    failedStage: null,
    retryable: true,
    message: "temporary upstream failure"
  });
});
