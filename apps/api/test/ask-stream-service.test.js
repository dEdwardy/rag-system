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

test("AskAssistantService bypasses provider streaming for no-hit say_insufficient_context answers", async () => {
  const events = [];
  let providerStreamCalls = 0;
  let finalizeStreamedAnswerCalls = 0;

  const service = new AskAssistantService(
    {
      getAssistant: async assistantId => ({
        id: assistantId,
        tenantId: "tenant-1",
        kbId: "kb-1",
        systemPrompt: "system prompt",
        answerPolicyJson: {
          responseStyle: "concise",
          tone: "neutral",
          outputFormat: "paragraph",
          language: "en",
          citationMode: "required",
          maxCitations: 3,
          noAnswerBehavior: "say_insufficient_context",
          includeMissingInformation: true
        },
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
        retrievedChunks: [],
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    {
      buildStreamAnswerContext: ({ chunks }) => chunks,
      buildDeterministicInsufficientContextResult: ({ question }) => ({
        answer: `deterministic fallback for: ${question}`,
        modelName: "fallback-local",
        citations: [],
        retrievedChunks: [],
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: true,
          answerPolicy: {
            responseStyle: "concise",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "en",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "say_insufficient_context",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 0,
          contextGroupCount: 0,
          citationCount: 0,
          answerStatus: "insufficient_context"
        },
        answerStatus: "insufficient_context",
        missingInformation: ["No relevant supporting sources were retrieved."],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          primaryIssue: "no_retrieval_hits",
          flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
          summary: "Answer quality is weak because supporting context was insufficient."
        }
      }),
      generateAnswer: async () => {
        throw new Error("one-shot generateAnswer should not be used by native streaming");
      },
      finalizeStreamedAnswer: async input => {
        finalizeStreamedAnswerCalls += 1;
        return {
        answer: input.rawAnswer,
        modelName: input.modelName,
        citations: [],
        retrievedChunks: input.chunks,
        contextGroups: input.contextGroups,
        answeringMetadata: {
          promptId: input.promptId,
          usedFallback: input.usedFallback,
          answerPolicy: input.answerPolicy,
          contextMode: "chunks",
          inputChunkCount: input.chunks.length,
          contextGroupCount: input.contextGroups.length,
          citationCount: 0,
          answerStatus: "insufficient_context"
        },
        answerStatus: "insufficient_context",
        missingInformation: ["No relevant supporting sources were retrieved."],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          primaryIssue: "no_retrieval_hits",
          flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
          summary: "Answer quality is weak because supporting context was insufficient."
        }
        };
      }
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
      generateAnswerStream: async () => {
        providerStreamCalls += 1;
        throw new Error("provider stream should be bypassed");
      }
    }
  );

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "What detail is missing?",
    onEvent: event => {
      events.push(event);
    }
  });

  assert.equal(providerStreamCalls, 0);
  assert.equal(finalizeStreamedAnswerCalls, 0);
  assert.deepEqual(
    events.map(event => event.type === "status" ? `${event.type}:${event.phase}` : event.type),
    ["status:started", "status:retrieving", "status:generating", "answer_delta", "final"]
  );
  assert.equal(events[3].delta, "deterministic fallback for: What detail is missing?");
  assert.equal(events[4].data.answer, "deterministic fallback for: What detail is missing?");
  assert.equal(finalResult.answer, "deterministic fallback for: What detail is missing?");
  assert.equal(finalResult.answeringMetadata.usedFallback, true);
});

test("AskAssistantService preserves best_effort stream no-hit answers instead of using deterministic bypass", async () => {
  const events = [];
  let providerStreamCalls = 0;
  let finalizeStreamedAnswerCalls = 0;

  const service = new AskAssistantService(
    {
      getAssistant: async assistantId => ({
        id: assistantId,
        tenantId: "tenant-1",
        kbId: "kb-1",
        systemPrompt: "system prompt",
        answerPolicyJson: {
          responseStyle: "balanced",
          tone: "direct",
          outputFormat: "paragraph",
          language: "en",
          citationMode: "optional",
          maxCitations: 3,
          noAnswerBehavior: "best_effort",
          includeMissingInformation: true
        },
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
        retrievedChunks: [],
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
      finalizeStreamedAnswer: async input => {
        finalizeStreamedAnswerCalls += 1;
        assert.equal(input.answerPolicy.noAnswerBehavior, "best_effort");
        return {
          answer: input.rawAnswer,
          modelName: input.modelName,
          citations: [],
          retrievedChunks: input.chunks,
          contextGroups: input.contextGroups,
          answeringMetadata: {
            promptId: input.promptId,
            usedFallback: input.usedFallback,
            answerPolicy: input.answerPolicy,
            contextMode: "chunks",
            inputChunkCount: input.chunks.length,
            contextGroupCount: input.contextGroups.length,
            citationCount: 0,
            answerStatus: "insufficient_context"
          },
          answerStatus: "insufficient_context",
          missingInformation: ["No relevant supporting sources were retrieved."],
          qualityEvaluation: {
            overall: "weak",
            grounding: "ungrounded",
            completeness: "insufficient",
            primaryIssue: "no_retrieval_hits",
            flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
            summary: "Answer quality is weak because supporting context was insufficient."
          }
        };
      }
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
        providerStreamCalls += 1;
        await input.onDelta("Best effort ");
        await input.onDelta("stream answer.");
        return {
          rawAnswer: "Best effort stream answer.",
          modelName: "test-model",
          promptId: "answer.v2",
          usedFallback: false
        };
      }
    }
  );

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "What detail is missing?",
    onEvent: event => {
      events.push(event);
    }
  });

  assert.equal(providerStreamCalls, 1);
  assert.equal(finalizeStreamedAnswerCalls, 1);
  assert.deepEqual(
    events.map(event => event.type === "status" ? `${event.type}:${event.phase}` : event.type),
    ["status:started", "status:retrieving", "status:generating", "answer_delta", "answer_delta", "final"]
  );
  assert.equal(events[3].delta, "Best effort ");
  assert.equal(events[4].delta, "stream answer.");
  assert.equal(events[5].data.answer, "Best effort stream answer.");
  assert.equal(finalResult.answer, "Best effort stream answer.");
  assert.equal(finalResult.answeringMetadata.answerPolicy.noAnswerBehavior, "best_effort");
});

test("AskAssistantService stream preserves fallback_generation as the primary quality issue in final payload and trace", async () => {
  const events = [];
  const updateTraceCalls = [];
  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "marker content",
      score: 0.4,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

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
        retrievedChunks,
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
        modelName: input.modelName,
        citations: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            snippet: "marker content"
          }
        ],
        retrievedChunks: input.chunks,
        contextGroups: input.contextGroups,
        answeringMetadata: {
          promptId: input.promptId,
          usedFallback: input.usedFallback,
          answerPolicy: input.answerPolicy,
          contextMode: "chunks",
          inputChunkCount: input.chunks.length,
          contextGroupCount: input.contextGroups.length,
          citationCount: 1,
          answerStatus: "grounded"
        },
        answerStatus: "grounded",
        missingInformation: [],
        qualityEvaluation: {
          overall: "partial",
          grounding: "grounded",
          completeness: "complete",
          primaryIssue: "fallback_generation",
          flags: ["low_retrieval_score", "fallback_generation"],
          summary:
            "Answer is grounded, but retrieval confidence was low for the supporting context, and it was produced through local fallback behavior."
        }
      })
    },
    {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      }),
      generateAnswerStream: async input => {
        await input.onDelta("Fallback ");
        await input.onDelta("stream answer [1]");
        return {
          rawAnswer: "Fallback stream answer [1]",
          modelName: "fallback-local",
          promptId: "answer.v2",
          usedFallback: true
        };
      }
    }
  );

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "Where is the marker?",
    onEvent: event => {
      events.push(event);
    }
  });

  assert.deepEqual(
    events.map(event => (event.type === "status" ? `${event.type}:${event.phase}` : event.type)),
    ["status:started", "status:retrieving", "status:generating", "answer_delta", "answer_delta", "final"]
  );
  assert.equal(finalResult.qualityEvaluation.primaryIssue, "fallback_generation");
  assert.deepEqual(finalResult.qualityEvaluation.flags, [
    "low_retrieval_score",
    "fallback_generation"
  ]);
  assert.equal(
    finalResult.qualityEvaluation.summary,
    "Answer is grounded, but retrieval confidence was low for the supporting context, and it was produced through local fallback behavior."
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(updateTraceCalls[0].input.qualityEvaluationJson.primaryIssue, "fallback_generation");
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson.flags, [
    "low_retrieval_score",
    "fallback_generation"
  ]);
});

test("AskAssistantService stream preserves fallback_generation as the primary quality issue when fallback answers also miss information", async () => {
  const events = [];
  const updateTraceCalls = [];
  const retrievedChunks = [
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
  ];

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
        retrievedChunks,
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
        modelName: input.modelName,
        citations: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            snippet: "marker content"
          }
        ],
        retrievedChunks: input.chunks,
        contextGroups: input.contextGroups,
        answeringMetadata: {
          promptId: input.promptId,
          usedFallback: input.usedFallback,
          answerPolicy: input.answerPolicy,
          contextMode: "chunks",
          inputChunkCount: input.chunks.length,
          contextGroupCount: input.contextGroups.length,
          citationCount: 1,
          answerStatus: "grounded"
        },
        answerStatus: "grounded",
        missingInformation: ["Need pricing details."],
        qualityEvaluation: {
          overall: "partial",
          grounding: "grounded",
          completeness: "partial",
          primaryIssue: "fallback_generation",
          flags: ["missing_information", "fallback_generation"],
          summary:
            "Answer is grounded but incomplete because some information is missing, and it was produced through local fallback behavior."
        }
      })
    },
    {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      }),
      generateAnswerStream: async input => {
        await input.onDelta("Fallback ");
        await input.onDelta("partial answer [1]");
        return {
          rawAnswer: "Fallback partial answer [1]",
          modelName: "fallback-local",
          promptId: "answer.v2",
          usedFallback: true
        };
      }
    }
  );

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "Where is the marker?",
    onEvent: event => {
      events.push(event);
    }
  });

  assert.deepEqual(
    events.map(event => (event.type === "status" ? `${event.type}:${event.phase}` : event.type)),
    ["status:started", "status:retrieving", "status:generating", "answer_delta", "answer_delta", "final"]
  );
  assert.equal(finalResult.qualityEvaluation.primaryIssue, "fallback_generation");
  assert.deepEqual(finalResult.qualityEvaluation.flags, [
    "missing_information",
    "fallback_generation"
  ]);
  assert.equal(
    finalResult.qualityEvaluation.summary,
    "Answer is grounded but incomplete because some information is missing, and it was produced through local fallback behavior."
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(updateTraceCalls[0].input.qualityEvaluationJson.primaryIssue, "fallback_generation");
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson.flags, [
    "missing_information",
    "fallback_generation"
  ]);
});
