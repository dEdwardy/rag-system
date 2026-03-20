const test = require("node:test");
const assert = require("node:assert/strict");
const { AskAssistantService } = require("../dist/modules/assistants/ask-assistant.service.js");

test("AskAssistantService marks trace as failed when answer generation throws", async () => {
  const traceUpdates = [];
  const assistantsService = {
    getAssistant: async () => ({
      id: "assistant-1",
      tenantId: "tenant-1",
      kbId: "kb-1",
      systemPrompt: "system prompt",
      retrievalProfile: {
        topK: 3,
        scoreThreshold: 0,
        chunkWindow: 0,
        enableHybrid: false,
        enableRerank: false
      }
    })
  };
  const conversationsService = {
    createConversation: async () => ({
      id: "conversation-1"
    }),
    getConversation: async () => ({
      id: "conversation-1"
    }),
    touchConversation: async () => ({})
  };
  const messagesService = {
    createMessage: async input => ({
      id: input.role === "user" ? "user-message-1" : "assistant-message-1",
      ...input
    }),
    attachTrace: async () => ({})
  };
  const retrievalService = {
    retrieve: async () => [
      {
        chunkId: "chunk-1",
        documentId: "document-1",
        documentTitle: "Document 1",
        chunkIndex: 0,
        content: "retrieved content",
        score: 0.9,
        isPrimary: true,
        pageNo: null,
        sectionTitle: null
      }
    ]
  };
  const answeringService = {
    generateAnswer: async () => {
      throw new Error("synthetic answer failure");
    }
  };
  const tracesService = {
    createTrace: async () => ({
      id: "trace-1"
    }),
    updateTrace: async (id, input) => {
      traceUpdates.push({ id, input });
      return { id, ...input };
    }
  };
  const llmService = {
    rewriteQuery: async ({ question }) => ({
      rewrittenQuery: question,
      modelName: "fallback-rewrite-local",
      usedFallback: true
    })
  };

  const service = new AskAssistantService(
    assistantsService,
    conversationsService,
    messagesService,
    retrievalService,
    answeringService,
    tracesService,
    llmService
  );

  await assert.rejects(
    service.askAssistant({
      assistantId: "assistant-1",
      question: "why did this fail?"
    }),
    error => {
      assert.equal(typeof error?.getStatus, "function");
      assert.equal(error.getStatus(), 502);

      const response = error.getResponse();
      assert.equal(response.statusCode, 502);
      assert.equal(response.error, "Bad Gateway");
      assert.equal(response.message, "Ask pipeline failed.");
      assert.equal(response.code, "ASK_PIPELINE_FAILED");
      assert.equal(response.traceId, "trace-1");
      assert.deepEqual(response.details, {
        stage: "answering",
        cause: "synthetic answer failure"
      });
      return true;
    }
  );

  assert.equal(traceUpdates.length, 1);
  assert.equal(traceUpdates[0].id, "trace-1");
  assert.equal(traceUpdates[0].input.status, "failed");
  assert.equal(traceUpdates[0].input.errorMessage, "synthetic answer failure");
});
