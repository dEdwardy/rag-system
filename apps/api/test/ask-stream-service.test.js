const assert = require("node:assert/strict");

const { AskAssistantService } = require("../src/modules/assistants/ask-assistant.service.ts");
const {
  createAskAssistantService,
  createAssistantRecord
} = require("./support/ask-assistant-test-helpers.js");

test("AskAssistantService exposes a dedicated stream orchestration path with progress, deltas, and final payload", async () => {
  const events = [];

  const service = createAskAssistantService({
    assistant: createAssistantRecord(),
    retrieval: {
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
    answering: {
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
          resolvedLanguage: "en",
          generationMode: "generated",
          contextMode: "chunks",
          inputChunkCount: input.chunks.length,
          promptContextCount: input.chunks.length,
          contextGroupCount: input.contextGroups.length,
          citationCountBeforeLimit: 0,
          citationCount: 0,
          citationLimitHit: false,
          citationAttribution: "none",
          citationSelectionSource: "none",
          missingInformationCount: 0,
          missingInformationSource: "none",
          answerTextSource: "model",
          insufficientContextReason: null,
          answerStatusSource: "model",
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
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async () => ({})
    },
    llm: {
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
  });

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
  assert.equal(finalResult.answeringMetadata.promptContextCount, 1);
  assert.equal(finalResult.answeringMetadata.citationAttribution, "none");
  assert.equal(finalResult.answeringMetadata.citationCountBeforeLimit, 0);
  assert.equal(finalResult.answeringMetadata.citationLimitHit, false);
  assert.equal(finalResult.answeringMetadata.missingInformationCount, 0);
  assert.equal(finalResult.answeringMetadata.missingInformationSource, "none");
  assert.equal(finalResult.answeringMetadata.answerTextSource, "model");
  assert.equal(finalResult.answeringMetadata.insufficientContextReason, null);
  assert.equal(finalResult.answeringMetadata.resolvedLanguage, "en");
  assert.equal(finalResult.answeringMetadata.generationMode, "generated");
});

test("AskAssistantService bypasses provider streaming for no-hit say_insufficient_context answers", async () => {
  const events = [];
  let providerStreamCalls = 0;
  let finalizeStreamedAnswerCalls = 0;

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: {
        responseStyle: "concise",
        tone: "neutral",
        outputFormat: "paragraph",
        language: "en",
        citationMode: "required",
        maxCitations: 3,
        noAnswerBehavior: "say_insufficient_context",
        includeMissingInformation: true
      }
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks: [],
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
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
          resolvedLanguage: "en",
          generationMode: "deterministic_bypass",
          contextMode: "chunks",
          inputChunkCount: 0,
          promptContextCount: 0,
          contextGroupCount: 0,
            citationCount: 0,
            citationAttribution: "none",
            citationSelectionSource: "none",
            missingInformationCount: 1,
            answerTextSource: "deterministic_policy",
            insufficientContextReason: "no_retrieval_hits",
            answerStatusSource: "deterministic_policy",
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
              answerTextSource: "model",
              insufficientContextReason: "no_retrieval_hits",
              answerStatusSource: "model",
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
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async () => ({})
    },
    llm: {
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
  });

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
  assert.equal(finalResult.answeringMetadata.answerTextSource, "deterministic_policy");
  assert.equal(finalResult.answeringMetadata.insufficientContextReason, "no_retrieval_hits");
});

test("AskAssistantService preserves best_effort stream no-hit answers instead of using deterministic bypass", async () => {
  const events = [];
  let providerStreamCalls = 0;
  let finalizeStreamedAnswerCalls = 0;

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: {
        responseStyle: "balanced",
        tone: "direct",
        outputFormat: "paragraph",
        language: "en",
        citationMode: "optional",
        maxCitations: 3,
        noAnswerBehavior: "best_effort",
        includeMissingInformation: true
      }
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks: [],
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
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
            answerTextSource: "model",
            insufficientContextReason: "no_retrieval_hits",
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
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async () => ({})
    },
    llm: {
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
  });

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
  assert.equal(finalResult.answeringMetadata.answerTextSource, "model");
  assert.equal(finalResult.answeringMetadata.insufficientContextReason, "no_retrieval_hits");
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

  const service = createAskAssistantService({
    assistant: createAssistantRecord(),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
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
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
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
  });

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

  const service = createAskAssistantService({
    assistant: createAssistantRecord(),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
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
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
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
  });

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

test("AskAssistantService stream preserves heuristic-citation strong summaries without upgrading them to explicit cited-source wording", async () => {
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

  const service = createAskAssistantService({
    assistant: createAssistantRecord(),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
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
          overall: "strong",
          grounding: "grounded",
          completeness: "complete",
          primaryIssue: "none",
          flags: [],
          summary: "Answer is grounded in retrieved sources with backend-inferred citations and no reported gaps."
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      }),
      generateAnswerStream: async input => {
        await input.onDelta("Answer text ");
        await input.onDelta("without explicit source markers.");
        return {
          rawAnswer: "Answer text without explicit source markers.",
          modelName: "test-model",
          promptId: "answer.v2",
          usedFallback: false
        };
      }
    }
  });

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
  assert.equal(finalResult.qualityEvaluation.primaryIssue, "none");
  assert.deepEqual(finalResult.qualityEvaluation.flags, []);
  assert.equal(
    finalResult.qualityEvaluation.summary,
    "Answer is grounded in retrieved sources with backend-inferred citations and no reported gaps."
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "Answer is grounded in retrieved sources with backend-inferred citations and no reported gaps."
  );
});

test("AskAssistantService stream preserves localized heuristic-citation strong summaries in Chinese", async () => {
  const events = [];
  const updateTraceCalls = [];
  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
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
        answerPolicyJson: {
          responseStyle: "balanced",
          tone: "neutral",
          outputFormat: "paragraph",
          language: "same_as_question",
          citationMode: "required",
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
            snippet: "中文内容"
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
          overall: "strong",
          grounding: "grounded",
          completeness: "complete",
          primaryIssue: "none",
          flags: [],
          summary: "回答已基于检索到的来源，引用由后端推断补齐，且没有发现已知缺口。"
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
        await input.onDelta("没有显式");
        await input.onDelta("来源标记的回答。");
        return {
          rawAnswer: "没有显式来源标记的回答。",
          modelName: "test-model",
          promptId: "answer.v2",
          usedFallback: false
        };
      }
    }
  );

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "标记在哪里？",
    onEvent: event => {
      events.push(event);
    }
  });

  assert.deepEqual(
    events.map(event => (event.type === "status" ? `${event.type}:${event.phase}` : event.type)),
    ["status:started", "status:retrieving", "status:generating", "answer_delta", "answer_delta", "final"]
  );
  assert.equal(finalResult.qualityEvaluation.primaryIssue, "none");
  assert.deepEqual(finalResult.qualityEvaluation.flags, []);
  assert.equal(
    finalResult.qualityEvaluation.summary,
    "回答已基于检索到的来源，引用由后端推断补齐，且没有发现已知缺口。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答已基于检索到的来源，引用由后端推断补齐，且没有发现已知缺口。"
  );
});

test("AskAssistantService stream preserves localized cited-source strong summaries in Chinese", async () => {
  const events = [];
  const updateTraceCalls = [];
  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
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
        answerPolicyJson: {
          responseStyle: "balanced",
          tone: "neutral",
          outputFormat: "paragraph",
          language: "same_as_question",
          citationMode: "required",
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
            snippet: "中文内容"
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
          overall: "strong",
          grounding: "grounded",
          completeness: "complete",
          primaryIssue: "none",
          flags: [],
          summary: "回答已基于引用的来源，且没有发现已知缺口。"
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
        await input.onDelta("回答 ");
        await input.onDelta("[1]");
        return {
          rawAnswer: "回答 [1]",
          modelName: "test-model",
          promptId: "answer.v2",
          usedFallback: false
        };
      }
    }
  );

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "标记在哪里？",
    onEvent: event => {
      events.push(event);
    }
  });

  assert.deepEqual(
    events.map(event => (event.type === "status" ? `${event.type}:${event.phase}` : event.type)),
    ["status:started", "status:retrieving", "status:generating", "answer_delta", "answer_delta", "final"]
  );
  assert.equal(finalResult.qualityEvaluation.primaryIssue, "none");
  assert.deepEqual(finalResult.qualityEvaluation.flags, []);
  assert.equal(finalResult.qualityEvaluation.summary, "回答已基于引用的来源，且没有发现已知缺口。");
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答已基于引用的来源，且没有发现已知缺口。"
  );
});

test("AskAssistantService stream preserves generic strong summaries without citations", async () => {
  const events = [];
  const updateTraceCalls = [];
  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "Citation-free grounded answer support",
      score: 0.9,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: {
        responseStyle: "balanced",
        tone: "neutral",
        outputFormat: "paragraph",
        language: "same_as_question",
        citationMode: "optional",
        maxCitations: 3,
        noAnswerBehavior: "best_effort",
        includeMissingInformation: true
      }
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      buildStreamAnswerContext: ({ chunks }) => chunks,
      generateAnswer: async () => {
        throw new Error("one-shot generateAnswer should not be used by native streaming");
      },
      finalizeStreamedAnswer: async input => ({
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
          summary: "Answer is grounded in retrieved sources with no reported gaps."
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      }),
      generateAnswerStream: async input => {
        await input.onDelta("Here is a grounded ");
        await input.onDelta("answer without explicit citations.");
        return {
          rawAnswer: "Here is a grounded answer without explicit citations.",
          modelName: "test-model",
          promptId: "answer.v2",
          usedFallback: false
        };
      }
    }
  });

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "What happened?",
    onEvent: event => {
      events.push(event);
    }
  });

  assert.deepEqual(
    events.map(event => (event.type === "status" ? `${event.type}:${event.phase}` : event.type)),
    ["status:started", "status:retrieving", "status:generating", "answer_delta", "answer_delta", "final"]
  );
  assert.equal(finalResult.qualityEvaluation.primaryIssue, "none");
  assert.deepEqual(finalResult.qualityEvaluation.flags, []);
  assert.equal(finalResult.qualityEvaluation.summary, "Answer is grounded in retrieved sources with no reported gaps.");
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "Answer is grounded in retrieved sources with no reported gaps."
  );
});

test("AskAssistantService stream preserves localized generic strong summaries without citations in Chinese", async () => {
  const events = [];
  const updateTraceCalls = [];
  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "涓枃鍐呭",
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
        answerPolicyJson: {
          responseStyle: "balanced",
          tone: "neutral",
          outputFormat: "paragraph",
          language: "same_as_question",
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
          summary: "鍥炵瓟宸插熀浜庢绱㈠埌鐨勬潵婧愶紝涓旀病鏈夊彂鐜板凡鐭ョ己鍙ｃ€?"
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
        await input.onDelta("杩欐槸涓€涓?");
        await input.onDelta("娌℃湁鏄惧紡寮曠敤鐨勫洖绛斻€?");
        return {
          rawAnswer: "杩欐槸涓€涓病鏈夋樉寮忓紩鐢ㄧ殑鍥炵瓟銆?",
          modelName: "test-model",
          promptId: "answer.v2",
          usedFallback: false
        };
      }
    }
  );

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "鍙戠敓浜嗕粈涔堬紵",
    onEvent: event => {
      events.push(event);
    }
  });

  assert.deepEqual(
    events.map(event => (event.type === "status" ? `${event.type}:${event.phase}` : event.type)),
    ["status:started", "status:retrieving", "status:generating", "answer_delta", "answer_delta", "final"]
  );
  assert.equal(finalResult.qualityEvaluation.primaryIssue, "none");
  assert.deepEqual(finalResult.qualityEvaluation.flags, []);
  assert.equal(finalResult.qualityEvaluation.summary, "鍥炵瓟宸插熀浜庢绱㈠埌鐨勬潵婧愶紝涓旀病鏈夊彂鐜板凡鐭ョ己鍙ｃ€?");
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "鍥炵瓟宸插熀浜庢绱㈠埌鐨勬潵婧愶紝涓旀病鏈夊彂鐜板凡鐭ョ己鍙ｃ€?"
  );
});

test("AskAssistantService stream preserves localized fallback partial summaries in Chinese", async () => {
  const events = [];
  const updateTraceCalls = [];
  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
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
        answerPolicyJson: {
          responseStyle: "balanced",
          tone: "neutral",
          outputFormat: "paragraph",
          language: "same_as_question",
          citationMode: "required",
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
            snippet: "中文内容"
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
        missingInformation: ["缺少价格信息。"],
        qualityEvaluation: {
          overall: "partial",
          grounding: "grounded",
          completeness: "partial",
          primaryIssue: "fallback_generation",
          flags: ["missing_information", "fallback_generation"],
          summary: "回答已基于检索到的内容，但仍不完整：部分信息缺失，且它是通过本地 fallback 生成的。"
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
        await input.onDelta("本地 fallback ");
        await input.onDelta("部分回答 [1]");
        return {
          rawAnswer: "本地 fallback 部分回答 [1]",
          modelName: "fallback-local",
          promptId: "answer.v2",
          usedFallback: true
        };
      }
    }
  );

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "标记在哪里？",
    onEvent: event => {
      events.push(event);
    }
  });

  assert.deepEqual(
    events.map(event => (event.type === "status" ? `${event.type}:${event.phase}` : event.type)),
    ["status:started", "status:retrieving", "status:generating", "answer_delta", "answer_delta", "final"]
  );
  assert.equal(finalResult.qualityEvaluation.primaryIssue, "fallback_generation");
  assert.deepEqual(finalResult.qualityEvaluation.flags, ["missing_information", "fallback_generation"]);
  assert.equal(
    finalResult.qualityEvaluation.summary,
    "回答已基于检索到的内容，但仍不完整：部分信息缺失，且它是通过本地 fallback 生成的。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答已基于检索到的内容，但仍不完整：部分信息缺失，且它是通过本地 fallback 生成的。"
  );
});

test("AskAssistantService stream preserves localized triple-cause fallback summaries in Chinese", async () => {
  const events = [];
  const updateTraceCalls = [];
  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
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
        answerPolicyJson: {
          responseStyle: "balanced",
          tone: "neutral",
          outputFormat: "paragraph",
          language: "same_as_question",
          citationMode: "required",
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
            snippet: "中文内容"
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
        missingInformation: ["缺少价格信息。"],
        qualityEvaluation: {
          overall: "partial",
          grounding: "grounded",
          completeness: "partial",
          primaryIssue: "fallback_generation",
          flags: ["missing_information", "low_retrieval_score", "fallback_generation"],
          summary:
            "回答已基于检索到的内容，但仍不完整：部分信息缺失，检索置信度偏低，且它是通过本地 fallback 生成的。"
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
        await input.onDelta("本地 fallback ");
        await input.onDelta("部分回答 [1]");
        return {
          rawAnswer: "本地 fallback 部分回答 [1]",
          modelName: "fallback-local",
          promptId: "answer.v2",
          usedFallback: true
        };
      }
    }
  );

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "标记在哪里？",
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
    "low_retrieval_score",
    "fallback_generation"
  ]);
  assert.equal(
    finalResult.qualityEvaluation.summary,
    "回答已基于检索到的内容，但仍不完整：部分信息缺失，检索置信度偏低，且它是通过本地 fallback 生成的。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答已基于检索到的内容，但仍不完整：部分信息缺失，检索置信度偏低，且它是通过本地 fallback 生成的。"
  );
});

test("AskAssistantService stream preserves localized low-confidence weak insufficient-context summaries in Chinese", async () => {
  const events = [];
  const updateTraceCalls = [];
  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
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
        answerPolicyJson: {
          responseStyle: "balanced",
          tone: "neutral",
          outputFormat: "paragraph",
          language: "same_as_question",
          citationMode: "required",
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
        missingInformation: ["缺少价格信息。"],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          primaryIssue: "insufficient_context",
          flags: ["insufficient_context", "missing_information", "low_retrieval_score"],
          summary:
            "回答质量较弱，因为即使已检索到上下文，仍不足以支持可靠回答，且检索置信度偏低。"
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
        await input.onDelta("不知道");
        await input.onDelta("。");
        return {
          rawAnswer: "不知道。",
          modelName: "test-model",
          promptId: "answer.v2",
          usedFallback: false
        };
      }
    }
  );

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "标记在哪里？",
    onEvent: event => {
      events.push(event);
    }
  });

  assert.deepEqual(
    events.map(event => (event.type === "status" ? `${event.type}:${event.phase}` : event.type)),
    ["status:started", "status:retrieving", "status:generating", "answer_delta", "answer_delta", "final"]
  );
  assert.equal(finalResult.qualityEvaluation.primaryIssue, "insufficient_context");
  assert.deepEqual(finalResult.qualityEvaluation.flags, [
    "insufficient_context",
    "missing_information",
    "low_retrieval_score"
  ]);
  assert.equal(
    finalResult.qualityEvaluation.summary,
    "回答质量较弱，因为即使已检索到上下文，仍不足以支持可靠回答，且检索置信度偏低。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答质量较弱，因为即使已检索到上下文，仍不足以支持可靠回答，且检索置信度偏低。"
  );
});

test("AskAssistantService stream preserves low-confidence weak insufficient-context summaries", async () => {
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

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: {
        responseStyle: "balanced",
        tone: "neutral",
        outputFormat: "paragraph",
        language: "en",
        citationMode: "required",
        maxCitations: 3,
        noAnswerBehavior: "best_effort",
        includeMissingInformation: true
      }
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      buildStreamAnswerContext: ({ chunks }) => chunks,
      generateAnswer: async () => {
        throw new Error("one-shot generateAnswer should not be used by native streaming");
      },
      finalizeStreamedAnswer: async input => ({
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
        missingInformation: ["Need pricing details."],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          primaryIssue: "insufficient_context",
          flags: ["insufficient_context", "missing_information", "low_retrieval_score"],
          summary:
            "Answer quality is weak because retrieved context was still insufficient, and retrieval confidence was low."
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      }),
      generateAnswerStream: async input => {
        await input.onDelta("I don't know");
        await input.onDelta(".");
        return {
          rawAnswer: "I don't know.",
          modelName: "test-model",
          promptId: "answer.v2",
          usedFallback: false
        };
      }
    }
  });

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
  assert.deepEqual(finalResult.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "insufficient_context",
    flags: ["insufficient_context", "missing_information", "low_retrieval_score"],
    summary:
      "Answer quality is weak because retrieved context was still insufficient, and retrieval confidence was low."
  });
  assert.equal(updateTraceCalls.length, 1);
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "insufficient_context",
    flags: ["insufficient_context", "missing_information", "low_retrieval_score"],
    summary:
      "Answer quality is weak because retrieved context was still insufficient, and retrieval confidence was low."
  });
});

test("AskAssistantService stream preserves hit-aware weak insufficient-context summaries", async () => {
  const events = [];
  const updateTraceCalls = [];
  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "marker content",
      score: 0.8,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: {
        responseStyle: "balanced",
        tone: "neutral",
        outputFormat: "paragraph",
        language: "en",
        citationMode: "required",
        maxCitations: 3,
        noAnswerBehavior: "best_effort",
        includeMissingInformation: true
      }
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      buildStreamAnswerContext: ({ chunks }) => chunks,
      generateAnswer: async () => {
        throw new Error("one-shot generateAnswer should not be used by native streaming");
      },
      finalizeStreamedAnswer: async input => ({
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
        missingInformation: ["Need pricing details."],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          primaryIssue: "insufficient_context",
          flags: ["insufficient_context", "missing_information"],
          summary: "Answer quality is weak because retrieved context was still insufficient."
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      }),
      generateAnswerStream: async input => {
        await input.onDelta("I don't know");
        await input.onDelta(".");
        return {
          rawAnswer: "I don't know.",
          modelName: "test-model",
          promptId: "answer.v2",
          usedFallback: false
        };
      }
    }
  });

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
  assert.deepEqual(finalResult.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "insufficient_context",
    flags: ["insufficient_context", "missing_information"],
    summary: "Answer quality is weak because retrieved context was still insufficient."
  });
  assert.equal(updateTraceCalls.length, 1);
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "insufficient_context",
    flags: ["insufficient_context", "missing_information"],
    summary: "Answer quality is weak because retrieved context was still insufficient."
  });
});

test("AskAssistantService stream preserves localized hit-aware weak insufficient-context summaries in Chinese", async () => {
  const events = [];
  const updateTraceCalls = [];
  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
      score: 0.8,
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
        answerPolicyJson: {
          responseStyle: "balanced",
          tone: "neutral",
          outputFormat: "paragraph",
          language: "same_as_question",
          citationMode: "required",
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
        missingInformation: ["缺少价格信息。"],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          primaryIssue: "insufficient_context",
          flags: ["insufficient_context", "missing_information"],
          summary: "回答质量较弱，因为即使已检索到上下文，仍不足以支持可靠回答。"
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
        await input.onDelta("不知道");
        await input.onDelta("。");
        return {
          rawAnswer: "不知道。",
          modelName: "test-model",
          promptId: "answer.v2",
          usedFallback: false
        };
      }
    }
  );

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "标记在哪里？",
    onEvent: event => {
      events.push(event);
    }
  });

  assert.deepEqual(
    events.map(event => (event.type === "status" ? `${event.type}:${event.phase}` : event.type)),
    ["status:started", "status:retrieving", "status:generating", "answer_delta", "answer_delta", "final"]
  );
  assert.equal(finalResult.qualityEvaluation.primaryIssue, "insufficient_context");
  assert.deepEqual(finalResult.qualityEvaluation.flags, [
    "insufficient_context",
    "missing_information"
  ]);
  assert.deepEqual(finalResult.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "insufficient_context",
    flags: ["insufficient_context", "missing_information"],
    summary: "回答质量较弱，因为即使已检索到上下文，仍不足以支持可靠回答。"
  });
  assert.equal(
    finalResult.qualityEvaluation.summary,
    "回答质量较弱，因为即使已检索到上下文，仍不足以支持可靠回答。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "insufficient_context",
    flags: ["insufficient_context", "missing_information"],
    summary: "回答质量较弱，因为即使已检索到上下文，仍不足以支持可靠回答。"
  });
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答质量较弱，因为即使已检索到上下文，仍不足以支持可靠回答。"
  );
});

test("AskAssistantService stream preserves grounded partial summaries when information is missing", async () => {
  const events = [];
  const updateTraceCalls = [];
  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "marker content",
      score: 0.8,
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
        answerPolicyJson: {
          responseStyle: "balanced",
          tone: "neutral",
          outputFormat: "paragraph",
          language: "en",
          citationMode: "required",
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
          primaryIssue: "missing_information",
          flags: ["missing_information"],
          summary: "Answer is grounded but incomplete because some information is missing."
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
        await input.onDelta("Partial grounded ");
        await input.onDelta("answer [1]");
        return {
          rawAnswer: "Partial grounded answer [1]",
          modelName: "test-model",
          promptId: "answer.v2",
          usedFallback: false
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
  assert.deepEqual(finalResult.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "partial",
    primaryIssue: "missing_information",
    flags: ["missing_information"],
    summary: "Answer is grounded but incomplete because some information is missing."
  });
  assert.equal(updateTraceCalls.length, 1);
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson, {
    overall: "partial",
    grounding: "grounded",
    completeness: "partial",
    primaryIssue: "missing_information",
    flags: ["missing_information"],
    summary: "Answer is grounded but incomplete because some information is missing."
  });
});

test("AskAssistantService stream preserves localized grounded partial summaries when information is missing", async () => {
  const events = [];
  const updateTraceCalls = [];
  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
      score: 0.8,
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
        answerPolicyJson: {
          responseStyle: "balanced",
          tone: "neutral",
          outputFormat: "paragraph",
          language: "same_as_question",
          citationMode: "required",
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
            snippet: "中文内容"
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
        missingInformation: ["缺少价格信息。"],
        qualityEvaluation: {
          overall: "partial",
          grounding: "grounded",
          completeness: "partial",
          primaryIssue: "missing_information",
          flags: ["missing_information"],
          summary: "回答已基于检索到的内容，但仍不完整：部分信息缺失。"
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
        await input.onDelta("部分回答 ");
        await input.onDelta("[1]");
        return {
          rawAnswer: "部分回答 [1]",
          modelName: "test-model",
          promptId: "answer.v2",
          usedFallback: false
        };
      }
    }
  );

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "标记在哪里？",
    onEvent: event => {
      events.push(event);
    }
  });

  assert.deepEqual(
    events.map(event => (event.type === "status" ? `${event.type}:${event.phase}` : event.type)),
    ["status:started", "status:retrieving", "status:generating", "answer_delta", "answer_delta", "final"]
  );
  assert.equal(finalResult.qualityEvaluation.primaryIssue, "missing_information");
  assert.deepEqual(finalResult.qualityEvaluation.flags, ["missing_information"]);
  assert.deepEqual(finalResult.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "partial",
    primaryIssue: "missing_information",
    flags: ["missing_information"],
    summary: "回答已基于检索到的内容，但仍不完整：部分信息缺失。"
  });
  assert.equal(
    finalResult.qualityEvaluation.summary,
    "回答已基于检索到的内容，但仍不完整：部分信息缺失。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson, {
    overall: "partial",
    grounding: "grounded",
    completeness: "partial",
    primaryIssue: "missing_information",
    flags: ["missing_information"],
    summary: "回答已基于检索到的内容，但仍不完整：部分信息缺失。"
  });
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答已基于检索到的内容，但仍不完整：部分信息缺失。"
  );
});

test("AskAssistantService stream preserves low-retrieval grounded summaries", async () => {
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
        answerPolicyJson: {
          responseStyle: "balanced",
          tone: "neutral",
          outputFormat: "paragraph",
          language: "en",
          citationMode: "required",
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
          primaryIssue: "low_retrieval_score",
          flags: ["low_retrieval_score"],
          summary: "Answer is grounded, but retrieval confidence was low for the supporting context."
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
        await input.onDelta("Grounded ");
        await input.onDelta("answer [1]");
        return {
          rawAnswer: "Grounded answer [1]",
          modelName: "test-model",
          promptId: "answer.v2",
          usedFallback: false
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
  assert.deepEqual(finalResult.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "low_retrieval_score",
    flags: ["low_retrieval_score"],
    summary: "Answer is grounded, but retrieval confidence was low for the supporting context."
  });
  assert.equal(updateTraceCalls.length, 1);
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson, {
    overall: "partial",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "low_retrieval_score",
    flags: ["low_retrieval_score"],
    summary: "Answer is grounded, but retrieval confidence was low for the supporting context."
  });
});

test("AskAssistantService stream preserves localized low-retrieval grounded summaries", async () => {
  const events = [];
  const updateTraceCalls = [];
  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
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
        answerPolicyJson: {
          responseStyle: "balanced",
          tone: "neutral",
          outputFormat: "paragraph",
          language: "same_as_question",
          citationMode: "required",
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
            snippet: "中文内容"
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
          primaryIssue: "low_retrieval_score",
          flags: ["low_retrieval_score"],
          summary: "回答已基于检索到的内容，但支持上下文的检索置信度偏低。"
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
        await input.onDelta("回答 ");
        await input.onDelta("[1]");
        return {
          rawAnswer: "回答 [1]",
          modelName: "test-model",
          promptId: "answer.v2",
          usedFallback: false
        };
      }
    }
  );

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "标记在哪里？",
    onEvent: event => {
      events.push(event);
    }
  });

  assert.deepEqual(
    events.map(event => (event.type === "status" ? `${event.type}:${event.phase}` : event.type)),
    ["status:started", "status:retrieving", "status:generating", "answer_delta", "answer_delta", "final"]
  );
  assert.equal(finalResult.qualityEvaluation.primaryIssue, "low_retrieval_score");
  assert.deepEqual(finalResult.qualityEvaluation.flags, ["low_retrieval_score"]);
  assert.equal(
    finalResult.qualityEvaluation.summary,
    "回答已基于检索到的内容，但支持上下文的检索置信度偏低。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答已基于检索到的内容，但支持上下文的检索置信度偏低。"
  );
});

test("AskAssistantService stream preserves fallback-only grounded summaries", async () => {
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
        answerPolicyJson: {
          responseStyle: "balanced",
          tone: "neutral",
          outputFormat: "paragraph",
          language: "en",
          citationMode: "required",
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
          flags: ["fallback_generation"],
          summary: "Answer is grounded, but it was produced through local fallback behavior."
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
        await input.onDelta("Grounded fallback ");
        await input.onDelta("answer [1]");
        return {
          rawAnswer: "Grounded fallback answer [1]",
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
  assert.deepEqual(finalResult.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "fallback_generation",
    flags: ["fallback_generation"],
    summary: "Answer is grounded, but it was produced through local fallback behavior."
  });
  assert.equal(updateTraceCalls.length, 1);
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson, {
    overall: "partial",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "fallback_generation",
    flags: ["fallback_generation"],
    summary: "Answer is grounded, but it was produced through local fallback behavior."
  });
});

test("AskAssistantService stream preserves localized fallback-only grounded summaries", async () => {
  const events = [];
  const updateTraceCalls = [];
  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
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
        answerPolicyJson: {
          responseStyle: "balanced",
          tone: "neutral",
          outputFormat: "paragraph",
          language: "same_as_question",
          citationMode: "required",
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
            snippet: "中文内容"
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
          flags: ["fallback_generation"],
          summary: "回答已基于检索到的内容，但它是通过本地 fallback 生成的。"
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
        await input.onDelta("回答 ");
        await input.onDelta("[1]");
        return {
          rawAnswer: "回答 [1]",
          modelName: "fallback-local",
          promptId: "answer.v2",
          usedFallback: true
        };
      }
    }
  );

  const finalResult = await service.askAssistantStream({
    assistantId: "assistant-1",
    question: "标记在哪里？",
    onEvent: event => {
      events.push(event);
    }
  });

  assert.deepEqual(
    events.map(event => (event.type === "status" ? `${event.type}:${event.phase}` : event.type)),
    ["status:started", "status:retrieving", "status:generating", "answer_delta", "answer_delta", "final"]
  );
  assert.equal(finalResult.qualityEvaluation.primaryIssue, "fallback_generation");
  assert.deepEqual(finalResult.qualityEvaluation.flags, ["fallback_generation"]);
  assert.equal(
    finalResult.qualityEvaluation.summary,
    "回答已基于检索到的内容，但它是通过本地 fallback 生成的。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答已基于检索到的内容，但它是通过本地 fallback 生成的。"
  );
});
