const test = require("node:test");
const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

const apiModuleUrl = pathToFileURL(resolve(__dirname, "../src/lib/api.ts")).href;

async function loadApiModule() {
  return import(apiModuleUrl);
}

test("apiStreamRequest rejects when the NDJSON stream emits an error event", async () => {
  const { apiStreamRequest } = await loadApiModule();
  const originalFetch = global.fetch;
  const seenEvents = [];

  global.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('{"type":"status","phase":"started"}\n'));
          controller.enqueue(
            encoder.encode(
              '{"type":"error","message":"Ask pipeline failed.","code":"ASK_PIPELINE_FAILED","traceId":"trace-stream-1","details":{"stage":"answering"}}\n'
            )
          );
          controller.close();
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8"
        }
      }
    );

  try {
    await assert.rejects(
      () =>
        apiStreamRequest("/assistants/default-assistant/ask/stream", {
          method: "POST",
          body: {
            question: "Trigger stream failure."
          },
          onEvent: event => {
            seenEvents.push(event);
          }
        }),
      error => {
        assert.equal(error instanceof Error, true);
        assert.equal(error.message, "Ask pipeline failed.");
        assert.equal(error.code, "ASK_PIPELINE_FAILED");
        assert.equal(error.traceId, "trace-stream-1");
        assert.deepEqual(error.details, {
          stage: "answering"
        });
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(seenEvents, [
    {
      type: "status",
      phase: "started"
    },
    {
      type: "error",
      message: "Ask pipeline failed.",
      code: "ASK_PIPELINE_FAILED",
      traceId: "trace-stream-1",
      details: {
        stage: "answering"
      }
    }
  ]);
});
