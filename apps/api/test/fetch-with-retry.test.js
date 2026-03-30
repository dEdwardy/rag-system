const assert = require("node:assert/strict");
const http = require("node:http");
const {
  DEFAULT_SOURCE_FETCH_CRAWL_BUDGET_MAX_REQUESTS,
  DEFAULT_SOURCE_FETCH_CRAWL_BUDGET_WINDOW_MS,
  DEFAULT_SOURCE_FETCH_BREAKER_CHALLENGE_PAUSE_MS,
  DEFAULT_SOURCE_FETCH_BREAKER_PAUSE_MS,
  DEFAULT_SOURCE_FETCH_BREAKER_REPEATED_5XX_THRESHOLD,
  DEFAULT_SOURCE_FETCH_DOMAIN_MIN_INTERVAL_MS,
  DEFAULT_SOURCE_FETCH_RETRY_ATTEMPTS,
  DEFAULT_SOURCE_FETCH_RETRY_BACKOFF_BASE_MS,
  DEFAULT_SOURCE_FETCH_RETRY_BACKOFF_MAX_MS,
  DEFAULT_SOURCE_FETCH_RETRY_JITTER_MS,
  DEFAULT_SOURCE_FETCH_TIMEOUT_MS,
  fetchWithRetry,
  isRetryableFetchException,
  resolveSourceFetchRuntimeConfig
} = require("../src/infra/http/fetch-with-retry.ts");

test("resolveSourceFetchRuntimeConfig preserves current defaults", () => {
  const config = resolveSourceFetchRuntimeConfig({});

  assert.deepEqual(config, {
    timeoutMs: DEFAULT_SOURCE_FETCH_TIMEOUT_MS,
    attempts: DEFAULT_SOURCE_FETCH_RETRY_ATTEMPTS,
    domainMinIntervalMs: DEFAULT_SOURCE_FETCH_DOMAIN_MIN_INTERVAL_MS,
    crawlBudgetWindowMs: DEFAULT_SOURCE_FETCH_CRAWL_BUDGET_WINDOW_MS,
    crawlBudgetMaxRequests: DEFAULT_SOURCE_FETCH_CRAWL_BUDGET_MAX_REQUESTS,
    retryBackoffBaseMs: DEFAULT_SOURCE_FETCH_RETRY_BACKOFF_BASE_MS,
    retryBackoffMaxMs: DEFAULT_SOURCE_FETCH_RETRY_BACKOFF_MAX_MS,
    retryJitterMs: DEFAULT_SOURCE_FETCH_RETRY_JITTER_MS,
    breakerPauseMs: DEFAULT_SOURCE_FETCH_BREAKER_PAUSE_MS,
    breakerRepeated5xxThreshold: DEFAULT_SOURCE_FETCH_BREAKER_REPEATED_5XX_THRESHOLD,
    breakerChallengePauseMs: DEFAULT_SOURCE_FETCH_BREAKER_CHALLENGE_PAUSE_MS
  });
});

test("resolveSourceFetchRuntimeConfig accepts explicit env overrides", () => {
  const config = resolveSourceFetchRuntimeConfig({
    SOURCE_FETCH_TIMEOUT_MS: "2500",
    SOURCE_FETCH_RETRY_ATTEMPTS: "4",
    SOURCE_FETCH_DOMAIN_MIN_INTERVAL_MS: "5",
    SOURCE_FETCH_CRAWL_BUDGET_WINDOW_MS: "2000",
    SOURCE_FETCH_CRAWL_BUDGET_MAX_REQUESTS: "6",
    SOURCE_FETCH_RETRY_BACKOFF_BASE_MS: "11",
    SOURCE_FETCH_RETRY_BACKOFF_MAX_MS: "77",
    SOURCE_FETCH_RETRY_JITTER_MS: "13",
    SOURCE_FETCH_BREAKER_PAUSE_MS: "1500",
    SOURCE_FETCH_BREAKER_REPEATED_5XX_THRESHOLD: "3",
    SOURCE_FETCH_BREAKER_CHALLENGE_PAUSE_MS: "2200"
  });

  assert.deepEqual(config, {
    timeoutMs: 2500,
    attempts: 4,
    domainMinIntervalMs: 5,
    crawlBudgetWindowMs: 2000,
    crawlBudgetMaxRequests: 6,
    retryBackoffBaseMs: 11,
    retryBackoffMaxMs: 77,
    retryJitterMs: 13,
    breakerPauseMs: 1500,
    breakerRepeated5xxThreshold: 3,
    breakerChallengePauseMs: 2200
  });
});

test("resolveSourceFetchRuntimeConfig ignores invalid env overrides", () => {
  const config = resolveSourceFetchRuntimeConfig({
    SOURCE_FETCH_TIMEOUT_MS: "0",
    SOURCE_FETCH_RETRY_ATTEMPTS: "not-a-number",
    SOURCE_FETCH_DOMAIN_MIN_INTERVAL_MS: "-5",
    SOURCE_FETCH_CRAWL_BUDGET_WINDOW_MS: "0",
    SOURCE_FETCH_CRAWL_BUDGET_MAX_REQUESTS: "0",
    SOURCE_FETCH_RETRY_BACKOFF_BASE_MS: "nope",
    SOURCE_FETCH_RETRY_BACKOFF_MAX_MS: "-10",
    SOURCE_FETCH_RETRY_JITTER_MS: "bad",
    SOURCE_FETCH_BREAKER_PAUSE_MS: "-1",
    SOURCE_FETCH_BREAKER_REPEATED_5XX_THRESHOLD: "0",
    SOURCE_FETCH_BREAKER_CHALLENGE_PAUSE_MS: "-5"
  });

  assert.deepEqual(config, {
    timeoutMs: DEFAULT_SOURCE_FETCH_TIMEOUT_MS,
    attempts: DEFAULT_SOURCE_FETCH_RETRY_ATTEMPTS,
    domainMinIntervalMs: DEFAULT_SOURCE_FETCH_DOMAIN_MIN_INTERVAL_MS,
    crawlBudgetWindowMs: DEFAULT_SOURCE_FETCH_CRAWL_BUDGET_WINDOW_MS,
    crawlBudgetMaxRequests: DEFAULT_SOURCE_FETCH_CRAWL_BUDGET_MAX_REQUESTS,
    retryBackoffBaseMs: DEFAULT_SOURCE_FETCH_RETRY_BACKOFF_BASE_MS,
    retryBackoffMaxMs: DEFAULT_SOURCE_FETCH_RETRY_BACKOFF_MAX_MS,
    retryJitterMs: DEFAULT_SOURCE_FETCH_RETRY_JITTER_MS,
    breakerPauseMs: DEFAULT_SOURCE_FETCH_BREAKER_PAUSE_MS,
    breakerRepeated5xxThreshold: DEFAULT_SOURCE_FETCH_BREAKER_REPEATED_5XX_THRESHOLD,
    breakerChallengePauseMs: DEFAULT_SOURCE_FETCH_BREAKER_CHALLENGE_PAUSE_MS
  });
});

test("fetchWithRetry pauses follow-up same-domain request after 429 pressure", async () => {
  const originalFetch = global.fetch;
  let requestCount = 0;
  const requestTimestamps = [];

  try {
    global.fetch = async () => {
      requestCount += 1;
      requestTimestamps.push(Date.now());
      if (requestCount === 1) {
        return new Response("rate limited", {
          status: 429,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        });
      }

      return new Response("ok", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    };

    await withTemporarySourceFetchEnv(
      {
        SOURCE_FETCH_DOMAIN_MIN_INTERVAL_MS: "0",
        SOURCE_FETCH_CRAWL_BUDGET_WINDOW_MS: "60000",
        SOURCE_FETCH_CRAWL_BUDGET_MAX_REQUESTS: "10",
        SOURCE_FETCH_RETRY_BACKOFF_BASE_MS: "0",
        SOURCE_FETCH_RETRY_BACKOFF_MAX_MS: "0",
        SOURCE_FETCH_RETRY_JITTER_MS: "0",
        SOURCE_FETCH_BREAKER_PAUSE_MS: "40",
        SOURCE_FETCH_BREAKER_REPEATED_5XX_THRESHOLD: "2",
        SOURCE_FETCH_BREAKER_CHALLENGE_PAUSE_MS: "0"
      },
      async () => {
        const first = await fetchWithRetry({
          url: "https://pressure-429.example/source.xml",
          headers: {
            Accept: "text/plain"
          },
          timeoutMs: 10000,
          attempts: 1
        });
        assert.equal(first.status, 429);

        const second = await fetchWithRetry({
          url: "https://pressure-429.example/source.xml",
          headers: {
            Accept: "text/plain"
          },
          timeoutMs: 10000,
          attempts: 1
        });

        assert.equal(second.status, 200);
        assert.ok(
          requestTimestamps[1] - requestTimestamps[0] >= 30,
          `Expected breaker pause after 429, got ${requestTimestamps[1] - requestTimestamps[0]}ms.`
        );
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchWithRetry honors Retry-After delay for follow-up same-domain request", async () => {
  const originalFetch = global.fetch;
  let requestCount = 0;
  const requestTimestamps = [];

  try {
    global.fetch = async () => {
      requestCount += 1;
      requestTimestamps.push(Date.now());
      if (requestCount === 1) {
        return new Response("rate limited", {
          status: 429,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Retry-After": "1"
          }
        });
      }

      return new Response("ok", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    };

    await withTemporarySourceFetchEnv(
      {
        SOURCE_FETCH_DOMAIN_MIN_INTERVAL_MS: "0",
        SOURCE_FETCH_CRAWL_BUDGET_WINDOW_MS: "60000",
        SOURCE_FETCH_CRAWL_BUDGET_MAX_REQUESTS: "10",
        SOURCE_FETCH_RETRY_BACKOFF_BASE_MS: "0",
        SOURCE_FETCH_RETRY_BACKOFF_MAX_MS: "0",
        SOURCE_FETCH_RETRY_JITTER_MS: "0",
        SOURCE_FETCH_BREAKER_PAUSE_MS: "20",
        SOURCE_FETCH_BREAKER_REPEATED_5XX_THRESHOLD: "2",
        SOURCE_FETCH_BREAKER_CHALLENGE_PAUSE_MS: "0"
      },
      async () => {
        const first = await fetchWithRetry({
          url: "https://pressure-retry-after.example/source.xml",
          headers: {
            Accept: "text/plain"
          },
          timeoutMs: 10000,
          attempts: 1
        });
        assert.equal(first.status, 429);

        const second = await fetchWithRetry({
          url: "https://pressure-retry-after.example/source.xml",
          headers: {
            Accept: "text/plain"
          },
          timeoutMs: 10000,
          attempts: 1
        });

        assert.equal(second.status, 200);
        assert.ok(
          requestTimestamps[1] - requestTimestamps[0] >= 850,
          `Expected Retry-After-driven breaker pause, got ${requestTimestamps[1] - requestTimestamps[0]}ms.`
        );
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchWithRetry pauses follow-up request after anti-bot challenge response", async () => {
  const originalFetch = global.fetch;
  let requestCount = 0;
  const requestTimestamps = [];

  try {
    global.fetch = async () => {
      requestCount += 1;
      requestTimestamps.push(Date.now());
      if (requestCount === 1) {
        return new Response("<html><title>Attention Required</title><body>captcha challenge</body></html>", {
          status: 403,
          headers: {
            "Content-Type": "text/html; charset=utf-8"
          }
        });
      }

      return new Response("ok", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    };

    await withTemporarySourceFetchEnv(
      {
        SOURCE_FETCH_DOMAIN_MIN_INTERVAL_MS: "0",
        SOURCE_FETCH_CRAWL_BUDGET_WINDOW_MS: "60000",
        SOURCE_FETCH_CRAWL_BUDGET_MAX_REQUESTS: "10",
        SOURCE_FETCH_RETRY_BACKOFF_BASE_MS: "0",
        SOURCE_FETCH_RETRY_BACKOFF_MAX_MS: "0",
        SOURCE_FETCH_RETRY_JITTER_MS: "0",
        SOURCE_FETCH_BREAKER_PAUSE_MS: "0",
        SOURCE_FETCH_BREAKER_REPEATED_5XX_THRESHOLD: "2",
        SOURCE_FETCH_BREAKER_CHALLENGE_PAUSE_MS: "45"
      },
      async () => {
        const first = await fetchWithRetry({
          url: "https://challenge-breaker.example/source.html",
          headers: {
            Accept: "text/html"
          },
          timeoutMs: 10000,
          attempts: 1
        });
        assert.equal(first.status, 403);

        const second = await fetchWithRetry({
          url: "https://challenge-breaker.example/source.html",
          headers: {
            Accept: "text/html"
          },
          timeoutMs: 10000,
          attempts: 1
        });

        assert.equal(second.status, 200);
        assert.ok(
          requestTimestamps[1] - requestTimestamps[0] >= 35,
          `Expected breaker pause after challenge response, got ${requestTimestamps[1] - requestTimestamps[0]}ms.`
        );
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchWithRetry pauses same-domain follow-up request after repeated 5xx responses", async () => {
  const originalFetch = global.fetch;
  let requestCount = 0;
  const requestTimestamps = [];

  try {
    global.fetch = async () => {
      requestCount += 1;
      requestTimestamps.push(Date.now());
      if (requestCount <= 2) {
        return new Response("upstream unavailable", {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        });
      }

      return new Response("ok", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    };

    await withTemporarySourceFetchEnv(
      {
        SOURCE_FETCH_DOMAIN_MIN_INTERVAL_MS: "0",
        SOURCE_FETCH_CRAWL_BUDGET_WINDOW_MS: "60000",
        SOURCE_FETCH_CRAWL_BUDGET_MAX_REQUESTS: "10",
        SOURCE_FETCH_RETRY_BACKOFF_BASE_MS: "0",
        SOURCE_FETCH_RETRY_BACKOFF_MAX_MS: "0",
        SOURCE_FETCH_RETRY_JITTER_MS: "0",
        SOURCE_FETCH_BREAKER_PAUSE_MS: "40",
        SOURCE_FETCH_BREAKER_REPEATED_5XX_THRESHOLD: "2",
        SOURCE_FETCH_BREAKER_CHALLENGE_PAUSE_MS: "0"
      },
      async () => {
        const first = await fetchWithRetry({
          url: "https://pressure-5xx.example/source.xml",
          headers: {
            Accept: "text/plain"
          },
          timeoutMs: 10000,
          attempts: 1
        });
        assert.equal(first.status, 503);

        const second = await fetchWithRetry({
          url: "https://pressure-5xx.example/source.xml",
          headers: {
            Accept: "text/plain"
          },
          timeoutMs: 10000,
          attempts: 1
        });
        assert.equal(second.status, 503);

        const third = await fetchWithRetry({
          url: "https://pressure-5xx.example/source.xml",
          headers: {
            Accept: "text/plain"
          },
          timeoutMs: 10000,
          attempts: 1
        });

        assert.equal(third.status, 200);
        assert.ok(
          requestTimestamps[2] - requestTimestamps[1] >= 30,
          `Expected breaker pause after repeated 5xx, got ${requestTimestamps[2] - requestTimestamps[1]}ms.`
        );
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchWithRetry applies bounded retry backoff before the next attempt", async () => {
  const originalFetch = global.fetch;
  let requestCount = 0;
  const requestTimestamps = [];

  try {
    global.fetch = async () => {
      requestCount += 1;
      requestTimestamps.push(Date.now());
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

    await withTemporarySourceFetchEnv(
      {
        SOURCE_FETCH_DOMAIN_MIN_INTERVAL_MS: "0",
        SOURCE_FETCH_RETRY_BACKOFF_BASE_MS: "30",
        SOURCE_FETCH_RETRY_BACKOFF_MAX_MS: "30",
        SOURCE_FETCH_RETRY_JITTER_MS: "0"
      },
      async () => {
        const response = await fetchWithRetry({
          url: "https://backoff-check.example/source.xml",
          headers: {
            Accept: "application/xml"
          },
          timeoutMs: 10000,
          attempts: 2
        });

        assert.equal(response.status, 200);
        assert.equal(await response.text(), "ok");
        assert.equal(requestCount, 2);
        assert.ok(
          requestTimestamps[1] - requestTimestamps[0] >= 25,
          `Expected at least ~30ms retry backoff, got ${requestTimestamps[1] - requestTimestamps[0]}ms.`
        );
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchWithRetry keeps per-domain crawl budget bounded via courtesy pacing", async () => {
  const originalFetch = global.fetch;
  let requestCount = 0;
  const requestTimestamps = [];

  try {
    global.fetch = async () => {
      requestCount += 1;
      requestTimestamps.push(Date.now());
      return new Response("ok", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    };

    await withTemporarySourceFetchEnv(
      {
        SOURCE_FETCH_DOMAIN_MIN_INTERVAL_MS: "0",
        SOURCE_FETCH_CRAWL_BUDGET_WINDOW_MS: "40",
        SOURCE_FETCH_CRAWL_BUDGET_MAX_REQUESTS: "1",
        SOURCE_FETCH_RETRY_BACKOFF_BASE_MS: "0",
        SOURCE_FETCH_RETRY_BACKOFF_MAX_MS: "0",
        SOURCE_FETCH_RETRY_JITTER_MS: "0"
      },
      async () => {
        const first = await fetchWithRetry({
          url: "https://crawl-budget-check.example/first",
          headers: {
            Accept: "text/plain"
          },
          timeoutMs: 10000,
          attempts: 1
        });
        assert.equal(first.status, 200);

        const second = await fetchWithRetry({
          url: "https://crawl-budget-check.example/second",
          headers: {
            Accept: "text/plain"
          },
          timeoutMs: 10000,
          attempts: 1
        });

        assert.equal(second.status, 200);
        assert.equal(requestCount, 2);
        assert.ok(
          requestTimestamps[1] - requestTimestamps[0] >= 30,
          `Expected crawl budget pacing delay, got ${requestTimestamps[1] - requestTimestamps[0]}ms.`
        );
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
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
          `Failed to follow redirect for http://127.0.0.1:${address.port}/redirect-long-invalid-scheme: redirect target must use http/https (${expectedTarget}). (after 1 attempt).`
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
          `Failed to follow redirect for http://127.0.0.1:${address.port}/redirect-missing-location: missing redirect location header. (after 1 attempt).`
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
        assert.equal(error.message, "Failed to fetch https://example.com/source.xml: fetch failed (after 1 attempt).");
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
          "Failed to fetch https://example.com/timeout.xml: request timed out after 2500ms: The operation was aborted. (after 1 attempt)."
        );
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchWithRetry treats TimeoutError the same as AbortError for timeout failures", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    const timeoutError = new Error("The operation timed out.");
    timeoutError.name = "TimeoutError";
    throw timeoutError;
  };

  try {
    await assert.rejects(
      () =>
        fetchWithRetry({
          url: "https://example.com/timeout-error.xml",
          headers: {
            Accept: "application/xml"
          },
          timeoutMs: 2500,
          attempts: 1
        }),
      error => {
        assert.equal(
          error.message,
          "Failed to fetch https://example.com/timeout-error.xml: request timed out after 2500ms: The operation timed out. (after 1 attempt)."
        );
        assert.equal(isRetryableFetchException(error), true);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchWithRetry timeout exhaustion remains retryable for source diagnostics", async () => {
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
          url: "https://example.com/timeout-retryable.xml",
          headers: {
            Accept: "application/xml"
          },
          timeoutMs: 2500,
          attempts: 1
        }),
      error => {
        assert.equal(
          error.message,
          "Failed to fetch https://example.com/timeout-retryable.xml: request timed out after 2500ms: The operation was aborted. (after 1 attempt)."
        );
        assert.equal(isRetryableFetchException(error), true);
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
          "Failed to fetch https://example.com/source.xml: fetch failed (after 2 attempts)."
        );
        return true;
      }
    );
    assert.equal(requestCount, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

async function withTemporarySourceFetchEnv(overrides, run) {
  const previousValues = {};

  for (const [key, value] of Object.entries(overrides)) {
    previousValues[key] = process.env[key];
    process.env[key] = value;
  }

  try {
    return await run();
  } finally {
    for (const key of Object.keys(overrides)) {
      const previousValue = previousValues[key];
      if (typeof previousValue === "undefined") {
        delete process.env[key];
        continue;
      }

      process.env[key] = previousValue;
    }
  }
}
