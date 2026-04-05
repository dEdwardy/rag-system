import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const repoRoot = resolve(__dirname, "../../..");
const apiBaseUrl = "http://127.0.0.1:3000";
const webBaseUrl = "http://127.0.0.1:3001";
const webDistRoot = resolve(repoRoot, "apps/web/dist");
const smokeLoginEmail = process.env.PLAYWRIGHT_SMOKE_EMAIL || "default-user@example.com";
const smokeLoginPassword = process.env.PLAYWRIGHT_SMOKE_PASSWORD || "local-password-1";
const smokeBrowserExecutablePaths = [
  process.env.PLAYWRIGHT_SMOKE_EXECUTABLE_PATH,
  "/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
  "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
].filter(Boolean);
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

async function waitForCdpReady(port, timeoutMs = 15000) {
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

    await delay(250);
  }

  throw new Error(`Browser CDP endpoint did not become ready at ${endpointUrl} within ${timeoutMs}ms.`);
}

const smokeBrowserDebugPortBase = Number(process.env.PLAYWRIGHT_SMOKE_DEBUG_PORT || 9777);

function toWindowsPath(executablePath) {
  return executablePath.replace(/^\/mnt\/c\//i, "C:\\").replaceAll("/", "\\");
}

function quotePowerShell(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function startWindowsProcess(executablePath, args) {
  const windowsPath = toWindowsPath(executablePath);
  const userDataDir = `C:\\Users\\Public\\rag-smoke-browser-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const processArgs = [
    `--remote-debugging-port=${args.port}`,
    `--user-data-dir=${userDataDir}`,
    "--headless",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ];
  const command = [
    `$p = Start-Process -FilePath ${quotePowerShell(windowsPath)} -ArgumentList @(${processArgs.map(quotePowerShell).join(",")}) -PassThru`,
    "$p.Id"
  ].join("; ");

  if (process.env.PLAYWRIGHT_SMOKE_VERBOSE === "1") {
    console.log(`[smoke] ps ${command}`);
  }

  const child = spawn("powershell.exe", ["-NoProfile", "-Command", command], {
    stdio: ["ignore", "pipe", "pipe"]
  });

  const pid = await new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    child.once("error", reject);
    child.once("exit", code => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || `powershell.exe exited with code ${code}`));
        return;
      }

      const parsedPid = Number.parseInt(stdout.trim(), 10);
      if (Number.isNaN(parsedPid)) {
        reject(new Error(stderr.trim() || `Could not read browser pid from: ${stdout.trim()}`));
        return;
      }

      resolve(parsedPid);
    });
  });

  return { pid, userDataDir };
}

async function cleanupWindowsProcess(pid, userDataDir) {
  await new Promise(resolve => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-Command", `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`],
      {
        stdio: "ignore"
      }
    );
    child.once("exit", () => resolve());
    child.once("error", () => resolve());
  });

  await new Promise(resolve => {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", `Remove-Item -Recurse -Force ${quotePowerShell(userDataDir)}`], {
      stdio: "ignore"
    });
    child.once("exit", () => resolve());
    child.once("error", () => resolve());
  });
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

  const child = startProcess(process.execPath, ["apps/api/scripts/start-prod.mjs"], "api-smoke");
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

      if (requestPath.startsWith("/api")) {
        const upstreamPath = request.url?.replace(/^\/api(?=\/|$)/, "") ?? "/";
        const bodyChunks = [];
        for await (const chunk of request) {
          bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        const upstreamResponse = await fetch(`${apiBaseUrl}${upstreamPath}`, {
          method: request.method,
          headers: {
            "content-type": request.headers["content-type"] ?? "application/json",
            cookie: request.headers.cookie ?? ""
          },
          body: bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : undefined
        });

        response.statusCode = upstreamResponse.status;
        const contentType = upstreamResponse.headers.get("content-type");
        if (contentType) {
          response.setHeader("Content-Type", contentType);
        }
        const setCookie = upstreamResponse.headers.getSetCookie?.() ?? [];
        if (setCookie.length > 0) {
          response.setHeader("Set-Cookie", setCookie);
        }
        response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
        return;
      }

      const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\//, "");
      const requestedFilePath = resolve(webDistRoot, relativePath);
      const filePath = requestPath === "/" || relativePath.includes(".")
        ? requestedFilePath
        : resolve(webDistRoot, "index.html");

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

async function loginWithDefaultCredentials(page) {
  await page.goto(`${webBaseUrl}/login`, {
    timeout: 10000,
    waitUntil: "networkidle"
  });

  await page.locator('input[name="email"]').fill(smokeLoginEmail);
  await page.locator('input[name="password"]').fill(smokeLoginPassword);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(url => !url.pathname.startsWith("/login"), {
    timeout: 10000
  });
}

async function assertPageLoaded(page, route, selectors, errorTextPatterns = []) {
  await page.goto(`${webBaseUrl}${route}`, {
    timeout: 10000,
    waitUntil: "domcontentloaded"
  });

  for (const selector of selectors) {
    await page.locator(selector).first().waitFor({ timeout: 10000 });
  }

      for (const pattern of errorTextPatterns) {
        const matched = await page.getByText(pattern).first().count();
        assert.equal(matched, 0);
      }
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
  for (const [index, executablePath] of smokeBrowserExecutablePaths.entries()) {
    if (!existsSync(executablePath)) {
      continue;
    }

    try {
      if (process.env.PLAYWRIGHT_SMOKE_VERBOSE === "1") {
        console.log(`[smoke] trying ${executablePath}`);
      }

      const debugPort = smokeBrowserDebugPortBase + index;
      const { pid, userDataDir } = await startWindowsProcess(executablePath, {
        port: debugPort
      });

      try {
        const wsEndpoint = await waitForCdpReady(debugPort);
        if (process.env.PLAYWRIGHT_SMOKE_VERBOSE === "1") {
          console.log(`[smoke] cdp ready on ${debugPort}`);
        }
        const browser = await chromium.connectOverCDP(wsEndpoint);
        if (process.env.PLAYWRIGHT_SMOKE_VERBOSE === "1") {
          console.log(`[smoke] connected ${executablePath}`);
        }

        return {
          browser,
          cleanup: async () => {
            await browser.close();
            await cleanupWindowsProcess(pid, userDataDir);
          }
          };
      } catch (error) {
        if (process.env.PLAYWRIGHT_SMOKE_VERBOSE === "1") {
          console.log(`[smoke] failed ${executablePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
        await cleanupWindowsProcess(pid, userDataDir);
      }
    } catch (error) {
      if (process.env.PLAYWRIGHT_SMOKE_VERBOSE === "1") {
        console.log(`[smoke] start failed ${executablePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  try {
    return {
      browser: await chromium.launch({
        channel: "msedge"
      }),
      cleanup: async () => {}
    };
  } catch {
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
    const { browser, cleanup } = await launchSmokeBrowser();
    const page = await browser.newPage();

    try {
      await loginWithDefaultCredentials(page);

      const workspaceData = await page.evaluate(async () => {
        const fetchJson = async path => {
          const response = await fetch(`/api${path}`, {
            credentials: "include"
          });

          if (!response.ok) {
            throw new Error(`Request to /api${path} failed with ${response.status}`);
          }

          return response.json();
        };

        const [knowledgeBases, assistants, retrievalProfiles] = await Promise.all([
          fetchJson("/knowledge-bases"),
          fetchJson("/assistants"),
          fetchJson("/retrieval-profiles")
        ]);

        const conversations = await fetchJson("/conversations");
        const conversationId = conversations[0]?.id ?? null;
        const traces = conversationId ? await fetchJson(`/conversations/${conversationId}/traces`) : [];
        const documents = knowledgeBases[0] ? await fetchJson(`/knowledge-bases/${knowledgeBases[0].id}/documents`) : [];

        return {
          knowledgeBases,
          assistants,
          retrievalProfiles,
          conversations,
          conversationId,
          traceId: traces[0]?.id ?? null,
          documents
        };
      });

      const { knowledgeBases, assistants, retrievalProfiles, conversations, conversationId, traceId, documents } = workspaceData;

      assert.equal(Array.isArray(knowledgeBases), true);
      assert.equal(Array.isArray(assistants), true);
      assert.equal(Array.isArray(retrievalProfiles), true);
      assert.equal(Array.isArray(conversations), true);
      assert.ok(knowledgeBases.length > 0, "Expected at least one seeded knowledge base.");
      assert.ok(assistants.length > 0, "Expected at least one seeded assistant.");

      const activeKnowledgeBase = knowledgeBases[0];
      const activeAssistant = assistants[0];
      const activeRetrievalProfile =
        retrievalProfiles.find(profile => profile.id === activeAssistant.retrievalProfileId) ?? null;

      assert.ok(activeRetrievalProfile, "Expected assistant retrieval profile to exist.");

      await page.locator('aside a[href="/knowledge-base"]').first().click();
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
      await page.locator('[data-testid="knowledge-base-open-assistant"]').waitFor({ timeout: 5000 });

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

      await page.goto(`${webBaseUrl}/knowledge-base`, { timeout: 10000, waitUntil: "domcontentloaded" });
      await page.locator('[data-testid="knowledge-base-create-trigger"]').click();
      await page.locator('[data-testid="knowledge-base-create-name"]').waitFor({ timeout: 5000 });
      await page.locator('[data-testid="knowledge-base-create-empty-action"]').first().click().catch(() => {});
      await page.keyboard.press("Escape");

      await page.goto(`${webBaseUrl}/documents`, { timeout: 10000, waitUntil: "domcontentloaded" });
      await page.locator('[data-testid="documents-source-entry-panel"]').waitFor({ timeout: 5000 });
      await page.locator('[data-testid="documents-source-entry-panel"] input').first().fill("https://example.com");
      await page.locator('[data-testid="documents-source-entry-panel"] button').filter({ hasText: /保存|Create|Add|Submit|提交/ }).first().waitFor({ timeout: 5000 }).catch(() => {});

      await page.goto(`${webBaseUrl}/reports`, { timeout: 10000, waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-testid="report-center-page"]', { timeout: 5000 });
      const pendingFilter = page.locator('[data-testid="report-filter-pending"]');
      if (await pendingFilter.count()) {
        await pendingFilter.click();
      }

      if (conversationId && traceId) {
        await page.goto(`${webBaseUrl}/traces`, { timeout: 10000, waitUntil: "domcontentloaded" });
        await page.waitForSelector('[data-testid="traces-page"]', { timeout: 10000 });
        await page.goto(`${webBaseUrl}/traces/${traceId}`, { timeout: 10000, waitUntil: "domcontentloaded" });
        await page.waitForLoadState("domcontentloaded");
        await page.locator('body').waitFor({ timeout: 10000 });
      }

      const documentId = documents[0]?.id ?? null;
      if (documentId) {
        await page.goto(`${webBaseUrl}/documents/${documentId}`, { timeout: 10000, waitUntil: "domcontentloaded" });
        await page.waitForSelector('[data-testid="document-delete-trigger"]', { timeout: 10000 });
        await page.locator('[data-testid="document-delete-trigger"]').click();
        await page.locator('[data-testid="document-delete-cancel"]').waitFor({ timeout: 10000 });
        await page.locator('[data-testid="document-delete-cancel"]').click();
      }

      const pagesToCheck = [
        {
          route: "/",
          selectors: ['[data-testid="chat-page"]']
        },
        {
          route: "/documents",
          selectors: ['[data-testid="documents-page"]']
        },
        {
          route: "/knowledge-base",
          selectors: ['[data-testid="knowledge-base-page"]']
        },
        {
          route: "/assistant",
          selectors: ['[data-testid="assistant-page"]']
        },
        {
          route: "/workbench",
          selectors: ['[data-testid="workbench-page"]']
        },
        {
          route: "/usage",
          selectors: ['[data-testid="usage-page"]']
        },
        {
          route: "/reports",
          selectors: ['[data-testid="report-center-page"]']
        },
        {
          route: "/traces",
          selectors: ['[data-testid="traces-page"]']
        }
      ];

      for (const pageSpec of pagesToCheck) {
        await assertPageLoaded(page, pageSpec.route, pageSpec.selectors, [
          /failed to load/i,
          /unexpected error/i
        ]);
      }

    } finally {
      await cleanup();
    }
  } finally {
    await stopProcess(startedWeb);
    await stopProcess(startedApi);
  }
});
