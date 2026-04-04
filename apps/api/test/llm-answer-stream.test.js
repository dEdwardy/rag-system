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
  assert.equal(result.answerStatus, "insufficient_context");
  assert.deepEqual(result.missingInformation, ["No relevant supporting sources were retrieved."]);
});

test("LlmService rethrows AbortError during native answer streaming instead of falling back", async () => {
  const service = createLlmService({
    answerPrompt: {
      promptId: "answer.v2",
      systemPrompt: "system prompt",
      userPrompt: "user prompt",
      fullPrompt: "system\n\nuser"
    }
  });

  const controller = new AbortController();

  await assert.rejects(
    () =>
      withFetchMock(
        (_, init) =>
          new Promise((_, reject) => {
            init.signal.addEventListener(
              "abort",
              () => {
                const error = new Error("stream aborted");
                error.name = "AbortError";
                reject(error);
              },
              { once: true }
            );

            controller.abort();
          }),
        () =>
          withEnv(
            {
              OLLAMA_BASE_URL: undefined,
              OLLAMA_MODEL: undefined,
              OPENAI_API_KEY: "test-key",
              OPENAI_BASE_URL: "https://openai-proxy.local/v1",
              OPENAI_CHAT_MODEL: "chat-model"
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
                signal: controller.signal,
                onDelta: () => {}
              })
          )
      ),
    error => error instanceof Error && error.name === "AbortError"
  );
});

test("LlmService recovers readable answer text from malformed structured payloads", () => {
  const service = createLlmService({
    answerPrompt: {
      promptId: "answer.v2",
      systemPrompt: "system prompt",
      userPrompt: "user prompt",
      fullPrompt: "system\n\nuser"
    }
  });

  const result = service.parseStructuredAnswer({
    rawAnswer: JSON.stringify({
      answer: "Codex App 更像一个给代理编程准备的桌面工作台。",
      citations: "grounded",
      citationEvidence: [
        {
          source: 1,
          quote: "Codex App 更像一个给代理编程准备的桌面工作台"
        }
      ],
      missingInformation: []
    }),
    modelName: "test-model",
    promptId: "answer.v2",
    usedFallback: false
  });

  assert.equal(result.answer, "Codex App 更像一个给代理编程准备的桌面工作台。");
  assert.equal(result.answerStatus, "grounded");
  assert.deepEqual(result.citedChunkNumbers, [1]);
  assert.deepEqual(result.citationEvidence, [
    {
      source: 1,
      quote: "Codex App 更像一个给代理编程准备的桌面工作台"
    }
  ]);
  assert.deepEqual(result.missingInformation, []);
});

test("LlmService extracts answer preview when structured payload is not valid JSON", () => {
  const service = createLlmService({
    answerPrompt: {
      promptId: "answer.v2",
      systemPrompt: "system prompt",
      userPrompt: "user prompt",
      fullPrompt: "system\n\nuser"
    }
  });

  const result = service.parseStructuredAnswer({
    rawAnswer:
      '{"answer":"Codex App 更像一个给代理编程准备的桌面工作台。","citations":"grounded","citationEvidence":[{"source":1,"quote":"Codex App 更像一个给代理编程准备的桌面工作台"}],"missingInformation":[]',
    modelName: "test-model",
    promptId: "answer.v2",
    usedFallback: false
  });

  assert.equal(result.answer, "Codex App 更像一个给代理编程准备的桌面工作台。");
  assert.equal(result.answerStatus, undefined);
  assert.deepEqual(result.citedChunkNumbers, []);
  assert.deepEqual(result.citationEvidence, []);
  assert.deepEqual(result.missingInformation, []);
});
