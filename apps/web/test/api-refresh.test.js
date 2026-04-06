import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const apiModulePath = resolve(__dirname, "../src/lib/api.ts");

async function loadFreshApiModule() {
  return import(`${pathToFileURL(apiModulePath).href}?t=${Date.now()}-${Math.random()}`);
}

test("apiRequest refreshes on 401 and retries the original request", async () => {
  const { apiRequest } = await loadFreshApiModule();
  const originalFetch = global.fetch;
  const seenUrls = [];
  let requestAttempt = 0;

  global.fetch = async (url, init) => {
    seenUrls.push({ url: String(url), method: init?.method ?? "GET" });

    if (String(url).endsWith("/auth/refresh")) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    requestAttempt += 1;
    if (requestAttempt === 1) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    return new Response(JSON.stringify({ ok: true, retried: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  };

  try {
    const result = await apiRequest("/auth/me");
    assert.deepEqual(result, { ok: true, retried: true });
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(seenUrls.map(entry => `${entry.method} ${entry.url}`), [
    "GET /api/auth/me",
    "POST /api/auth/refresh",
    "GET /api/auth/me"
  ]);
});

test("apiStreamRequest refreshes on 401 before opening the retried stream", async () => {
  const { apiStreamRequest } = await loadFreshApiModule();
  const originalFetch = global.fetch;
  const seenUrls = [];
  let streamAttempt = 0;
  const seenEvents = [];

  global.fetch = async (url, init) => {
    seenUrls.push({ url: String(url), method: init?.method ?? "GET" });

    if (String(url).endsWith("/auth/refresh")) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    streamAttempt += 1;
    if (streamAttempt === 1) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"type":"status","phase":"retried"}\n'));
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
  };

  try {
    await apiStreamRequest("/assistants/default-assistant/ask/stream", {
      method: "POST",
      body: { question: "Retry after refresh." },
      onEvent: event => {
        seenEvents.push(event);
      }
    });
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(seenEvents, [
    {
      type: "status",
      phase: "retried"
    }
  ]);
  assert.deepEqual(seenUrls.map(entry => `${entry.method} ${entry.url}`), [
    "POST /api/assistants/default-assistant/ask/stream",
    "POST /api/auth/refresh",
    "POST /api/assistants/default-assistant/ask/stream"
  ]);
});
