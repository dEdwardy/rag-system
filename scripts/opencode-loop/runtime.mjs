import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { relative, resolve } from "node:path";

import {
  DEFAULT_QUEUE_ITEM,
  LOOP_SCHEMA_VERSION,
  completeQueueItem,
  formatDisplayTime,
  pickNextItem,
  readQueue,
  updateQueueItem,
  writeQueue
} from "./queue.mjs";

export const DEFAULT_PROMPT_PATH = "prompts/build.md";
export const DEFAULT_PROMPT_FILE_NAME = "build.md";
export const DEFAULT_LOCK_DIR_NAME = "loop.lock";
export const DEFAULT_EXECUTION_DIRECTIVE = [
  "Execution mode: implement the requested repository increment now.",
  "Do not stop at search-only or analysis-only output.",
  "First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands."
].join("\n");

export async function runLoop(options) {
  const opencodeRoot = resolve(options.repoRoot, ".opencode");
  mkdirSync(opencodeRoot, { recursive: true });
  const repoCommandConfig = readRepoCommandConfig(options.repoRoot);

  const lock = acquireRunLock(resolve(opencodeRoot, DEFAULT_LOCK_DIR_NAME));
  logStatus("start", {
    repoRoot: options.repoRoot,
    baseUrl: options.baseUrl,
    defaultAgent: repoCommandConfig.build?.agent ?? DEFAULT_QUEUE_ITEM.agent,
    defaultModel: repoCommandConfig.build?.model ?? "server-default"
  });

  try {
    const loopRoot = resolve(opencodeRoot, "loop");
    const queuePath = resolve(loopRoot, "queue.json");
    const promptsDir = resolve(loopRoot, "prompts");
    const handoffsDir = resolve(loopRoot, "handoffs");

    ensureDefaultFiles({ loopRoot, queuePath, promptsDir, handoffsDir });

    const api = createApiClient(
      options.baseUrl,
      options.username,
      options.password,
      options.messageWaitMs,
      options.pollIntervalMs
    );

    const processedItems = [];

    for (;;) {
      let queue = readQueue(queuePath);
      const next = pickNextItem(queue);

      if (!next) {
        const lastProcessed = processedItems[processedItems.length - 1] ?? null;
      logStatus("idle", {
        processedCount: processedItems.length,
        queuePath: relative(options.repoRoot, queuePath)
      });

        return {
          processedItems,
          processedCount: processedItems.length,
          item: lastProcessed?.item ?? null,
          session: lastProcessed?.session ?? null,
          handoffPath: lastProcessed?.handoffPath ?? null
        };
      }

      const promptText = loadPrompt({
        repoRoot: options.repoRoot,
        loopRoot,
        item: next.item,
        buildTemplate: repoCommandConfig.build?.template
      });
      const resolvedAgent = next.item.agent ?? repoCommandConfig.build?.agent ?? DEFAULT_QUEUE_ITEM.agent;
      const resolvedModel = next.item.model ?? repoCommandConfig.build?.model;
      logStatus("pick", {
        itemId: next.item.id,
        status: next.item.status,
        agent: resolvedAgent,
        model: resolvedModel ?? "server-default",
        promptFile: next.item.promptFile ?? DEFAULT_PROMPT_PATH
      });
      const runState = await resolveQueueItemRun({
        api,
        queuePath,
        queue,
        next,
        promptText,
        agent: resolvedAgent,
        model: resolvedModel
      });

      queue = runState.queue;

      const currentQueueItem = runState.queue.items[next.index] ?? next.item;
      const assistantText = extractAssistantText(runState.message.parts);
      const completedAt = new Date().toISOString();
      const handoffPath = resolve(
        handoffsDir,
        `${toTimestampSlug(new Date(completedAt))}-${sanitizeFileToken(next.item.id)}.md`
      );

      const caveats = [];
      if (!assistantText.trim()) {
        caveats.push("Assistant text was empty; raw response parts were preserved in the handoff.");
      }
      if (next.item.status === "in_progress" && next.item.sessionId) {
        caveats.push("The loop resumed an existing OpenCode session after an interrupted run.");
      } else {
        caveats.push("The loop creates a fresh OpenCode session for new work items.");
      }
      caveats.push(
        "Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message."
      );

      writeFileSync(
        handoffPath,
        renderHandoff({
          item: currentQueueItem,
          session: runState.session,
          message: runState.message,
          promptText,
          assistantText,
          caveats,
          completedAt
        }),
        "utf8"
      );

      const relativeHandoffPath = relative(options.repoRoot, handoffPath).replace(/\\/g, "/");
      const updatedQueue = completeQueueItem({
        queue,
        index: next.index,
        sessionId: runState.session.id,
        messageId: runState.message.info?.id ?? null,
        handoffPath: relativeHandoffPath,
        completedAt
      });
      writeQueue(queuePath, updatedQueue);
      logStatus("complete", {
        itemId: next.item.id,
        sessionId: runState.session.id,
        messageId: runState.message.info?.id ?? "unknown",
        handoffPath: relativeHandoffPath
      });

      processedItems.push({
        item: updatedQueue.items[next.index],
        session: runState.session,
        handoffPath: relativeHandoffPath
      });
    }
  } finally {
    releaseRunLock(lock);
  }
}

function acquireRunLock(lockDir) {
  for (;;) {
    try {
      mkdirSync(lockDir);
      const lockInfo = {
        pid: process.pid,
        createdAt: new Date().toISOString()
      };

      writeFileSync(resolve(lockDir, "lock.json"), `${JSON.stringify(lockInfo, null, 2)}\n`, "utf8");

      return { lockDir };
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }

      const lockInfo = readLockInfo(lockDir);
      if (lockInfo && isProcessAlive(lockInfo.pid)) {
        throw new Error(
          `检测到另一个 opencode-loop 运行中（pid ${lockInfo.pid}），请等待它结束后再启动。`
        );
      }

      rmSync(lockDir, { recursive: true, force: true });
    }
  }
}

function releaseRunLock(lock) {
  rmSync(lock.lockDir, { recursive: true, force: true });
}

function readLockInfo(lockDir) {
  try {
    const lockRaw = readFileSync(resolve(lockDir, "lock.json"), "utf8");
    const lockInfo = JSON.parse(lockRaw);

    if (!lockInfo || typeof lockInfo !== "object" || Array.isArray(lockInfo)) {
      return null;
    }

    return lockInfo;
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function isAlreadyExistsError(error) {
  return error instanceof Error && error?.code === "EEXIST";
}

function ensureDefaultFiles(paths) {
  mkdirSync(paths.loopRoot, { recursive: true });
  mkdirSync(paths.promptsDir, { recursive: true });
  mkdirSync(paths.handoffsDir, { recursive: true });

  ensureTextFile(
    resolve(paths.promptsDir, DEFAULT_PROMPT_FILE_NAME),
    [
      "Read AGENTS.md plus the repository primary docs and execute the smallest next build increment.",
      "Run one focused validation command and report exact commands and file changes.",
      "Do not broaden scope or start a second independent task."
    ].join("\n")
  );

  try {
    readFileSync(paths.queuePath, "utf8");
  } catch {
    writeQueue(paths.queuePath, {
      version: LOOP_SCHEMA_VERSION,
      cursor: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [DEFAULT_QUEUE_ITEM]
    });
  }
}

function ensureTextFile(filePath, contents) {
  try {
    readFileSync(filePath, "utf8");
  } catch {
    writeFileSync(filePath, `${contents}\n`, "utf8");
  }
}

function readRepoCommandConfig(repoRoot) {
  const configPath = resolve(repoRoot, "opencode.jsonc");

  try {
    const configRaw = readFileSync(configPath, "utf8");
    const config = JSON.parse(configRaw);

    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return {};
    }

    return {
      build: normalizeCommandConfig(config.command?.build)
    };
  } catch {
    return {};
  }
}

function normalizeCommandConfig(commandConfig) {
  if (!commandConfig || typeof commandConfig !== "object" || Array.isArray(commandConfig)) {
    return null;
  }

  return {
    agent: typeof commandConfig.agent === "string" ? commandConfig.agent : undefined,
    model: typeof commandConfig.model === "string" ? commandConfig.model : undefined,
    template: typeof commandConfig.template === "string" ? commandConfig.template.trim() : undefined
  };
}

function loadPrompt({ repoRoot, loopRoot, item, buildTemplate }) {
  const relativePromptPath = item.promptFile ?? DEFAULT_PROMPT_PATH;
  const absolutePromptPath = resolve(loopRoot, relativePromptPath);
  const taskPromptText = readFileSync(absolutePromptPath, "utf8").trim();

  if (!taskPromptText) {
    throw new Error(`Prompt file is empty: ${relative(repoRoot, absolutePromptPath)}`);
  }

  return composeExecutionPrompt({
    taskPromptText,
    buildTemplate
  });
}

function composeExecutionPrompt({ taskPromptText, buildTemplate }) {
  const sections = [DEFAULT_EXECUTION_DIRECTIVE];

  if (buildTemplate) {
    sections.push(`Repository build policy:\n${buildTemplate}`);
  }

  sections.push(`Task:\n${taskPromptText}`);

  return sections.join("\n\n");
}

async function resolveQueueItemRun({ api, queuePath, queue, next, promptText, agent, model }) {
  const runStartedAt = new Date().toISOString();
  let workingQueue = queue;
  let session = next.item.sessionId ? { id: next.item.sessionId } : null;
  let message = null;
  let resumeBaselineMessageId = null;

  if (next.item.status !== "in_progress") {
      workingQueue = updateQueueItem(workingQueue, next.index, currentItem => ({
        ...currentItem,
        status: "in_progress",
        startedAt: runStartedAt,
        runId: randomUUID()
      }));
    writeQueue(queuePath, workingQueue);
  }

  if (session) {
    logStatus("resume", {
      itemId: next.item.id,
      sessionId: session.id
    });
    if (next.item.messageId) {
      try {
        message = await api.findAssistantMessage({
          sessionId: session.id,
          messageId: next.item.messageId
        });
      } catch {
        message = null;
      }
    }

    if (!message) {
      try {
        const latestAssistant = await api.getLatestAssistantMessage({ sessionId: session.id });
        resumeBaselineMessageId = latestAssistant?.info?.id ?? null;
      } catch {
        resumeBaselineMessageId = null;
      }
    }
  }

  if (!session) {
    logStatus("session:create", {
      itemId: next.item.id,
      agent,
      model: model ?? "server-default"
    });
    session = await api.createSession({
      title: `loop ${next.item.id} ${formatSessionTitleTime(runStartedAt)}`
    });

    workingQueue = updateQueueItem(workingQueue, next.index, currentItem => ({
      ...currentItem,
      sessionId: session.id,
      startedAt: currentItem.startedAt ?? runStartedAt,
      status: "in_progress"
    }));
    writeQueue(queuePath, workingQueue);
  }

  if (!message) {
    logStatus("message:send", {
      itemId: next.item.id,
      sessionId: session.id,
      agent,
      model: model ?? "server-default"
    });
    message = await api.sendMessage({
      sessionId: session.id,
      agent,
      model,
      promptText,
      afterMessageId: resumeBaselineMessageId
    });
  }

  const messageId = message.info?.id ?? null;
  workingQueue = updateQueueItem(workingQueue, next.index, currentItem => ({
    ...currentItem,
    sessionId: session.id,
    messageId,
    status: "in_progress",
    messageReceivedAt: new Date().toISOString(),
    resumedAt: next.item.sessionId ? runStartedAt : undefined
  }));
  writeQueue(queuePath, workingQueue);

  return {
    queue: workingQueue,
    session,
    message
  };
}

function createApiClient(baseUrl, username, password, messageWaitMs, pollIntervalMs) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const headers = {
    "content-type": "application/json"
  };

  if (password) {
    const authUser = username ?? "opencode";
    headers.authorization = `Basic ${Buffer.from(`${authUser}:${password}`).toString("base64")}`;
  }

  return {
    async createSession(body) {
      const response = await requestJson({
        method: "POST",
        url: `${normalizedBaseUrl}/session`,
        headers,
        body
      });

      if (!response?.id) {
        throw new Error("OpenCode /session 响应缺少 session id。");
      }

      return response;
    },

    async listMessages({ sessionId }) {
      const response = await requestJson({
        method: "GET",
        url: `${normalizedBaseUrl}/session/${encodeURIComponent(sessionId)}/message?limit=200`,
        headers
      });

      return Array.isArray(response) ? response : [];
    },

    async findAssistantMessage({ sessionId, messageId }) {
      if (!messageId) {
        return null;
      }

      const messages = await this.listMessages({ sessionId });
      return findAssistantMessageById(messages, messageId);
    },

    async getLatestAssistantMessage({ sessionId }) {
      const messages = await this.listMessages({ sessionId });
      return findLatestAssistantMessage(messages);
    },

    async sendMessage({ sessionId, agent, model, promptText, afterMessageId }) {
      const normalizedModel = normalizeModelInput(model);

      let response;

      try {
        response = await requestJson({
          method: "POST",
          url: `${normalizedBaseUrl}/session/${encodeURIComponent(sessionId)}/message`,
          headers,
          body: {
            ...(agent ? { agent } : {}),
            ...(normalizedModel ? { model: normalizedModel } : {}),
            parts: [{ type: "text", text: promptText }]
          }
        });
      } catch (error) {
        if (!isFetchFailedError(error)) {
          throw error;
        }

        response = null;
      }

      if (isAssistantMessage(response) && response.info?.id !== afterMessageId) {
        return response;
      }

      return await waitForAssistantMessage({
        listMessages: this.listMessages,
        normalizedBaseUrl,
        sessionId,
        headers,
        messageWaitMs,
        pollIntervalMs,
        afterMessageId
      });
    },

    async waitForAssistantMessage({ sessionId, afterMessageId }) {
      return await waitForAssistantMessage({
        listMessages: this.listMessages,
        normalizedBaseUrl,
        sessionId,
        headers,
        messageWaitMs,
        pollIntervalMs,
        afterMessageId
      });
    }
  };
}

async function waitForAssistantMessage({
  listMessages,
  normalizedBaseUrl,
  sessionId,
  headers,
  messageWaitMs,
  pollIntervalMs,
  afterMessageId
}) {
  const waitMs = Number.isFinite(messageWaitMs) && messageWaitMs > 0 ? messageWaitMs : 180000;
  const intervalMs = Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : 2000;
  const deadline = Date.now() + waitMs;

  while (Date.now() <= deadline) {
    let fallback;

    try {
      fallback = listMessages
        ? await listMessages({ sessionId })
        : await requestJson({
            method: "GET",
            url: `${normalizedBaseUrl}/session/${encodeURIComponent(sessionId)}/message?limit=200`,
            headers
          });
    } catch (error) {
      if (isFetchFailedError(error)) {
        await sleep(intervalMs);
        continue;
      }

      throw error;
    }

    if (Array.isArray(fallback)) {
      const lastAssistant = findAssistantMessageAfter(fallback, afterMessageId);

      if (lastAssistant) {
        return lastAssistant;
      }
    }

    await sleep(intervalMs);
  }

  throw new Error(
    `OpenCode 在 ${waitMs}ms 内没有为 session ${sessionId} 返回 assistant 消息。`
  );
}

function findLatestAssistantMessage(messages) {
  if (!Array.isArray(messages)) {
    return null;
  }

  return [...messages].reverse().find(isAssistantMessage) ?? null;
}

function findAssistantMessageById(messages, messageId) {
  if (!Array.isArray(messages) || !messageId) {
    return null;
  }

  return messages.find(message => isAssistantMessage(message) && message.info?.id === messageId) ?? null;
}

function findAssistantMessageAfter(messages, afterMessageId) {
  if (!Array.isArray(messages)) {
    return null;
  }

  if (!afterMessageId) {
    return findLatestAssistantMessage(messages);
  }

  const baselineIndex = messages.findIndex(message => message?.info?.id === afterMessageId);
  if (baselineIndex === -1) {
    return null;
  }

  for (let index = messages.length - 1; index > baselineIndex; index -= 1) {
    if (isAssistantMessage(messages[index])) {
      return messages[index];
    }
  }

  return null;
}

async function requestJson({ method, url, headers, body }) {
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`OpenCode request failed: ${method} ${url} -> ${response.status} ${raw}`);
  }

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`OpenCode 为 ${method} ${url} 返回了非 JSON 内容。`);
  }
}

function extractAssistantText(parts) {
  if (!Array.isArray(parts)) {
    return "";
  }

  const textParts = parts
    .filter(part => part?.type === "text" && typeof part.text === "string")
    .map(part => part.text.trim())
    .filter(Boolean);

  if (textParts.length > 0) {
    return `${textParts.join("\n\n")}\n`;
  }

  return `${JSON.stringify(parts, null, 2)}\n`;
}

function renderHandoff({ item, session, message, promptText, assistantText, caveats, completedAt }) {
  const resultText = assistantText.trim() ? assistantText.trim() : "(空)";
  const lines = [
    `# ${item.id}`,
    "",
    `- 标题: ${item.title ?? item.id}`,
    `- 状态: completed`,
    `- 代理: ${item.agent ?? "default"}`,
    `- 会话: ${session.id}`,
    `- 消息: ${message.info?.id ?? "unknown"}`,
    ...(item.startedAt ? [`- 开始: ${formatDisplayTime(item.startedAt)}`] : []),
    ...(item.resumedAt ? [`- 恢复: ${formatDisplayTime(item.resumedAt)}`] : []),
    ...(item.messageReceivedAt ? [`- 收到: ${formatDisplayTime(item.messageReceivedAt)}`] : []),
    `- 完成: ${formatDisplayTime(completedAt)}`,
    "",
    "## 结果",
    resultText,
    "",
    "## 提示词",
    "```text",
    promptText,
    "```",
    "",
    ...(caveats.length > 0 ? ["## 备注", ...caveats.map(caveat => `- ${caveat}`), ""] : [""])
  ];

  return `${lines.join("\n")}\n`;
}

function sanitizeFileToken(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function toTimestampSlug(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function sleep(ms) {
  return new Promise(resolvePromise => {
    setTimeout(resolvePromise, ms);
  });
}

function normalizeModelInput(model) {
  if (!model) {
    return undefined;
  }

  if (typeof model === "object" && !Array.isArray(model)) {
    const providerID = typeof model.providerID === "string" ? model.providerID.trim() : "";
    const modelID = typeof model.modelID === "string" ? model.modelID.trim() : "";

    if (providerID && modelID) {
      return { providerID, modelID };
    }

    return undefined;
  }

  if (typeof model !== "string") {
    return undefined;
  }

  const normalized = model.trim();
  if (!normalized) {
    return undefined;
  }

  const separatorIndex = normalized.indexOf("/");
  if (separatorIndex === -1) {
    return undefined;
  }

  const providerID = normalized.slice(0, separatorIndex).trim();
  const modelID = normalized.slice(separatorIndex + 1).trim();

  if (!providerID || !modelID) {
    return undefined;
  }

  return { providerID, modelID };
}

function isAssistantMessage(message) {
  return Boolean(
    message &&
      typeof message === "object" &&
      !Array.isArray(message) &&
      message.info?.role === "assistant" &&
      Array.isArray(message.parts)
  );
}

function isFetchFailedError(error) {
  return (
    error instanceof Error &&
    (error.message === "fetch failed" || error.message.includes("fetch failed"))
  );
}

function logStatus(event, fields) {
  const labelMap = {
    start: "启动",
    pick: "取任务",
    resume: "恢复",
    "session:create": "建会话",
    "message:send": "发消息",
    complete: "完成",
    idle: "空闲"
  };

  const label = labelMap[event] ?? event;
  const orderedKeys = [
    "itemId",
    "status",
    "sessionId",
    "messageId",
    "agent",
    "model",
    "promptFile",
    "handoffPath",
    "processedCount",
    "queuePath",
    "repoRoot",
    "baseUrl",
    "defaultAgent",
    "defaultModel"
  ];
  const orderedEntries = [];

  for (const key of orderedKeys) {
    const value = fields[key];
    if (value !== undefined && value !== null && value !== "") {
      orderedEntries.push(`${key}=${JSON.stringify(value)}`);
    }
  }

  for (const [key, value] of Object.entries(fields)) {
    if (orderedKeys.includes(key)) {
      continue;
    }
    if (value !== undefined && value !== null && value !== "") {
      orderedEntries.push(`${key}=${JSON.stringify(value)}`);
    }
  }

  const suffix = orderedEntries.join(" ");
  const prefix = `[opencode-loop] ${formatDisplayTime(new Date())} ${label}`;
  console.log(suffix ? `${prefix} ${suffix}` : prefix);
}

function formatSessionTitleTime(value) {
  return formatDisplayTime(value);
}
