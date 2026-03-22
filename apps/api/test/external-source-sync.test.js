const test = require("node:test");
const assert = require("node:assert/strict");
const { Prisma } = require("@prisma/client");
const { DocumentsService } = require("../dist/modules/documents/documents.service.js");

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
    ingestionService: {
      enqueueDocument: async documentId => {
        enqueuedDocumentIds.push(documentId);
      }
    }
  });

  const result = await DocumentsService.prototype[methodName].call(fakeService, "default-kb", input);

  assert.equal(result.id, existingDocument.id);
  assert.equal(documentCreates.length, 0);
  assert.equal(documentUpdates.length, 1);
  assert.deepEqual(documentUpdates[0], {
    where: {
      id: existingDocument.id
    },
    data: {
      sourceName: expectedSourceName,
      title: input.title ?? fetchResult.title ?? buildRemoteSourceFallbackTitle(expectedSourceName),
      mimeType: "text/plain",
      storageKey: `generated/${sourceType}-refreshed.txt`,
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
  assert.deepEqual(enqueuedDocumentIds, [existingDocument.id]);
}

function buildRemoteSourceFallbackTitle(url) {
  const parsed = new URL(url);
  const path = `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  return path.slice(0, 255);
}
