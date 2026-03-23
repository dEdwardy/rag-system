const assert = require("node:assert/strict");
const { createLlmService, withEnv, withFetchMock } = require("./support/llm-test-helpers.js");

const conciseAnswerPolicy = {
  responseStyle: "concise",
  citationMode: "required",
  maxCitations: 2,
  noAnswerBehavior: "say_insufficient_context"
};

const localizedAnswerPolicy = {
  responseStyle: "concise",
  tone: "neutral",
  outputFormat: "paragraph",
  citationMode: "required",
  maxCitations: 2,
  noAnswerBehavior: "say_insufficient_context",
  includeMissingInformation: true
};

test("LlmService uses prompt manager output for Ollama answer generation", async () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;
  const originalModel = process.env.OLLAMA_MODEL;
  const seenBodies = [];

  global.fetch = async (_url, options) => {
    seenBodies.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => ({
        response:
          '{"answer":"Managed answer","status":"grounded","citations":[1],"missingInformation":[]}'
      })
    };
  };

  process.env.OLLAMA_BASE_URL = "http://localhost:11434";
  process.env.OLLAMA_MODEL = "test-model";

  const service = createLlmService();

  try {
    const result = await service.generateAnswer({
      question: "Where is the answer?",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: conciseAnswerPolicy,
      chunks: []
    });

    assert.equal(result.answer, "Managed answer");
    assert.equal(seenBodies.length, 1);
    assert.equal(seenBodies[0].prompt, "managed full prompt");
  } finally {
    global.fetch = originalFetch;
    process.env.OLLAMA_BASE_URL = originalBaseUrl;
    process.env.OLLAMA_MODEL = originalModel;
  }
});

test("LlmService uses prompt manager output for Ollama rewrite generation", async () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;
  const originalModel = process.env.OLLAMA_MODEL;
  const seenBodies = [];

  global.fetch = async (_url, options) => {
    seenBodies.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => ({
        response: "managed rewritten query"
      })
    };
  };

  process.env.OLLAMA_BASE_URL = "http://localhost:11434";
  process.env.OLLAMA_MODEL = "test-model";

  const service = createLlmService();

  try {
    const result = await service.rewriteQuery({
      question: "Please tell me about product ABC in short"
    });

    assert.equal(result.rewrittenQuery, "managed rewritten query");
    assert.equal(seenBodies.length, 1);
    assert.equal(seenBodies[0].prompt, "managed rewrite full prompt");
  } finally {
    global.fetch = originalFetch;
    process.env.OLLAMA_BASE_URL = originalBaseUrl;
    process.env.OLLAMA_MODEL = originalModel;
  }
});

test("LlmService normalizes structured answer JSON with schema constraints", async () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;
  const originalModel = process.env.OLLAMA_MODEL;

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      response:
        '{"answer":" Structured answer ","status":"grounded","citations":[1,"2",1,"2"],"missingInformation":["", " Need price ", "Need price"]}'
    })
  });

  process.env.OLLAMA_BASE_URL = "http://localhost:11434";
  process.env.OLLAMA_MODEL = "test-model";

  const service = createLlmService();

  try {
    const result = await service.generateAnswer({
      question: "Where is the answer?",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: conciseAnswerPolicy,
      chunks: []
    });

    assert.equal(result.answer, "Structured answer");
    assert.equal(result.answerStatus, "grounded");
    assert.deepEqual(result.citedChunkNumbers, [1, 2]);
    assert.deepEqual(result.missingInformation, ["Need price"]);
  } finally {
    global.fetch = originalFetch;
    process.env.OLLAMA_BASE_URL = originalBaseUrl;
    process.env.OLLAMA_MODEL = originalModel;
  }
});

test("LlmService preserves first-seen order when deduplicating missingInformation", async () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;
  const originalModel = process.env.OLLAMA_MODEL;

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      response:
        '{"answer":"Structured answer","status":"insufficient_context","citations":[],"missingInformation":["Need price","Need timeline","Need price","Need owner","Need timeline"]}'
    })
  });

  process.env.OLLAMA_BASE_URL = "http://localhost:11434";
  process.env.OLLAMA_MODEL = "test-model";

  const service = createLlmService();

  try {
    const result = await service.generateAnswer({
      question: "Where is the answer?",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: conciseAnswerPolicy,
      chunks: []
    });

    assert.deepEqual(result.missingInformation, ["Need price", "Need timeline", "Need owner"]);
  } finally {
    global.fetch = originalFetch;
    process.env.OLLAMA_BASE_URL = originalBaseUrl;
    process.env.OLLAMA_MODEL = originalModel;
  }
});

test("LlmService parses structured citation evidence objects", async () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;
  const originalModel = process.env.OLLAMA_MODEL;

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      response:
        '{"answer":"Structured answer","status":"grounded","citations":[1],"citationEvidence":[{"source":1,"quote":"retrieved content marker"}],"missingInformation":[]}'
    })
  });

  process.env.OLLAMA_BASE_URL = "http://localhost:11434";
  process.env.OLLAMA_MODEL = "test-model";

  const service = createLlmService();

  try {
    const result = await service.generateAnswer({
      question: "Where is the marker?",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: conciseAnswerPolicy,
      chunks: []
    });

    assert.equal(result.answer, "Structured answer");
    assert.deepEqual(result.citedChunkNumbers, [1]);
    assert.deepEqual(result.citationEvidence, [
      {
        source: 1,
        quote: "retrieved content marker"
      }
    ]);
  } finally {
    global.fetch = originalFetch;
    process.env.OLLAMA_BASE_URL = originalBaseUrl;
    process.env.OLLAMA_MODEL = originalModel;
  }
});

test("LlmService falls back when structured answer payload fails schema validation", async () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;
  const originalModel = process.env.OLLAMA_MODEL;

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      response: '{"status":"grounded","citations":[2],"missingInformation":[]}'
    })
  });

  process.env.OLLAMA_BASE_URL = "http://localhost:11434";
  process.env.OLLAMA_MODEL = "test-model";

  const service = createLlmService();

  try {
    const result = await service.generateAnswer({
      question: "Where is the answer?",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: conciseAnswerPolicy,
      chunks: []
    });

    assert.equal(result.answer, '{"status":"grounded","citations":[2],"missingInformation":[]}');
    assert.equal(result.answerStatus, undefined);
    assert.deepEqual(result.citedChunkNumbers, [2]);
    assert.deepEqual(result.missingInformation, []);
  } finally {
    global.fetch = originalFetch;
    process.env.OLLAMA_BASE_URL = originalBaseUrl;
    process.env.OLLAMA_MODEL = originalModel;
  }
});

test("LlmService local fallback no-hit answer respects explicit zh language policy", async () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;
  const originalModel = process.env.OLLAMA_MODEL;
  const originalApiKey = process.env.OPENAI_API_KEY;

  delete process.env.OLLAMA_BASE_URL;
  delete process.env.OLLAMA_MODEL;
  delete process.env.OPENAI_API_KEY;

  const service = createLlmService();

  try {
    const result = await service.generateAnswer({
      question: "价格是多少？",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: { ...localizedAnswerPolicy, language: "zh" },
      chunks: []
    });

    assert.equal(result.answer, "我没有在知识库中找到足够相关的信息来回答这个问题。");
    assert.equal(result.answerStatus, "insufficient_context");
  } finally {
    global.fetch = originalFetch;
    process.env.OLLAMA_BASE_URL = originalBaseUrl;
    process.env.OLLAMA_MODEL = originalModel;
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("LlmService local fallback no-hit answer follows same_as_question language detection", async () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;
  const originalModel = process.env.OLLAMA_MODEL;
  const originalApiKey = process.env.OPENAI_API_KEY;

  delete process.env.OLLAMA_BASE_URL;
  delete process.env.OLLAMA_MODEL;
  delete process.env.OPENAI_API_KEY;

  const service = createLlmService();

  try {
    const result = await service.generateAnswer({
      question: "这个文档里提到了什么？",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: { ...localizedAnswerPolicy, language: "same_as_question" },
      chunks: []
    });

    assert.equal(result.answer, "我没有在知识库中找到足够相关的信息来回答这个问题。");
    assert.equal(result.answerStatus, "insufficient_context");
  } finally {
    global.fetch = originalFetch;
    process.env.OLLAMA_BASE_URL = originalBaseUrl;
    process.env.OLLAMA_MODEL = originalModel;
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("LlmService local fallback no-hit missingInformation follows same_as_question language detection", async () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;
  const originalModel = process.env.OLLAMA_MODEL;
  const originalApiKey = process.env.OPENAI_API_KEY;

  delete process.env.OLLAMA_BASE_URL;
  delete process.env.OLLAMA_MODEL;
  delete process.env.OPENAI_API_KEY;

  const service = createLlmService();

  try {
    const result = await service.generateAnswer({
      question: "\u8fd9\u4e2a\u6587\u6863\u91cc\u63d0\u5230\u4e86\u4ec0\u4e48\uff1f",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: { ...localizedAnswerPolicy, language: "same_as_question" },
      chunks: []
    });

    assert.deepEqual(result.missingInformation, [
      "\u6ca1\u6709\u68c0\u7d22\u5230\u53ef\u7528\u4e8e\u652f\u6301\u56de\u7b54\u7684\u76f8\u5173\u6765\u6e90\u3002"
    ]);
  } finally {
    global.fetch = originalFetch;
    process.env.OLLAMA_BASE_URL = originalBaseUrl;
    process.env.OLLAMA_MODEL = originalModel;
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("LlmService local fallback grounded answer respects explicit zh language policy", async () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;
  const originalModel = process.env.OLLAMA_MODEL;
  const originalApiKey = process.env.OPENAI_API_KEY;

  delete process.env.OLLAMA_BASE_URL;
  delete process.env.OLLAMA_MODEL;
  delete process.env.OPENAI_API_KEY;

  const service = createLlmService();

  try {
    const result = await service.generateAnswer({
      question: "\u8fd9\u4e2a\u6587\u6863\u63d0\u5230\u4e86\u4ec0\u4e48\uff1f",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: { ...localizedAnswerPolicy, language: "zh" },
      chunks: [
        {
          content: "\u8fd9\u662f\u68c0\u7d22\u5230\u7684\u4e2d\u6587\u7247\u6bb5\u3002",
          sourceId: "source-1",
          chunkId: "chunk-1",
          score: 0.8,
          metadata: {}
        }
      ]
    });

    assert.equal(result.answer, "\u6839\u636e\u68c0\u7d22\u5230\u7684\u6765\u6e90 [1]\uff0c\u76ee\u524d\u6700\u76f8\u5173\u7684\u4fe1\u606f\u662f\uff1a\n\n\u8fd9\u662f\u68c0\u7d22\u5230\u7684\u4e2d\u6587\u7247\u6bb5\u3002");
    assert.equal(result.answerStatus, "grounded");
    assert.deepEqual(result.citedChunkNumbers, [1]);
  } finally {
    global.fetch = originalFetch;
    process.env.OLLAMA_BASE_URL = originalBaseUrl;
    process.env.OLLAMA_MODEL = originalModel;
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("LlmService local fallback grounded answer follows same_as_question language detection", async () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;
  const originalModel = process.env.OLLAMA_MODEL;
  const originalApiKey = process.env.OPENAI_API_KEY;

  delete process.env.OLLAMA_BASE_URL;
  delete process.env.OLLAMA_MODEL;
  delete process.env.OPENAI_API_KEY;

  const service = createLlmService();

  try {
    const result = await service.generateAnswer({
      question: "\u8fd9\u4e2a\u6587\u6863\u63d0\u5230\u4e86\u4ec0\u4e48\uff1f",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: { ...localizedAnswerPolicy, language: "same_as_question" },
      chunks: [
        {
          content: "\u8fd9\u662f\u68c0\u7d22\u5230\u7684\u4e2d\u6587\u7247\u6bb5\u3002",
          sourceId: "source-1",
          chunkId: "chunk-1",
          score: 0.8,
          metadata: {}
        }
      ]
    });

    assert.equal(result.answer, "\u6839\u636e\u68c0\u7d22\u5230\u7684\u6765\u6e90 [1]\uff0c\u76ee\u524d\u6700\u76f8\u5173\u7684\u4fe1\u606f\u662f\uff1a\n\n\u8fd9\u662f\u68c0\u7d22\u5230\u7684\u4e2d\u6587\u7247\u6bb5\u3002");
    assert.equal(result.answerStatus, "grounded");
    assert.deepEqual(result.citedChunkNumbers, [1]);
  } finally {
    global.fetch = originalFetch;
    process.env.OLLAMA_BASE_URL = originalBaseUrl;
    process.env.OLLAMA_MODEL = originalModel;
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});
