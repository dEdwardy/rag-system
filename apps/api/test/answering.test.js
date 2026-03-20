const test = require("node:test");
const assert = require("node:assert/strict");
const { AnsweringService } = require("../dist/modules/answering/answering.service.js");

test("AnsweringService returns only cited citations when the model cites sources", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Answer text [2]",
      modelName: "test-model",
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
});
