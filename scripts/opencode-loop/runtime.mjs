import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { relative, resolve } from "node:path";

import {
  DEFAULT_QUEUE_ITEM,
  LOOP_SCHEMA_VERSION,
  completeQueueItem,
  deferQueueItem,
  countRemainingQueueWork,
  formatDisplayTime,
  formatSessionTitleTime,
  normalizeQueueForExecution,
  pickNextItem,
  readQueue,
  resolveQueueCursor,
  updateQueueItem,
  writeQueue
} from "./queue.mjs";
import {
  DEFAULT_AUTO_REFILL_MAX_CYCLES,
  DEFAULT_AUTO_REFILL_MAX_ITEMS,
  DEFAULT_PLANNER_PROMPT_FILE_NAME,
  initializeAutoRefillState,
  maybeAutoRefillQueue
} from "./planner.mjs";
import { normalizeLoopStrategy } from "./strategy.mjs";
import { parseJsonc } from "./jsonc.mjs";

export const DEFAULT_PROMPT_PATH = "prompts/build.md";
export const DEFAULT_PROMPT_FILE_NAME = "build.md";
export const DEFAULT_READ_MODEL_METADATA_PROMPT_FILE_NAME = "read-model-metadata-build.md";
export const DEFAULT_LOCK_DIR_NAME = "loop.lock";
export const DEFAULT_ASSISTANT_TIMEOUT_RETRY_COUNT = 3;
export const DEFAULT_EXECUTION_DIRECTIVE = [
  "Execution mode: implement the requested repository increment now.",
  "Do not stop at search-only or analysis-only output.",
  "First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.",
  "Commit each completed increment on the current branch, but keep push and PR decisions for a stable wave closeout point after validation is green.",
  "Prefer `dev` for backend work unless the task explicitly requires a different branch transition."
].join("\n");

export async function runLoop(options) {
  const opencodeRoot = resolve(options.repoRoot, ".opencode");
  mkdirSync(opencodeRoot, { recursive: true });
  const repoCommandConfig = readRepoCommandConfig(options.repoRoot);
  const loopStrategy = normalizeLoopStrategy(options.strategy);
  const preserveDeferredIds = new Set();

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
      const autoRefillState = initializeAutoRefillState(readQueue(queuePath), {
        maxCycles: normalizeNonNegativeInteger(options.autoRefillMaxCycles, DEFAULT_AUTO_REFILL_MAX_CYCLES),
        maxItems: normalizePositiveInteger(options.autoRefillMaxItems, DEFAULT_AUTO_REFILL_MAX_ITEMS)
      });

      for (;;) {
      let queue = readQueue(queuePath);
      const cursorResolution = resolveQueueCursor(queue);
      if (cursorResolution.recovered) {
        queue = {
          ...queue,
          cursor: cursorResolution.cursor,
          updatedAt: new Date().toISOString()
        };
        writeQueue(queuePath, queue);
        logStatus("cursor:recover", {
          queuePath: relative(options.repoRoot, queuePath),
          cursorFrom: cursorResolution.from,
          cursorTo: cursorResolution.cursor,
          cursorReason: cursorResolution.reason
        });
      }

      const queueNormalization = normalizeQueueForExecution(queue, undefined, { preserveDeferredIds });
      if (queueNormalization.normalizedCount > 0) {
        queue = queueNormalization.queue;
        writeQueue(queuePath, queue);
        logStatus("queue:normalize", {
          queuePath: relative(options.repoRoot, queuePath),
          normalizedCount: queueNormalization.normalizedCount,
          normalizedItemIds: queueNormalization.normalizedItemIds
        });
      }

      const next = loopStrategy.selectNextItem({
        queue,
        pickNextItem: () => pickNextItem(queue, loopStrategy.shouldRunItem),
        shouldRunItem: loopStrategy.shouldRunItem
      });

      if (!next) {
        const refillResult = await maybeAutoRefillQueue({
          api,
          repoRoot: options.repoRoot,
          loopRoot,
          queuePath,
          handoffsDir,
          queue,
          commandConfig: repoCommandConfig,
          autoRefillState,
          logStatus,
          extractAssistantText
        });
        queue = refillResult.queue;

        if (refillResult.generatedItems.length > 0) {
          continue;
        }

        const lastProcessed = processedItems[processedItems.length - 1] ?? null;
        logStatus("idle", {
          processedCount: processedItems.length,
          queuePath: relative(options.repoRoot, queuePath),
          ...buildIdleQueueWorkVisibility(queue)
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
        promptFile: next.item.promptFile ?? DEFAULT_PROMPT_PATH,
        ...buildQueueCursorVisibility(queue, next.index),
        ...buildQueueWorkVisibility(queue, next.index)
      });
      let runState;

      try {
        runState = await resolveQueueItemRun({
          api,
          queuePath,
          queue,
          next,
          promptText,
          agent: resolvedAgent,
          model: resolvedModel
        });
      } catch (error) {
        const failureAction = loopStrategy.onItemFailure({
          error,
          queue,
          item: queue.items[next.index] ?? next.item,
          next
        });

        if (failureAction === "defer") {
          queue = deferQueueItem({ queue, index: next.index });
          const deferredItemId = queue.items[next.index]?.id;
          if (typeof deferredItemId === "string" && deferredItemId.trim()) {
            preserveDeferredIds.add(deferredItemId.trim());
          }
          writeQueue(queuePath, queue);
          logStatus("item:defer", {
            itemId: next.item.id,
            status: queue.items[next.index]?.status ?? "deferred",
            failureReason: error instanceof Error ? error.message : String(error)
          });
          continue;
        }

        throw error;
      }

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

      loopStrategy.onItemComplete({
        item: updatedQueue.items[next.index],
        queue: updatedQueue,
        session: runState.session,
        message: runState.message,
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
        createdAt: new Date().toISOString(),
        processStartTicks: readLinuxProcessStartTicks(process.pid),
        processCmdline: readLinuxProcessCmdline(process.pid)
      };

      writeFileSync(resolve(lockDir, "lock.json"), `${JSON.stringify(lockInfo, null, 2)}\n`, "utf8");

      return { lockDir };
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }

      const lockInfo = readLockInfo(lockDir);
      if (lockInfo && isLockOwnedByLiveProcess(lockInfo)) {
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

function isLockOwnedByLiveProcess(lockInfo) {
  if (!lockInfo || !isProcessAlive(lockInfo.pid)) {
    return false;
  }

  const currentStartTicks = readLinuxProcessStartTicks(lockInfo.pid);
  if (lockInfo.processStartTicks && currentStartTicks) {
    return lockInfo.processStartTicks === currentStartTicks;
  }

  const currentCmdline = readLinuxProcessCmdline(lockInfo.pid);
  if (lockInfo.processCmdline && currentCmdline) {
    return lockInfo.processCmdline === currentCmdline;
  }

  return true;
}

function readLinuxProcessStartTicks(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return null;
  }

  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const closingParenIndex = stat.lastIndexOf(")");
    if (closingParenIndex === -1) {
      return null;
    }

    const fields = stat.slice(closingParenIndex + 2).trim().split(/\s+/);
    return fields[19] ?? null;
  } catch {
    return null;
  }
}

function readLinuxProcessCmdline(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return null;
  }

  try {
    const raw = readFileSync(`/proc/${pid}/cmdline`, "utf8");
    return raw.replace(/\u0000/g, " ").trim() || null;
  } catch {
    return null;
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
  ensureTextFile(
    resolve(paths.promptsDir, DEFAULT_READ_MODEL_METADATA_PROMPT_FILE_NAME),
    [
      "Read AGENTS.md and the repository primary docs first.",
      "Implement one minimal read-model / metadata convergence build increment (ask response, trace summary, or shared contract readability/alignment only).",
      "Do not change retrieval behavior semantics, source-family scope, or persistence/schema paths.",
      "Run one focused validation command and report exact commands plus changed files."
    ].join("\n")
  );
  ensureTextFile(
    resolve(paths.promptsDir, DEFAULT_PLANNER_PROMPT_FILE_NAME),
    [
      "Read AGENTS.md plus the repository primary docs before proposing follow-up queue work.",
      "Only propose the next smallest additive increment that fits the current project plan.",
      "Prefer behavior-preserving closeout work, focused validation, and explicit acceptance wording.",
      "Return JSON array only with objects shaped as {\"title\",\"family\",\"prompt\",\"agent\",\"model\"}.",
      "The prompt field must be execution-ready for rag-build: name target files, keep scope narrow, and require one focused validation command.",
      "Do not propose more than the requested number of items, do not repeat already-finished work, and do not broaden into new architecture."
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
    const config = parseJsonc(configRaw);

    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return {};
    }

    return {
      plan: normalizeCommandConfig(config.command?.plan),
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
  const taskPromptText =
    typeof item.promptText === "string" && item.promptText.trim()
      ? item.promptText.trim()
      : readFileSync(resolve(loopRoot, item.promptFile ?? DEFAULT_PROMPT_PATH), "utf8").trim();

  if (!taskPromptText) {
    const absolutePromptPath = resolve(loopRoot, item.promptFile ?? DEFAULT_PROMPT_PATH);
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

function normalizeNonNegativeInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function normalizePositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

async function resolveQueueItemRun({ api, queuePath, queue, next, promptText, agent, model }) {
  const runStartedAt = new Date().toISOString();
  let workingQueue = queue;
  let currentItem = workingQueue.items[next.index] ?? next.item;
  const maxTimeoutRetries = DEFAULT_ASSISTANT_TIMEOUT_RETRY_COUNT;

  if (currentItem.status !== "in_progress") {
    workingQueue = updateQueueItem(workingQueue, next.index, queueItem => ({
      ...queueItem,
      status: "in_progress",
      startedAt: runStartedAt,
      runId: randomUUID()
    }));
    writeQueue(queuePath, workingQueue);
  }

  for (let timeoutRetryAttempt = 0; timeoutRetryAttempt <= maxTimeoutRetries; timeoutRetryAttempt += 1) {
    currentItem = workingQueue.items[next.index] ?? currentItem;
    let session = currentItem.sessionId ? { id: currentItem.sessionId } : null;
    let message = null;
    let resumeBaselineMessageId = null;

    try {
      if (session) {
        logStatus("resume", {
          itemId: next.item.id,
          sessionId: session.id,
          timeoutRetryAttempt
        });
        if (currentItem.messageId) {
          try {
            message = await api.findAssistantMessage({
              sessionId: session.id,
              messageId: currentItem.messageId
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
          model: model ?? "server-default",
          timeoutRetryAttempt
        });
        session = await api.createSession({
          title: `loop #${next.index + 1} · ${countRemainingQueueWork(workingQueue)} left · ${next.item.id} · ${formatSessionTitleTime(runStartedAt)}`
        });

        workingQueue = updateQueueItem(workingQueue, next.index, queueItem => ({
          ...queueItem,
          sessionId: session.id,
          startedAt: queueItem.startedAt ?? runStartedAt,
          status: "in_progress"
        }));
        writeQueue(queuePath, workingQueue);
        currentItem = workingQueue.items[next.index] ?? currentItem;
      }

      if (!message) {
        logStatus("message:send", {
          itemId: next.item.id,
          sessionId: session.id,
          agent,
          model: model ?? "server-default",
          timeoutRetryAttempt
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
      workingQueue = updateQueueItem(workingQueue, next.index, queueItem => ({
        ...queueItem,
        sessionId: session.id,
        messageId,
        status: "in_progress",
        messageReceivedAt: new Date().toISOString(),
        resumedAt: currentItem.sessionId ? runStartedAt : undefined
      }));
      writeQueue(queuePath, workingQueue);

      return {
        queue: workingQueue,
        session,
        message
      };
    } catch (error) {
      if (!isAssistantMessageTimeoutError(error)) {
        throw error;
      }

      const exhaustedRetries = timeoutRetryAttempt >= maxTimeoutRetries;

      workingQueue = resetTimedOutQueueItem(workingQueue, next.index, {
        preserveInProgress: !exhaustedRetries
      });
      writeQueue(queuePath, workingQueue);

      if (exhaustedRetries) {
        logStatus("message:timeout-exhausted", {
          itemId: next.item.id,
          sessionId: session?.id ?? currentItem.sessionId ?? null,
          timeoutRetryAttempt,
          maxTimeoutRetries,
          timeoutWaitMs: error.waitMs
        });
        throw error;
      }

      logStatus("message:timeout-retry", {
        itemId: next.item.id,
        sessionId: session?.id ?? currentItem.sessionId ?? null,
        timeoutRetryAttempt: timeoutRetryAttempt + 1,
        maxTimeoutRetries,
        timeoutWaitMs: error.waitMs
      });
    }
  }

  throw new Error(`Loop could not resolve queue item ${next.item.id}.`);
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
        url: buildSessionMessagesUrl(normalizedBaseUrl, sessionId),
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
            ...(afterMessageId ? { afterMessageId } : {}),
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
            url: buildSessionMessagesUrl(normalizedBaseUrl, sessionId),
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

  throw new AssistantMessageTimeoutError(sessionId, waitMs);
}

class AssistantMessageTimeoutError extends Error {
  constructor(sessionId, waitMs) {
    super(`OpenCode 在 ${waitMs}ms 内没有为 session ${sessionId} 返回 assistant 消息。`);
    this.name = "AssistantMessageTimeoutError";
    this.sessionId = sessionId;
    this.waitMs = waitMs;
  }
}

function isAssistantMessageTimeoutError(error) {
  return error instanceof AssistantMessageTimeoutError;
}

function resetTimedOutQueueItem(queue, index, { preserveInProgress }) {
  return updateQueueItem(queue, index, queueItem => ({
    ...queueItem,
    status: preserveInProgress ? "in_progress" : "pending",
    runId: randomUUID(),
    sessionId: undefined,
    messageId: undefined,
    messageReceivedAt: undefined,
    resumedAt: undefined
  }));
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
    const latestAssistant = findLatestAssistantMessage(messages);
    return latestAssistant?.info?.id === afterMessageId ? null : latestAssistant;
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

function buildSessionMessagesUrl(normalizedBaseUrl, sessionId, limit = 200) {
  return `${normalizedBaseUrl}/session/${encodeURIComponent(sessionId)}/message?limit=${limit}`;
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

function buildQueueWorkVisibility(queue, pickedIndex) {
  const { pendingCount, completedCount, inProgressCount, deferredCount, totalCount } = countQueueWork(queue);
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const pickedStatus = items[pickedIndex]?.status;
  const currentWorkReduction = pickedStatus === "pending" || pickedStatus === "in_progress" ? 1 : 0;

  return {
    queueTotal: totalCount,
    queuePending: pendingCount,
    queueCompleted: completedCount,
    queueInProgress: inProgressCount,
    queueDeferred: deferredCount,
    remainingAfterPick: Math.max(0, pendingCount + inProgressCount + deferredCount - currentWorkReduction),
    ...buildQueueFamilyCountVisibility(queue)
  };
}

function buildIdleQueueWorkVisibility(queue) {
  const { pendingCount, completedCount, inProgressCount, deferredCount, totalCount } = countQueueWork(queue);

  return {
    queueTotal: totalCount,
    queuePending: pendingCount,
    queueCompleted: completedCount,
    queueInProgress: inProgressCount,
    queueDeferred: deferredCount,
    remainingQueueWork: pendingCount + inProgressCount + deferredCount,
    ...buildQueueFamilyCountVisibility(queue)
  };
}

function buildQueueFamilyCountVisibility(queue) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const pendingByFamily = new Map();
  const completedByFamily = new Map();

  for (const item of items) {
    const family = resolveQueueItemFamily(item);
    if (!family) {
      continue;
    }

    if (item?.status === "pending") {
      pendingByFamily.set(family, (pendingByFamily.get(family) ?? 0) + 1);
      continue;
    }

    if (item?.status === "completed") {
      completedByFamily.set(family, (completedByFamily.get(family) ?? 0) + 1);
      continue;
    }

    if (item?.status === "deferred") {
      pendingByFamily.set(family, (pendingByFamily.get(family) ?? 0) + 1);
    }
  }

  return {
    queuePendingByFamily: mapToSortedObject(pendingByFamily),
    queueCompletedByFamily: mapToSortedObject(completedByFamily)
  };
}

function resolveQueueItemFamily(item) {
  const id = typeof item?.id === "string" ? item.id.trim() : "";
  if (!id) {
    return null;
  }

  const [family] = id.split(/[-_:/.]/);
  return family || null;
}

function mapToSortedObject(countMap) {
  if (!(countMap instanceof Map) || countMap.size === 0) {
    return null;
  }

  return Object.fromEntries([...countMap.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function countQueueWork(queue) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  let pendingCount = 0;
  let completedCount = 0;
  let inProgressCount = 0;
  let deferredCount = 0;

  for (const item of items) {
    if (item?.status === "pending") {
      pendingCount += 1;
      continue;
    }

    if (item?.status === "completed") {
      completedCount += 1;
      continue;
    }

    if (item?.status === "in_progress") {
      inProgressCount += 1;
      continue;
    }

    if (item?.status === "deferred") {
      deferredCount += 1;
    }
  }

  return {
    pendingCount,
    completedCount,
    inProgressCount,
    deferredCount,
    totalCount: items.length
  };
}

function buildQueueCursorVisibility(queue, pickedIndex) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const cursor = Number.isInteger(queue?.cursor) ? queue.cursor : null;
  const cursorItem =
    Number.isInteger(cursor) && cursor >= 0 && cursor < items.length ? items[cursor] : null;
  const nextPendingItem = findNextPendingItem(items, pickedIndex);
  const nextPendingCursorDistance = computeCursorDistanceToIndex({
    cursor,
    targetIndex: nextPendingItem?.index,
    itemCount: items.length
  });

  return {
    queueCursor: cursor,
    queueCursorItemId: cursorItem?.id ?? null,
    queueCursorItemStatus: cursorItem?.status ?? null,
    ...buildActiveCursorResumeVisibility(cursorItem),
    nextPendingItemId: nextPendingItem?.id ?? null,
    nextPendingItemIndex: nextPendingItem?.index ?? null,
    nextPendingItemTitle: nextPendingItem?.title ?? null,
    nextPendingCursorDistance
  };
}

function computeCursorDistanceToIndex({ cursor, targetIndex, itemCount }) {
  if (!Number.isInteger(cursor) || !Number.isInteger(targetIndex) || !Number.isInteger(itemCount)) {
    return null;
  }

  if (itemCount <= 0 || cursor < 0 || cursor >= itemCount || targetIndex < 0 || targetIndex >= itemCount) {
    return null;
  }

  if (targetIndex >= cursor) {
    return targetIndex - cursor;
  }

  return itemCount - cursor + targetIndex;
}

function buildActiveCursorResumeVisibility(cursorItem) {
  const title =
    typeof cursorItem?.title === "string" && cursorItem.title.trim() ? cursorItem.title.trim() : null;
  const sessionId =
    typeof cursorItem?.sessionId === "string" && cursorItem.sessionId.trim()
      ? cursorItem.sessionId.trim()
      : null;
  const messageId =
    typeof cursorItem?.messageId === "string" && cursorItem.messageId.trim()
      ? cursorItem.messageId.trim()
      : null;
  const startedAt =
    typeof cursorItem?.startedAt === "string" && cursorItem.startedAt.trim()
      ? cursorItem.startedAt
      : null;

  if (cursorItem?.status !== "in_progress") {
    return {
      queueCursorItemTitle: title
    };
  }

  let resumePreview = "resume-metadata-missing";
  if (sessionId && messageId) {
    resumePreview = "resume-with-tracked-assistant-message";
  } else if (sessionId) {
    resumePreview = "resume-awaiting-new-assistant-message";
  }

  return {
    queueCursorItemTitle: title,
    queueCursorResumePreview: resumePreview,
    queueCursorResumeSessionId: sessionId,
    queueCursorResumeMessageId: messageId,
    queueCursorResumeStartedAt: startedAt ? formatDisplayTime(startedAt) : null
  };
}

function findNextPendingItem(items, pickedIndex) {
  const startIndex = Number.isInteger(pickedIndex) ? pickedIndex + 1 : 0;

  for (let index = startIndex; index < items.length; index += 1) {
    if (index === pickedIndex) {
      continue;
    }

    const item = items[index];
    if (item?.status === "pending" && typeof item?.id === "string") {
      return {
        index,
        id: item.id,
        title: typeof item.title === "string" && item.title.trim() ? item.title : null
      };
    }
  }

  for (let index = 0; index < startIndex && index < items.length; index += 1) {
    if (index === pickedIndex) {
      continue;
    }

    const item = items[index];
    if (item?.status === "pending" && typeof item?.id === "string") {
      return {
        index,
        id: item.id,
        title: typeof item.title === "string" && item.title.trim() ? item.title : null
      };
    }
  }

  return null;
}

function logStatus(event, fields) {
  const labelMap = {
    start: "启动",
    plan: "自动补任务",
    pick: "取任务",
    resume: "恢复",
    "queue:normalize": "队列修复",
    "session:create": "建会话",
    "message:send": "发消息",
    "message:timeout-retry": "超时重试",
    "message:timeout-exhausted": "超时回退",
    "item:defer": "失败降级",
    "cursor:recover": "游标恢复",
    refill: "补队列",
    "refill:skip": "补队列跳过",
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
    "queueCursor",
    "queueCursorItemId",
    "queueCursorItemStatus",
    "queueCursorItemTitle",
    "queueCursorResumePreview",
    "queueCursorResumeSessionId",
    "queueCursorResumeMessageId",
    "queueCursorResumeStartedAt",
    "nextPendingItemId",
    "nextPendingItemIndex",
    "nextPendingItemTitle",
    "nextPendingCursorDistance",
    "remainingAfterPick",
    "remainingQueueWork",
    "queuePending",
    "queuePendingByFamily",
    "queueCompleted",
    "queueCompletedByFamily",
    "queueInProgress",
    "queueDeferred",
    "queueTotal",
    "handoffPath",
    "processedCount",
    "queuePath",
    "cursorFrom",
    "cursorTo",
    "cursorReason",
    "repoRoot",
    "baseUrl",
    "defaultAgent",
    "defaultModel",
    "plannerSessionId",
    "plannerMessageId",
    "generatedCount",
    "generatedItemIds",
    "autoRefillCycle",
    "maxAutoRefillCycles",
    "autoRefillMaxItems",
    "timeoutRetryAttempt",
    "maxTimeoutRetries",
    "timeoutWaitMs",
    "normalizedCount",
    "normalizedItemIds"
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
