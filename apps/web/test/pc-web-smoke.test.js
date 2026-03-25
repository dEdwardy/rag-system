const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:http");
const { join, resolve } = require("node:path");
const { tmpdir } = require("node:os");
const { setTimeout: delay } = require("node:timers/promises");
const { chromium } = require("playwright");

const repoRoot = resolve(__dirname, "../../..");
const apiBaseUrl = "http://127.0.0.1:3000";
const webBaseUrl = "http://127.0.0.1:3001";
const webDistRoot = resolve(repoRoot, "apps/web/dist");
const smokeBrowserExecutablePaths = [
  "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
];
const smokeBrowserDebugPort = 9222;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function createAbortSignal(timeoutMs) {
  return AbortSignal.timeout(timeoutMs);
}

async function isHttpReady(url) {
  try {
    const response = await fetch(url, {
      signal: createAbortSignal(1000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHttp(url, label, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isHttpReady(url)) {
      return;
    }

    await delay(500);
  }

  throw new Error(`${label} did not become ready at ${url} within ${timeoutMs}ms.`);
}

async function waitForCdpReady(port, timeoutMs = 30000) {
  const startedAt = Date.now();
  const endpointUrl = `http://127.0.0.1:${port}/json/version`;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(endpointUrl, {
        signal: createAbortSignal(1000)
      });

      if (response.ok) {
        const payload = await response.json();
        if (typeof payload.webSocketDebuggerUrl === "string") {
          return payload.webSocketDebuggerUrl;
        }
      }
    } catch {
    }

    await delay(500);
  }

  throw new Error(`Browser CDP endpoint did not become ready at ${endpointUrl} within ${timeoutMs}ms.`);
}

function startProcess(command, args, label, cwd = repoRoot) {
  const child = spawn(command, args, {
    cwd,
    env: {
      ...process.env
    },
    shell: process.platform === "win32",
    stdio: "ignore",
    detached: process.platform === "win32"
  });
  child.unref();

  return child;
}

async function ensureApiRunning() {
  if (await isHttpReady(`${apiBaseUrl}/health`)) {
    return null;
  }

  const child = startProcess(process.execPath, ["apps/api/dist/main.js"], "api-smoke");
  await waitForHttp(`${apiBaseUrl}/health`, "API health");
  return child;
}

async function ensureWebRunning() {
  if (await isHttpReady(webBaseUrl)) {
    return null;
  }

  const server = createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent((request.url || "/").split("?")[0]);
      const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\//, "");
      const filePath = resolve(webDistRoot, relativePath);

      if (!filePath.startsWith(webDistRoot)) {
        response.statusCode = 403;
        response.end("forbidden");
        return;
      }

      const content = await readFile(filePath);
      const extension = filePath.slice(filePath.lastIndexOf("."));
      response.setHeader("Content-Type", mimeTypes[extension] || "application/octet-stream");
      response.end(content);
    } catch {
      response.statusCode = 404;
      response.end("not found");
    }
  });

  await new Promise((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(3001, "127.0.0.1", () => {
      server.off("error", rejectReady);
      resolveReady();
    });
  });

  await waitForHttp(webBaseUrl, "Web preview");
  return server;
}

async function stopProcess(child) {
  if (!child) {
    return;
  }

  if (typeof child.close === "function") {
    await new Promise(resolveClose => child.close(resolveClose));
    return;
  }

  child.kill("SIGTERM");

  const startedAt = Date.now();
  while (!child.killed && Date.now() - startedAt < 5000) {
    await delay(100);
  }

  if (!child.killed) {
    child.kill("SIGKILL");
  }
}

async function launchSmokeBrowser() {
  try {
    return {
      browser: await chromium.launch({
        channel: "msedge"
      }),
      cleanup: async () => {}
    };
  } catch {
    for (const executablePath of smokeBrowserExecutablePaths) {
      if (!existsSync(executablePath)) {
        continue;
      }

      const userDataDir = await mkdtemp(join(tmpdir(), "rag-smoke-browser-"));
      const child = spawn(
        executablePath,
        [
          `--remote-debugging-port=${smokeBrowserDebugPort}`,
          `--user-data-dir=${userDataDir}`,
          "--headless=new",
          "--no-first-run",
          "--no-default-browser-check",
          "about:blank"
        ],
        {
          stdio: "ignore"
        }
      );

      try {
        const wsEndpoint = await waitForCdpReady(smokeBrowserDebugPort);
        const browser = await chromium.connectOverCDP(wsEndpoint);

        return {
          browser,
          cleanup: async () => {
            await browser.close();
            await stopProcess(child);
            await rm(userDataDir, { recursive: true, force: true });
          }
        };
      } catch {
        await stopProcess(child);
        await rm(userDataDir, { recursive: true, force: true });
      }
    }

    return {
      browser: await chromium.launch(),
      cleanup: async () => {}
    };
  }
}

test("PC Web smoke: knowledge base overview loads real data and navigates to assistant", async () => {
  const startedApi = await ensureApiRunning();
  const startedWeb = await ensureWebRunning();

  try {
    const [knowledgeBasesResponse, assistantsResponse, retrievalProfilesResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/knowledge-bases`, {
        signal: createAbortSignal(5000)
      }),
      fetch(`${apiBaseUrl}/assistants`, {
        signal: createAbortSignal(5000)
      }),
      fetch(`${apiBaseUrl}/retrieval-profiles`, {
        signal: createAbortSignal(5000)
      })
    ]);

    assert.equal(knowledgeBasesResponse.ok, true);
    assert.equal(assistantsResponse.ok, true);
    assert.equal(retrievalProfilesResponse.ok, true);

    const knowledgeBases = await knowledgeBasesResponse.json();
    const assistants = await assistantsResponse.json();
    const retrievalProfiles = await retrievalProfilesResponse.json();

    assert.equal(Array.isArray(knowledgeBases), true);
    assert.equal(Array.isArray(assistants), true);
    assert.equal(Array.isArray(retrievalProfiles), true);
    assert.ok(knowledgeBases.length > 0, "Expected at least one seeded knowledge base.");
    assert.ok(assistants.length > 0, "Expected at least one seeded assistant.");

    const activeKnowledgeBase = knowledgeBases[0];
    const activeAssistant = assistants[0];
    const activeRetrievalProfile =
      retrievalProfiles.find(profile => profile.id === activeAssistant.retrievalProfileId) ?? null;

    assert.ok(activeRetrievalProfile, "Expected assistant retrieval profile to exist.");

    const documentsResponse = await fetch(
      `${apiBaseUrl}/knowledge-bases/${activeKnowledgeBase.id}/documents`,
      {
        signal: createAbortSignal(5000)
      }
    );
    assert.equal(documentsResponse.ok, true);

    const documents = await documentsResponse.json();
    const chunkCount = documents.reduce((sum, document) => sum + document.chunkCount, 0);
    const readyCount = documents.filter(document => document.status === "ready").length;
    const processingCount = documents.filter(
      document => document.status === "pending" || document.status === "processing"
    ).length;
    const failedCount = documents.filter(document => document.status === "failed").length;
    const assistantCount = assistants.filter(
      assistant => assistant.kbId === activeKnowledgeBase.id
    ).length;

    const { browser, cleanup } = await launchSmokeBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(`${webBaseUrl}/`, {
        timeout: 10000,
        waitUntil: "networkidle"
      });
      await page.locator('a[href="/knowledge-base"]').click();
      await page.waitForURL("**/knowledge-base", {
        timeout: 5000
      });

      await page.waitForSelector('[data-testid="knowledge-base-page"]', {
        timeout: 5000
      });

      assert.equal(
        await page.locator('[data-testid="knowledge-base-id"]').textContent(),
        activeKnowledgeBase.id
      );
      assert.equal(
        await page.locator('[data-testid="knowledge-base-document-count"]').textContent(),
        String(documents.length)
      );
      assert.equal(
        await page.locator('[data-testid="knowledge-base-chunk-count"]').textContent(),
        String(chunkCount)
      );
      assert.equal(
        await page.locator('[data-testid="knowledge-base-ready-count"]').textContent(),
        String(readyCount)
      );
      assert.equal(
        await page.locator('[data-testid="knowledge-base-processing-count"]').textContent(),
        String(processingCount)
      );
      assert.equal(
        await page.locator('[data-testid="knowledge-base-failed-count"]').textContent(),
        String(failedCount)
      );
      assert.equal(
        await page.locator('[data-testid="knowledge-base-assistant-count"]').textContent(),
        String(assistantCount)
      );

      await page.locator('[data-testid="knowledge-base-open-assistant"]').click();
      await page.waitForURL("**/assistant", {
        timeout: 5000
      });
      await page.waitForSelector('[data-testid="assistant-page"]', {
        timeout: 5000
      });

      assert.equal(
        await page.locator('[data-testid="assistant-id"]').textContent(),
        activeAssistant.id
      );
      assert.equal(
        await page.locator('[data-testid="assistant-name-text"]').textContent(),
        activeAssistant.name
      );
      assert.match(
        (await page.locator('[data-testid="assistant-retrieval-profile-name"]').textContent()) ?? "",
        new RegExp(activeRetrievalProfile.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      );
    } finally {
      await cleanup();
    }
  } finally {
    await stopProcess(startedWeb);
    await stopProcess(startedApi);
  }
});
