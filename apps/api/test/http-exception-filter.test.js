const assert = require("node:assert/strict");
const { test } = require("node:test");
const { HttpException, HttpStatus } = require("@nestjs/common");
const { GlobalHttpExceptionFilter } = require("../src/common/http-exception.filter.ts");

test("GlobalHttpExceptionFilter preserves structured HttpException fields", () => {
  const filter = new GlobalHttpExceptionFilter();
  const jsonCalls = [];
  const response = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      jsonCalls.push(payload);
      return this;
    }
  };
  const request = {
    url: "/assistants/default-assistant/ask"
  };
  const host = {
    switchToHttp() {
      return {
        getResponse() {
          return response;
        },
        getRequest() {
          return request;
        }
      };
    }
  };

  const exception = new HttpException(
    {
      statusCode: HttpStatus.BAD_GATEWAY,
      error: "Bad Gateway",
      message: "Ask pipeline failed.",
      code: "ASK_PIPELINE_FAILED",
      traceId: "trace-1",
      details: { stage: "answering" }
    },
    HttpStatus.BAD_GATEWAY
  );

  filter.catch(exception, host);

  assert.equal(response.statusCode, HttpStatus.BAD_GATEWAY);
  assert.equal(jsonCalls.length, 1);
  assert.equal(jsonCalls[0].statusCode, HttpStatus.BAD_GATEWAY);
  assert.equal(jsonCalls[0].error, "Bad Gateway");
  assert.equal(jsonCalls[0].message, "Ask pipeline failed.");
  assert.equal(jsonCalls[0].code, "ASK_PIPELINE_FAILED");
  assert.equal(jsonCalls[0].traceId, "trace-1");
  assert.deepEqual(jsonCalls[0].details, { stage: "answering" });
  assert.equal(jsonCalls[0].path, "/assistants/default-assistant/ask");
  assert.equal(typeof jsonCalls[0].timestamp, "string");
});
