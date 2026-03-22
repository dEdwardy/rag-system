const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { fetchWithRetry } = require("../dist/infra/http/fetch-with-retry.js");

test("fetchWithRetry retries once after a transient 5xx response", async () => {
  let requestCount = 0;
  const server = http.createServer((request, response) => {
    requestCount += 1;

    if (request.url === "/transient" && requestCount === 1) {
      response.writeHead(502, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end("temporary upstream failure");
      return;
    }

    response.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end("ok");
  });

  await new Promise(resolvePromise => {
    server.listen(0, "127.0.0.1", resolvePromise);
  });

  try {
    const address = server.address();
    const response = await fetchWithRetry({
      url: `http://127.0.0.1:${address.port}/transient`,
      headers: {
        Accept: "text/plain"
      },
      timeoutMs: 10000
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "ok");
    assert.equal(requestCount, 2);
  } finally {
    await new Promise((resolvePromise, rejectPromise) => {
      server.close(error => {
        if (error) {
          rejectPromise(error);
          return;
        }

        resolvePromise();
      });
    });
  }
});
