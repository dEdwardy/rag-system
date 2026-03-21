const test = require("node:test");
const assert = require("node:assert/strict");

const { AssistantsController } = require("../dist/modules/assistants/assistants.controller.js");
const { AskAssistantError } = require("../dist/modules/assistants/ask-assistant.error.js");

test("askAssistantStream emits structured error diagnostics for ask pipeline failures", async () => {
  const controller = new AssistantsController(
    {},
    {
      askAssistant: async () => {
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
