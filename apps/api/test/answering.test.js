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
  assert.deepEqual(result.answeringMetadata, {
    promptId: "answer.v2",
    usedFallback: false,
    answerPolicy: {
      responseStyle: "concise",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "auto",
      citationMode: "required",
      maxCitations: 1,
      noAnswerBehavior: "say_insufficient_context",
      includeMissingInformation: true
    },
    contextMode: "chunks",
    inputChunkCount: 2,
    contextGroupCount: 0,
    citationCount: 1,
    answerStatus: "grounded"
  });
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

test("AnsweringService exposes usedFallback in answering metadata for local fallback answers", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Fallback answer [1]",
      modelName: "fallback-local",
      promptId: "answer.v2",
      usedFallback: true,
      answerStatus: "grounded",
      missingInformation: [],
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

  assert.equal(result.answeringMetadata.usedFallback, true);
});

test("AnsweringService de-duplicates repeated inline citation markers from plain-text answers", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Fallback answer [1][1][2][1]",
      modelName: "test-model"
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
      },
      {
        chunkId: "chunk-2",
        documentId: "doc-1",
        documentTitle: "Doc 1",
        chunkIndex: 1,
        content: "second chunk with answer",
        score: 0.8,
        pageNo: null,
        sectionTitle: "B"
      }
    ]
  });

  assert.deepEqual(
    result.citations.map(citation => citation.chunkId),
    ["chunk-1", "chunk-2"]
  );
  assert.equal(result.answeringMetadata.citationCount, 2);
});

test("AnsweringService does not fabricate heuristic citations when citationMode is optional", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Fallback answer without markers",
      modelName: "test-model",
      answerStatus: "grounded",
      missingInformation: []
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "where?",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "auto",
      citationMode: "optional",
      maxCitations: 3,
      noAnswerBehavior: "best_effort",
      includeMissingInformation: true
    },
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

  assert.deepEqual(result.citations, []);
});

test("AnsweringService keeps quality evaluation strong when citations are optional and no other gaps exist", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Fallback answer without markers",
      modelName: "test-model",
      answerStatus: "grounded",
      missingInformation: []
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "where?",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "auto",
      citationMode: "optional",
      maxCitations: 3,
      noAnswerBehavior: "best_effort",
      includeMissingInformation: true
    },
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

  assert.deepEqual(result.citations, []);
  assert.deepEqual(result.qualityEvaluation, {
    overall: "strong",
    grounding: "grounded",
    completeness: "complete",
    flags: [],
    summary: "Answer is grounded in cited sources with no reported gaps."
  });
});

test("AnsweringService clears missingInformation when the policy disables it", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Partial answer [1]",
      modelName: "test-model",
      answerStatus: "grounded",
      missingInformation: ["Need pricing details"],
      citedChunkNumbers: [1]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "where?",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "direct",
      outputFormat: "markdown",
      language: "en",
      citationMode: "required",
      maxCitations: 3,
      noAnswerBehavior: "best_effort",
      includeMissingInformation: false
    },
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

  assert.deepEqual(result.missingInformation, []);
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

  const result = await service.generateAnswer({
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
  assert.deepEqual(result.answeringMetadata, {
    promptId: "answer.v2",
    usedFallback: false,
    answerPolicy: {
      responseStyle: "concise",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "auto",
      citationMode: "required",
      maxCitations: 3,
      noAnswerBehavior: "say_insufficient_context",
      includeMissingInformation: true
    },
    contextMode: "context_groups",
    inputChunkCount: 2,
    contextGroupCount: 1,
    citationCount: 1,
    answerStatus: "grounded"
  });
});

test("AnsweringService uses validated citationEvidence quotes as returned snippets", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Answer text [1]",
      modelName: "test-model",
      answerStatus: "grounded",
      missingInformation: [],
      citedChunkNumbers: [1],
      citationEvidence: [
        {
          source: 1,
          quote: "marker evidence line"
        }
      ]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "where is the marker?",
    systemPrompt: "answer",
    chunks: [
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        documentTitle: "Doc 1",
        chunkIndex: 0,
        content: "prefix marker evidence line suffix",
        score: 0.9,
        pageNo: null,
        sectionTitle: "Facts"
      }
    ]
  });

  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0].snippet, "marker evidence line");
});

test("AnsweringService rejects citationEvidence quotes that do not belong to the cited source", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Answer text [1]",
      modelName: "test-model",
      answerStatus: "grounded",
      missingInformation: [],
      citedChunkNumbers: [1],
      citationEvidence: [
        {
          source: 1,
          quote: "quote from another chunk"
        }
      ]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "where is the marker?",
    systemPrompt: "answer",
    chunks: [
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        documentTitle: "Doc 1",
        chunkIndex: 0,
        content: "first chunk with marker evidence line and local support",
        score: 0.9,
        pageNo: null,
        sectionTitle: "Facts"
      },
      {
        chunkId: "chunk-2",
        documentId: "doc-1",
        documentTitle: "Doc 1",
        chunkIndex: 1,
        content: "quote from another chunk",
        score: 0.8,
        pageNo: null,
        sectionTitle: "Other"
      }
    ]
  });

  assert.equal(result.citations.length, 1);
  assert.notEqual(result.citations[0].snippet, "quote from another chunk");
  assert.match(result.citations[0].snippet, /marker evidence line|first chunk/i);
});

test("AnsweringService returns strong quality evaluation for grounded answers with citations and no gaps", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Answer text [1]",
      modelName: "test-model",
      answerStatus: "grounded",
      missingInformation: [],
      citedChunkNumbers: [1]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "where is the marker?",
    systemPrompt: "answer",
    chunks: [
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        documentTitle: "Doc 1",
        chunkIndex: 0,
        content: "marker evidence line",
        score: 0.92,
        pageNo: null,
        sectionTitle: "Facts"
      }
    ]
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "strong",
    grounding: "grounded",
    completeness: "complete",
    flags: [],
    summary: "Answer is grounded in cited sources with no reported gaps."
  });
});

test("AnsweringService returns partial quality evaluation when information is missing", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Partial answer [1]",
      modelName: "test-model",
      answerStatus: "grounded",
      missingInformation: ["Need pricing details"],
      citedChunkNumbers: [1]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "where is the marker?",
    systemPrompt: "answer",
    chunks: [
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        documentTitle: "Doc 1",
        chunkIndex: 0,
        content: "marker evidence line",
        score: 0.88,
        pageNo: null,
        sectionTitle: "Facts"
      }
    ]
  });

  assert.equal(result.qualityEvaluation.overall, "partial");
  assert.equal(result.qualityEvaluation.grounding, "grounded");
  assert.equal(result.qualityEvaluation.completeness, "partial");
  assert.deepEqual(result.qualityEvaluation.flags, ["missing_information"]);
});

test("AnsweringService returns weak quality evaluation for insufficient-context answers", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "I don't know.",
      modelName: "test-model",
      answerStatus: "insufficient_context",
      missingInformation: ["No relevant supporting sources were retrieved."]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "where is the marker?",
    systemPrompt: "answer",
    chunks: []
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
    summary: "Answer quality is weak because supporting context was insufficient."
  });
});

test("AnsweringService enforces say_insufficient_context with a deterministic fallback answer", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Hallucinated answer that should not leak through.",
      modelName: "test-model",
      answerStatus: "insufficient_context",
      missingInformation: ["No relevant supporting sources were retrieved."]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "What is the unsupported detail?",
    systemPrompt: "answer",
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
    chunks: []
  });

  assert.equal(
    result.answer,
    "I don't have enough information in the retrieved sources to answer that reliably."
  );
  assert.equal(result.answerStatus, "insufficient_context");
});

test("AnsweringService preserves best_effort answers even when context is insufficient", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Best effort answer with uncertainty.",
      modelName: "test-model",
      answerStatus: "insufficient_context",
      missingInformation: ["No relevant supporting sources were retrieved."]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "What is the unsupported detail?",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "direct",
      outputFormat: "paragraph",
      language: "en",
      citationMode: "optional",
      maxCitations: 3,
      noAnswerBehavior: "best_effort",
      includeMissingInformation: true
    },
    chunks: []
  });

  assert.equal(result.answer, "Best effort answer with uncertainty.");
  assert.equal(result.answerStatus, "insufficient_context");
});

test("AnsweringService localizes the deterministic insufficient-context fallback for Chinese questions", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "不应该透出的猜测性回答。",
      modelName: "test-model",
      answerStatus: "insufficient_context",
      missingInformation: ["No relevant supporting sources were retrieved."]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "这个问题缺少什么信息？",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "concise",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "same_as_question",
      citationMode: "required",
      maxCitations: 3,
      noAnswerBehavior: "say_insufficient_context",
      includeMissingInformation: true
    },
    chunks: []
  });

  assert.equal(result.answer, "根据当前检索到的资料，我还没有足够信息来可靠回答这个问题。");
  assert.equal(result.answerStatus, "insufficient_context");
});

test("AnsweringService preserves missingInformation for insufficient-context answers even when the policy disables advisory gaps", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "I don't know.",
      modelName: "test-model",
      answerStatus: "insufficient_context",
      missingInformation: ["Need pricing details."]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "What is the price?",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "concise",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "en",
      citationMode: "required",
      maxCitations: 3,
      noAnswerBehavior: "say_insufficient_context",
      includeMissingInformation: false
    },
    chunks: []
  });

  assert.deepEqual(result.missingInformation, ["Need pricing details."]);
  assert.deepEqual(result.qualityEvaluation.flags, [
    "no_retrieval_hits",
    "insufficient_context",
    "missing_information"
  ]);
});

test("AnsweringService fills a deterministic missingInformation reason for insufficient-context answers when the model omits one", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "I don't know.",
      modelName: "test-model",
      answerStatus: "insufficient_context",
      missingInformation: []
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "What is the price?",
    systemPrompt: "answer",
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
    chunks: []
  });

  assert.deepEqual(result.missingInformation, ["No relevant supporting sources were retrieved."]);
  assert.deepEqual(result.qualityEvaluation.flags, [
    "no_retrieval_hits",
    "insufficient_context",
    "missing_information"
  ]);
});
