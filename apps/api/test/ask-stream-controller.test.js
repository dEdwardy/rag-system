const assert = require("node:assert/strict");

const { AssistantsController } = require("../src/modules/assistants/assistants.controller.ts");
const { AskAssistantError } = require("../src/modules/assistants/ask-assistant.error.ts");

test("askAssistantStream appends structured error diagnostics after stream events have started", async () => {
  const controller = new AssistantsController(
    {},
    {
      askAssistantStream: async ({ onEvent }) => {
        await onEvent({
          type: "status",
          phase: "started"
        });
        throw new AskAssistantError({
          traceId: "trace-stream-1",
          details: {
            stage: "answering",
            cause: "Synthetic failure"
          }
        });
      }
    }
  );

  const events = [];
  const response = createMockResponse(events);

  await controller.askAssistantStream(
    "default-assistant",
    {
      question: "Trigger stream failure."
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.ended, true);
  assert.equal(events.length >= 2, true);
  assert.deepEqual(events[0], {
    type: "status",
    phase: "started"
  });
  assert.deepEqual(events.at(-1), {
    type: "error",
    message: "Ask pipeline failed.",
    code: "ASK_PIPELINE_FAILED",
    traceId: "trace-stream-1",
    details: {
      stage: "answering",
      cause: "Synthetic failure"
    }
  });
});

test("askAssistantStream emits structured error diagnostics even when the stream fails before any events", async () => {
  const controller = new AssistantsController(
    {},
    {
      askAssistantStream: async () => {
        throw new AskAssistantError({
          traceId: "trace-stream-early",
          details: {
            stage: "retrieval",
            cause: "Early synthetic failure"
          }
        });
      }
    }
  );

  const events = [];
  const response = createMockResponse(events);

  await controller.askAssistantStream(
    "default-assistant",
    {
      question: "Trigger early stream failure."
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.ended, true);
  assert.deepEqual(events, [
    {
      type: "error",
      message: "Ask pipeline failed.",
      code: "ASK_PIPELINE_FAILED",
      traceId: "trace-stream-early",
      details: {
        stage: "retrieval",
        cause: "Early synthetic failure"
      }
    }
  ]);
});

function createMockResponse(events) {
  return {
    statusCode: null,
    ended: false,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    write(chunk) {
      events.push(JSON.parse(String(chunk).trim()));
    },
    end() {
      this.ended = true;
    }
  };
}
