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
