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
    promptContextCount: 2,
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

test("AnsweringService downgrades grounded local fallback answers in quality evaluation", async () => {
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

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "fallback_generation",
    flags: ["fallback_generation"],
    summary: "Answer is grounded, but it was produced through local fallback behavior."
  });
});

test("AnsweringService localizes fallback-only grounded summaries for Chinese questions", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "鏈湴 fallback 鍥炵瓟 [1]",
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
    question: "鍦ㄥ摢閲岋紵",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "same_as_question",
      citationMode: "required",
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
        content: "涓枃涓婁笅鏂?",
        score: 0.9,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "fallback_generation",
    flags: ["fallback_generation"],
    summary: "回答已基于检索到的内容，但它是通过本地 fallback 生成的。"
  });
});

test("AnsweringService localizes fallback-generation quality summaries for Chinese questions", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "\u56de\u7b54 [1]",
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
    question: "\u8fd9\u4e2a\u6587\u6863\u91cc\u63d0\u5230\u4e86\u4ec0\u4e48\uff1f",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "concise",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "same_as_question",
      citationMode: "required",
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
        content: "\u4e2d\u6587\u5185\u5bb9",
        score: 0.9,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "fallback_generation",
    flags: ["fallback_generation"],
    summary: "\u56de\u7b54\u5df2\u57fa\u4e8e\u68c0\u7d22\u5230\u7684\u5185\u5bb9\uff0c\u4f46\u5b83\u662f\u901a\u8fc7\u672c\u5730 fallback \u751f\u6210\u7684\u3002"
  });
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
    primaryIssue: "none",
    flags: [],
    summary: "Answer is grounded in retrieved sources with no reported gaps."
  });
});

test("AnsweringService localizes generic strong summaries when citations are optional", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "杩欐槸涓€涓病鏈夋樉寮忓紩鐢ㄧ殑鍥炵瓟銆?",
      modelName: "test-model",
      answerStatus: "grounded",
      missingInformation: []
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "鍙戠敓浜嗕粈涔堬紵",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "same_as_question",
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
        content: "涓枃涓婁笅鏂?",
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
    primaryIssue: "none",
    flags: [],
    summary: "回答已基于检索到的来源，且没有发现已知缺口。"
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
    promptContextCount: 1,
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
    primaryIssue: "none",
    flags: [],
    summary: "Answer is grounded in cited sources with no reported gaps."
  });
});

test("AnsweringService does not claim cited-source grounding when citations were heuristically backfilled", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Answer text without explicit source markers.",
      modelName: "test-model",
      answerStatus: "grounded",
      missingInformation: []
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "where is the marker?",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "en",
      citationMode: "required",
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
        content: "marker evidence line",
        score: 0.92,
        pageNo: null,
        sectionTitle: "Facts"
      }
    ]
  });

  assert.equal(result.citations.length, 1);
  assert.deepEqual(result.qualityEvaluation, {
    overall: "strong",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "none",
    flags: [],
    summary:
      "Answer is grounded in retrieved sources with backend-inferred citations and no reported gaps."
  });
});

test("AnsweringService localizes strong summaries when citations were heuristically backfilled", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "没有显式来源标记的回答。",
      modelName: "test-model",
      answerStatus: "grounded",
      missingInformation: []
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "标记在哪里？",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "same_as_question",
      citationMode: "required",
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
        content: "marker evidence line",
        score: 0.92,
        pageNo: null,
        sectionTitle: "Facts"
      }
    ]
  });

  assert.equal(result.citations.length, 1);
  assert.deepEqual(result.qualityEvaluation, {
    overall: "strong",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "none",
    flags: [],
    summary: "回答已基于检索到的来源，引用由后端推断补齐，且没有发现已知缺口。"
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

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "partial",
    primaryIssue: "missing_information",
    flags: ["missing_information"],
    summary: "Answer is grounded but incomplete because some information is missing."
  });
});

test("AnsweringService mentions both missing information and low retrieval confidence in partial summaries when both apply", async () => {
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
      tone: "neutral",
      outputFormat: "paragraph",
      language: "en",
      citationMode: "required",
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
        score: 0.4,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "partial",
    primaryIssue: "missing_information",
    flags: ["missing_information", "low_retrieval_score"],
    summary: "Answer is grounded but incomplete because some information is missing, and retrieval confidence was low."
  });
});

test("AnsweringService localizes partial summaries that combine missing information and low retrieval confidence", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "\u90e8\u5206\u56de\u7b54 [1]",
      modelName: "test-model",
      answerStatus: "grounded",
      missingInformation: ["\u7f3a\u5c11\u4ef7\u683c\u4fe1\u606f"],
      citedChunkNumbers: [1]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "\u5728\u54ea\u91cc\uff1f",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "same_as_question",
      citationMode: "required",
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
        content: "\u7b2c\u4e00\u6bb5\u4e0a\u4e0b\u6587",
        score: 0.4,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "missing_information");
  assert.deepEqual(result.qualityEvaluation.flags, ["missing_information", "low_retrieval_score"]);
  assert.equal(
    result.qualityEvaluation.summary,
    "\u56de\u7b54\u5df2\u57fa\u4e8e\u68c0\u7d22\u5230\u7684\u5185\u5bb9\uff0c\u4f46\u4ecd\u4e0d\u5b8c\u6574\uff1a\u90e8\u5206\u4fe1\u606f\u7f3a\u5931\uff0c\u4e14\u68c0\u7d22\u7f6e\u4fe1\u5ea6\u504f\u4f4e\u3002"
  );
});

test("AnsweringService localizes missing-information partial summaries for Chinese questions", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "部分回答 [1]",
      modelName: "test-model",
      answerStatus: "grounded",
      missingInformation: ["缺少价格信息"],
      citedChunkNumbers: [1]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "在哪里？",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "same_as_question",
      citationMode: "required",
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
        content: "第一段上下文",
        score: 0.9,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "partial",
    primaryIssue: "missing_information",
    flags: ["missing_information"],
    summary: "回答已基于检索到的内容，但仍不完整：部分信息缺失。"
  });
});

test("AnsweringService reports a retrieval-score-specific partial quality summary when top retrieval confidence is low", async () => {
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
    question: "where?",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "en",
      citationMode: "required",
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
        score: 0.4,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "low_retrieval_score",
    flags: ["low_retrieval_score"],
    summary: "Answer is grounded, but retrieval confidence was low for the supporting context."
  });
});

test("AnsweringService localizes low-retrieval grounded summaries for Chinese questions", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "回答 [1]",
      modelName: "test-model",
      answerStatus: "grounded",
      missingInformation: [],
      citedChunkNumbers: [1]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "在哪里？",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "same_as_question",
      citationMode: "required",
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
        content: "第一段上下文",
        score: 0.4,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "low_retrieval_score",
    flags: ["low_retrieval_score"],
    summary: "回答已基于检索到的内容，但支持上下文的检索置信度偏低。"
  });
});

test("AnsweringService keeps fallback_generation as the primary issue when fallback answers also have low retrieval confidence", async () => {
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
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "en",
      citationMode: "required",
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
        score: 0.4,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "fallback_generation",
    flags: ["low_retrieval_score", "fallback_generation"],
    summary: "Answer is grounded, but retrieval confidence was low for the supporting context, and it was produced through local fallback behavior."
  });
});

test("AnsweringService localizes low-retrieval fallback summaries for Chinese questions", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "本地 fallback 回答 [1]",
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
    question: "在哪里？",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "same_as_question",
      citationMode: "required",
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
        content: "第一段上下文",
        score: 0.4,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "fallback_generation",
    flags: ["low_retrieval_score", "fallback_generation"],
    summary: "回答已基于检索到的内容，但支持上下文的检索置信度偏低，且它是通过本地 fallback 生成的。"
  });
});

test("AnsweringService combines missing information, low retrieval confidence, and fallback generation in English partial summaries", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Fallback answer with partial support [1]",
      modelName: "fallback-local",
      promptId: "answer.v2",
      usedFallback: true,
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
      tone: "neutral",
      outputFormat: "paragraph",
      language: "en",
      citationMode: "required",
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
        score: 0.2,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "partial",
    primaryIssue: "fallback_generation",
    flags: ["missing_information", "low_retrieval_score", "fallback_generation"],
    summary:
      "Answer is grounded but incomplete because some information is missing, retrieval confidence was low, and it was produced through local fallback behavior."
  });
});

test("AnsweringService keeps fallback_generation as the primary issue when fallback answers also miss information", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "Fallback partial answer [1]",
      modelName: "fallback-local",
      promptId: "answer.v2",
      usedFallback: true,
      answerStatus: "grounded",
      missingInformation: ["Need pricing details."],
      citedChunkNumbers: [1]
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
      language: "en",
      citationMode: "required",
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

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "partial",
    primaryIssue: "fallback_generation",
    flags: ["missing_information", "fallback_generation"],
    summary: "Answer is grounded but incomplete because some information is missing, and it was produced through local fallback behavior."
  });
});

test("AnsweringService localizes partial summaries when fallback answers also miss information", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "本地 fallback 部分回答 [1]",
      modelName: "fallback-local",
      promptId: "answer.v2",
      usedFallback: true,
      answerStatus: "grounded",
      missingInformation: ["缺少价格信息。"],
      citedChunkNumbers: [1]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "在哪里？",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "same_as_question",
      citationMode: "required",
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
        content: "第一段上下文",
        score: 0.9,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "fallback_generation");
  assert.deepEqual(result.qualityEvaluation.flags, ["missing_information", "fallback_generation"]);
  assert.equal(
    result.qualityEvaluation.summary,
    "回答已基于检索到的内容，但仍不完整：部分信息缺失，且它是通过本地 fallback 生成的。"
  );
});

test("AnsweringService localizes partial summaries when missing information, low retrieval confidence, and fallback generation all apply", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "本地 fallback 部分回答 [1]",
      modelName: "fallback-local",
      promptId: "answer.v2",
      usedFallback: true,
      answerStatus: "grounded",
      missingInformation: ["缺少价格信息。"],
      citedChunkNumbers: [1]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "在哪里？",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "same_as_question",
      citationMode: "required",
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
        content: "第一段上下文",
        score: 0.4,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "fallback_generation");
  assert.deepEqual(result.qualityEvaluation.flags, [
    "missing_information",
    "low_retrieval_score",
    "fallback_generation"
  ]);
  assert.equal(
    result.qualityEvaluation.summary,
    "回答已基于检索到的内容，但仍不完整：部分信息缺失，检索置信度偏低，且它是通过本地 fallback 生成的。"
  );
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
    primaryIssue: "no_retrieval_hits",
    flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
    summary: "Answer quality is weak because supporting context was insufficient."
  });
});

test("AnsweringService localizes weak insufficient-context quality summaries for Chinese questions", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "\u4e0d\u77e5\u9053\u3002",
      modelName: "test-model",
      answerStatus: "insufficient_context",
      missingInformation: ["\u6ca1\u6709\u68c0\u7d22\u5230\u53ef\u7528\u4e8e\u652f\u6301\u56de\u7b54\u7684\u76f8\u5173\u6765\u6e90\u3002"]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "\u8fd9\u4e2a\u95ee\u9898\u7f3a\u5c11\u4ec0\u4e48\u4fe1\u606f\uff1f",
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

  assert.deepEqual(result.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "no_retrieval_hits",
    flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
    summary: "\u56de\u7b54\u8d28\u91cf\u8f83\u5f31\uff0c\u56e0\u4e3a\u6ca1\u6709\u8db3\u591f\u7684\u652f\u6301\u4e0a\u4e0b\u6587\u3002"
  });
});

test("AnsweringService preserves localized no-hit weak quality metadata for Chinese questions", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "不知道。",
      modelName: "test-model",
      answerStatus: "insufficient_context",
      missingInformation: ["没有检索到可用于支持回答的相关来源。"]
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

  assert.deepEqual(result.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "no_retrieval_hits",
    flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
    summary: "回答质量较弱，因为没有足够的支持上下文。"
  });
});

test("AnsweringService distinguishes weak insufficient-context summaries when retrieval produced context", async () => {
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
    question: "where?",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "en",
      citationMode: "required",
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
        content: "first chunk with partial support",
        score: 0.8,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "insufficient_context",
    flags: ["insufficient_context", "missing_information"],
    summary: "Answer quality is weak because retrieved context was still insufficient."
  });
});

test("AnsweringService localizes hit-aware weak insufficient-context summaries for Chinese questions", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "不知道。",
      modelName: "test-model",
      answerStatus: "insufficient_context",
      missingInformation: ["缺少价格信息。"]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "在哪里？",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "same_as_question",
      citationMode: "required",
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
        content: "部分上下文",
        score: 0.8,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "insufficient_context",
    flags: ["insufficient_context", "missing_information"],
    summary: "回答质量较弱，因为即使已检索到上下文，仍不足以支持可靠回答。"
  });
});

test("AnsweringService mentions low retrieval confidence in weak insufficient-context summaries", async () => {
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
    question: "where?",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "en",
      citationMode: "required",
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
        content: "first chunk with partial support",
        score: 0.4,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "insufficient_context",
    flags: ["insufficient_context", "missing_information", "low_retrieval_score"],
    summary: "Answer quality is weak because retrieved context was still insufficient, and retrieval confidence was low."
  });
});

test("AnsweringService localizes low-confidence weak insufficient-context summaries for Chinese questions", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "\u4e0d\u77e5\u9053\u3002",
      modelName: "test-model",
      answerStatus: "insufficient_context",
      missingInformation: ["\u7f3a\u5c11\u4ef7\u683c\u4fe1\u606f\u3002"]
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "\u5728\u54ea\u91cc\uff1f",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "same_as_question",
      citationMode: "required",
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
        content: "\u90e8\u5206\u4e0a\u4e0b\u6587",
        score: 0.4,
        pageNo: null,
        sectionTitle: "A"
      }
    ]
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "insufficient_context",
    flags: ["insufficient_context", "missing_information", "low_retrieval_score"],
    summary:
      "\u56de\u7b54\u8d28\u91cf\u8f83\u5f31\uff0c\u56e0\u4e3a\u5373\u4f7f\u5df2\u68c0\u7d22\u5230\u4e0a\u4e0b\u6587\uff0c\u4ecd\u4e0d\u8db3\u4ee5\u652f\u6301\u53ef\u9760\u56de\u7b54\uff0c\u4e14\u68c0\u7d22\u7f6e\u4fe1\u5ea6\u504f\u4f4e\u3002"
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
  assert.deepEqual(result.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "no_retrieval_hits",
    flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
    summary: "Answer quality is weak because supporting context was insufficient."
  });
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
  assert.deepEqual(result.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "no_retrieval_hits",
    flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
    summary: "Answer quality is weak because supporting context was insufficient."
  });
});

test("AnsweringService uses a hit-aware deterministic missingInformation reason when retrieved context is still insufficient", async () => {
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
      noAnswerBehavior: "best_effort",
      includeMissingInformation: true
    },
    chunks: [
      {
        chunkId: "chunk-1",
        documentId: "document-1",
        documentTitle: "Document 1",
        content: "This section mentions the product but not its price.",
        score: 0.82,
        pageNo: null,
        sectionTitle: "Overview"
      }
    ]
  });

  assert.deepEqual(result.missingInformation, [
    "Retrieved context was still insufficient to support a reliable answer."
  ]);
  assert.deepEqual(result.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "insufficient_context",
    flags: ["insufficient_context", "missing_information"],
    summary: "Answer quality is weak because retrieved context was still insufficient."
  });
});

test("AnsweringService localizes the deterministic missingInformation reason for Chinese insufficient-context answers", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "\u4e0d\u77e5\u9053\u3002",
      modelName: "test-model",
      answerStatus: "insufficient_context",
      missingInformation: []
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "\u8fd9\u4e2a\u95ee\u9898\u7f3a\u5c11\u4ec0\u4e48\u4fe1\u606f\uff1f",
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

  assert.deepEqual(result.missingInformation, [
    "\u6ca1\u6709\u68c0\u7d22\u5230\u53ef\u7528\u4e8e\u652f\u6301\u56de\u7b54\u7684\u76f8\u5173\u6765\u6e90\u3002"
  ]);
});

test("AnsweringService localizes the hit-aware deterministic missingInformation reason for Chinese insufficient-context answers", async () => {
  const llmService = {
    generateAnswer: async () => ({
      answer: "\u4e0d\u77e5\u9053\u3002",
      modelName: "test-model",
      answerStatus: "insufficient_context",
      missingInformation: []
    })
  };

  const service = new AnsweringService(llmService);
  const result = await service.generateAnswer({
    question: "\u8fd9\u4e2a\u4ef7\u683c\u662f\u591a\u5c11\uff1f",
    systemPrompt: "answer",
    answerPolicy: {
      responseStyle: "concise",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "same_as_question",
      citationMode: "required",
      maxCitations: 3,
      noAnswerBehavior: "best_effort",
      includeMissingInformation: true
    },
    chunks: [
      {
        chunkId: "chunk-1",
        documentId: "document-1",
        documentTitle: "Document 1",
        content: "\u8fd9\u4e00\u6bb5\u63d0\u5230\u4e86\u4ea7\u54c1\uff0c\u4f46\u6ca1\u6709\u4ef7\u683c\u4fe1\u606f\u3002",
        score: 0.82,
        pageNo: null,
        sectionTitle: "Overview"
      }
    ]
  });

  assert.deepEqual(result.missingInformation, [
    "\u5df2\u68c0\u7d22\u5230\u76f8\u5173\u4e0a\u4e0b\u6587\uff0c\u4f46\u4ecd\u4e0d\u8db3\u4ee5\u652f\u6301\u53ef\u9760\u56de\u7b54\u3002"
  ]);
});
