import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { relative, resolve } from "node:path";

import {
  DEFAULT_QUEUE_ITEM,
  LOOP_SCHEMA_VERSION,
  completeQueueItem,
  deferQueueItem,
  finalizeQueueItemVerification,
  countRemainingQueueWork,
  formatSessionTitleTime,
  markQueueItemVerifying,
  markQueueItemNeedsReview,
  normalizeQueueV2,
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
import { buildHandoffPath, renderHandoff } from "./handoff.mjs";
import { createApiClient, extractAssistantText, isAssistantMessageTimeoutError } from "./opencode-api.mjs";
import {
  buildResumeDirective,
  buildResumeGuidanceForSuspendedItem,
  classifyReviewReason,
  promotePendingReviewItems,
  queueHasUnresolvedExceptionItems,
  summarizeReviewFailure
} from "./review.mjs";
import { normalizeLoopStrategy } from "./strategy.mjs";
import { QUEUE_STATUS, assertQueueStatusTransition } from "./state-machine.mjs";
import { maybeAppendVerificationFollowup, verifyQueueItem, writeVerificationArtifact } from "./verification.mjs";
import { buildIdleQueueWorkVisibility, buildQueueCursorVisibility, buildQueueWorkVisibility } from "./visibility.mjs";
import { logStatus } from "./logger.mjs";
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
  "If the task clearly requires human approval, unavailable credentials, risky schema/security changes, or repo-state conflict resolution, stop implementation, say so explicitly, and explain the exact review or unblock needed.",
  "Commit each completed increment on the current branch, but keep push and PR decisions for a stable wave closeout point after validation is green.",
  "If verification does not succeed, any local commit is evidence-only and is never push-eligible; do not push, open a PR, or describe the increment as publish-ready.",
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
      const queueV2Normalization = normalizeQueueV2(queue);
      if (queueV2Normalization.normalizedCount > 0) {
        queue = queueV2Normalization.queue;
        writeQueue(queuePath, queue);
        logStatus("queue:v2-normalize", {
          queuePath: relative(options.repoRoot, queuePath),
          normalizedCount: queueV2Normalization.normalizedCount
        });
      }
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

      const reviewPromotion = promotePendingReviewItems(queue);
      if (reviewPromotion.promotedCount > 0) {
        queue = reviewPromotion.queue;
        writeQueue(queuePath, queue);
        logStatus("item:needs-review", {
          queuePath: relative(options.repoRoot, queuePath),
          promotedCount: reviewPromotion.promotedCount,
          promotedItemIds: reviewPromotion.promotedItemIds,
          reviewReason: "pre_run_review_required"
        });
      }

      const next = loopStrategy.selectNextItem({
        queue,
        pickNextItem: () => pickNextItem(queue, loopStrategy.shouldRunItem),
        shouldRunItem: loopStrategy.shouldRunItem
      });

      if (!next) {
        if (!queueHasUnresolvedExceptionItems(queue)) {
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

        if (failureAction === "needs_review" || failureAction === "blocked_external") {
          const reviewStatus = failureAction === "blocked_external" ? "blocked_external" : "needs_review";
          const reviewReason = classifyReviewReason(error, reviewStatus);
          queue = markQueueItemNeedsReview({
            queue,
            index: next.index,
            reviewStatus,
            reviewReason,
            reviewSummary: summarizeReviewFailure(error),
            ...buildResumeGuidanceForSuspendedItem({
              item: queue.items[next.index] ?? next.item,
              reviewStatus,
              reviewReason
            })
          });
          writeQueue(queuePath, queue);
          logStatus("item:needs-review", {
            itemId: next.item.id,
            status: reviewStatus,
            riskLevel: queue.items[next.index]?.riskLevel ?? null,
            failureReason: error instanceof Error ? error.message : String(error)
          });
          continue;
        }

        throw error;
      }

      queue = runState.queue;

      const currentQueueItem = runState.queue.items[next.index] ?? next.item;
      const assistantText = extractAssistantText(runState.message.parts);
      const executionCompletedAt = new Date().toISOString();
      const handoffPath = buildHandoffPath({
        handoffsDir,
        itemId: next.item.id,
        completedAt: executionCompletedAt
      });

      const caveats = [];
      if (!assistantText.trim()) {
        caveats.push("Assistant text was empty; raw response parts were preserved in the handoff.");
      }
      if (runState.sessionReuseKind === "resume") {
        caveats.push("The loop resumed an existing OpenCode session after an interrupted run.");
      } else if (runState.sessionReuseKind === "affinity") {
        caveats.push(
          `The loop reused the previous adjacent session for related work via session affinity${runState.sessionReuseSourceItemId ? ` (source item: ${runState.sessionReuseSourceItemId})` : ""}.`
        );
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
          completedAt: executionCompletedAt,
          finalStatus: "verifying"
        }),
        "utf8"
      );

      const relativeHandoffPath = relative(options.repoRoot, handoffPath).replace(/\\/g, "/");
      let verifyingQueue = markQueueItemVerifying({
        queue,
        index: next.index,
        verificationStartedAt: new Date().toISOString()
      });
      verifyingQueue = updateQueueItem(verifyingQueue, next.index, queueItem => ({
        ...queueItem,
        sessionId: runState.session.id,
        messageId: runState.message.info?.id ?? null,
        handoffPath: relativeHandoffPath
      }));
      writeQueue(queuePath, verifyingQueue);
      logStatus("verify", {
        itemId: next.item.id,
        sessionId: runState.session.id,
        messageId: runState.message.info?.id ?? "unknown",
        handoffPath: relativeHandoffPath
      });

      const verificationResult = verifyQueueItem({
        repoRoot: options.repoRoot,
        handoffsDir,
        item: verifyingQueue.items[next.index],
        assistantText,
        executionHandoffPath: relativeHandoffPath
      });
      const replanOutcome = maybeAppendVerificationFollowup({
        queue: verifyingQueue,
        index: next.index,
        item: verifyingQueue.items[next.index],
        verificationResult
      });
      verifyingQueue = replanOutcome.queue;
      const finalizedVerificationResult = replanOutcome.verificationResult;

      const finalizedAt = new Date().toISOString();
      const verificationArtifactPath = writeVerificationArtifact({
        repoRoot: options.repoRoot,
        handoffsDir,
        itemId: next.item.id,
        completedAt: finalizedAt,
        verificationResult: finalizedVerificationResult
      });

      writeFileSync(
        handoffPath,
        renderHandoff({
          item: verifyingQueue.items[next.index],
          session: runState.session,
          message: runState.message,
          promptText,
          assistantText,
          caveats,
          completedAt: finalizedAt,
          finalStatus: finalizedVerificationResult.verdict === "succeeded" ? "completed" : finalizedVerificationResult.verdict,
          verificationResult: finalizedVerificationResult,
          verificationArtifactPath
        }),
        "utf8"
      );

      let updatedQueue;
      if (finalizedVerificationResult.verdict === "succeeded") {
        updatedQueue = completeQueueItem({
          queue: verifyingQueue,
          index: next.index,
          sessionId: runState.session.id,
          messageId: runState.message.info?.id ?? null,
          handoffPath: relativeHandoffPath,
          completedAt: finalizedAt
        });
        updatedQueue = finalizeQueueItemVerification({
          queue: updatedQueue,
          index: next.index,
          verdict: finalizedVerificationResult.verdict,
          verificationArtifactPath,
          verificationSummary: finalizedVerificationResult.summary,
          verificationResult: finalizedVerificationResult,
          verifiedAt: finalizedAt
        });
      } else {
        updatedQueue = finalizeQueueItemVerification({
          queue: verifyingQueue,
          index: next.index,
          verdict: finalizedVerificationResult.verdict,
          verificationArtifactPath,
          verificationSummary: finalizedVerificationResult.summary,
          verificationResult: finalizedVerificationResult,
          verifiedAt: finalizedAt
        });
      }

      writeQueue(queuePath, updatedQueue);
      logStatus(finalizedVerificationResult.verdict === "succeeded" ? "complete" : "verify:verdict", {
        itemId: next.item.id,
        sessionId: runState.session.id,
        messageId: runState.message.info?.id ?? "unknown",
        handoffPath: relativeHandoffPath,
        verificationArtifactPath,
        verificationVerdict: finalizedVerificationResult.verdict,
        followupItemId: finalizedVerificationResult.followupItemId ?? null
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
      "Return JSON array only with objects shaped as {\"title\",\"family\",\"kind\",\"goal\",\"prompt\",\"agent\",\"model\",\"acceptance\",\"constraints\",\"verification\",\"retryPolicy\",\"riskLevel\",\"reviewRequired\",\"escalationPolicy\"}.",
      "The prompt field must be execution-ready for rag-build: name target files, keep scope narrow, and require one focused validation command.",
      "When possible, include a minimal verifier contract: verification.commands plus verification.artifacts, and acceptance/constraints metrics that can be checked from JSON artifacts.",
      "retryPolicy may now also include per-category verifier routing such as onAcceptanceFailure, onConstraintFailure, onCommandFailure, or onArtifactFailure when the task should suspend into review/blocked states instead of always failing or replanning.",
      "Omit those per-category overrides when the runtime defaults should infer only the most obvious credential/network external blockers or manual-review artifact cases.",
      "Set reviewRequired true only when the task should pause for human review before execution; otherwise keep it false or omit it.",
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

  const resumeDirective = buildResumeDirective(item);

  return composeExecutionPrompt({
    taskPromptText: resumeDirective ? `${taskPromptText}\n\nResume context:\n${resumeDirective}` : taskPromptText,
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

  if (currentItem.status !== QUEUE_STATUS.inProgress) {
    workingQueue = updateQueueItem(workingQueue, next.index, queueItem => ({
      ...assertStatusChange(queueItem, QUEUE_STATUS.inProgress, "resolve-run:start"),
      ...queueItem,
      status: QUEUE_STATUS.inProgress,
      startedAt: runStartedAt,
      attempt: (Number.isInteger(queueItem?.attempt) ? queueItem.attempt : 0) + 1,
      runId: randomUUID()
    }));
    writeQueue(queuePath, workingQueue);
  }

  for (let timeoutRetryAttempt = 0; timeoutRetryAttempt <= maxTimeoutRetries; timeoutRetryAttempt += 1) {
    currentItem = workingQueue.items[next.index] ?? currentItem;
    let session = currentItem.sessionId ? { id: currentItem.sessionId } : null;
    let message = null;
    let resumeBaselineMessageId = null;
    let sessionReuseKind = currentItem.sessionId ? "resume" : "fresh";
    let sessionReuseSourceItemId = null;

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
      } else {
        const reusableSessionCandidate = await findReusableSessionCandidate({
          api,
          queue: workingQueue,
          index: next.index,
          item: currentItem
        });

        if (reusableSessionCandidate) {
          session = { id: reusableSessionCandidate.sessionId };
          resumeBaselineMessageId = reusableSessionCandidate.afterMessageId;
          sessionReuseKind = "affinity";
          sessionReuseSourceItemId = reusableSessionCandidate.sourceItemId;

          logStatus("session:reuse", {
            itemId: next.item.id,
            sessionId: session.id,
            sourceItemId: sessionReuseSourceItemId,
            timeoutRetryAttempt
          });

          workingQueue = updateQueueItem(workingQueue, next.index, queueItem => ({
            ...queueItem,
            sessionId: session.id,
            startedAt: queueItem.startedAt ?? runStartedAt,
            status: QUEUE_STATUS.inProgress,
            sessionReuseKind,
            sessionReuseSourceItemId,
            resumedAt: runStartedAt
          }));
          writeQueue(queuePath, workingQueue);
          currentItem = workingQueue.items[next.index] ?? currentItem;
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
          title: buildLoopSessionTitle({
            index: next.index,
            item: next.item,
            queue: workingQueue,
            runStartedAt
          })
        });

        workingQueue = updateQueueItem(workingQueue, next.index, queueItem => ({
          ...queueItem,
          sessionId: session.id,
          startedAt: queueItem.startedAt ?? runStartedAt,
          status: QUEUE_STATUS.inProgress,
          sessionReuseKind: "fresh",
          sessionReuseSourceItemId: undefined
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
        status: QUEUE_STATUS.inProgress,
        messageReceivedAt: new Date().toISOString(),
        resumedAt: sessionReuseKind === "fresh" ? undefined : runStartedAt,
        sessionReuseKind,
        sessionReuseSourceItemId: sessionReuseSourceItemId ?? undefined
      }));
      writeQueue(queuePath, workingQueue);

      return {
        queue: workingQueue,
        session,
        message,
        sessionReuseKind,
        sessionReuseSourceItemId
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

function resetTimedOutQueueItem(queue, index, { preserveInProgress }) {
  return updateQueueItem(queue, index, queueItem => ({
    ...assertStatusChange(queueItem, preserveInProgress ? QUEUE_STATUS.inProgress : QUEUE_STATUS.pending, "resolve-run:timeout-reset"),
    ...queueItem,
    status: preserveInProgress ? QUEUE_STATUS.inProgress : QUEUE_STATUS.pending,
    runId: randomUUID(),
    sessionId: undefined,
    messageId: undefined,
    messageReceivedAt: undefined,
    resumedAt: undefined,
    sessionReuseKind: undefined,
    sessionReuseSourceItemId: undefined
  }));
}

async function findReusableSessionCandidate({ api, queue, index, item }) {
  const previousItem = index > 0 ? queue.items[index - 1] ?? null : null;
  if (!previousItem?.sessionId) {
    return null;
  }

  if (!itemsShareReusableSession(previousItem, item)) {
    return null;
  }

  const afterMessageId = await resolveReusableSessionBaselineMessageId({
    api,
    sessionId: previousItem.sessionId,
    preferredMessageId: previousItem.messageId
  });

  return {
    sessionId: previousItem.sessionId,
    afterMessageId,
    sourceItemId: previousItem.id ?? null
  };
}

function itemsShareReusableSession(previousItem, item) {
  const previousAffinityKey = normalizeSessionAffinityKey(previousItem);
  const currentAffinityKey = normalizeSessionAffinityKey(item);
  if (previousAffinityKey && currentAffinityKey) {
    return previousAffinityKey === currentAffinityKey;
  }

  const previousPlannerFamily = normalizePlannerFamily(previousItem);
  const currentPlannerFamily = normalizePlannerFamily(item);
  return Boolean(previousPlannerFamily && currentPlannerFamily && previousPlannerFamily === currentPlannerFamily);
}

async function resolveReusableSessionBaselineMessageId({ api, sessionId, preferredMessageId }) {
  if (preferredMessageId) {
    try {
      const matchedMessage = await api.findAssistantMessage({
        sessionId,
        messageId: preferredMessageId
      });
      if (matchedMessage?.info?.id) {
        return matchedMessage.info.id;
      }
    } catch {
      // Fall through to latest-assistant discovery when the stored assistant message is unavailable.
    }
  }

  try {
    const latestAssistant = await api.getLatestAssistantMessage({ sessionId });
    return latestAssistant?.info?.id ?? null;
  } catch {
    return null;
  }
}

function normalizeSessionAffinityKey(item) {
  return typeof item?.sessionAffinityKey === "string" && item.sessionAffinityKey.trim()
    ? item.sessionAffinityKey.trim()
    : null;
}

function normalizePlannerFamily(item) {
  return typeof item?.plannerFamily === "string" && item.plannerFamily.trim() ? item.plannerFamily.trim() : null;
}

function assertStatusChange(queueItem, nextStatus, context) {
  assertQueueStatusTransition({
    from: queueItem?.status,
    to: nextStatus,
    context
  });
  return {};
}

function buildLoopSessionTitle({ index, item, queue, runStartedAt }) {
  const remaining = countRemainingQueueWork(queue);
  const stagePrefix = item?.plannerSource === "auto-refill" ? "refill " : "";
  return `loop #${index + 1} · ${stagePrefix}${remaining} left · ${item?.id ?? "unknown-item"} · ${formatSessionTitleTime(runStartedAt)}`;
}
