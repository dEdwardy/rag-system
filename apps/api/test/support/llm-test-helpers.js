const { LlmService } = require("../../src/infra/llm/llm.service.ts");

function createPromptManagerStub(input = {}) {
  const answerPrompt = {
    promptId: "answer.v1",
    systemPrompt: "managed system prompt",
    userPrompt: "managed user prompt",
    fullPrompt: "managed full prompt",
    ...(input.answerPrompt ?? {})
  };
  const rewritePrompt = {
    promptId: "rewrite-query.v1",
    systemPrompt: "managed rewrite system",
    userPrompt: "managed rewrite user",
    fullPrompt: "managed rewrite full prompt",
    ...(input.rewritePrompt ?? {})
  };

  return {
    buildAnswerPrompt: () => answerPrompt,
    buildRewritePrompt: () => rewritePrompt,
    getAnswerPromptId: () => answerPrompt.promptId,
    getRewritePromptId: () => rewritePrompt.promptId
  };
}

function createLlmService(input = {}) {
  return new LlmService(createPromptManagerStub(input));
}

async function withEnv(overrides, run) {
  const originalEntries = new Map();

  for (const [key, value] of Object.entries(overrides)) {
    originalEntries.set(key, Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of originalEntries.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function withFetchMock(fetchImpl, run) {
  const originalFetch = global.fetch;
  global.fetch = fetchImpl;

  try {
    return await run();
  } finally {
    global.fetch = originalFetch;
  }
}

module.exports = {
  createLlmService,
  createPromptManagerStub,
  withEnv,
  withFetchMock
};
