const test = require("node:test");
const assert = require("node:assert/strict");

const { LlmService } = require("../dist/infra/llm/llm.service.js");

test("LlmService exposes a native answer streaming API that emits provider deltas and a completed result", async () => {
  const service = new LlmService({
    buildAnswerPrompt: () => ({
      promptId: "answer.v2",
      systemPrompt: "system prompt",
      userPrompt: "user prompt",
      fullPrompt: "system\n\nuser"
    }),
    buildRewritePrompt: () => ({
      promptId: "rewrite-query.v1",
      fullPrompt: "rewrite"
    }),
    getAnswerPromptId: () => "answer.v2",
    getRewritePromptId: () => "rewrite-query.v1"
  });

  assert.equal(typeof service.generateAnswerStream, "function");

  const originalFetch = global.fetch;
  const deltas = [];
  process.env.OLLAMA_BASE_URL = "http://ollama.test";
  process.env.OLLAMA_MODEL = "qwen-test";

  global.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('{"response":"Alpha ","done":false}\n'));
          controller.enqueue(encoder.encode('{"response":"Beta","done":false}\n'));
          controller.enqueue(
            encoder.encode('{"response":"","done":true,"model":"qwen-test","prompt_eval_count":10,"eval_count":2}\n')
          );
          controller.close();
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/x-ndjson"
        }
      }
    );

  try {
    const result = await service.generateAnswerStream({
      question: "Where is the marker?",
      systemPrompt: "system prompt",
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
      chunks: [],
      onDelta: delta => {
        deltas.push(delta);
      }
    });

    assert.deepEqual(deltas, ["Alpha ", "Beta"]);
    assert.equal(result.rawAnswer, "Alpha Beta");
    assert.equal(result.modelName, "ollama:qwen-test");
    assert.equal(result.promptId, "answer.v2");
  } finally {
    global.fetch = originalFetch;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_MODEL;
  }
});
