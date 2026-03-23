const assert = require("node:assert/strict");
const { createLlmService, withEnv, withFetchMock } = require("./support/llm-test-helpers.js");

test("LlmService exposes a native answer streaming API that emits provider deltas and a completed result", async () => {
  const service = createLlmService({
    answerPrompt: {
      promptId: "answer.v2",
      systemPrompt: "system prompt",
      userPrompt: "user prompt",
      fullPrompt: "system\n\nuser"
    },
    rewritePrompt: {
      promptId: "rewrite-query.v1",
      fullPrompt: "rewrite"
    }
  });

  assert.equal(typeof service.generateAnswerStream, "function");

  const deltas = [];
  const result = await withFetchMock(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode('{"response":"Alpha ","done":false}\n'));
            controller.enqueue(encoder.encode('{"response":"Beta","done":false}\n'));
            controller.enqueue(
              encoder.encode(
                '{"response":"","done":true,"model":"qwen-test","prompt_eval_count":10,"eval_count":2}\n'
              )
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
      ),
    () =>
      withEnv(
        {
          OLLAMA_BASE_URL: "http://ollama.test",
          OLLAMA_MODEL: "qwen-test"
        },
        () =>
          service.generateAnswerStream({
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
          })
      )
  );

  assert.deepEqual(deltas, ["Alpha ", "Beta"]);
  assert.equal(result.rawAnswer, "Alpha Beta");
  assert.equal(result.modelName, "ollama:qwen-test");
  assert.equal(result.promptId, "answer.v2");
});

test("LlmService fallback stream aligns no-hit deltas with say_insufficient_context behavior", async () => {
  const service = createLlmService({
    answerPrompt: {
      promptId: "answer.v2",
      systemPrompt: "system prompt",
      userPrompt: "user prompt",
      fullPrompt: "system\n\nuser"
    },
    rewritePrompt: {
      promptId: "rewrite-query.v1",
      fullPrompt: "rewrite"
    }
  });

  const deltas = [];

  const result = await withEnv(
    {
      OLLAMA_BASE_URL: undefined,
      OLLAMA_MODEL: undefined,
      OPENAI_API_KEY: undefined
    },
    () =>
      service.generateAnswerStream({
        question: "What detail is missing?",
        systemPrompt: "system prompt",
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
        chunks: [],
        onDelta: delta => {
          deltas.push(delta);
        }
      })
  );

  assert.deepEqual(deltas, [
    "I don't have enough information in the retrieved sources to answer that reliably."
  ]);
  assert.equal(
    result.rawAnswer,
    "I don't have enough information in the retrieved sources to answer that reliably."
  );
  assert.equal(result.modelName, "fallback-local");
  assert.equal(result.promptId, "answer.v2");
});
