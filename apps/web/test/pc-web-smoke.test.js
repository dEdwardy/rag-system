const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { resolve } = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const { chromium } = require("playwright");

const repoRoot = resolve(__dirname, "../../..");
const apiBaseUrl = "http://127.0.0.1:3000";
const webBaseUrl = "http://127.0.0.1:3001";

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

  const child = startProcess(
    "python",
    [
      "-m",
      "http.server",
      "3001",
      "--bind",
      "127.0.0.1",
    ],
    "web-smoke",
    resolve(repoRoot, "apps/web/dist")
  );
  await waitForHttp(webBaseUrl, "Web preview");
  return child;
}

async function stopProcess(child) {
  if (!child) {
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

    const browser = await chromium.launch({
      channel: "msedge"
    });
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
      await browser.close();
    }
  } finally {
    await stopProcess(startedWeb);
    await stopProcess(startedApi);
  }
});
