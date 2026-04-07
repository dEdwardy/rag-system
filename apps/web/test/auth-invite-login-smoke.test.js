import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const apiBaseUrl = "http://127.0.0.1:3000";
const webBaseUrl = "http://127.0.0.1:3001";
const webDistRoot = resolve(repoRoot, "apps/web/dist");

const inviteCode = process.env.PLAYWRIGHT_SMOKE_INVITE_CODE || "edw4rd";
const loginEmail = process.env.PLAYWRIGHT_SMOKE_EMAIL || "default-user@example.com";
const loginPassword = process.env.PLAYWRIGHT_SMOKE_PASSWORD || "local-password-1";
const smokeBrowserExecutablePaths = [
  process.env.PLAYWRIGHT_SMOKE_EXECUTABLE_PATH,
  "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe"
].filter(Boolean);
const smokeBrowserDebugPortBase = Number(process.env.PLAYWRIGHT_SMOKE_DEBUG_PORT || 9877);

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

function startProcess(command, args, cwd = repoRoot) {
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

  const child = startProcess(process.execPath, ["apps/api/scripts/start-prod.mjs"]);
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

      const content = readFileSync(filePath);
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
  await delay(250);
}

function toWindowsPath(executablePath) {
  return executablePath.replace(/^\/mnt\/c\//i, "C:\\").replaceAll("/", "\\");
}

function quotePowerShell(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function waitForCdpReady(port, timeoutMs = 15000) {
  const startedAt = Date.now();
  const endpointUrl = `http://127.0.0.1:${port}/json/version`;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(endpointUrl, { signal: createAbortSignal(1000) });
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

async function startWindowsProcess(executablePath, port) {
  const windowsPath = toWindowsPath(executablePath);
  const userDataDir = `C:\\Users\\Public\\rag-auth-smoke-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const processArgs = [
    `--remote-debugging-port=${port}`,
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

  const child = spawn("powershell.exe", ["-NoProfile", "-Command", command], {
    stdio: ["ignore", "pipe", "pipe"]
  });

  const pid = await new Promise((resolvePid, rejectPid) => {
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });
    child.once("error", rejectPid);
    child.once("exit", code => {
      if (code !== 0 && !stdout.trim()) {
        rejectPid(new Error(stderr.trim() || `powershell.exe exited with code ${code}`));
        return;
      }

      const parsedPid = Number.parseInt(stdout.trim(), 10);
      if (Number.isNaN(parsedPid)) {
        rejectPid(new Error(stderr.trim() || `Could not read browser pid from: ${stdout.trim()}`));
        return;
      }

      resolvePid(parsedPid);
    });
  });

  return { pid, userDataDir };
}

async function cleanupWindowsProcess(pid, userDataDir) {
  await new Promise(resolveDone => {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`], {
      stdio: "ignore"
    });
    child.once("exit", () => resolveDone());
    child.once("error", () => resolveDone());
  });

  await new Promise(resolveDone => {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", `Remove-Item -Recurse -Force ${quotePowerShell(userDataDir)}`], {
      stdio: "ignore"
    });
    child.once("exit", () => resolveDone());
    child.once("error", () => resolveDone());
  });
}

async function launchSmokeBrowser() {
  for (const [index, executablePath] of smokeBrowserExecutablePaths.entries()) {
    if (!existsSync(executablePath)) {
      continue;
    }

    const debugPort = smokeBrowserDebugPortBase + index;
    const { pid, userDataDir } = await startWindowsProcess(executablePath, debugPort);
    try {
      const wsEndpoint = await waitForCdpReady(debugPort);
      const browser = await chromium.connectOverCDP(wsEndpoint);
      return {
        browser,
        cleanup: async () => {
          await browser.close();
          await cleanupWindowsProcess(pid, userDataDir);
        }
      };
    } catch (error) {
      await cleanupWindowsProcess(pid, userDataDir);
      throw error;
    }
  }

  const browser = await chromium.launch();
  return {
    browser,
    cleanup: async () => {
      await browser.close();
    }
  };
}

test("Playwright smoke: invite gate and local login succeed in Windows Edge", async () => {
  const startedApi = await ensureApiRunning();
  const startedWeb = await ensureWebRunning();

  try {
    const { browser, cleanup } = await launchSmokeBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(`${webBaseUrl}/invite`, {
        timeout: 15000,
        waitUntil: "networkidle"
      });

      await page.locator('input[autocomplete="one-time-code"]').fill(inviteCode);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL("**/login", { timeout: 15000 });

      await page.locator('input[name="email"]').fill(loginEmail);
      await page.locator('input[name="password"]').fill(loginPassword);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(url => !url.pathname.startsWith("/login"), {
        timeout: 15000
      });

      await page.waitForSelector('[data-testid="chat-page"]', { timeout: 15000 });

      const diagnostics = await page.evaluate(async () => {
        const meResponse = await fetch("/api/auth/me", { credentials: "include" });
        const me = await meResponse.json();
        const kbResponse = await fetch("/api/knowledge-bases", { credentials: "include" });
        const knowledgeBases = await kbResponse.json();
        return {
          meStatus: meResponse.status,
          me,
          knowledgeBaseStatus: kbResponse.status,
          knowledgeBaseCount: Array.isArray(knowledgeBases) ? knowledgeBases.length : -1
        };
      });

      assert.equal(diagnostics.meStatus, 200);
      assert.equal(diagnostics.me.identity?.userId, "default-user");
      assert.equal(diagnostics.me.identity?.sessionId != null, true);
      assert.equal(diagnostics.knowledgeBaseStatus, 200);
      assert.ok(diagnostics.knowledgeBaseCount > 0, "Expected seeded knowledge bases after login.");

      await page.goto(`${webBaseUrl}/knowledge-base`, {
        timeout: 15000,
        waitUntil: "domcontentloaded"
      });
      await page.waitForSelector('[data-testid="knowledge-base-page"]', { timeout: 10000 });

      await page.goto(`${webBaseUrl}/documents`, {
        timeout: 15000,
        waitUntil: "domcontentloaded"
      });
      await page.waitForSelector('[data-testid="documents-page"]', { timeout: 10000 });
    } finally {
      await cleanup();
    }
  } finally {
    await stopProcess(startedWeb);
    await stopProcess(startedApi);
  }
});
