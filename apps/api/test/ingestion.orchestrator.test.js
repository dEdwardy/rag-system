const assert = require("node:assert/strict");
const { Prisma } = require("@prisma/client");
const { DocumentIngestionProcessor } = require("../src/modules/ingestion/document-ingestion.processor.ts");
const { IngestionService } = require("../src/modules/ingestion/ingestion.service.ts");

test("DocumentIngestionProcessor processes a document through parsing, chunking, indexing, and ready status", async () => {
  const documentUpdates = [];
  const deletedChunks = [];
  const createdChunkBatches = [];
  const indexingCalls = [];
  const processingRuns = [];
  const completedRuns = [];

  const prisma = {
    document: {
      findUnique: async () => ({
        id: "document-1",
        kbId: "kb-1",
        sourceName: "guide.md",
        mimeType: "text/markdown",
        storageKey: "documents/document-1.md",
        version: 1
      }),
      update: async ({ data }) => {
        documentUpdates.push(data);
        return data;
      }
    },
    documentChunk: {
      deleteMany: async args => {
        deletedChunks.push(args);
        return { count: 1 };
      },
      createMany: async args => {
        createdChunkBatches.push(args.data);
        return { count: args.data.length };
      }
    }
  };

  const fakeProcessor = Object.assign(Object.create(DocumentIngestionProcessor.prototype), {
    prisma,
    storageService: {
      readFileByStorageKey: async storageKey => {
        assert.equal(storageKey, "documents/document-1.md");
        return Buffer.from("# Guide\n\nAlpha\n\nBeta");
      }
    },
    parsingService: {
      parseDocument: async input => {
        assert.equal(input.sourceName, "guide.md");
        assert.equal(input.mimeType, "text/markdown");
        return "# Guide\n\nAlpha\n\nBeta";
      }
    },
    chunkingService: {
      buildChunks: content => {
        assert.equal(content, "# Guide\n\nAlpha\n\nBeta");
        return [
          { content: "Alpha", sectionTitle: "Guide" },
          { content: "Beta", sectionTitle: "Guide" }
        ];
      }
    },
    indexingService: {
      indexDocument: async documentId => {
        indexingCalls.push(documentId);
      }
    },
    documentRunsService: {
      markRunProcessing: async (documentId, version) => {
        processingRuns.push({ documentId, version });
      },
      markRunCompleted: async (documentId, version) => {
        completedRuns.push({ documentId, version });
      }
    }
  });

  await DocumentIngestionProcessor.prototype.processDocument.call(fakeProcessor, {
    data: {
      documentId: "document-1"
    }
  });

  assert.deepEqual(deletedChunks, [
    {
      where: {
        documentId: "document-1"
      }
    }
  ]);
  assert.equal(createdChunkBatches.length, 1);
  assert.deepEqual(
    createdChunkBatches[0].map(chunk => ({
      documentId: chunk.documentId,
      kbId: chunk.kbId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      sectionTitle: chunk.sectionTitle
    })),
    [
      {
        documentId: "document-1",
        kbId: "kb-1",
        chunkIndex: 0,
        content: "Alpha",
        sectionTitle: "Guide"
      },
      {
        documentId: "document-1",
        kbId: "kb-1",
        chunkIndex: 1,
        content: "Beta",
        sectionTitle: "Guide"
      }
    ]
  );
  assert.deepEqual(indexingCalls, ["document-1"]);
  assert.deepEqual(processingRuns, [
    {
      documentId: "document-1",
      version: 1
    }
  ]);
  assert.deepEqual(completedRuns, [
    {
      documentId: "document-1",
      version: 1
    }
  ]);
  assert.deepEqual(documentUpdates, [
    {
      status: "processing",
      processingStage: "parsing",
      errorMessage: null,
      diagnosticsJson: Prisma.JsonNull
    },
    {
      processingStage: "chunking"
    },
    {
      processingStage: "indexing"
    },
    {
      status: "ready",
      processingStage: "completed",
      chunkCount: 2,
      errorMessage: null,
      diagnosticsJson: Prisma.JsonNull
    }
  ]);
});

test("DocumentIngestionProcessor marks the document as failed when indexing throws", async () => {
  const documentUpdates = [];

  const prisma = {
    document: {
      findUnique: async () => ({
        id: "document-2",
        kbId: "kb-1",
        sourceName: "guide.md",
        mimeType: "text/markdown",
        storageKey: "documents/document-2.md",
        version: 1
      }),
      update: async ({ data }) => {
        documentUpdates.push(data);
        return data;
      }
    },
    documentChunk: {
      deleteMany: async () => ({ count: 0 }),
      createMany: async () => ({ count: 1 })
    }
  };

  const fakeProcessor = Object.assign(Object.create(DocumentIngestionProcessor.prototype), {
    prisma,
    storageService: {
      readFileByStorageKey: async () => Buffer.from("# Guide\n\nAlpha")
    },
    parsingService: {
      parseDocument: async () => "# Guide\n\nAlpha"
    },
    chunkingService: {
      buildChunks: () => [{ content: "Alpha", sectionTitle: "Guide" }]
    },
    indexingService: {
      indexDocument: async () => {
        throw new Error("synthetic indexing failure");
      }
    },
    documentRunsService: {
      markRunProcessing: async () => {},
      markRunFailed: async () => {}
    }
  });

  await assert.rejects(
    DocumentIngestionProcessor.prototype.processDocument.call(fakeProcessor, {
      data: {
        documentId: "document-2"
      }
    }),
    /synthetic indexing failure/
  );

  assert.deepEqual(documentUpdates, [
    {
      status: "processing",
      processingStage: "parsing",
      errorMessage: null,
      diagnosticsJson: Prisma.JsonNull
    },
    {
      processingStage: "chunking"
    },
    {
      processingStage: "indexing"
    },
    {
      status: "failed",
      processingStage: "failed",
      errorMessage: "synthetic indexing failure",
      diagnosticsJson: {
        code: "INGESTION_INDEXING_FAILED",
        failedStage: "indexing",
        retryable: true,
        documentVersion: 1,
        message: "synthetic indexing failure"
      }
    }
  ]);
});

test("DocumentIngestionProcessor processes a DOCX document through parsing, chunking, indexing, and ready status", async () => {
  const documentUpdates = [];
  const deletedChunks = [];
  const createdChunkBatches = [];
  const indexingCalls = [];

  const prisma = {
    document: {
      findUnique: async () => ({
        id: "document-docx-1",
        kbId: "kb-1",
        sourceName: "guide.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        storageKey: "documents/document-docx-1.docx"
      }),
      update: async ({ data }) => {
        documentUpdates.push(data);
        return data;
      }
    },
    documentChunk: {
      deleteMany: async args => {
        deletedChunks.push(args);
        return { count: 0 };
      },
      createMany: async args => {
        createdChunkBatches.push(args.data);
        return { count: args.data.length };
      }
    }
  };

  const fakeProcessor = Object.assign(Object.create(DocumentIngestionProcessor.prototype), {
    prisma,
    storageService: {
      readFileByStorageKey: async storageKey => {
        assert.equal(storageKey, "documents/document-docx-1.docx");
        return Buffer.from("synthetic-docx-buffer");
      }
    },
    parsingService: {
      parseDocument: async input => {
        assert.equal(input.sourceName, "guide.docx");
        assert.equal(
          input.mimeType,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        return "DOCX Sample Title\n\nAlpha\n\nBeta";
      }
    },
    chunkingService: {
      buildChunks: content => {
        assert.equal(content, "DOCX Sample Title\n\nAlpha\n\nBeta");
        return [
          { content: "Alpha", sectionTitle: "DOCX Sample Title" },
          { content: "Beta", sectionTitle: "DOCX Sample Title" }
        ];
      }
    },
    indexingService: {
      indexDocument: async documentId => {
        indexingCalls.push(documentId);
      }
    },
    documentRunsService: {
      markRunProcessing: async () => {},
      markRunCompleted: async () => {}
    }
  });

  await DocumentIngestionProcessor.prototype.processDocument.call(fakeProcessor, {
    data: {
      documentId: "document-docx-1"
    }
  });

  assert.deepEqual(deletedChunks, [
    {
      where: {
        documentId: "document-docx-1"
      }
    }
  ]);
  assert.equal(createdChunkBatches.length, 1);
  assert.deepEqual(
    createdChunkBatches[0].map(chunk => ({
      documentId: chunk.documentId,
      kbId: chunk.kbId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      sectionTitle: chunk.sectionTitle
    })),
    [
      {
        documentId: "document-docx-1",
        kbId: "kb-1",
        chunkIndex: 0,
        content: "Alpha",
        sectionTitle: "DOCX Sample Title"
      },
      {
        documentId: "document-docx-1",
        kbId: "kb-1",
        chunkIndex: 1,
        content: "Beta",
        sectionTitle: "DOCX Sample Title"
      }
    ]
  );
  assert.deepEqual(indexingCalls, ["document-docx-1"]);
  assert.deepEqual(documentUpdates, [
    {
      status: "processing",
      processingStage: "parsing",
      errorMessage: null,
      diagnosticsJson: Prisma.JsonNull
    },
    {
      processingStage: "chunking"
    },
    {
      processingStage: "indexing"
    },
    {
      status: "ready",
      processingStage: "completed",
      chunkCount: 2,
      errorMessage: null,
      diagnosticsJson: Prisma.JsonNull
    }
  ]);
});

test("DocumentIngestionProcessor records parsing diagnostics for unsupported file types", async () => {
  const documentUpdates = [];

  const fakeProcessor = Object.assign(Object.create(DocumentIngestionProcessor.prototype), {
    logger: {
      warn: () => {}
    },
    prisma: {
      document: {
        findUnique: async () => ({
          id: "document-unsupported-1",
          kbId: "kb-1",
          sourceName: "archive.bin",
          mimeType: "application/octet-stream",
          storageKey: "documents/archive.bin",
          version: 4
        }),
        update: async ({ data }) => {
          documentUpdates.push(data);
          return data;
        }
      },
      documentChunk: {
        deleteMany: async () => ({ count: 0 }),
        createMany: async () => ({ count: 0 })
      }
    },
    storageService: {
      readFileByStorageKey: async () => Buffer.from("raw-binary")
    },
    parsingService: {
      parseDocument: async () => {
        throw new Error("Unsupported file type for ingestion: archive.bin (application/octet-stream).");
      }
    },
    chunkingService: {
      buildChunks: () => []
    },
    indexingService: {
      indexDocument: async () => {}
    },
    documentRunsService: {
      markRunProcessing: async () => {},
      markRunFailed: async () => {}
    }
  });

  await assert.rejects(
    DocumentIngestionProcessor.prototype.processDocument.call(fakeProcessor, {
      data: {
        documentId: "document-unsupported-1",
        documentVersion: 4
      }
    }),
    /Unsupported file type/
  );

  assert.deepEqual(documentUpdates, [
    {
      status: "processing",
      processingStage: "parsing",
      errorMessage: null,
      diagnosticsJson: Prisma.JsonNull
    },
    {
      status: "failed",
      processingStage: "failed",
      errorMessage: "Unsupported file type for ingestion: archive.bin (application/octet-stream).",
      diagnosticsJson: {
        code: "INGESTION_UNSUPPORTED_FILE_TYPE",
        failedStage: "parsing",
        retryable: false,
        documentVersion: 4,
        message: "Unsupported file type for ingestion: archive.bin (application/octet-stream)."
      }
    }
  ]);
});

test("DocumentIngestionProcessor skips a stale ingestion job when the document version has moved on", async () => {
  const documentUpdates = [];
  const deletedChunks = [];
  const createdChunkBatches = [];
  const indexingCalls = [];
  const parsingCalls = [];
  const storageReads = [];
  const skippedRuns = [];

  const fakeProcessor = Object.assign(Object.create(DocumentIngestionProcessor.prototype), {
    logger: {
      warn: () => {}
    },
    prisma: {
      document: {
        findUnique: async () => ({
          id: "document-stale-1",
          kbId: "kb-1",
          sourceName: "guide.md",
          mimeType: "text/markdown",
          storageKey: "documents/document-stale-1.md",
          version: 3
        }),
        update: async ({ data }) => {
          documentUpdates.push(data);
          return data;
        }
      },
      documentChunk: {
        deleteMany: async args => {
          deletedChunks.push(args);
          return { count: 0 };
        },
        createMany: async args => {
          createdChunkBatches.push(args.data);
          return { count: args.data.length };
        }
      }
    },
    storageService: {
      readFileByStorageKey: async storageKey => {
        storageReads.push(storageKey);
        return Buffer.from("# Guide\n\nAlpha");
      }
    },
    parsingService: {
      parseDocument: async input => {
        parsingCalls.push(input);
        return "# Guide\n\nAlpha";
      }
    },
    chunkingService: {
      buildChunks: () => [{ content: "Alpha", sectionTitle: "Guide" }]
    },
    indexingService: {
      indexDocument: async documentId => {
        indexingCalls.push(documentId);
      }
    },
    documentRunsService: {
      markRunSkipped: async (documentId, version, input) => {
        skippedRuns.push({ documentId, version, ...input });
      }
    }
  });

  await DocumentIngestionProcessor.prototype.processDocument.call(fakeProcessor, {
    data: {
      documentId: "document-stale-1",
      documentVersion: 2
    }
  });

  assert.deepEqual(documentUpdates, []);
  assert.deepEqual(deletedChunks, []);
  assert.deepEqual(createdChunkBatches, []);
  assert.deepEqual(indexingCalls, []);
  assert.deepEqual(parsingCalls, []);
  assert.deepEqual(storageReads, []);
  assert.deepEqual(skippedRuns, [
    {
      documentId: "document-stale-1",
      version: 2,
      failedStage: "stale_guard",
      diagnosticsJson: {
        code: "INGESTION_RUN_SUPERSEDED",
        failedStage: "stale_guard",
        retryable: false,
        documentVersion: 2,
        message: "Skipped stale ingestion job because a newer document version is already active.",
        currentDocumentVersion: 3
      }
    }
  ]);
});

test("IngestionService can disable worker startup while preserving queue producer behavior", async () => {
  const queuedJobs = [];
  let connectionQuitCalls = 0;

  const fakeService = Object.assign(Object.create(IngestionService.prototype), {
    logger: {
      log: () => {}
    },
    queueService: {
      addDocumentIngestionJob: async (documentId, documentVersion) => {
        queuedJobs.push({ documentId, documentVersion });
      }
    },
    queueRuntimeConfigService: {
      getConfig: () => ({
        enableDocumentIngestionWorker: false
      })
    },
    connection: {
      quit: async () => {
        connectionQuitCalls += 1;
      }
    },
    documentIngestionProcessor: {
      processDocument: async () => {
        throw new Error("worker should not process jobs when disabled");
      }
    }
  });

  await IngestionService.prototype.enqueueDocument.call(fakeService, "document-disabled-1", 7);
  IngestionService.prototype.onModuleInit.call(fakeService);
  await IngestionService.prototype.onModuleDestroy.call(fakeService);

  assert.deepEqual(queuedJobs, [
    {
      documentId: "document-disabled-1",
      documentVersion: 7
    }
  ]);
  assert.equal(fakeService.worker, undefined);
  assert.equal(connectionQuitCalls, 1);
});
