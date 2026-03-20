const test = require("node:test");
const assert = require("node:assert/strict");
const { IngestionService } = require("../dist/modules/ingestion/ingestion.service.js");

test("IngestionService processes a document through parsing, chunking, indexing, and ready status", async () => {
  const documentUpdates = [];
  const deletedChunks = [];
  const createdChunkBatches = [];
  const indexingCalls = [];

  const prisma = {
    document: {
      findUnique: async () => ({
        id: "document-1",
        kbId: "kb-1",
        sourceName: "guide.md",
        mimeType: "text/markdown",
        storageKey: "documents/document-1.md"
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

  const fakeService = {
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
    }
  };

  await IngestionService.prototype.processDocument.call(fakeService, {
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
  assert.deepEqual(documentUpdates, [
    {
      status: "processing",
      processingStage: "parsing",
      errorMessage: null
    },
    {
      processingStage: "indexing"
    },
    {
      status: "ready",
      processingStage: "completed",
      chunkCount: 2,
      errorMessage: null
    }
  ]);
});

test("IngestionService marks the document as failed when indexing throws", async () => {
  const documentUpdates = [];

  const prisma = {
    document: {
      findUnique: async () => ({
        id: "document-2",
        kbId: "kb-1",
        sourceName: "guide.md",
        mimeType: "text/markdown",
        storageKey: "documents/document-2.md"
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

  const fakeService = {
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
    }
  };

  await assert.rejects(
    IngestionService.prototype.processDocument.call(fakeService, {
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
      errorMessage: null
    },
    {
      processingStage: "indexing"
    },
    {
      status: "failed",
      processingStage: "failed",
      errorMessage: "synthetic indexing failure"
    }
  ]);
});

test("IngestionService processes a DOCX document through parsing, chunking, indexing, and ready status", async () => {
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

  const fakeService = {
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
    }
  };

  await IngestionService.prototype.processDocument.call(fakeService, {
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
      errorMessage: null
    },
    {
      processingStage: "indexing"
    },
    {
      status: "ready",
      processingStage: "completed",
      chunkCount: 2,
      errorMessage: null
    }
  ]);
});
