const test = require("node:test");
const assert = require("node:assert/strict");
const { AskAssistantService } = require("../dist/modules/assistants/ask-assistant.service.js");

test("AskAssistantService completes the happy path with retrieval, messages, and successful trace update", async () => {
  const createConversationCalls = [];
  const retrievalCalls = [];
  const createTraceCalls = [];
  const updateTraceCalls = [];
  const createdMessages = [];
  const attachedTraces = [];
  const touchedConversations = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "retrieved content marker",
      score: 0.9,
      vectorScore: 0.9,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];
  const contextGroups = [
    {
      documentId: "document-1",
      documentTitle: "Document 1",
      startChunkIndex: 0,
      endChunkIndex: 0,
      chunkIds: ["chunk-1"],
      primaryChunkIds: ["chunk-1"],
      mergedContent: "retrieved content marker",
      pageNumbers: [1],
      sectionTitles: ["Facts"]
    }
  ];
  const citations = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      snippet: "retrieved content marker"
    }
  ];

  const service = new AskAssistantService(
    {
      getAssistant: async assistantId => ({
        id: assistantId,
        tenantId: "tenant-1",
        kbId: "kb-1",
        systemPrompt: "system prompt",
        answerPolicyJson: {
          responseStyle: "balanced",
          tone: "friendly",
          outputFormat: "bullets",
          language: "same_as_question",
          citationMode: "required",
          maxCitations: 2,
          noAnswerBehavior: "say_insufficient_context",
          includeMissingInformation: false
        },
        retrievalProfile: {
          topK: 4,
          scoreThreshold: 0.2,
          chunkWindow: 1,
          enableHybrid: true,
          enableRerank: true,
          filtersJson: {
            documentIds: {
              include: ["document-1"],
              exclude: ["document-2"]
            },
            sectionTitles: {
              contains: ["fact"]
            }
          }
        }
      })
    },
    {
      createConversation: async input => {
        createConversationCalls.push(input);
        return { id: "conversation-1" };
      },
      getConversation: async () => {
        throw new Error("should not load an existing conversation in this test");
      },
      touchConversation: async conversationId => {
        touchedConversations.push(conversationId);
      }
    },
    {
      createMessage: async input => {
        const message = {
          id: input.role === "user" ? "user-message-1" : "assistant-message-1",
          ...input
        };
        createdMessages.push(message);
        return message;
      },
      attachTrace: async (messageId, traceId) => {
        attachedTraces.push({ messageId, traceId });
      }
    },
    {
      retrieve: async input => {
        retrievalCalls.push(input);
        return {
          retrievedChunks,
          contextGroups
        };
      }
    },
    {
      generateAnswer: async input => {
        assert.equal(input.question, "where is the marker?");
        assert.equal(input.systemPrompt, "system prompt");
        assert.deepEqual(input.answerPolicy, {
          responseStyle: "balanced",
          tone: "friendly",
          outputFormat: "bullets",
          language: "same_as_question",
          citationMode: "required",
          maxCitations: 2,
          noAnswerBehavior: "say_insufficient_context",
          includeMissingInformation: false
        });
        assert.deepEqual(input.chunks, retrievedChunks);
        assert.deepEqual(input.contextGroups, contextGroups);
        return {
          answer: "The marker is in Document 1.",
          citations,
          retrievedChunks,
          contextGroups,
          modelName: "fallback-local",
          answerStatus: "grounded",
          missingInformation: [],
          qualityEvaluation: {
            overall: "strong",
            grounding: "grounded",
            completeness: "complete",
            flags: [],
            summary: "Answer is grounded in cited sources with no reported gaps."
          }
        };
      }
    },
    {
      createTrace: async input => {
        createTraceCalls.push(input);
        return { id: "trace-1" };
      },
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    {
      rewriteQuery: async ({ question }) => ({
        rewrittenQuery: `${question} rewritten`,
        modelName: "rewrite-model",
        usedFallback: true
      })
    }
  );

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "where is the marker?"
  });

  assert.deepEqual(createConversationCalls, [
    {
      tenantId: "tenant-1",
      userId: "default-user",
      assistantId: "assistant-1",
      title: "where is the marker?"
    }
  ]);
  assert.equal(createdMessages.length, 2);
  assert.deepEqual(
    createdMessages.map(message => ({
      id: message.id,
      role: message.role,
      traceId: message.traceId ?? null
    })),
    [
      {
        id: "user-message-1",
        role: "user",
        traceId: null
      },
      {
        id: "assistant-message-1",
        role: "assistant",
        traceId: "trace-1"
      }
    ]
  );
  assert.deepEqual(retrievalCalls, [
    {
      kbId: "kb-1",
      query: "where is the marker? rewritten",
      topK: 4,
      scoreThreshold: 0.2,
      chunkWindow: 1,
      enableHybrid: true,
      enableRerank: true,
      filters: {
        documentIds: {
          include: ["document-1"],
          exclude: ["document-2"]
        },
        sectionTitles: {
          contains: ["fact"]
        }
      },
      strategy: {
        queryRewrite: {
          enabled: true
        },
        candidateSelection: {
          mode: "hybrid",
          candidateMultiplier: 3,
          minCandidates: 4
        },
        hybrid: {
          vectorWeight: 0.7,
          lexicalWeight: 0.3
        },
        rerank: {
          enabled: true
        }
      }
    }
  ]);
  assert.equal(createTraceCalls.length, 1);
  assert.equal(createTraceCalls[0].status, "success");
  assert.equal(createTraceCalls[0].rewrittenQuery, "where is the marker? rewritten");
  assert.deepEqual(attachedTraces, [
    {
      messageId: "user-message-1",
      traceId: "trace-1"
    }
  ]);
  assert.deepEqual(touchedConversations, ["conversation-1"]);
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(updateTraceCalls[0].id, "trace-1");
  assert.equal(updateTraceCalls[0].input.status, "success");
  assert.equal(updateTraceCalls[0].input.assistantMessageId, "assistant-message-1");
  assert.deepEqual(updateTraceCalls[0].input.citationsJson, citations);
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson, {
    overall: "strong",
    grounding: "grounded",
    completeness: "complete",
    flags: [],
    summary: "Answer is grounded in cited sources with no reported gaps."
  });
  assert.equal(result.conversationId, "conversation-1");
  assert.equal(result.traceId, "trace-1");
  assert.equal(result.answer, "The marker is in Document 1.");
  assert.deepEqual(result.citations, citations);
  assert.deepEqual(result.retrievedChunks, retrievedChunks);
  assert.deepEqual(result.contextGroups, contextGroups);
  assert.equal(result.modelName, "fallback-local");
  assert.equal(result.answerStatus, "grounded");
  assert.deepEqual(result.missingInformation, []);
  assert.deepEqual(result.qualityEvaluation, {
    overall: "strong",
    grounding: "grounded",
    completeness: "complete",
    flags: [],
    summary: "Answer is grounded in cited sources with no reported gaps."
  });
});

test("AskAssistantService can disable query rewrite and forwards resolved retrieval strategy", async () => {
  const retrievalCalls = [];
  let rewriteCalls = 0;

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
          enableHybrid: true,
          enableRerank: false,
          filtersJson: null,
          strategyJson: {
            queryRewrite: {
              enabled: false
            },
            candidateSelection: {
              mode: "lexical",
              candidateMultiplier: 5,
              minCandidates: 9
            },
            hybrid: {
              vectorWeight: 0.2,
              lexicalWeight: 0.8
            },
            rerank: {
              enabled: true
            }
          }
        }
      })
    },
    {
      createConversation: async () => ({ id: "conversation-1" }),
      getConversation: async () => {
        throw new Error("should not load an existing conversation in this test");
      },
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
      retrieve: async input => {
        retrievalCalls.push(input);
        return {
          retrievedChunks: [],
          contextGroups: []
        };
      }
    },
    {
      generateAnswer: async () => ({
        answer: "answer",
        citations: [],
        retrievedChunks: [],
        contextGroups: [],
        modelName: "fallback-local",
        answerStatus: "insufficient_context",
        missingInformation: [],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
          summary: "Answer quality is weak because supporting context was insufficient."
        }
      })
    },
    {
      createTrace: async input => ({ id: "trace-1", ...input }),
      updateTrace: async (id, input) => ({ id, ...input })
    },
    {
      rewriteQuery: async () => {
        rewriteCalls += 1;
        return {
          rewrittenQuery: "rewritten question",
          modelName: "rewrite-model",
          usedFallback: false
        };
      }
    }
  );

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "original question"
  });

  assert.equal(rewriteCalls, 0);
  assert.deepEqual(retrievalCalls, [
    {
      kbId: "kb-1",
      query: "original question",
      topK: 4,
      scoreThreshold: 0,
      chunkWindow: 0,
      enableHybrid: true,
      enableRerank: false,
      filters: undefined,
      strategy: {
        queryRewrite: {
          enabled: false
        },
        candidateSelection: {
          mode: "lexical",
          candidateMultiplier: 5,
          minCandidates: 9
        },
        hybrid: {
          vectorWeight: 0.2,
          lexicalWeight: 0.8
        },
        rerank: {
          enabled: true
        }
      }
    }
  ]);
  assert.equal(result.traceId, "trace-1");
  assert.deepEqual(result.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
    summary: "Answer quality is weak because supporting context was insufficient."
  });
});
