const assert = require("node:assert/strict");
const { BadGatewayException, BadRequestException } = require("@nestjs/common");
const { Prisma } = require("@prisma/client");
const { FeedSourceService } = require("../src/infra/feed-source/feed-source.service.ts");
const { SitemapSourceService } = require("../src/infra/sitemap-source/sitemap-source.service.ts");
const { WebPageService } = require("../src/infra/web-page/web-page.service.ts");
const { DocumentsService } = require("../src/modules/documents/documents.service.ts");

test("DocumentsService lists knowledge-base documents by latest update activity without a default limit", async () => {
  const findManyCalls = [];
  const fakeDocuments = [{ id: "document-2" }, { id: "document-1" }];

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    prisma: {
      document: {
        findMany: async args => {
          findManyCalls.push(args);
          return fakeDocuments;
        }
      }
    },
    knowledgeBasesService: {
      getKnowledgeBase: async knowledgeBaseId => {
        assert.equal(knowledgeBaseId, "default-kb");
        return { id: knowledgeBaseId };
      }
    }
  });

  const result = await DocumentsService.prototype.listKnowledgeBaseDocuments.call(fakeService, "default-kb", {});

  assert.deepEqual(result, fakeDocuments);
  assert.deepEqual(findManyCalls, [
    {
      where: {
        kbId: "default-kb"
      },
      orderBy: {
        updatedAt: "desc"
      }
    }
  ]);
});

test("DocumentsService reuses an existing web page document when the same URL is ingested again", async () => {
  await expectExternalSourceResync({
    sourceType: "web_page",
    methodName: "createWebPageDocument",
    input: {
      url: "https://Example.com/guide#intro",
      title: "Guide Override"
    },
    expectedSourceName: "https://example.com/guide",
    fetchResult: {
      title: "Fetched Guide",
      content: "Alpha"
    }
  });
});

test("DocumentsService reuses an existing feed document when the same URL is ingested again", async () => {
  await expectExternalSourceResync({
    sourceType: "feed",
    methodName: "createFeedDocument",
    input: {
      url: "https://Example.com/feed.xml#latest",
      maxItems: 5
    },
    expectedSourceName: "https://example.com/feed.xml",
    fetchResult: {
      title: "Fetched Feed",
      content: "Feed content"
    }
  });
});

test("DocumentsService persists normalized partial diagnostics when a reused feed source returns partial results", async () => {
  const enqueuedDocumentIds = [];
  const documentUpdates = [];

  const existingDocument = {
    id: "existing-feed-partial-document",
    kbId: "default-kb",
    sourceType: "feed",
    sourceName: "https://example.com/feed.xml",
    title: "Existing feed",
    mimeType: "text/plain",
    storageKey: "generated/feed.txt",
    status: "ready",
    processingStage: "completed",
    version: 3,
    chunkCount: 4,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    prisma: {
      document: {
        findFirst: async () => existingDocument,
        update: async args => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === "object" && args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version
          };
        }
      }
    },
    knowledgeBasesService: {
      getKnowledgeBase: async knowledgeBaseId => {
        assert.equal(knowledgeBaseId, "default-kb");
        return { id: knowledgeBaseId };
      }
    },
    storageService: {
      saveGeneratedTextFile: async ({ content }) => {
        assert.equal(content, "Feed partial content");
        return {
          storageKey: "generated/feed-partial.txt"
        };
      }
    },
    feedSourceService: {
      fetchFeed: async options => {
        assert.deepEqual(options, {
          url: "https://example.com/feed.xml",
          maxItems: 5
        });
        return {
          title: "Fetched Feed",
          content: "Feed partial content",
          diagnostics: {
            attemptedEntryCount: 3,
            succeededEntryCount: 2,
            failedEntryCount: 1,
            failedEntryRefs: ["Broken Entry"],
            failedEntries: [
              {
                ref: "Broken Entry",
                code: "ENTRY_CONTENT_EMPTY",
                message: "Feed entry is missing both summary and link.",
                retryable: false
              }
            ],
            failedEntriesTruncated: false,
            failedEntriesOmittedCount: 0,
            partial: true
          }
        };
      }
    },
    documentRunsService: {
      createRun: async () => {}
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    sitemapSourceService: {},
    webPageService: {}
  });

  const result = await DocumentsService.prototype.createFeedDocument.call(fakeService, "default-kb", {
    url: "https://Example.com/feed.xml#latest",
    maxItems: 5
  });

  assert.equal(result.id, existingDocument.id);
  assert.equal(documentUpdates.length, 2);
  assert.deepEqual(documentUpdates[1], {
    where: {
      id: existingDocument.id
    },
    data: {
      title: "Fetched Feed",
      mimeType: "text/plain",
      storageKey: "generated/feed-partial.txt",
      status: "pending",
      processingStage: "uploaded",
      errorMessage: null,
        diagnosticsJson: {
          code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
          failedStage: "source_fetch",
          retryable: false,
          documentVersion: existingDocument.version + 1,
          sourceKind: "feed",
          schemaVersion: 2,
          category: "external_source_partial",
          partialFailureCount: 1,
          retryableFailureCount: 0,
          nonRetryableFailureCount: 0,
          boundaryHit: false,
          boundaryReasons: [],
          message: "Feed source completed with partial entry validation failures.",
        attemptedEntryCount: 3,
        succeededEntryCount: 2,
        failedEntryCount: 1,
        failedEntryRefs: ["Broken Entry"],
        failedEntries: [
          {
            ref: "Broken Entry",
            code: "ENTRY_CONTENT_EMPTY",
            message: "Feed entry is missing both summary and link.",
            retryable: false
          }
        ],
        failedEntriesTruncated: false,
        failedEntriesOmittedCount: 0,
        partial: true
      }
    }
  });
  assert.deepEqual(enqueuedDocumentIds, [existingDocument.id]);
});

test("DocumentsService reuses an existing sitemap document when the same URL is ingested again", async () => {
  await expectExternalSourceResync({
    sourceType: "sitemap",
    methodName: "createSitemapDocument",
    input: {
      url: "https://Example.com/sitemap.xml#root",
      maxPages: 10
    },
    expectedSourceName: "https://example.com/sitemap.xml",
    fetchResult: {
      content: "Sitemap content"
    }
  });
});

test("DocumentsService persists normalized partial diagnostics when a reused sitemap source returns partial results", async () => {
  const enqueuedDocumentIds = [];
  const documentUpdates = [];

  const existingDocument = {
    id: "existing-sitemap-partial-document",
    kbId: "default-kb",
    sourceType: "sitemap",
    sourceName: "https://example.com/sitemap.xml",
    title: "Existing sitemap",
    mimeType: "text/plain",
    storageKey: "generated/sitemap.txt",
    status: "ready",
    processingStage: "completed",
    version: 3,
    chunkCount: 4,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    prisma: {
      document: {
        findFirst: async () => existingDocument,
        update: async args => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === "object" && args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version
          };
        }
      }
    },
    knowledgeBasesService: {
      getKnowledgeBase: async knowledgeBaseId => {
        assert.equal(knowledgeBaseId, "default-kb");
        return { id: knowledgeBaseId };
      }
    },
    storageService: {
      saveGeneratedTextFile: async ({ content }) => {
        assert.equal(content, "Sitemap partial content");
        return {
          storageKey: "generated/sitemap-partial.txt"
        };
      }
    },
    sitemapSourceService: {
      fetchSitemap: async options => {
        assert.deepEqual(options, {
          url: "https://example.com/sitemap.xml",
          maxPages: 10
        });
        return {
          content: "Sitemap partial content",
          diagnostics: {
            attemptedPageCount: 3,
            succeededPageCount: 2,
            failedPageCount: 1,
            failedPageUrls: ["https://example.com/pages/bad"],
            failedPages: [
              {
                url: "https://example.com/pages/bad",
                code: "UNSUPPORTED_CONTENT_TYPE",
                message: "Unsupported web page content type: application/pdf.",
                retryable: false
              }
            ],
            failedPagesTruncated: false,
            failedPagesOmittedCount: 0,
            retryable: false,
            partial: true
          }
        };
      }
    },
    documentRunsService: {
      createRun: async () => {}
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    feedSourceService: {},
    webPageService: {}
  });

  const result = await DocumentsService.prototype.createSitemapDocument.call(fakeService, "default-kb", {
    url: "https://Example.com/sitemap.xml#root",
    maxPages: 10
  });

  assert.equal(result.id, existingDocument.id);
  assert.equal(documentUpdates.length, 2);
  assert.deepEqual(documentUpdates[1], {
    where: {
      id: existingDocument.id
    },
    data: {
      title: "Existing sitemap",
      mimeType: "text/plain",
      storageKey: "generated/sitemap-partial.txt",
      status: "pending",
      processingStage: "uploaded",
      errorMessage: null,
        diagnosticsJson: {
          code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
          failedStage: "source_fetch",
          retryable: false,
          documentVersion: existingDocument.version + 1,
          sourceKind: "sitemap",
          schemaVersion: 2,
          category: "external_source_partial",
          partialFailureCount: 1,
          retryableFailureCount: 0,
          nonRetryableFailureCount: 0,
          boundaryHit: false,
          boundaryReasons: [],
          message: "Sitemap source completed with partial page fetch failures.",
        attemptedPageCount: 3,
        succeededPageCount: 2,
        failedPageCount: 1,
        failedPageUrls: ["https://example.com/pages/bad"],
        failedPages: [
          {
            url: "https://example.com/pages/bad",
            code: "UNSUPPORTED_CONTENT_TYPE",
            message: "Unsupported web page content type: application/pdf.",
            retryable: false
          }
        ],
        failedPagesTruncated: false,
        failedPagesOmittedCount: 0,
        partial: true
      }
    }
  });
  assert.deepEqual(enqueuedDocumentIds, [existingDocument.id]);
});

test("DocumentsService clarifies child-sitemap partial diagnostics and preserves retryable summary when a reused sitemap source returns child fetch failures", async () => {
  const enqueuedDocumentIds = [];
  const documentUpdates = [];

  const existingDocument = {
    id: "existing-sitemap-child-partial-document",
    kbId: "default-kb",
    sourceType: "sitemap",
    sourceName: "https://example.com/sitemap-index.xml",
    title: "Existing sitemap index",
    mimeType: "text/plain",
    storageKey: "generated/sitemap-index.txt",
    status: "ready",
    processingStage: "completed",
    version: 3,
    chunkCount: 4,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    prisma: {
      document: {
        findFirst: async () => existingDocument,
        update: async args => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === "object" && args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version
          };
        }
      }
    },
    knowledgeBasesService: {
      getKnowledgeBase: async knowledgeBaseId => {
        assert.equal(knowledgeBaseId, "default-kb");
        return { id: knowledgeBaseId };
      }
    },
    storageService: {
      saveGeneratedTextFile: async ({ content }) => {
        assert.equal(content, "Sitemap child partial content");
        return {
          storageKey: "generated/sitemap-child-partial.txt"
        };
      }
    },
    sitemapSourceService: {
      fetchSitemap: async options => {
        assert.deepEqual(options, {
          url: "https://example.com/sitemap-index.xml",
          maxPages: 10
        });
        return {
          content: "Sitemap child partial content",
          diagnostics: {
            attemptedPageCount: 2,
            succeededPageCount: 2,
            failedPageCount: 0,
            failedPageUrls: [],
            failedPages: [],
            failedPagesTruncated: false,
            failedPagesOmittedCount: 0,
            attemptedChildSitemapCount: 2,
            succeededChildSitemapCount: 1,
            failedChildSitemapCount: 1,
            failedChildSitemapUrls: ["https://example.com/sitemaps/failing.xml"],
            failedChildSitemaps: [
              {
                url: "https://example.com/sitemaps/failing.xml",
                code: "UPSTREAM_FETCH_FAILED",
                message: "Failed to fetch sitemap: upstream responded with 502.",
                retryable: true
              }
            ],
            failedChildSitemapsTruncated: false,
            failedChildSitemapsOmittedCount: 0,
            retryable: true,
            partial: true
          }
        };
      }
    },
    documentRunsService: {
      createRun: async () => {}
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    feedSourceService: {},
    webPageService: {}
  });

  const result = await DocumentsService.prototype.createSitemapDocument.call(fakeService, "default-kb", {
    url: "https://Example.com/sitemap-index.xml#root",
    maxPages: 10
  });

  assert.equal(result.id, existingDocument.id);
  assert.equal(documentUpdates.length, 2);
  assert.deepEqual(documentUpdates[1], {
    where: {
      id: existingDocument.id
    },
    data: {
      title: "Existing sitemap index",
      mimeType: "text/plain",
      storageKey: "generated/sitemap-child-partial.txt",
      status: "pending",
      processingStage: "uploaded",
      errorMessage: null,
        diagnosticsJson: {
          code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
          failedStage: "source_fetch",
          retryable: true,
          documentVersion: existingDocument.version + 1,
          sourceKind: "sitemap",
          schemaVersion: 2,
          category: "external_source_partial",
          partialFailureCount: 1,
          retryableFailureCount: 0,
          nonRetryableFailureCount: 0,
          boundaryHit: false,
          boundaryReasons: [],
          message: "Sitemap source completed with partial child sitemap fetch failures.",
        attemptedPageCount: 2,
        succeededPageCount: 2,
        failedPageCount: 0,
        failedPageUrls: [],
        failedPages: [],
        failedPagesTruncated: false,
        failedPagesOmittedCount: 0,
        attemptedChildSitemapCount: 2,
        succeededChildSitemapCount: 1,
        failedChildSitemapCount: 1,
        failedChildSitemapUrls: ["https://example.com/sitemaps/failing.xml"],
        failedChildSitemaps: [
          {
            url: "https://example.com/sitemaps/failing.xml",
            code: "UPSTREAM_FETCH_FAILED",
            message: "Failed to fetch sitemap: upstream responded with 502.",
            retryable: true
          }
        ],
        failedChildSitemapsTruncated: false,
        failedChildSitemapsOmittedCount: 0,
        partial: true
      }
    }
  });
  assert.deepEqual(enqueuedDocumentIds, [existingDocument.id]);
});

test("DocumentsService records a failed web page sync when source fetch fails", async () => {
  const enqueuedDocumentIds = [];
  const documentUpdates = [];
  const createdRuns = [];
  const failedRuns = [];

  const reservedDocument = {
    id: "reserved-web-page-document",
    kbId: "default-kb",
    sourceType: "web_page",
    sourceName: "https://example.com/down",
    title: "example.com/down",
    mimeType: "text/plain",
    storageKey: "generated/pending.txt",
    version: 2
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    prisma: {
      document: {
        findFirst: async () => null,
        create: async () => reservedDocument,
        update: async args => {
          documentUpdates.push(args);
          return {
            ...reservedDocument,
            ...args.data
          };
        }
      }
    },
    knowledgeBasesService: {
      getKnowledgeBase: async () => ({ id: "default-kb" })
    },
    storageService: {
      saveGeneratedTextFile: async () => {
        throw new Error("saveGeneratedTextFile should not be called on fetch failure");
      }
    },
    webPageService: {
      fetchWebPage: async () => {
        throw new Error("Failed to fetch web page: upstream responded with 502.");
      }
    },
    feedSourceService: {},
    sitemapSourceService: {},
    documentRunsService: {
      createRun: async input => {
        createdRuns.push(input);
      },
      markRunFailed: async (documentId, version, input) => {
        failedRuns.push({ documentId, version, ...input });
      }
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    }
  });

  await assert.rejects(
    DocumentsService.prototype.createWebPageDocument.call(fakeService, "default-kb", {
      url: "https://example.com/down"
    }),
    /upstream responded with 502/
  );

  assert.deepEqual(documentUpdates, [
    {
      where: {
        id: reservedDocument.id
      },
      data: {
        status: "failed",
        processingStage: "failed",
        errorMessage: "Failed to fetch web page: upstream responded with 502.",
        diagnosticsJson: {
          code: "EXTERNAL_SOURCE_FETCH_FAILED",
          failedStage: "source_fetch",
          retryable: true,
          documentVersion: reservedDocument.version,
          message: "Failed to fetch web page: upstream responded with 502.",
          sourceType: "web_page",
          sourceName: "https://example.com/down"
        }
      }
    }
  ]);
  assert.deepEqual(createdRuns, [
    {
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      trigger: "external_resync"
    }
  ]);
  assert.deepEqual(failedRuns, [
    {
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      failedStage: "source_fetch",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: true,
        documentVersion: reservedDocument.version,
        message: "Failed to fetch web page: upstream responded with 502.",
        sourceType: "web_page",
        sourceName: "https://example.com/down"
      }
    }
  ]);
  assert.deepEqual(enqueuedDocumentIds, []);
});

test("DocumentsService records non-retryable diagnostics for invalid external source payloads", async () => {
  const documentUpdates = [];
  const failedRuns = [];

  const reservedDocument = {
    id: "reserved-invalid-web-page-document",
    version: 4
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    prisma: {
      document: {
        update: async args => {
          documentUpdates.push(args);
          return {
            ...reservedDocument,
            ...args.data
          };
        }
      }
    },
    documentRunsService: {
      markRunFailed: async (documentId, version, input) => {
        failedRuns.push({ documentId, version, ...input });
      }
    }
  });

  await assert.rejects(
    DocumentsService.prototype.fetchExternalSourceOrRecordFailure.call(
      fakeService,
      reservedDocument,
      async () => {
        throw new BadRequestException("Unsupported web page content type: application/pdf.");
      }
    ),
    /Unsupported web page content type/
  );

  assert.deepEqual(documentUpdates, [
    {
      where: {
        id: reservedDocument.id
      },
      data: {
        status: "failed",
        processingStage: "failed",
        errorMessage: "Unsupported web page content type: application/pdf.",
        diagnosticsJson: {
          code: "EXTERNAL_SOURCE_FETCH_FAILED",
          failedStage: "source_fetch",
          retryable: false,
          documentVersion: reservedDocument.version,
          message: "Unsupported web page content type: application/pdf."
        }
      }
    }
  ]);
  assert.deepEqual(failedRuns, [
    {
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      failedStage: "source_fetch",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: false,
        documentVersion: reservedDocument.version,
        message: "Unsupported web page content type: application/pdf."
      }
    }
  ]);
});

test("DocumentsService keeps canonical external partial envelope fields over raw source diagnostics", () => {
  const fakeService = Object.create(DocumentsService.prototype);

  const diagnostics = DocumentsService.prototype.buildExternalSourcePartialDiagnostics.call(
    fakeService,
    7,
    {
      partial: true,
      code: "SOURCE_CODE_SHOULD_NOT_WIN",
      failedStage: "indexing",
      retryable: false,
      documentVersion: 999,
      sourceKind: "raw-source",
      schemaVersion: 999,
      category: "raw",
      message: "raw-message",
      retryableFailureCount: 2,
      nonRetryableFailureCount: 0,
      failedEntryCount: 1,
      boundaryHit: false,
      boundaryReasons: ["RAW_REASON"]
    },
    "canonical-message",
    false,
    "feed"
  );

  assert.deepEqual(diagnostics, {
    partial: true,
    code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
    failedStage: "source_fetch",
    retryable: false,
    documentVersion: 7,
    sourceKind: "feed",
    schemaVersion: 2,
    category: "external_source_partial",
    message: "canonical-message",
    retryableFailureCount: 2,
    nonRetryableFailureCount: 0,
    partialFailureCount: 1,
    boundaryHit: false,
    boundaryReasons: ["RAW_REASON"],
    failedEntryCount: 1
  });
});

test("WebPageService classifies upstream 404 responses as non-retryable", async () => {
  await withMockedFetch(
    [
      new Response("User-agent: *\nAllow: /\n", { status: 200, headers: { "content-type": "text/plain" } }),
      new Response("missing", { status: 404, headers: { "content-type": "text/html" } })
    ],
    async () => {
      const service = new WebPageService();

      await assert.rejects(service.fetchWebPage("https://example.com/missing"), error => {
        assert.equal(error instanceof BadRequestException, true);
        assert.equal(error.message, "Failed to fetch web page: upstream responded with 404.");
        return true;
      });
    }
  );
});

test("WebPageService blocks fetch when robots disallows the target path", async () => {
  await withMockedFetch(
    [new Response("User-agent: *\nDisallow: /private\n", { status: 200, headers: { "content-type": "text/plain" } })],
    async () => {
      const service = new WebPageService();

      await assert.rejects(service.fetchWebPage("https://example.com/private/doc"), error => {
        assert.equal(error instanceof BadRequestException, true);
        assert.equal(error.message, "Failed to fetch web page: Blocked by robots.txt for https://example.com/private/doc.");
        return true;
      });
    }
  );
});

test("WebPageService blocks redirected fetch when target path is disallowed by robots", async () => {
  await withMockedFetch(
    [
      new Response("User-agent: *\nAllow: /public\nDisallow: /private\n", {
        status: 200,
        headers: { "content-type": "text/plain" }
      }),
      new Response("redirect", {
        status: 302,
        headers: { location: "/private/doc" }
      }),
      new Response("<html><title>Private</title><body>private page</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" }
      }),
      new Response("User-agent: *\nDisallow: /private\n", {
        status: 200,
        headers: { "content-type": "text/plain" }
      })
    ],
    async () => {
      const service = new WebPageService();

      await assert.rejects(service.fetchWebPage("https://example.com/public"), error => {
        assert.equal(error instanceof BadRequestException, true);
        assert.match(
          error.message,
          /^Failed to fetch web page: Blocked by robots\.txt for https:\/\/example\.com\/private\/doc\./
        );
        return true;
      });
    }
  );
});

test("FeedSourceService classifies upstream 404 responses as non-retryable", async () => {
  await withMockedFetch(
    [
      new Response("User-agent: *\nAllow: /\n", { status: 200, headers: { "content-type": "text/plain" } }),
      new Response("missing", { status: 404, headers: { "content-type": "application/rss+xml" } })
    ],
    async () => {
      const service = new FeedSourceService();

      await assert.rejects(
        service.fetchFeed({
          url: "https://example.com/feed.xml",
          maxItems: 5
        }),
        error => {
          assert.equal(error instanceof BadRequestException, true);
          assert.equal(error.message, "Failed to fetch feed: upstream responded with 404.");
          return true;
        }
      );
    }
  );
});

test("FeedSourceService blocks redirected fetch when target path is disallowed by robots", async () => {
  await withMockedFetch(
    [
      new Response("User-agent: *\nAllow: /feed.xml\nDisallow: /private\n", {
        status: 200,
        headers: { "content-type": "text/plain" }
      }),
      new Response("redirect", {
        status: 302,
        headers: { location: "/private/feed.xml" }
      }),
      new Response(
        ['<?xml version="1.0" encoding="UTF-8"?>', "<rss><channel><title>Private Feed</title><item><title>One</title><link>https://example.com/one</link></item></channel></rss>"].join("\n"),
        {
          status: 200,
          headers: { "content-type": "application/rss+xml" }
        }
      ),
      new Response("User-agent: *\nDisallow: /private\n", {
        status: 200,
        headers: { "content-type": "text/plain" }
      })
    ],
    async () => {
      const service = new FeedSourceService();

      await assert.rejects(
        service.fetchFeed({
          url: "https://example.com/feed.xml",
          maxItems: 5
        }),
        error => {
          assert.equal(error instanceof BadRequestException, true);
          assert.match(
            error.message,
            /^Failed to fetch feed: Blocked by robots\.txt for https:\/\/example\.com\/private\/feed\.xml\./
          );
          return true;
        }
      );
    }
  );
});

test("SitemapSourceService blocks redirected fetch when target path is disallowed by robots", async () => {
  await withMockedFetch(
    [
      new Response("User-agent: *\nAllow: /sitemap.xml\nDisallow: /private\n", {
        status: 200,
        headers: { "content-type": "text/plain" }
      }),
      new Response("redirect", {
        status: 302,
        headers: { location: "/private/sitemap.xml" }
      }),
      new Response(
        ['<?xml version="1.0" encoding="UTF-8"?>', "<urlset><url><loc>https://example.com/one</loc></url></urlset>"].join("\n"),
        {
          status: 200,
          headers: { "content-type": "application/xml" }
        }
      ),
      new Response("User-agent: *\nDisallow: /private\n", {
        status: 200,
        headers: { "content-type": "text/plain" }
      })
    ],
    async () => {
      const service = new SitemapSourceService({
        fetchWebPage: async url => ({
          title: url,
          content: `Content for ${url}`
        })
      });

      await assert.rejects(
        service.fetchSitemap({
          url: "https://example.com/sitemap.xml",
          maxPages: 5
        }),
        error => {
          assert.equal(error instanceof BadRequestException, true);
          assert.match(
            error.message,
            /^Failed to fetch sitemap: Blocked by robots\.txt for https:\/\/example\.com\/private\/sitemap\.xml\./
          );
          return true;
        }
      );
    }
  );
});

test("SitemapSourceService keeps child sitemap 404 failures non-retryable in partial diagnostics", async () => {
  await withMockedFetch(
    [
      new Response("User-agent: *\nAllow: /\n", { status: 200, headers: { "content-type": "text/plain" } }),
      new Response(
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          "<sitemapindex>",
          "  <sitemap><loc>https://example.com/sitemaps/first.xml</loc></sitemap>",
          "  <sitemap><loc>https://example.com/sitemaps/missing.xml</loc></sitemap>",
          "</sitemapindex>"
        ].join("\n"),
        { status: 200, headers: { "content-type": "application/xml" } }
      ),
      new Response("User-agent: *\nAllow: /\n", { status: 200, headers: { "content-type": "text/plain" } }),
      new Response(
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          "<urlset>",
          "  <url><loc>https://example.com/pages/one</loc></url>",
          "</urlset>"
        ].join("\n"),
        { status: 200, headers: { "content-type": "application/xml" } }
      ),
      new Response("User-agent: *\nAllow: /\n", { status: 200, headers: { "content-type": "text/plain" } }),
      new Response("missing", { status: 404, headers: { "content-type": "application/xml" } })
    ],
    async () => {
      const service = new SitemapSourceService({
        fetchWebPage: async url => ({
          title: url,
          content: `Content for ${url}`
        })
      });

      const result = await service.fetchSitemap({
        url: "https://example.com/sitemap-index.xml",
        maxPages: 5
      });

      assert.equal(result.diagnostics?.retryable, false);
      assert.equal(result.diagnostics?.partial, true);
      assert.deepEqual(result.diagnostics?.failedChildSitemaps, [
        {
          url: "https://example.com/sitemaps/missing.xml",
          code: "UPSTREAM_FETCH_FAILED",
          message: "Failed to fetch sitemap: upstream responded with 404.",
          retryable: false
        }
      ]);
    }
  );
});

test("SitemapSourceService rejects cross-domain child sitemap URLs", async () => {
  await withMockedFetch(
    [
      new Response("User-agent: *\nAllow: /\n", { status: 200, headers: { "content-type": "text/plain" } }),
      new Response(
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          "<sitemapindex>",
          "  <sitemap><loc>https://example.com/sitemaps/one.xml</loc></sitemap>",
          "  <sitemap><loc>https://other-site.test/sitemaps/two.xml</loc></sitemap>",
          "</sitemapindex>"
        ].join("\n"),
        { status: 200, headers: { "content-type": "application/xml" } }
      )
    ],
    async () => {
      const service = new SitemapSourceService({
        fetchWebPage: async url => ({
          title: url,
          content: `Content for ${url}`
        })
      });

      await assert.rejects(
        service.fetchSitemap({
          url: "https://example.com/sitemap-index.xml",
          maxPages: 5
        }),
        /outside source domain boundary/
      );
    }
  );
});

test("DocumentsService records non-retryable diagnostics for upstream 404 source failures", async () => {
  const documentUpdates = [];
  const failedRuns = [];

  const reservedDocument = {
    id: "reserved-missing-web-page-document",
    version: 5
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    prisma: {
      document: {
        update: async args => {
          documentUpdates.push(args);
          return {
            ...reservedDocument,
            ...args.data
          };
        }
      }
    },
    documentRunsService: {
      markRunFailed: async (documentId, version, input) => {
        failedRuns.push({ documentId, version, ...input });
      }
    }
  });

  await assert.rejects(
    DocumentsService.prototype.fetchExternalSourceOrRecordFailure.call(fakeService, reservedDocument, async () => {
      throw new BadRequestException("Failed to fetch web page: upstream responded with 404.");
    }),
    /upstream responded with 404/
  );

  assert.deepEqual(documentUpdates, [
    {
      where: {
        id: reservedDocument.id
      },
      data: {
        status: "failed",
        processingStage: "failed",
        errorMessage: "Failed to fetch web page: upstream responded with 404.",
        diagnosticsJson: {
          code: "EXTERNAL_SOURCE_FETCH_FAILED",
          failedStage: "source_fetch",
          retryable: false,
          documentVersion: reservedDocument.version,
          message: "Failed to fetch web page: upstream responded with 404."
        }
      }
    }
  ]);
  assert.deepEqual(failedRuns, [
    {
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      failedStage: "source_fetch",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: false,
        documentVersion: reservedDocument.version,
        message: "Failed to fetch web page: upstream responded with 404."
      }
    }
  ]);
});

test("DocumentsService stale external finalize does not overwrite a newer document version", async () => {
  const documentUpdates = [];
  const skippedRuns = [];

  const currentDocument = {
    id: "stale-finalize-document",
    version: 4,
    status: "pending",
    processingStage: "uploaded"
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    prisma: {
      document: {
        findUnique: async ({ where }) => {
          assert.deepEqual(where, { id: currentDocument.id });
          return {
            version: currentDocument.version
          };
        },
        update: async args => {
          documentUpdates.push(args);
          return args.data;
        }
      }
    },
    documentRunsService: {
      markRunSkipped: async (documentId, version, input) => {
        skippedRuns.push({ documentId, version, ...input });
      }
    },
    getDocument: async documentId => {
      assert.equal(documentId, currentDocument.id);
      return currentDocument;
    }
  });

  const result = await DocumentsService.prototype.finalizeExternalDocument.call(
    fakeService,
    {
      id: currentDocument.id,
      version: 3
    },
    {
      title: "Fetched title",
      mimeType: "text/plain",
      storageKey: "generated/stale.txt"
    }
  );

  assert.deepEqual(result, {
    document: currentDocument,
    applied: false
  });
  assert.deepEqual(documentUpdates, []);
  assert.deepEqual(skippedRuns, [
    {
      documentId: currentDocument.id,
      version: 3,
      failedStage: "stale_guard",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_RUN_SUPERSEDED",
        failedStage: "stale_guard",
        retryable: false,
        documentVersion: 3,
        message: "Skipped stale external source update because a newer document version is already active.",
        currentDocumentVersion: 4
      }
    }
  ]);
});

test("DocumentsService finalize uses version-guarded update to avoid stale overwrite during concurrent external resync", async () => {
  const updateManyCalls = [];
  const skippedRuns = [];

  const currentDocument = {
    id: "stale-race-finalize-document",
    version: 7,
    status: "pending",
    processingStage: "uploaded"
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    prisma: {
      document: {
        updateMany: async args => {
          updateManyCalls.push(args);
          return { count: 0 };
        },
        findUnique: async ({ where }) => {
          assert.deepEqual(where, { id: currentDocument.id });
          return {
            version: currentDocument.version
          };
        }
      }
    },
    documentRunsService: {
      markRunSkipped: async (documentId, version, input) => {
        skippedRuns.push({ documentId, version, ...input });
      }
    },
    getDocument: async documentId => {
      assert.equal(documentId, currentDocument.id);
      return currentDocument;
    }
  });

  const result = await DocumentsService.prototype.finalizeExternalDocument.call(
    fakeService,
    {
      id: currentDocument.id,
      version: 6
    },
    {
      title: "Stale fetched title",
      mimeType: "text/plain",
      storageKey: "generated/stale-race.txt"
    }
  );

  assert.deepEqual(updateManyCalls, [
    {
      where: {
        id: currentDocument.id,
        version: 6
      },
      data: {
        title: "Stale fetched title",
        mimeType: "text/plain",
        storageKey: "generated/stale-race.txt",
        status: "pending",
        processingStage: "uploaded",
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull
      }
    }
  ]);
  assert.deepEqual(result, {
    document: currentDocument,
    applied: false
  });
  assert.deepEqual(skippedRuns, [
    {
      documentId: currentDocument.id,
      version: 6,
      failedStage: "stale_guard",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_RUN_SUPERSEDED",
        failedStage: "stale_guard",
        retryable: false,
        documentVersion: 6,
        message: "Skipped stale external source update because a newer document version is already active.",
        currentDocumentVersion: 7
      }
    }
  ]);
});

test("DocumentsService stale external fetch failure does not overwrite a newer document version", async () => {
  const documentUpdates = [];
  const failedRuns = [];
  const skippedRuns = [];

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    prisma: {
      document: {
        findUnique: async ({ where }) => {
          assert.deepEqual(where, { id: "stale-failure-document" });
          return {
            version: 6
          };
        },
        update: async args => {
          documentUpdates.push(args);
          return args.data;
        }
      }
    },
    documentRunsService: {
      markRunFailed: async (documentId, version, input) => {
        failedRuns.push({ documentId, version, ...input });
      },
      markRunSkipped: async (documentId, version, input) => {
        skippedRuns.push({ documentId, version, ...input });
      }
    }
  });

  await assert.rejects(
    DocumentsService.prototype.fetchExternalSourceOrRecordFailure.call(
      fakeService,
      {
        id: "stale-failure-document",
        version: 5
      },
      async () => {
        throw new Error("Failed to fetch feed: upstream responded with 502.");
      }
    ),
    /upstream responded with 502/
  );

  assert.deepEqual(documentUpdates, []);
  assert.deepEqual(failedRuns, []);
  assert.deepEqual(skippedRuns, [
    {
      documentId: "stale-failure-document",
      version: 5,
      failedStage: "stale_guard",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_RUN_SUPERSEDED",
        failedStage: "stale_guard",
        retryable: false,
        documentVersion: 5,
        message: "Skipped stale external source update because a newer document version is already active.",
        currentDocumentVersion: 6
      }
    }
  ]);
});

test("DocumentsService skips stale external run before source fetch to avoid duplicate fetch work", async () => {
  const createdRuns = [];
  const skippedRuns = [];
  const enqueuedDocumentIds = [];

  const reservedDocument = {
    id: "stale-prefetch-guard-document",
    version: 3,
    title: "Reserved title"
  };
  const currentDocument = {
    id: reservedDocument.id,
    version: 4,
    title: "Newer title",
    status: "pending",
    processingStage: "uploaded"
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    reserveExternalDocument: async () => reservedDocument,
    prisma: {
      document: {
        findUnique: async ({ where }) => {
          assert.deepEqual(where, { id: reservedDocument.id });
          return {
            version: currentDocument.version
          };
        },
        update: async () => {
          throw new Error("document.update should not be called for stale pre-fetch run");
        }
      }
    },
    documentRunsService: {
      createRun: async input => {
        createdRuns.push(input);
      },
      markRunSkipped: async (documentId, version, input) => {
        skippedRuns.push({ documentId, version, ...input });
      }
    },
    getDocument: async documentId => {
      assert.equal(documentId, reservedDocument.id);
      return currentDocument;
    },
    webPageService: {
      fetchWebPage: async () => {
        throw new Error("fetchWebPage should not be called for stale pre-fetch run");
      }
    },
    storageService: {
      saveGeneratedTextFile: async () => {
        throw new Error("saveGeneratedTextFile should not be called for stale pre-fetch run");
      }
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    feedSourceService: {},
    sitemapSourceService: {}
  });

  const result = await DocumentsService.prototype.createWebPageDocument.call(fakeService, "default-kb", {
    url: "https://example.com/stale-prefetch"
  });

  assert.deepEqual(result, currentDocument);
  assert.deepEqual(createdRuns, [
    {
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      trigger: "external_resync"
    }
  ]);
  assert.deepEqual(skippedRuns, [
    {
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      failedStage: "stale_guard",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_RUN_SUPERSEDED",
        failedStage: "stale_guard",
        retryable: false,
        documentVersion: reservedDocument.version,
        message: "Skipped stale external source update because a newer document version is already active.",
        currentDocumentVersion: currentDocument.version
      }
    }
  ]);
  assert.deepEqual(enqueuedDocumentIds, []);
});

test("DocumentsService records external source persistence failures after fetch succeeds", async () => {
  const createdRuns = [];
  const documentUpdates = [];
  const failedRuns = [];
  const enqueuedDocumentIds = [];

  const reservedDocument = {
    id: "web-persist-failure-document",
    version: 2,
    title: "Reserved title"
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    reserveExternalDocument: async () => reservedDocument,
    prisma: {
      document: {
        findUnique: async ({ where }) => {
          assert.deepEqual(where, { id: reservedDocument.id });
          return {
            version: reservedDocument.version
          };
        },
        update: async args => {
          documentUpdates.push(args);
          return args.data;
        }
      }
    },
    documentRunsService: {
      createRun: async input => {
        createdRuns.push(input);
      },
      markRunFailed: async (documentId, version, input) => {
        failedRuns.push({ documentId, version, ...input });
      }
    },
    webPageService: {
      fetchWebPage: async url => {
        assert.equal(url, "https://example.com/failing-page");
        return {
          title: "Fetched page",
          content: "Fetched content"
        };
      }
    },
    storageService: {
      saveGeneratedTextFile: async () => {
        throw new Error("Failed to persist fetched external source content.");
      }
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    feedSourceService: {},
    sitemapSourceService: {}
  });

  await assert.rejects(
    DocumentsService.prototype.createWebPageDocument.call(fakeService, "default-kb", {
      url: "https://Example.com/failing-page"
    }),
    /Failed to persist fetched external source content/
  );

  assert.deepEqual(createdRuns, [
    {
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      trigger: "external_resync"
    }
  ]);
  assert.deepEqual(documentUpdates, [
    {
      where: { id: reservedDocument.id },
      data: {
        status: "failed",
        processingStage: "failed",
        errorMessage: "Failed to persist fetched external source content.",
        diagnosticsJson: {
          code: "EXTERNAL_SOURCE_PERSIST_FAILED",
          failedStage: "source_fetch",
          retryable: true,
          documentVersion: reservedDocument.version,
          message: "Failed to persist fetched external source content."
        }
      }
    }
  ]);
  assert.deepEqual(failedRuns, [
    {
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      failedStage: "source_fetch",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_PERSIST_FAILED",
        failedStage: "source_fetch",
        retryable: true,
        documentVersion: reservedDocument.version,
        message: "Failed to persist fetched external source content."
      }
    }
  ]);
  assert.deepEqual(enqueuedDocumentIds, []);
});

test("DocumentsService records external enqueue failures after finalize succeeds", async () => {
  const createdRuns = [];
  const documentUpdates = [];
  const failedRuns = [];

  const reservedDocument = {
    id: "web-enqueue-failure-document",
    version: 2,
    title: "Reserved title"
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    reserveExternalDocument: async () => reservedDocument,
    prisma: {
      document: {
        findUnique: async ({ where }) => {
          assert.deepEqual(where, { id: reservedDocument.id });
          return {
            version: reservedDocument.version
          };
        },
        update: async args => {
          documentUpdates.push(args);
          return {
            id: reservedDocument.id,
            version: reservedDocument.version,
            ...args.data
          };
        }
      }
    },
    documentRunsService: {
      createRun: async input => {
        createdRuns.push(input);
      },
      markRunFailed: async (documentId, version, input) => {
        failedRuns.push({ documentId, version, ...input });
      }
    },
    webPageService: {
      fetchWebPage: async url => {
        assert.equal(url, "https://example.com/enqueue-failing-page");
        return {
          title: "Fetched page",
          content: "Fetched content"
        };
      }
    },
    storageService: {
      saveGeneratedTextFile: async () => ({
        storageKey: "generated/enqueue-failing-page.txt"
      })
    },
    ingestionService: {
      enqueueDocument: async () => {
        throw new Error("BullMQ add failed after finalize.");
      }
    },
    feedSourceService: {},
    sitemapSourceService: {}
  });

  await assert.rejects(
    DocumentsService.prototype.createWebPageDocument.call(fakeService, "default-kb", {
      url: "https://Example.com/enqueue-failing-page"
    }),
    /BullMQ add failed after finalize/
  );

  assert.deepEqual(createdRuns, [
    {
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      trigger: "external_resync"
    }
  ]);
  assert.deepEqual(documentUpdates, [
    {
      where: { id: reservedDocument.id },
      data: {
        title: "Fetched page",
        mimeType: "text/plain",
        storageKey: "generated/enqueue-failing-page.txt",
        status: "pending",
        processingStage: "uploaded",
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull
      }
    },
    {
      where: { id: reservedDocument.id },
      data: {
        status: "failed",
        processingStage: "failed",
        errorMessage: "BullMQ add failed after finalize.",
        diagnosticsJson: {
          code: "EXTERNAL_SOURCE_ENQUEUE_FAILED",
          failedStage: "source_fetch",
          retryable: true,
          documentVersion: reservedDocument.version,
          message: "BullMQ add failed after finalize."
        }
      }
    }
  ]);
  assert.deepEqual(failedRuns, [
    {
      documentId: reservedDocument.id,
      version: reservedDocument.version,
      failedStage: "source_fetch",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_ENQUEUE_FAILED",
        failedStage: "source_fetch",
        retryable: true,
        documentVersion: reservedDocument.version,
        message: "BullMQ add failed after finalize."
      }
    }
  ]);
});

test("DocumentsService records a failed external_resync run when stored source config is invalid and legacy identity cannot be recovered", async () => {
  const documentUpdates = [];
  const createdRuns = [];
  const failedRuns = [];
  const enqueuedDocumentIds = [];

  const existingDocument = {
    id: "existing-broken-feed-document",
    kbId: "default-kb",
    sourceType: "feed",
    sourceName: "not-a-valid-source-url",
    title: "Broken feed",
    mimeType: "text/plain",
    storageKey: "generated/feed.txt",
    sourceConfigJson: Prisma.JsonNull,
    status: "ready",
    processingStage: "completed",
    version: 2,
    chunkCount: 5,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    getDocument: async documentId => {
      assert.equal(documentId, existingDocument.id);
      return existingDocument;
    },
    prisma: {
      document: {
        update: async args => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === "object" && args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version
          };
        }
      }
    },
    documentRunsService: {
      createRun: async input => {
        createdRuns.push(input);
      },
      markRunFailed: async (documentId, version, input) => {
        failedRuns.push({ documentId, version, ...input });
      }
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    storageService: {
      saveGeneratedTextFile: async () => {
        throw new Error("saveGeneratedTextFile should not be called when source config is invalid");
      }
    },
    feedSourceService: {
      fetchFeed: async () => {
        throw new Error("fetchFeed should not be called when source config is invalid");
      }
    },
    sitemapSourceService: {},
    webPageService: {}
  });

  await assert.rejects(
    DocumentsService.prototype.reindexDocument.call(fakeService, existingDocument.id),
    /External feed source config is missing/
  );

  assert.deepEqual(documentUpdates, [
    {
      where: { id: existingDocument.id },
      data: {
        status: "pending",
        processingStage: "uploaded",
        chunkCount: 0,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    },
    {
      where: { id: existingDocument.id },
      data: {
        status: "failed",
        processingStage: "failed",
        errorMessage: "External feed source config is missing.",
        diagnosticsJson: {
          code: "EXTERNAL_SOURCE_CONFIG_INVALID",
          failedStage: "source_fetch",
          retryable: false,
          documentVersion: 3,
          message: "External feed source config is missing."
        }
      }
    }
  ]);
  assert.deepEqual(createdRuns, [
    {
      documentId: existingDocument.id,
      version: 3,
      trigger: "external_resync"
    }
  ]);
  assert.deepEqual(failedRuns, [
    {
      documentId: existingDocument.id,
      version: 3,
      failedStage: "source_fetch",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_CONFIG_INVALID",
        failedStage: "source_fetch",
        retryable: false,
        documentVersion: 3,
        message: "External feed source config is missing."
      }
    }
  ]);
  assert.deepEqual(enqueuedDocumentIds, []);
});

test("DocumentsService records a failed external_resync run when legacy sitemap identity cannot be recovered from missing source config", async () => {
  const documentUpdates = [];
  const createdRuns = [];
  const failedRuns = [];
  const enqueuedDocumentIds = [];

  const existingDocument = {
    id: "existing-broken-sitemap-document",
    kbId: "default-kb",
    sourceType: "sitemap",
    sourceName: "not-a-valid-sitemap-url",
    title: "Broken sitemap",
    mimeType: "text/plain",
    storageKey: "generated/sitemap.txt",
    sourceConfigJson: Prisma.JsonNull,
    status: "ready",
    processingStage: "completed",
    version: 4,
    chunkCount: 6,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    getDocument: async documentId => {
      assert.equal(documentId, existingDocument.id);
      return existingDocument;
    },
    prisma: {
      document: {
        update: async args => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === "object" && args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version
          };
        }
      }
    },
    documentRunsService: {
      createRun: async input => {
        createdRuns.push(input);
      },
      markRunFailed: async (documentId, version, input) => {
        failedRuns.push({ documentId, version, ...input });
      }
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    storageService: {
      saveGeneratedTextFile: async () => {
        throw new Error("saveGeneratedTextFile should not be called when source config is invalid");
      }
    },
    feedSourceService: {},
    sitemapSourceService: {
      fetchSitemap: async () => {
        throw new Error("fetchSitemap should not be called when source config is invalid");
      }
    },
    webPageService: {}
  });

  await assert.rejects(
    DocumentsService.prototype.reindexDocument.call(fakeService, existingDocument.id),
    /External sitemap source config is missing/
  );

  assert.deepEqual(documentUpdates, [
    {
      where: { id: existingDocument.id },
      data: {
        status: "pending",
        processingStage: "uploaded",
        chunkCount: 0,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    },
    {
      where: { id: existingDocument.id },
      data: {
        status: "failed",
        processingStage: "failed",
        errorMessage: "External sitemap source config is missing.",
        diagnosticsJson: {
          code: "EXTERNAL_SOURCE_CONFIG_INVALID",
          failedStage: "source_fetch",
          retryable: false,
          documentVersion: 5,
          message: "External sitemap source config is missing."
        }
      }
    }
  ]);
  assert.deepEqual(createdRuns, [
    {
      documentId: existingDocument.id,
      version: 5,
      trigger: "external_resync"
    }
  ]);
  assert.deepEqual(failedRuns, [
    {
      documentId: existingDocument.id,
      version: 5,
      failedStage: "source_fetch",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_CONFIG_INVALID",
        failedStage: "source_fetch",
        retryable: false,
        documentVersion: 5,
        message: "External sitemap source config is missing."
      }
    }
  ]);
  assert.deepEqual(enqueuedDocumentIds, []);
});

test("DocumentsService records a failed external_resync run when legacy web-page identity cannot be recovered from missing source config", async () => {
  const documentUpdates = [];
  const createdRuns = [];
  const failedRuns = [];
  const enqueuedDocumentIds = [];

  const existingDocument = {
    id: "existing-broken-web-page-document",
    kbId: "default-kb",
    sourceType: "web_page",
    sourceName: "not-a-valid-web-page-url",
    title: "Broken web page",
    mimeType: "text/plain",
    storageKey: "generated/web-page.txt",
    sourceConfigJson: Prisma.JsonNull,
    status: "ready",
    processingStage: "completed",
    version: 6,
    chunkCount: 4,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    getDocument: async documentId => {
      assert.equal(documentId, existingDocument.id);
      return existingDocument;
    },
    prisma: {
      document: {
        update: async args => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === "object" && args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version
          };
        }
      }
    },
    documentRunsService: {
      createRun: async input => {
        createdRuns.push(input);
      },
      markRunFailed: async (documentId, version, input) => {
        failedRuns.push({ documentId, version, ...input });
      }
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    storageService: {
      saveGeneratedTextFile: async () => {
        throw new Error("saveGeneratedTextFile should not be called when source config is invalid");
      }
    },
    feedSourceService: {},
    sitemapSourceService: {},
    webPageService: {
      fetchWebPage: async () => {
        throw new Error("fetchWebPage should not be called when source config is invalid");
      }
    }
  });

  await assert.rejects(
    DocumentsService.prototype.reindexDocument.call(fakeService, existingDocument.id),
    /External web page source config is missing/
  );

  assert.deepEqual(documentUpdates, [
    {
      where: { id: existingDocument.id },
      data: {
        status: "pending",
        processingStage: "uploaded",
        chunkCount: 0,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    },
    {
      where: { id: existingDocument.id },
      data: {
        status: "failed",
        processingStage: "failed",
        errorMessage: "External web page source config is missing.",
        diagnosticsJson: {
          code: "EXTERNAL_SOURCE_CONFIG_INVALID",
          failedStage: "source_fetch",
          retryable: false,
          documentVersion: 7,
          message: "External web page source config is missing."
        }
      }
    }
  ]);
  assert.deepEqual(createdRuns, [
    {
      documentId: existingDocument.id,
      version: 7,
      trigger: "external_resync"
    }
  ]);
  assert.deepEqual(failedRuns, [
    {
      documentId: existingDocument.id,
      version: 7,
      failedStage: "source_fetch",
      diagnosticsJson: {
        code: "EXTERNAL_SOURCE_CONFIG_INVALID",
        failedStage: "source_fetch",
        retryable: false,
        documentVersion: 7,
        message: "External web page source config is missing."
      }
    }
  ]);
  assert.deepEqual(enqueuedDocumentIds, []);
});

test("DocumentsService reindex recovers legacy feed config when sourceConfigJson is missing", async () => {
  const documentUpdates = [];
  const createdRuns = [];
  const fetchFeedCalls = [];
  const enqueuedDocumentIds = [];

  const existingDocument = {
    id: "existing-legacy-feed-missing-config-document",
    kbId: "default-kb",
    sourceType: "feed",
    sourceName: "https://Example.com/legacy-feed.xml#latest",
    title: "Legacy feed",
    mimeType: "text/plain",
    storageKey: "generated/feed.txt",
    sourceConfigJson: Prisma.JsonNull,
    status: "ready",
    processingStage: "completed",
    version: 2,
    chunkCount: 5,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    getDocument: async documentId => {
      assert.equal(documentId, existingDocument.id);
      return existingDocument;
    },
    prisma: {
      document: {
        update: async args => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === "object" && args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version
          };
        }
      }
    },
    documentRunsService: {
      createRun: async input => {
        createdRuns.push(input);
      }
    },
    feedSourceService: {
      fetchFeed: async options => {
        fetchFeedCalls.push(options);
        return {
          title: "Fetched legacy feed",
          content: "Updated legacy feed content"
        };
      }
    },
    storageService: {
      saveGeneratedTextFile: async ({ content }) => {
        assert.equal(content, "Updated legacy feed content");
        return {
          storageKey: "generated/feed-refreshed.txt"
        };
      }
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    sitemapSourceService: {},
    webPageService: {}
  });

  const result = await DocumentsService.prototype.reindexDocument.call(fakeService, existingDocument.id);

  assert.equal(result.id, existingDocument.id);
  assert.deepEqual(createdRuns, [
    {
      documentId: existingDocument.id,
      version: 3,
      trigger: "external_resync"
    }
  ]);
  assert.deepEqual(fetchFeedCalls, [
    {
      url: "https://example.com/legacy-feed.xml",
      maxItems: 20
    }
  ]);
  assert.deepEqual(documentUpdates, [
    {
      where: { id: existingDocument.id },
      data: {
        status: "pending",
        processingStage: "uploaded",
        chunkCount: 0,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    },
    {
      where: { id: existingDocument.id },
      data: {
        title: "Fetched legacy feed",
        mimeType: "text/plain",
        storageKey: "generated/feed-refreshed.txt",
        status: "pending",
        processingStage: "uploaded",
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull
      }
    }
  ]);
  assert.deepEqual(enqueuedDocumentIds, [existingDocument.id]);
});

test("DocumentsService reindex keeps in-flight external resync instead of starting another broad fetch", async () => {
  const createdRuns = [];

  const existingDocument = {
    id: "in-flight-feed-resync-document",
    kbId: "default-kb",
    sourceType: "feed",
    sourceName: "https://example.com/feed.xml",
    title: "In-flight feed",
    mimeType: "text/plain",
    storageKey: "generated/feed.txt",
    sourceConfigJson: {
      kind: "feed",
      url: "https://example.com/feed.xml",
      maxItems: 50
    },
    status: "pending",
    processingStage: "uploaded",
    version: 6,
    chunkCount: 0,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    getDocument: async documentId => {
      assert.equal(documentId, existingDocument.id);
      return existingDocument;
    },
    prisma: {
      document: {
        update: async () => {
          throw new Error("document.update should not be called while external resync is already in-flight");
        }
      }
    },
    documentRunsService: {
      createRun: async input => {
        createdRuns.push(input);
      }
    },
    feedSourceService: {
      fetchFeed: async () => {
        throw new Error("fetchFeed should not be called while external resync is already in-flight");
      }
    },
    storageService: {
      saveGeneratedTextFile: async () => {
        throw new Error("saveGeneratedTextFile should not be called while external resync is already in-flight");
      }
    },
    ingestionService: {
      enqueueDocument: async () => {
        throw new Error("enqueueDocument should not be called while external resync is already in-flight");
      }
    },
    sitemapSourceService: {},
    webPageService: {}
  });

  const result = await DocumentsService.prototype.reindexDocument.call(fakeService, existingDocument.id);

  assert.deepEqual(result, existingDocument);
  assert.deepEqual(createdRuns, []);
});

test("DocumentsService reindex recovers legacy sitemap config when sourceConfigJson is missing", async () => {
  const documentUpdates = [];
  const createdRuns = [];
  const fetchSitemapCalls = [];
  const enqueuedDocumentIds = [];

  const existingDocument = {
    id: "existing-legacy-sitemap-missing-config-document",
    kbId: "default-kb",
    sourceType: "sitemap",
    sourceName: "https://Example.com/legacy-sitemap.xml#root",
    title: "Legacy sitemap",
    mimeType: "text/plain",
    storageKey: "generated/sitemap.txt",
    sourceConfigJson: Prisma.JsonNull,
    status: "ready",
    processingStage: "completed",
    version: 4,
    chunkCount: 9,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    getDocument: async documentId => {
      assert.equal(documentId, existingDocument.id);
      return existingDocument;
    },
    prisma: {
      document: {
        update: async args => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === "object" && args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version
          };
        }
      }
    },
    documentRunsService: {
      createRun: async input => {
        createdRuns.push(input);
      }
    },
    sitemapSourceService: {
      fetchSitemap: async options => {
        fetchSitemapCalls.push(options);
        return {
          content: "Updated legacy sitemap content",
          diagnostics: null
        };
      }
    },
    storageService: {
      saveGeneratedTextFile: async ({ content }) => {
        assert.equal(content, "Updated legacy sitemap content");
        return {
          storageKey: "generated/sitemap-refreshed.txt"
        };
      }
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    feedSourceService: {},
    webPageService: {}
  });

  const result = await DocumentsService.prototype.reindexDocument.call(fakeService, existingDocument.id);

  assert.equal(result.id, existingDocument.id);
  assert.deepEqual(createdRuns, [
    {
      documentId: existingDocument.id,
      version: 5,
      trigger: "external_resync"
    }
  ]);
  assert.deepEqual(fetchSitemapCalls, [
    {
      url: "https://example.com/legacy-sitemap.xml",
      maxPages: 20
    }
  ]);
  assert.deepEqual(documentUpdates, [
    {
      where: { id: existingDocument.id },
      data: {
        status: "pending",
        processingStage: "uploaded",
        chunkCount: 0,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    },
    {
      where: { id: existingDocument.id },
      data: {
        title: "Legacy sitemap",
        mimeType: "text/plain",
        storageKey: "generated/sitemap-refreshed.txt",
        status: "pending",
        processingStage: "uploaded",
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull
      }
    }
  ]);
  assert.deepEqual(enqueuedDocumentIds, [existingDocument.id]);
});

test("DocumentsService reindex recovers legacy feed/sitemap config when sourceType casing differs and sourceConfigJson is missing", async () => {
  const runRecoveryCase = async ({
    existingDocument,
    expectedFetchCall,
    buildFakeService,
    expectedVersion
  }) => {
    const createdRuns = [];
    const enqueuedDocumentIds = [];

    const fakeService = Object.assign(
      Object.create(DocumentsService.prototype),
      buildFakeService({ createdRuns, enqueuedDocumentIds, existingDocument })
    );

    const result = await DocumentsService.prototype.reindexDocument.call(fakeService, existingDocument.id);

    assert.equal(result.id, existingDocument.id);
    assert.deepEqual(createdRuns, [
      {
        documentId: existingDocument.id,
        version: expectedVersion,
        trigger: "external_resync"
      }
    ]);
    assert.deepEqual(expectedFetchCall.calls, [expectedFetchCall.value]);
    assert.deepEqual(enqueuedDocumentIds, [existingDocument.id]);
  };

  const feedFetchCalls = [];
  await runRecoveryCase({
    existingDocument: {
      id: "existing-legacy-uppercase-feed-document",
      kbId: "default-kb",
      sourceType: "  FEED  ",
      sourceName: "https://Example.com/legacy-feed-upper.xml#latest",
      title: "Legacy uppercase feed",
      mimeType: "text/plain",
      storageKey: "generated/feed-upper.txt",
      sourceConfigJson: Prisma.JsonNull,
      status: "ready",
      processingStage: "completed",
      version: 2,
      chunkCount: 3,
      errorMessage: null,
      diagnosticsJson: Prisma.JsonNull
    },
    expectedVersion: 3,
    expectedFetchCall: {
      calls: feedFetchCalls,
      value: {
        url: "https://example.com/legacy-feed-upper.xml",
        maxItems: 20
      }
    },
    buildFakeService: ({ createdRuns, enqueuedDocumentIds, existingDocument }) => ({
      getDocument: async documentId => {
        assert.equal(documentId, existingDocument.id);
        return existingDocument;
      },
      prisma: {
        document: {
          update: async args => ({
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === "object" && args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version
          })
        }
      },
      documentRunsService: {
        createRun: async input => {
          createdRuns.push(input);
        }
      },
      feedSourceService: {
        fetchFeed: async options => {
          feedFetchCalls.push(options);
          return {
            title: "Recovered uppercase feed",
            content: "Recovered uppercase feed content"
          };
        }
      },
      sitemapSourceService: {},
      webPageService: {},
      storageService: {
        saveGeneratedTextFile: async () => ({
          storageKey: "generated/feed-upper-recovered.txt"
        })
      },
      ingestionService: {
        enqueueDocument: async documentId => {
          enqueuedDocumentIds.push(documentId);
        }
      }
    })
  });

  const sitemapFetchCalls = [];
  await runRecoveryCase({
    existingDocument: {
      id: "existing-legacy-uppercase-sitemap-document",
      kbId: "default-kb",
      sourceType: "SITEMAP",
      sourceName: "https://Example.com/legacy-sitemap-upper.xml#root",
      title: "Legacy uppercase sitemap",
      mimeType: "text/plain",
      storageKey: "generated/sitemap-upper.txt",
      sourceConfigJson: Prisma.JsonNull,
      status: "ready",
      processingStage: "completed",
      version: 4,
      chunkCount: 8,
      errorMessage: null,
      diagnosticsJson: Prisma.JsonNull
    },
    expectedVersion: 5,
    expectedFetchCall: {
      calls: sitemapFetchCalls,
      value: {
        url: "https://example.com/legacy-sitemap-upper.xml",
        maxPages: 20
      }
    },
    buildFakeService: ({ createdRuns, enqueuedDocumentIds, existingDocument }) => ({
      getDocument: async documentId => {
        assert.equal(documentId, existingDocument.id);
        return existingDocument;
      },
      prisma: {
        document: {
          update: async args => ({
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === "object" && args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version
          })
        }
      },
      documentRunsService: {
        createRun: async input => {
          createdRuns.push(input);
        }
      },
      feedSourceService: {},
      webPageService: {},
      sitemapSourceService: {
        fetchSitemap: async options => {
          sitemapFetchCalls.push(options);
          return {
            content: "Recovered uppercase sitemap content",
            diagnostics: null
          };
        }
      },
      storageService: {
        saveGeneratedTextFile: async () => ({
          storageKey: "generated/sitemap-upper-recovered.txt"
        })
      },
      ingestionService: {
        enqueueDocument: async documentId => {
          enqueuedDocumentIds.push(documentId);
        }
      }
    })
  });
});

test("DocumentsService reindex recovers legacy feed config without maxItems by using default selection bound", async () => {
  const documentUpdates = [];
  const createdRuns = [];
  const fetchFeedCalls = [];
  const enqueuedDocumentIds = [];

  const existingDocument = {
    id: "existing-legacy-feed-document",
    kbId: "default-kb",
    sourceType: "feed",
    sourceName: "https://example.com/feed.xml",
    title: "Legacy feed",
    mimeType: "text/plain",
    storageKey: "generated/feed.txt",
    sourceConfigJson: {
      kind: "feed",
      url: "https://example.com/feed.xml"
    },
    status: "ready",
    processingStage: "completed",
    version: 2,
    chunkCount: 5,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    getDocument: async documentId => {
      assert.equal(documentId, existingDocument.id);
      return existingDocument;
    },
    prisma: {
      document: {
        update: async args => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === "object" && args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version
          };
        }
      }
    },
    documentRunsService: {
      createRun: async input => {
        createdRuns.push(input);
      }
    },
    feedSourceService: {
      fetchFeed: async options => {
        fetchFeedCalls.push(options);
        return {
          title: "Fetched feed",
          content: "Updated feed content"
        };
      }
    },
    storageService: {
      saveGeneratedTextFile: async ({ content }) => {
        assert.equal(content, "Updated feed content");
        return {
          storageKey: "generated/feed-refreshed.txt"
        };
      }
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    sitemapSourceService: {},
    webPageService: {}
  });

  const result = await DocumentsService.prototype.reindexDocument.call(fakeService, existingDocument.id);

  assert.equal(result.id, existingDocument.id);
  assert.deepEqual(createdRuns, [
    {
      documentId: existingDocument.id,
      version: 3,
      trigger: "external_resync"
    }
  ]);
  assert.deepEqual(fetchFeedCalls, [
    {
      url: "https://example.com/feed.xml",
      maxItems: 20
    }
  ]);
  assert.deepEqual(documentUpdates, [
    {
      where: { id: existingDocument.id },
      data: {
        status: "pending",
        processingStage: "uploaded",
        chunkCount: 0,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    },
    {
      where: { id: existingDocument.id },
      data: {
        title: "Fetched feed",
        mimeType: "text/plain",
        storageKey: "generated/feed-refreshed.txt",
        status: "pending",
        processingStage: "uploaded",
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull
      }
    }
  ]);
  assert.deepEqual(enqueuedDocumentIds, [existingDocument.id]);
});

test("DocumentsService reindex recovers from config-loss feed payload when legacy identity is available", async () => {
  const documentUpdates = [];
  const createdRuns = [];
  const fetchFeedCalls = [];
  const enqueuedDocumentIds = [];

  const existingDocument = {
    id: "existing-legacy-feed-config-loss-document",
    kbId: "default-kb",
    sourceType: "feed",
    sourceName: "https://Example.com/config-loss-feed.xml#latest",
    title: "Legacy feed config-loss",
    mimeType: "text/plain",
    storageKey: "generated/feed.txt",
    sourceConfigJson: {
      kind: "feed",
      maxItems: 8
    },
    status: "ready",
    processingStage: "completed",
    version: 9,
    chunkCount: 6,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    getDocument: async documentId => {
      assert.equal(documentId, existingDocument.id);
      return existingDocument;
    },
    prisma: {
      document: {
        update: async args => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === "object" && args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version
          };
        }
      }
    },
    documentRunsService: {
      createRun: async input => {
        createdRuns.push(input);
      }
    },
    feedSourceService: {
      fetchFeed: async options => {
        fetchFeedCalls.push(options);
        return {
          title: "Recovered feed",
          content: "Recovered feed content"
        };
      }
    },
    storageService: {
      saveGeneratedTextFile: async ({ content }) => {
        assert.equal(content, "Recovered feed content");
        return {
          storageKey: "generated/feed-recovered.txt"
        };
      }
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    sitemapSourceService: {},
    webPageService: {}
  });

  const result = await DocumentsService.prototype.reindexDocument.call(fakeService, existingDocument.id);

  assert.equal(result.id, existingDocument.id);
  assert.deepEqual(createdRuns, [
    {
      documentId: existingDocument.id,
      version: 10,
      trigger: "external_resync"
    }
  ]);
  assert.deepEqual(fetchFeedCalls, [
    {
      url: "https://example.com/config-loss-feed.xml",
      maxItems: 20
    }
  ]);
  assert.deepEqual(documentUpdates, [
    {
      where: { id: existingDocument.id },
      data: {
        status: "pending",
        processingStage: "uploaded",
        chunkCount: 0,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    },
    {
      where: { id: existingDocument.id },
      data: {
        title: "Recovered feed",
        mimeType: "text/plain",
        storageKey: "generated/feed-recovered.txt",
        status: "pending",
        processingStage: "uploaded",
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull
      }
    }
  ]);
  assert.deepEqual(enqueuedDocumentIds, [existingDocument.id]);
});

test("DocumentsService reindex recovers from invalid sitemap maxPages payload via legacy identity fallback", async () => {
  const documentUpdates = [];
  const createdRuns = [];
  const fetchSitemapCalls = [];
  const enqueuedDocumentIds = [];

  const existingDocument = {
    id: "existing-legacy-sitemap-invalid-bound-document",
    kbId: "default-kb",
    sourceType: "sitemap",
    sourceName: "https://Example.com/config-loss-sitemap.xml#root",
    title: "Legacy sitemap invalid bound",
    mimeType: "text/plain",
    storageKey: "generated/sitemap.txt",
    sourceConfigJson: {
      kind: "sitemap",
      url: "https://example.com/config-loss-sitemap.xml",
      maxPages: "20"
    },
    status: "ready",
    processingStage: "completed",
    version: 11,
    chunkCount: 4,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    getDocument: async documentId => {
      assert.equal(documentId, existingDocument.id);
      return existingDocument;
    },
    prisma: {
      document: {
        update: async args => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === "object" && args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version
          };
        }
      }
    },
    documentRunsService: {
      createRun: async input => {
        createdRuns.push(input);
      }
    },
    sitemapSourceService: {
      fetchSitemap: async options => {
        fetchSitemapCalls.push(options);
        return {
          content: "Recovered sitemap content",
          diagnostics: null
        };
      }
    },
    storageService: {
      saveGeneratedTextFile: async ({ content }) => {
        assert.equal(content, "Recovered sitemap content");
        return {
          storageKey: "generated/sitemap-recovered.txt"
        };
      }
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    feedSourceService: {},
    webPageService: {}
  });

  const result = await DocumentsService.prototype.reindexDocument.call(fakeService, existingDocument.id);

  assert.equal(result.id, existingDocument.id);
  assert.deepEqual(createdRuns, [
    {
      documentId: existingDocument.id,
      version: 12,
      trigger: "external_resync"
    }
  ]);
  assert.deepEqual(fetchSitemapCalls, [
    {
      url: "https://example.com/config-loss-sitemap.xml",
      maxPages: 20
    }
  ]);
  assert.deepEqual(documentUpdates, [
    {
      where: { id: existingDocument.id },
      data: {
        status: "pending",
        processingStage: "uploaded",
        chunkCount: 0,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    },
    {
      where: { id: existingDocument.id },
      data: {
        title: "Legacy sitemap invalid bound",
        mimeType: "text/plain",
        storageKey: "generated/sitemap-recovered.txt",
        status: "pending",
        processingStage: "uploaded",
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull
      }
    }
  ]);
  assert.deepEqual(enqueuedDocumentIds, [existingDocument.id]);
});

test("DocumentsService reindex recovers legacy web-page config when sourceConfigJson is missing", async () => {
  const documentUpdates = [];
  const createdRuns = [];
  const fetchWebPageCalls = [];
  const enqueuedDocumentIds = [];

  const existingDocument = {
    id: "existing-legacy-web-document",
    kbId: "default-kb",
    sourceType: "web_page",
    sourceName: "https://example.com/legacy-page",
    title: "Legacy web page",
    mimeType: "text/plain",
    storageKey: "generated/web-page.txt",
    sourceConfigJson: Prisma.JsonNull,
    status: "ready",
    processingStage: "completed",
    version: 7,
    chunkCount: 3,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    getDocument: async documentId => {
      assert.equal(documentId, existingDocument.id);
      return existingDocument;
    },
    prisma: {
      document: {
        update: async args => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === "object" && args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version
          };
        }
      }
    },
    documentRunsService: {
      createRun: async input => {
        createdRuns.push(input);
      }
    },
    webPageService: {
      fetchWebPage: async url => {
        fetchWebPageCalls.push(url);
        return {
          title: "Fetched legacy page",
          content: "Updated legacy page content"
        };
      }
    },
    storageService: {
      saveGeneratedTextFile: async ({ content }) => {
        assert.equal(content, "Updated legacy page content");
        return {
          storageKey: "generated/web-page-refreshed.txt"
        };
      }
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    feedSourceService: {},
    sitemapSourceService: {}
  });

  const result = await DocumentsService.prototype.reindexDocument.call(fakeService, existingDocument.id);

  assert.equal(result.id, existingDocument.id);
  assert.deepEqual(createdRuns, [
    {
      documentId: existingDocument.id,
      version: 8,
      trigger: "external_resync"
    }
  ]);
  assert.deepEqual(fetchWebPageCalls, ["https://example.com/legacy-page"]);
  assert.deepEqual(documentUpdates, [
    {
      where: { id: existingDocument.id },
      data: {
        status: "pending",
        processingStage: "uploaded",
        chunkCount: 0,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    },
    {
      where: { id: existingDocument.id },
      data: {
        title: "Fetched legacy page",
        mimeType: "text/plain",
        storageKey: "generated/web-page-refreshed.txt",
        status: "pending",
        processingStage: "uploaded",
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull
      }
    }
  ]);
  assert.deepEqual(enqueuedDocumentIds, [existingDocument.id]);
});

test("DocumentsService reindex preserves an existing sitemap title when the resynced source has no title", async () => {
  const documentUpdates = [];
  const createdRuns = [];
  const enqueuedDocumentIds = [];

  const existingDocument = {
    id: "existing-sitemap-document",
    kbId: "default-kb",
    sourceType: "sitemap",
    sourceName: "https://example.com/sitemap.xml",
    title: "Curated sitemap title",
    mimeType: "text/plain",
    storageKey: "generated/sitemap.txt",
    sourceConfigJson: {
      kind: "sitemap",
      url: "https://example.com/sitemap.xml",
      maxPages: 10
    },
    status: "ready",
    processingStage: "completed",
    version: 4,
    chunkCount: 3,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    getDocument: async documentId => {
      assert.equal(documentId, existingDocument.id);
      return existingDocument;
    },
    prisma: {
      document: {
        update: async args => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === "object" && args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version
          };
        }
      }
    },
    documentRunsService: {
      createRun: async input => {
        createdRuns.push(input);
      }
    },
    sitemapSourceService: {
      fetchSitemap: async options => {
        assert.deepEqual(options, {
          url: "https://example.com/sitemap.xml",
          maxPages: 10
        });
        return {
          content: "Updated sitemap content",
          diagnostics: null
        };
      }
    },
    storageService: {
      saveGeneratedTextFile: async ({ content }) => {
        assert.equal(content, "Updated sitemap content");
        return {
          storageKey: "generated/sitemap-refreshed.txt"
        };
      }
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    feedSourceService: {},
    webPageService: {}
  });

  const result = await DocumentsService.prototype.reindexDocument.call(fakeService, existingDocument.id);

  assert.equal(result.id, existingDocument.id);
  assert.deepEqual(createdRuns, [
    {
      documentId: existingDocument.id,
      version: 5,
      trigger: "external_resync"
    }
  ]);
  assert.deepEqual(documentUpdates, [
    {
      where: { id: existingDocument.id },
      data: {
        status: "pending",
        processingStage: "uploaded",
        chunkCount: 0,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    },
    {
      where: { id: existingDocument.id },
      data: {
        title: "Curated sitemap title",
        mimeType: "text/plain",
        storageKey: "generated/sitemap-refreshed.txt",
        status: "pending",
        processingStage: "uploaded",
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull
      }
    }
  ]);
  assert.deepEqual(enqueuedDocumentIds, [existingDocument.id]);
});

test("DocumentsService preserves an existing sitemap title when the same URL is ingested again without a new title", async () => {
  const enqueuedDocumentIds = [];
  const documentCreates = [];
  const documentUpdates = [];

  const existingDocument = {
    id: "existing-sitemap-curated-document",
    kbId: "default-kb",
    sourceType: "sitemap",
    sourceName: "https://example.com/sitemap.xml",
    title: "Curated sitemap title",
    mimeType: "text/plain",
    storageKey: "generated/sitemap.txt",
    status: "ready",
    processingStage: "completed",
    version: 3,
    chunkCount: 4,
    errorMessage: null
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    prisma: {
      document: {
        findFirst: async ({ where }) => {
          assert.deepEqual(where, {
            kbId: "default-kb",
            sourceType: "sitemap",
            sourceName: "https://example.com/sitemap.xml"
          });
          return existingDocument;
        },
        create: async args => {
          documentCreates.push(args);
          return { id: "new-sitemap-document" };
        },
        update: async args => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data
          };
        }
      }
    },
    knowledgeBasesService: {
      getKnowledgeBase: async knowledgeBaseId => {
        assert.equal(knowledgeBaseId, "default-kb");
        return { id: knowledgeBaseId };
      }
    },
    storageService: {
      saveGeneratedTextFile: async ({ content }) => {
        assert.equal(content, "Sitemap content");
        return {
          storageKey: "generated/sitemap-refreshed.txt"
        };
      }
    },
    sitemapSourceService: {
      fetchSitemap: async options => {
        assert.deepEqual(options, {
          url: "https://example.com/sitemap.xml",
          maxPages: 10
        });
        return {
          content: "Sitemap content"
        };
      }
    },
    documentRunsService: {
      createRun: async () => {}
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    },
    feedSourceService: {},
    webPageService: {}
  });

  const result = await DocumentsService.prototype.createSitemapDocument.call(fakeService, "default-kb", {
    url: "https://Example.com/sitemap.xml#root",
    maxPages: 10
  });

  assert.equal(result.id, existingDocument.id);
  assert.equal(documentCreates.length, 0);
  assert.equal(documentUpdates.length, 2);
  assert.deepEqual(documentUpdates[0], {
    where: {
      id: existingDocument.id
    },
    data: {
      sourceName: "https://example.com/sitemap.xml",
      title: "Curated sitemap title",
      sourceConfigJson: {
        kind: "sitemap",
        url: "https://example.com/sitemap.xml",
        maxPages: 10
      },
      status: "pending",
      processingStage: "uploaded",
      chunkCount: 0,
      errorMessage: null,
      diagnosticsJson: Prisma.JsonNull,
      version: {
        increment: 1
      }
    }
  });
  assert.deepEqual(documentUpdates[1], {
    where: {
      id: existingDocument.id
    },
    data: {
      title: "Curated sitemap title",
      mimeType: "text/plain",
      storageKey: "generated/sitemap-refreshed.txt",
      status: "pending",
      processingStage: "uploaded",
      errorMessage: null,
      diagnosticsJson: Prisma.JsonNull
    }
  });
  assert.deepEqual(enqueuedDocumentIds, [existingDocument.id]);
});

async function expectExternalSourceResync({ sourceType, methodName, input, expectedSourceName, fetchResult }) {
  const enqueuedDocumentIds = [];
  const documentCreates = [];
  const documentUpdates = [];

  const existingDocument = {
    id: `existing-${sourceType}-document`,
    kbId: "default-kb",
    sourceType,
    sourceName: expectedSourceName,
    title: `Existing ${sourceType}`,
    mimeType: "text/plain",
    storageKey: `generated/${sourceType}.txt`,
    status: "ready",
    processingStage: "completed",
    version: 3,
    chunkCount: 4,
    errorMessage: "old error"
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    prisma: {
      document: {
        findFirst: async ({ where }) => {
          assert.deepEqual(where, {
            kbId: "default-kb",
            sourceType,
            sourceName: expectedSourceName
          });
          return existingDocument;
        },
        create: async args => {
          documentCreates.push(args);
          return { id: `new-${sourceType}-document` };
        },
        update: async args => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data
          };
        }
      }
    },
    knowledgeBasesService: {
      getKnowledgeBase: async knowledgeBaseId => {
        assert.equal(knowledgeBaseId, "default-kb");
        return { id: knowledgeBaseId };
      }
    },
    storageService: {
      saveGeneratedTextFile: async ({ content }) => {
        assert.equal(content, fetchResult.content);
        return {
          storageKey: `generated/${sourceType}-refreshed.txt`
        };
      }
    },
    webPageService: {
      fetchWebPage: async url => {
        assert.equal(url, expectedSourceName);
        return fetchResult;
      }
    },
    feedSourceService: {
      fetchFeed: async options => {
        assert.deepEqual(options, {
          url: expectedSourceName,
          maxItems: input.maxItems
        });
        return fetchResult;
      }
    },
    sitemapSourceService: {
      fetchSitemap: async options => {
        assert.deepEqual(options, {
          url: expectedSourceName,
          maxPages: input.maxPages
        });
        return fetchResult;
      }
    },
    documentRunsService: {
      createRun: async () => {}
    },
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    }
  });

  const result = await DocumentsService.prototype[methodName].call(fakeService, "default-kb", input);

  assert.equal(result.id, existingDocument.id);
  assert.equal(documentCreates.length, 0);
  assert.equal(documentUpdates.length, 2);
  assert.deepEqual(documentUpdates[0], {
    where: {
      id: existingDocument.id
    },
    data: {
      sourceName: expectedSourceName,
      title: input.title ?? existingDocument.title ?? buildRemoteSourceFallbackTitle(expectedSourceName),
      sourceConfigJson:
        sourceType === "web_page"
          ? {
              kind: "web_page",
              url: expectedSourceName
            }
          : sourceType === "feed"
            ? {
                kind: "feed",
                url: expectedSourceName,
                maxItems: input.maxItems
              }
            : {
                kind: "sitemap",
                url: expectedSourceName,
                maxPages: input.maxPages
              },
      status: "pending",
      processingStage: "uploaded",
      chunkCount: 0,
      errorMessage: null,
      diagnosticsJson: Prisma.JsonNull,
      version: {
        increment: 1
      }
    }
  });
  assert.deepEqual(documentUpdates[1], {
    where: {
      id: existingDocument.id
    },
    data: {
      title:
        input.title ??
        fetchResult.title ??
        existingDocument.title ??
        buildRemoteSourceFallbackTitle(expectedSourceName),
      mimeType: "text/plain",
      storageKey: `generated/${sourceType}-refreshed.txt`,
      status: "pending",
      processingStage: "uploaded",
      errorMessage: null,
      diagnosticsJson: Prisma.JsonNull,
    }
  });
  assert.deepEqual(enqueuedDocumentIds, [existingDocument.id]);
}

function buildRemoteSourceFallbackTitle(url) {
  const parsed = new URL(url);
  const path = `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  return path.slice(0, 255);
}

async function withMockedFetch(handlers, callback) {
  const originalFetch = global.fetch;
  let index = 0;

  global.fetch = async (...args) => {
    const handler = handlers[index];
    index += 1;

    if (handler === undefined) {
      throw new Error(`Unexpected fetch call ${index} for ${args[0]}`);
    }

    if (typeof handler === "function") {
      return handler(...args);
    }

    return handler;
  };

  try {
    return await callback();
  } finally {
    global.fetch = originalFetch;
  }
}
