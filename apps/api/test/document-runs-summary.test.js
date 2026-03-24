const assert = require("node:assert/strict");
const { DocumentRunsService } = require("../src/modules/document-runs/document-runs.service.ts");

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

  const runs = await DocumentRunsService.prototype.listDocumentRuns.call(fakeService, "doc-1");

  assert.equal(runs.length, 1);
  assert.deepEqual(queryArgs, [
    {
      where: {
        documentId: "doc-1"
      },
      orderBy: [{ startedAt: "desc" }, { version: "desc" }]
    }
  ]);
});
