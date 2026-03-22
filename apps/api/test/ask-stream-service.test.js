const test = require("node:test");
const assert = require("node:assert/strict");

const { AskAssistantService } = require("../dist/modules/assistants/ask-assistant.service.js");

test("AskAssistantService exposes a dedicated stream orchestration path with progress, deltas, and final payload", async () => {
  const events = [];

  const service = new AskAssistantService(
    {
      getAssistant: async assistantId => ({
        id: assistantId,
        tenantId: "tenant-1",
        kbId: "kb-1",
        systemPrompt: "system prompt",
        answerPolicyJson: null,
        retrievalProfile: {
          topK: 4,
          scoreThreshold: 0,
          chunkWindow: 0,
          enableHybrid: false,
          enableRerank: false,
          filtersJson: null,
          strategyJson: null
        }
      })
    },
    {
      createConversation: async () => ({ id: "conversation-1" }),
      getConversation: async () => ({ id: "conversation-1" }),
      touchConversation: async () => {}
    },
    {
      createMessage: async input => ({
        id: input.role === "user" ? "user-message-1" : "assistant-message-1",
        ...input
      }),
      attachTrace: async () => {}
    },
    {
      retrieve: async () => ({
        retrievedChunks: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            chunkIndex: 0,
            content: "marker content",
            score: 0.9,
            isPrimary: true,
            pageNo: 1,
            sectionTitle: "Facts"
          }
        ],
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    {
      buildStreamAnswerContext: ({ chunks }) => chunks,
      generateAnswer: async () => {
        throw new Error("one-shot generateAnswer should not be used by native streaming");
      },
      finalizeStreamedAnswer: async input => ({
        answer: input.rawAnswer,
        modelName: "ollama:qwen-test",
        citations: [],
        retrievedChunks: input.chunks,
        contextGroups: input.contextGroups,
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: input.usedFallback,
          answerPolicy: input.answerPolicy,
          contextMode: "chunks",
          inputChunkCount: input.chunks.length,
          contextGroupCount: input.contextGroups.length,
          citationCount: 0,
          answerStatus: "grounded"
        },
        answerStatus: "grounded",
        missingInformation: [],
        qualityEvaluation: {
          overall: "strong",
          grounding: "grounded",
          completeness: "complete",
          primaryIssue: "none",
          flags: [],
          summary: "Answer is grounded in cited sources with no reported gaps."
        }
      })
    },
    {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async () => ({})
    },
    {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      }),
      generateAnswerStream: async input => {
        input.onDelta("Alpha ");
        input.onDelta("Beta");
        return {
          rawAnswer: "Alpha Beta",
          modelName: "ollama:qwen-test",
          promptId: "answer.v2",
          usedFallback: false
        };
      }
    }
  );

  assert.equal(typeof service.askAssistantStream, "function");

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "Where is the marker?",
    onEvent: event => {
      events.push(event);
    }
  });

  assert.deepEqual(
    events.map(event => event.type === "status" ? `${event.type}:${event.phase}` : event.type),
    ["status:started", "status:retrieving", "status:generating", "answer_delta", "answer_delta", "final"]
  );
  assert.equal(events[3].delta, "Alpha ");
  assert.equal(events[4].delta, "Beta");
  assert.equal(events[5].data.answer, "Alpha Beta");
  assert.equal(finalResult.answer, "Alpha Beta");
  assert.equal(finalResult.traceId, "trace-1");
});
