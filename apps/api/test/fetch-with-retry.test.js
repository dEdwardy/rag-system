const assert = require("node:assert/strict");
const http = require("node:http");
const {
  DEFAULT_SOURCE_FETCH_RETRY_ATTEMPTS,
  DEFAULT_SOURCE_FETCH_TIMEOUT_MS,
  fetchWithRetry,
  resolveSourceFetchRuntimeConfig
} = require("../src/infra/http/fetch-with-retry.ts");

test("resolveSourceFetchRuntimeConfig preserves current defaults", () => {
  const config = resolveSourceFetchRuntimeConfig({});

  assert.deepEqual(config, {
    timeoutMs: DEFAULT_SOURCE_FETCH_TIMEOUT_MS,
    attempts: DEFAULT_SOURCE_FETCH_RETRY_ATTEMPTS
  });
});

test("resolveSourceFetchRuntimeConfig accepts explicit env overrides", () => {
  const config = resolveSourceFetchRuntimeConfig({
    SOURCE_FETCH_TIMEOUT_MS: "2500",
    SOURCE_FETCH_RETRY_ATTEMPTS: "4"
  });

  assert.deepEqual(config, {
    timeoutMs: 2500,
    attempts: 4
  });
});

test("resolveSourceFetchRuntimeConfig ignores invalid env overrides", () => {
  const config = resolveSourceFetchRuntimeConfig({
    SOURCE_FETCH_TIMEOUT_MS: "0",
    SOURCE_FETCH_RETRY_ATTEMPTS: "not-a-number"
  });

  assert.deepEqual(config, {
    timeoutMs: DEFAULT_SOURCE_FETCH_TIMEOUT_MS,
    attempts: DEFAULT_SOURCE_FETCH_RETRY_ATTEMPTS
  });
});

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

test("fetchWithRetry retries once after an upstream 408 response", async () => {
  let requestCount = 0;
  const server = http.createServer((request, response) => {
    requestCount += 1;

    if (request.url === "/transient-timeout" && requestCount === 1) {
      response.writeHead(408, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end("request timeout");
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
      url: `http://127.0.0.1:${address.port}/transient-timeout`,
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

test("fetchWithRetry follows one HTTP redirect and returns final response", async () => {
  const server = http.createServer((request, response) => {
    if (request.url === "/redirect") {
      response.writeHead(302, {
        Location: "/final"
      });
      response.end();
      return;
    }

    if (request.url === "/final") {
      response.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end("redirect-ok");
      return;
    }

    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end("not found");
  });

  await new Promise(resolvePromise => {
    server.listen(0, "127.0.0.1", resolvePromise);
  });

  try {
    const address = server.address();
    const response = await fetchWithRetry({
      url: `http://127.0.0.1:${address.port}/redirect`,
      headers: {
        Accept: "text/plain"
      },
      timeoutMs: 10000,
      attempts: 1
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "redirect-ok");
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

test("fetchWithRetry reports clear error when redirect target is non-http scheme", async () => {
  const server = http.createServer((request, response) => {
    if (request.url === "/redirect-invalid-scheme") {
      response.writeHead(302, {
        Location: "mailto:test@example.com"
      });
      response.end();
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
    await assert.rejects(
      () =>
        fetchWithRetry({
          url: `http://127.0.0.1:${address.port}/redirect-invalid-scheme`,
          headers: {
            Accept: "text/plain"
          },
          timeoutMs: 10000,
          attempts: 1
        }),
      error => {
        assert.match(error.message, /Failed to follow redirect/i);
        assert.match(error.message, /http\/https/i);
        return true;
      }
    );
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

test("fetchWithRetry keeps bounded raw redirect target in non-http redirect error", async () => {
  const rawRedirectTarget = `mailto:${"debug-target-".repeat(20)}@example.com`;
  const expectedTarget = `${rawRedirectTarget.slice(0, 160)}...<truncated>`;
  const server = http.createServer((request, response) => {
    if (request.url === "/redirect-long-invalid-scheme") {
      response.writeHead(302, {
        Location: rawRedirectTarget
      });
      response.end();
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
    await assert.rejects(
      () =>
        fetchWithRetry({
          url: `http://127.0.0.1:${address.port}/redirect-long-invalid-scheme`,
          headers: {
            Accept: "text/plain"
          },
          timeoutMs: 10000,
          attempts: 1
        }),
      error => {
        assert.equal(
          error.message,
          `Failed to follow redirect for http://127.0.0.1:${address.port}/redirect-long-invalid-scheme: redirect target must use http/https (${expectedTarget}).`
        );
        assert.ok(!error.message.includes(rawRedirectTarget));
        return true;
      }
    );
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

test("fetchWithRetry reports clear error when redirect response misses location header", async () => {
  const server = http.createServer((request, response) => {
    if (request.url === "/redirect-missing-location") {
      response.writeHead(302);
      response.end();
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
    await assert.rejects(
      () =>
        fetchWithRetry({
          url: `http://127.0.0.1:${address.port}/redirect-missing-location`,
          headers: {
            Accept: "text/plain"
          },
          timeoutMs: 10000,
          attempts: 1
        }),
      error => {
        assert.equal(
          error.message,
          `Failed to follow redirect for http://127.0.0.1:${address.port}/redirect-missing-location: missing redirect location header.`
        );
        return true;
      }
    );
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

test("fetchWithRetry includes source URL in network failure error", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new TypeError("fetch failed");
  };

  try {
    await assert.rejects(
      () =>
        fetchWithRetry({
          url: "https://example.com/source.xml",
          headers: {
            Accept: "application/xml"
          },
          timeoutMs: 10000,
          attempts: 1
        }),
      error => {
        assert.equal(error.message, "Fetch request failed for https://example.com/source.xml: fetch failed");
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchWithRetry includes source URL and timeout boundary for timeout failures", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    const timeoutError = new Error("The operation was aborted.");
    timeoutError.name = "AbortError";
    throw timeoutError;
  };

  try {
    await assert.rejects(
      () =>
        fetchWithRetry({
          url: "https://example.com/timeout.xml",
          headers: {
            Accept: "application/xml"
          },
          timeoutMs: 2500,
          attempts: 1
        }),
      error => {
        assert.equal(
          error.message,
          "Fetch request timed out for https://example.com/timeout.xml after 2500ms: The operation was aborted."
        );
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchWithRetry retries once after a transient fetch exception", async () => {
  const originalFetch = global.fetch;
  let requestCount = 0;

  global.fetch = async () => {
    requestCount += 1;
    if (requestCount === 1) {
      throw new TypeError("fetch failed");
    }

    return new Response("ok", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  };

  try {
    const response = await fetchWithRetry({
      url: "https://example.com/source.xml",
      headers: {
        Accept: "application/xml"
      },
      timeoutMs: 10000,
      attempts: 2
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "ok");
    assert.equal(requestCount, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchWithRetry includes retry-attempt context when transient failures exhaust retries", async () => {
  const originalFetch = global.fetch;
  let requestCount = 0;

  global.fetch = async () => {
    requestCount += 1;
    throw new TypeError("fetch failed");
  };

  try {
    await assert.rejects(
      () =>
        fetchWithRetry({
          url: "https://example.com/source.xml",
          headers: {
            Accept: "application/xml"
          },
          timeoutMs: 10000,
          attempts: 2
        }),
      error => {
        assert.equal(
          error.message,
          "Fetch request failed for https://example.com/source.xml: fetch failed (after 2 attempts)."
        );
        return true;
      }
    );
    assert.equal(requestCount, 2);
  } finally {
    global.fetch = originalFetch;
  }
});
