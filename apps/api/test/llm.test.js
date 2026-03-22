const test = require("node:test");
const assert = require("node:assert/strict");
const { LlmService } = require("../dist/infra/llm/llm.service.js");

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

  const service = new LlmService({
    buildAnswerPrompt: () => ({
      promptId: "answer.v1",
      systemPrompt: "managed system prompt",
      userPrompt: "managed user prompt",
      fullPrompt: "managed full prompt"
    }),
    buildRewritePrompt: () => ({
      promptId: "rewrite-query.v1",
      systemPrompt: "managed rewrite system",
      userPrompt: "managed rewrite user",
      fullPrompt: "managed rewrite full prompt"
    })
  });

  try {
    const result = await service.generateAnswer({
      question: "Where is the answer?",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: {
        responseStyle: "concise",
        citationMode: "required",
        maxCitations: 2,
        noAnswerBehavior: "say_insufficient_context"
      },
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

  const service = new LlmService({
    buildAnswerPrompt: () => ({
      promptId: "answer.v1",
      systemPrompt: "managed system prompt",
      userPrompt: "managed user prompt",
      fullPrompt: "managed full prompt"
    }),
    buildRewritePrompt: () => ({
      promptId: "rewrite-query.v1",
      systemPrompt: "managed rewrite system",
      userPrompt: "managed rewrite user",
      fullPrompt: "managed rewrite full prompt"
    })
  });

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

  const service = new LlmService({
    buildAnswerPrompt: () => ({
      promptId: "answer.v1",
      systemPrompt: "managed system prompt",
      userPrompt: "managed user prompt",
      fullPrompt: "managed full prompt"
    }),
    buildRewritePrompt: () => ({
      promptId: "rewrite-query.v1",
      systemPrompt: "managed rewrite system",
      userPrompt: "managed rewrite user",
      fullPrompt: "managed rewrite full prompt"
    })
  });

  try {
    const result = await service.generateAnswer({
      question: "Where is the answer?",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: {
        responseStyle: "concise",
        citationMode: "required",
        maxCitations: 2,
        noAnswerBehavior: "say_insufficient_context"
      },
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

  const service = new LlmService({
    buildAnswerPrompt: () => ({
      promptId: "answer.v1",
      systemPrompt: "managed system prompt",
      userPrompt: "managed user prompt",
      fullPrompt: "managed full prompt"
    }),
    buildRewritePrompt: () => ({
      promptId: "rewrite-query.v1",
      systemPrompt: "managed rewrite system",
      userPrompt: "managed rewrite user",
      fullPrompt: "managed rewrite full prompt"
    })
  });

  try {
    const result = await service.generateAnswer({
      question: "Where is the answer?",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: {
        responseStyle: "concise",
        citationMode: "required",
        maxCitations: 2,
        noAnswerBehavior: "say_insufficient_context"
      },
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

  const service = new LlmService({
    buildAnswerPrompt: () => ({
      promptId: "answer.v1",
      systemPrompt: "managed system prompt",
      userPrompt: "managed user prompt",
      fullPrompt: "managed full prompt"
    }),
    buildRewritePrompt: () => ({
      promptId: "rewrite-query.v1",
      systemPrompt: "managed rewrite system",
      userPrompt: "managed rewrite user",
      fullPrompt: "managed rewrite full prompt"
    })
  });

  try {
    const result = await service.generateAnswer({
      question: "Where is the marker?",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: {
        responseStyle: "concise",
        citationMode: "required",
        maxCitations: 2,
        noAnswerBehavior: "say_insufficient_context"
      },
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

  const service = new LlmService({
    buildAnswerPrompt: () => ({
      promptId: "answer.v1",
      systemPrompt: "managed system prompt",
      userPrompt: "managed user prompt",
      fullPrompt: "managed full prompt"
    }),
    buildRewritePrompt: () => ({
      promptId: "rewrite-query.v1",
      systemPrompt: "managed rewrite system",
      userPrompt: "managed rewrite user",
      fullPrompt: "managed rewrite full prompt"
    })
  });

  try {
    const result = await service.generateAnswer({
      question: "Where is the answer?",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: {
        responseStyle: "concise",
        citationMode: "required",
        maxCitations: 2,
        noAnswerBehavior: "say_insufficient_context"
      },
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

  const service = new LlmService({
    buildAnswerPrompt: () => ({
      promptId: "answer.v1",
      systemPrompt: "managed system prompt",
      userPrompt: "managed user prompt",
      fullPrompt: "managed full prompt"
    }),
    buildRewritePrompt: () => ({
      promptId: "rewrite-query.v1",
      systemPrompt: "managed rewrite system",
      userPrompt: "managed rewrite user",
      fullPrompt: "managed rewrite full prompt"
    }),
    getAnswerPromptId: () => "answer.v1",
    getRewritePromptId: () => "rewrite-query.v1"
  });

  try {
    const result = await service.generateAnswer({
      question: "价格是多少？",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: {
        responseStyle: "concise",
        tone: "neutral",
        outputFormat: "paragraph",
        language: "zh",
        citationMode: "required",
        maxCitations: 2,
        noAnswerBehavior: "say_insufficient_context",
        includeMissingInformation: true
      },
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

  const service = new LlmService({
    buildAnswerPrompt: () => ({
      promptId: "answer.v1",
      systemPrompt: "managed system prompt",
      userPrompt: "managed user prompt",
      fullPrompt: "managed full prompt"
    }),
    buildRewritePrompt: () => ({
      promptId: "rewrite-query.v1",
      systemPrompt: "managed rewrite system",
      userPrompt: "managed rewrite user",
      fullPrompt: "managed rewrite full prompt"
    }),
    getAnswerPromptId: () => "answer.v1",
    getRewritePromptId: () => "rewrite-query.v1"
  });

  try {
    const result = await service.generateAnswer({
      question: "这个文档里提到了什么？",
      systemPrompt: "ignored direct system prompt",
      answerPolicy: {
        responseStyle: "concise",
        tone: "neutral",
        outputFormat: "paragraph",
        language: "same_as_question",
        citationMode: "required",
        maxCitations: 2,
        noAnswerBehavior: "say_insufficient_context",
        includeMissingInformation: true
      },
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
