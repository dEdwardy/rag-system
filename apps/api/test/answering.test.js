const test = require("node:test");
const assert = require("node:assert/strict");
const { AnsweringService } = require("../dist/modules/answering/answering.service.js");

test("AnsweringService returns only cited citations when the model cites sources", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Answer text [2]",
      modelName: "test-model",
      answerStatus: "grounded",
      missingInformation: [],
      citedChunkNumbers: [2]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "where?",
    systemPrompt: "answer",
    chunks: [
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        documentTitle: "Doc 1",
        chunkIndex: 0,
        content: "first chunk",
        score: 0.4,
        pageNo: null,
        sectionTitle: "A"
      },
      {
        chunkId: "chunk-2",
        documentId: "doc-1",
        documentTitle: "Doc 1",
        chunkIndex: 1,
        content: "second chunk with answer",
        score: 0.9,
        pageNo: null,
        sectionTitle: "B"
      }
    ]
  });

  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0].chunkId, "chunk-2");
  assert.match(result.citations[0].snippet, /second chunk/);
  assert.equal(result.answerStatus, "grounded");
  assert.deepEqual(result.missingInformation, []);
});

test("AnsweringService preserves structured answer metadata and enforces max citations", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Structured answer",
      modelName: "test-model",
      answerStatus: "grounded",
      missingInformation: [],
      citedChunkNumbers: [2, 1]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "where?",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "concise",
      citationMode: "required",
      maxCitations: 1,
      noAnswerBehavior: "say_insufficient_context"
    },
    chunks: [
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        documentTitle: "Doc 1",
        chunkIndex: 0,
        content: "first chunk with answer",
        score: 0.4,
        pageNo: null,
        sectionTitle: "A"
      },
      {
        chunkId: "chunk-2",
        documentId: "doc-1",
        documentTitle: "Doc 1",
        chunkIndex: 1,
        content: "second chunk with better answer",
        score: 0.9,
        pageNo: null,
        sectionTitle: "B"
      }
    ]
  });

  assert.equal(result.answer, "Structured answer");
  assert.equal(result.answerStatus, "grounded");
  assert.deepEqual(result.missingInformation, []);
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0].chunkId, "chunk-2");
});

test("AnsweringService falls back to default structured metadata when the model only returns plain text", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Fallback answer [1]",
      modelName: "test-model",
      citedChunkNumbers: [1]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "where?",
    systemPrompt: "answer",
    chunks: [
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        documentTitle: "Doc 1",
        chunkIndex: 0,
        content: "first chunk with answer",
        score: 0.9,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.equal(result.answer, "Fallback answer [1]");
  assert.equal(result.answerStatus, "grounded");
  assert.deepEqual(result.missingInformation, []);
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0].chunkId, "chunk-1");
});

test("AnsweringService prefers merged contextGroups content when calling the model", async () => {
  const llmCalls = [];
  const llmService = {
    generateAnswer: async input => {
      llmCalls.push(input);
      return {
        answer: "Grouped answer [1]",
        modelName: "test-model",
        citedChunkNumbers: [1]
      };
    }
  };

  const service = new AnsweringService(llmService);
  const chunks = [
    {
      chunkId: "chunk-1",
      documentId: "doc-1",
      documentTitle: "Doc 1",
      chunkIndex: 0,
      content: "first chunk",
      score: 0.9,
      pageNo: null,
      sectionTitle: "A"
    },
    {
      chunkId: "chunk-2",
      documentId: "doc-1",
      documentTitle: "Doc 1",
      chunkIndex: 1,
      content: "second chunk",
      score: 0.8,
      pageNo: null,
      sectionTitle: "B"
    }
  ];
  const contextGroups = [
    {
      documentId: "doc-1",
      documentTitle: "Doc 1",
      startChunkIndex: 0,
      endChunkIndex: 1,
      chunkIds: ["chunk-1", "chunk-2"],
      primaryChunkIds: ["chunk-1"],
      mergedContent: "first chunk\n\nsecond chunk",
      pageNumbers: [],
      sectionTitles: ["A", "B"]
    }
  ];

  await service.generateAnswer({
    question: "where?",
    systemPrompt: "answer",
    chunks,
    contextGroups
  });

  assert.equal(llmCalls.length, 1);
  assert.deepEqual(llmCalls[0].chunks, [
    {
      chunkId: "chunk-1",
      documentId: "doc-1",
      documentTitle: "Doc 1",
      content: "first chunk\n\nsecond chunk",
      score: 0.9,
      pageNo: null,
      sectionTitle: "A / B"
    }
  ]);
});
