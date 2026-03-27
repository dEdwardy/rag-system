import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { relative, resolve } from "node:path";

export const LOOP_SCHEMA_VERSION = 1;
export const DEFAULT_PROMPT_PATH = "prompts/build.md";
export const DEFAULT_PROMPT_FILE_NAME = "build.md";
export const DEFAULT_LOCK_DIR_NAME = "loop.lock";
export const DEFAULT_EXECUTION_DIRECTIVE = [
  "Execution mode: implement the requested repository increment now.",
  "Do not stop at search-only or analysis-only output.",
  "First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands."
].join("\n");
export const DEFAULT_QUEUE_ITEM = {
  id: "build-001",
  title: "Run rag-build on default prompt",
  agent: "rag-build",
  promptFile: DEFAULT_PROMPT_PATH,
  status: "pending"
};

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

  ensureJsonFile(
    paths.queuePath,
    JSON.stringify(
      {
        version: LOOP_SCHEMA_VERSION,
        cursor: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [DEFAULT_QUEUE_ITEM]
      },
      null,
      2
    )
  );
}

function ensureTextFile(filePath, contents) {
  try {
    readFileSync(filePath, "utf8");
  } catch {
    writeFileSync(filePath, `${contents}\n`, "utf8");
  }
}

function ensureJsonFile(filePath, contents) {
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

export function readQueue(queuePath) {
  const queueRaw = readFileSync(queuePath, "utf8");
  const queue = JSON.parse(queueRaw);

  if (!queue || typeof queue !== "object" || Array.isArray(queue)) {
    throw new Error(`Invalid queue payload in ${queuePath}.`);
  }

  if (queue.version !== LOOP_SCHEMA_VERSION || !Array.isArray(queue.items)) {
    throw new Error(`Unsupported queue format in ${queuePath}.`);
  }

  return queue;
}

function writeQueue(queuePath, queue) {
  writeFileSync(queuePath, `${JSON.stringify(decorateQueueForWrite(queue), null, 2)}\n`, "utf8");
}

function pickNextItem(queue) {
  const recoveryIndex = findItemIndexByStatus(queue.items, "in_progress");
  if (recoveryIndex !== -1) {
    return { index: recoveryIndex, item: queue.items[recoveryIndex] };
  }

  const startIndex = Number.isInteger(queue.cursor) && queue.cursor >= 0 ? queue.cursor : 0;
  const forwardIndex = findPendingIndex(queue.items, startIndex);
  const fallbackIndex = forwardIndex === -1 ? findPendingIndex(queue.items, 0) : -1;
  const index = forwardIndex !== -1 ? forwardIndex : fallbackIndex;

  if (index === -1) {
    return null;
  }

  return { index, item: queue.items[index] };
}

function findPendingIndex(items, start) {
  for (let index = start; index < items.length; index += 1) {
    if (items[index]?.status === "pending") {
      return index;
    }
  }

  return -1;
}

function findItemIndexByStatus(items, status) {
  for (let index = 0; index < items.length; index += 1) {
    if (items[index]?.status === status) {
      return index;
    }
  }

  return -1;
}

function computeNextCursor(items, start) {
  const nextIndex = findPendingIndex(items, start);
  if (nextIndex !== -1) {
    return nextIndex;
  }

  const wrappedIndex = findPendingIndex(items, 0);
  if (wrappedIndex !== -1) {
    return wrappedIndex;
  }

  return items.length;
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
      title: `opencode-loop:${next.item.id}:${runStartedAt}`
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

function updateQueueItem(queue, index, updater) {
  const updatedItems = queue.items.map((queueItem, queueIndex) => {
    if (queueIndex !== index) {
      return queueItem;
    }

    return updater(queueItem);
  });

  return {
    ...queue,
    items: updatedItems,
    updatedAt: new Date().toISOString()
  };
}

function completeQueueItem({ queue, index, sessionId, messageId, handoffPath, completedAt }) {
  const updatedItems = queue.items.map((queueItem, queueIndex) => {
    if (queueIndex !== index) {
      return queueItem;
    }

    return {
      ...queueItem,
      status: "completed",
      sessionId,
      messageId,
      handoffPath,
      completedAt
    };
  });

  return {
    ...queue,
    items: updatedItems,
    cursor: computeNextCursor(updatedItems, index + 1),
    updatedAt: completedAt
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
  const lines = [
    "# OpenCode Loop Handoff",
    "",
    "## Run Metadata",
    `- Queue item: ${item.id}`,
    `- Session ID: ${session.id}`,
    `- Message ID: ${message.info?.id ?? "unknown"}`,
    `- Agent: ${item.agent ?? "default"}`,
    ...(item.startedAt ? [`- Started at: ${formatDisplayTime(item.startedAt)} (${item.startedAt})`] : []),
    ...(item.resumedAt ? [`- Resumed at: ${formatDisplayTime(item.resumedAt)} (${item.resumedAt})`] : []),
    ...(item.messageReceivedAt
      ? [`- Assistant received at: ${formatDisplayTime(item.messageReceivedAt)} (${item.messageReceivedAt})`]
      : []),
    `- Completed at: ${formatDisplayTime(completedAt)} (${completedAt})`,
    "",
    "## Prompt",
    "```text",
    promptText,
    "```",
    "",
    "## Assistant Result",
    assistantText.trim() ? assistantText : "(empty assistant text)",
    "",
    "## API Compatibility Caveats",
    ...caveats.map(caveat => `- ${caveat}`),
    ""
  ];

  return `${lines.join("\n")}\n`;
}

function sanitizeFileToken(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function toTimestampSlug(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function decorateQueueForWrite(queue) {
  const items = Array.isArray(queue.items) ? queue.items.map(decorateQueueItemForWrite) : queue.items;

  return decorateTimestampFields(
    {
      ...queue,
      items
    },
    ["createdAt", "updatedAt"]
  );
}

function decorateQueueItemForWrite(item) {
  return decorateTimestampFields(item, [
    "startedAt",
    "resumedAt",
    "messageReceivedAt",
    "completedAt"
  ]);
}

function decorateTimestampFields(record, keys) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return record;
  }

  const nextRecord = { ...record };

  for (const key of keys) {
    const displayKey = `${key}Display`;
    const value = nextRecord[key];

    if (typeof value === "string" && value.trim()) {
      nextRecord[displayKey] = formatDisplayTime(value);
      continue;
    }

    delete nextRecord[displayKey];
  }

  return nextRecord;
}

function formatDisplayTime(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "invalid-date";
  }

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
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
    pick: "选取任务",
    resume: "恢复会话",
    "session:create": "新建会话",
    "message:send": "发送消息",
    complete: "任务完成",
    idle: "空闲"
  };

  const label = labelMap[event] ?? event;
  const suffix = Object.entries({ at: formatDisplayTime(new Date()), ...fields })
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(" ");

  console.log(suffix ? `[opencode-loop] ${label} (${event}) ${suffix}` : `[opencode-loop] ${label} (${event})`);
}
