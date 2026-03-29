import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { relative, resolve } from "node:path";

import {
  DEFAULT_QUEUE_ITEM,
  LOOP_SCHEMA_VERSION,
  appendQueueItems,
  completeQueueItem,
  countQueueWork,
  deferQueueItem,
  finalizeQueueItemVerification,
  countRemainingQueueWork,
  formatDisplayTime,
  formatSessionTitleTime,
  markQueueItemVerifying,
  markQueueItemNeedsReview,
  normalizeQueueV2,
  normalizeQueueForExecution,
  pickNextItem,
  readQueue,
  resolveQueueCursor,
  shouldQueueItemWaitForReview,
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
export const DEFAULT_NETWORK_RETRY_COUNT = 3;
export const DEFAULT_NETWORK_RETRY_BASE_DELAY_MS = 1000;
export const DEFAULT_EXECUTION_DIRECTIVE = [
  "Execution mode: implement the requested repository increment now.",
  "Do not stop at search-only or analysis-only output.",
  "First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.",
  "If the task clearly requires human approval, unavailable credentials, risky schema/security changes, or repo-state conflict resolution, stop implementation, say so explicitly, and explain the exact review or unblock needed.",
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
      const handoffPath = resolve(
        handoffsDir,
        `${toTimestampSlug(new Date(executionCompletedAt))}-${sanitizeFileToken(next.item.id)}.md`
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
        promptText,
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

function promotePendingReviewItems(queue, reviewRequestedAt = new Date().toISOString()) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  let nextQueue = queue;
  let promotedCount = 0;
  const promotedItemIds = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = nextQueue.items[index];
    if (item?.status !== "pending" || !shouldQueueItemWaitForReview(item)) {
      continue;
    }

    nextQueue = markQueueItemNeedsReview({
      queue: nextQueue,
      index,
      reviewReason: "pre_run_review_required",
      reviewSummary: buildReviewSummary(item),
      ...buildResumeGuidanceForSuspendedItem({
        item,
        reviewStatus: "needs_review",
        reviewReason: "pre_run_review_required"
      }),
      reviewRequestedAt
    });
    promotedCount += 1;
    if (typeof item?.id === "string" && item.id.trim()) {
      promotedItemIds.push(item.id.trim());
    }
  }

  return {
    queue: nextQueue,
    promotedCount,
    promotedItemIds
  };
}

function queueHasUnresolvedExceptionItems(queue) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  return items.some(
    item =>
      item?.status === "needs_review" ||
      item?.status === "blocked_external" ||
      item?.status === "needs_replan" ||
      item?.status === "failed"
  );
}

function buildReviewSummary(item) {
  const summaryParts = [];
  if (item?.reviewSummary) {
    summaryParts.push(String(item.reviewSummary).trim());
  }
  if (item?.riskLevel) {
    summaryParts.push(`risk=${String(item.riskLevel).trim()}`);
  }
  if (item?.reviewRequired === true) {
    summaryParts.push("reviewRequired=true");
  }

  return summaryParts.filter(Boolean).join("; ") || undefined;
}

function classifyReviewReason(error, reviewStatus) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (reviewStatus === "blocked_external") {
    return "external_dependency_blocked";
  }

  if (normalized.includes("credential") || normalized.includes("secret") || normalized.includes("auth")) {
    return "credentials_or_access_required";
  }

  if (normalized.includes("conflict") || normalized.includes("dirty worktree") || normalized.includes("uncommitted")) {
    return "repo_state_conflict";
  }

  return "execution_failed_requires_review";
}

function summarizeReviewFailure(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.trim() || undefined;
}

function buildResumeGuidanceForSuspendedItem({ item, reviewStatus, reviewReason }) {
  if (reviewStatus === "blocked_external") {
    return {
      resumeWhen:
        "Resume after the missing credential, external dependency, or environment blocker is fixed and the same verifier/build path can run again.",
      resumeHint: `After unblocking, rerun with \`node .opencode/loop/cli.mjs --resume-item ${item?.id ?? "<item-id>"}\` to put the item back into the pending lane.`
    };
  }

  if (reviewReason === "pre_run_review_required" || item?.reviewRequired === true) {
    return {
      resumeWhen: "Resume only after a human reviewer explicitly approves running this item unattended.",
      resumeHint: `Use \`node .opencode/loop/cli.mjs --resume-item ${item?.id ?? "<item-id>"} --resume-note \"approved\"\` after review.`
    };
  }

  if (reviewReason === "credentials_or_access_required") {
    return {
      resumeWhen: "Resume after the required credential, access grant, or secret is available in the runtime environment.",
      resumeHint: `After access is restored, run \`node .opencode/loop/cli.mjs --resume-item ${item?.id ?? "<item-id>"}\` to retry the same task.`
    };
  }

  return {
    resumeWhen:
      "Resume after a human has reviewed the failure evidence and decided the same task should continue in the autonomous lane.",
    resumeHint: `Use \`node .opencode/loop/cli.mjs --resume-item ${item?.id ?? "<item-id>"} --resume-note \"why it is safe to continue\"\` once the review is complete.`
  };
}

function buildResumeDirective(item) {
  if (!item?.resumeApprovedAt && !item?.resumeNote && !item?.lastSuspendedStatus) {
    return "";
  }

  const lines = [];
  if (item?.lastSuspendedStatus) {
    lines.push(`Previous suspended status: ${item.lastSuspendedStatus}`);
  }
  if (item?.reviewReason) {
    lines.push(`Previous suspend reason: ${item.reviewReason}`);
  }
  if (item?.resumeWhen) {
    lines.push(`Recovered condition: ${item.resumeWhen}`);
  }
  if (item?.resumeApprovedAt) {
    lines.push(`Manual resume approved at: ${item.resumeApprovedAt}`);
  }
  if (item?.resumeNote) {
    lines.push(`Manual resume note: ${item.resumeNote}`);
  }

  return lines.join("\n");
}

function verifyQueueItem({ repoRoot, handoffsDir, item, assistantText, executionHandoffPath }) {
  const verification = item?.verification ?? { mode: "assistant_only" };
  const mode = verification.mode ?? "assistant_only";
  const commandResults = runVerificationCommands({
    repoRoot,
    commands: verification.commands,
    commandTimeoutMs: verification.commandTimeoutMs
  });
  const artifacts = readVerificationArtifacts({
    repoRoot,
    artifactPaths: verification.artifacts,
    executionHandoffPath,
    handoffsDir
  });
  const acceptanceVerdict = computeAcceptanceVerdict({
    item,
    artifacts,
    assistantText
  });

  if (mode !== "assistant_only") {
    const failingCommand = commandResults.find(result => result.exitCode !== 0);
    if (failingCommand) {
      const failureCategory = "verification_command";
      const failureCode = failingCommand.timedOut ? "command_timeout" : "command_exit_nonzero";
      const routing = resolveVerificationFailureRouting({
        item,
        failureCategory,
        failureCode,
        fallback: "failed",
        commandResults,
        failureDetail: {
          command: failingCommand.command,
          exitCode: failingCommand.exitCode,
          signal: failingCommand.signal,
          timedOut: failingCommand.timedOut === true
        }
      });
      return enrichSuspendedVerificationResult({
        item,
        verificationResult: {
        verdict: routing.verdict,
        summary: `Verification command failed: ${failingCommand.command}`,
        failureCategory,
        failureCode,
        routingReason: routing.routingReason,
        failureDetail: {
          command: failingCommand.command,
          exitCode: failingCommand.exitCode,
          signal: failingCommand.signal,
          timedOut: failingCommand.timedOut === true
        },
        mode,
        commands: commandResults,
        artifacts,
        acceptance: acceptanceVerdict
        }
      });
    }
  }

  if (mode === "command+artifact") {
    const missingArtifact = artifacts.find(artifact => artifact.exists !== true);
    if (missingArtifact) {
      const failureCategory = "verification_artifact";
      const failureCode = "artifact_missing";
      const routing = resolveVerificationFailureRouting({
        item,
        failureCategory,
        failureCode,
        fallback: "failed",
        commandResults,
        artifacts,
        failureDetail: {
          path: missingArtifact.path
        }
      });
      return enrichSuspendedVerificationResult({
        item,
        verificationResult: {
        verdict: routing.verdict,
        summary: `Verification artifact missing: ${missingArtifact.path}`,
        failureCategory,
        failureCode,
        routingReason: routing.routingReason,
        failureDetail: {
          path: missingArtifact.path
        },
        mode,
        commands: commandResults,
        artifacts,
        acceptance: acceptanceVerdict
        }
      });
    }
  }

  if (!acceptanceVerdict.ok) {
    const primaryFailure = acceptanceVerdict.failures?.[0] ?? null;
    const failureCategory = primaryFailure?.category ?? "verification_acceptance";
    const failureCode = primaryFailure?.code ?? "acceptance_check_failed";
    const routing = resolveVerificationFailureRouting({
      item,
      failureCategory,
      failureCode,
      fallback: "needs_replan",
      commandResults,
      artifacts,
      failureDetail: primaryFailure?.detail ?? null
    });
    return enrichSuspendedVerificationResult({
      item,
      verificationResult: {
      verdict: routing.verdict,
      summary: acceptanceVerdict.reasons.join("; ") || "Verification acceptance did not pass.",
      failureCategory,
      failureCode,
      routingReason: routing.routingReason,
      failureDetail: primaryFailure?.detail ?? null,
      mode,
      commands: commandResults,
      artifacts,
      acceptance: acceptanceVerdict
      }
    });
  }

  return {
    verdict: "succeeded",
    summary: buildVerificationSuccessSummary({ mode, commandResults, artifacts, acceptanceVerdict }),
    mode,
    commands: commandResults,
    artifacts,
    acceptance: acceptanceVerdict
  };
}

function enrichSuspendedVerificationResult({ item, verificationResult }) {
  if (!verificationResult || !["needs_review", "blocked_external"].includes(verificationResult.verdict)) {
    return verificationResult;
  }

  return {
    ...verificationResult,
    ...buildResumeGuidanceForSuspendedItem({
      item,
      reviewStatus: verificationResult.verdict,
      reviewReason: verificationResult.failureCode ?? verificationResult.failureCategory ?? verificationResult.routingReason
    })
  };
}

function resolveVerificationFailureRouting({ item, failureCategory, failureCode, fallback, commandResults, artifacts, failureDetail }) {
  const retryPolicy = item?.retryPolicy;
  const defaultVerdict = sanitizeVerificationFailureVerdict(fallback, "failed");

  if (retryPolicy && typeof retryPolicy === "object") {
    const explicitVerdict = resolveExplicitVerificationFailureVerdict({
      retryPolicy,
      failureCategory,
      failureCode,
      defaultVerdict
    });
    if (explicitVerdict) {
      return {
        verdict: explicitVerdict,
        routingReason: "explicit_retry_policy"
      };
    }
  }

  const inferredVerdict = inferVerificationFailureVerdict({
    failureCategory,
    failureCode,
    failureDetail,
    commandResults,
    artifacts
  });
  if (inferredVerdict) {
    return inferredVerdict;
  }

  return {
    verdict: defaultVerdict,
    routingReason: "default_fallback"
  };
}

function resolveExplicitVerificationFailureVerdict({ retryPolicy, failureCategory, failureCode, defaultVerdict }) {
  if (failureCategory === "verification_command") {
    return maybeSanitizeVerificationFailureVerdict(retryPolicy.onCommandFailure, defaultVerdict);
  }

  if (failureCategory === "verification_artifact") {
    return maybeSanitizeVerificationFailureVerdict(retryPolicy.onArtifactFailure, defaultVerdict);
  }

  if (failureCategory === "verification_constraint") {
    return maybeSanitizeVerificationFailureVerdict(
      retryPolicy.onConstraintFailure ?? retryPolicy.onVerificationFail,
      defaultVerdict
    );
  }

  if (failureCategory === "verification_acceptance") {
    return maybeSanitizeVerificationFailureVerdict(
      retryPolicy.onAcceptanceFailure ?? retryPolicy.onVerificationFail,
      defaultVerdict
    );
  }

  if (failureCode === "acceptance_check_failed") {
    return maybeSanitizeVerificationFailureVerdict(
      retryPolicy.onAcceptanceFailure ?? retryPolicy.onVerificationFail,
      defaultVerdict
    );
  }

  return undefined;
}

function maybeSanitizeVerificationFailureVerdict(value, defaultVerdict) {
  if (typeof value !== "string") {
    return undefined;
  }
  return sanitizeVerificationFailureVerdict(value, defaultVerdict);
}

function sanitizeVerificationFailureVerdict(value, fallback) {
  return typeof value === "string" && ["needs_replan", "failed", "needs_review", "blocked_external"].includes(value)
    ? value
    : fallback;
}

function inferVerificationFailureVerdict({ failureCategory, failureDetail, commandResults, artifacts }) {
  if (failureCategory === "verification_command") {
    const externalBlockerReason = classifyExternalVerificationBlocker({ failureDetail, commandResults });
    if (externalBlockerReason) {
      return {
        verdict: "blocked_external",
        routingReason: externalBlockerReason
      };
    }
  }

  if (failureCategory === "verification_artifact") {
    const reviewReason = classifyReviewArtifactHint(failureDetail, artifacts);
    if (reviewReason) {
      return {
        verdict: "needs_review",
        routingReason: reviewReason
      };
    }
  }

  return null;
}

function classifyExternalVerificationBlocker({ failureDetail, commandResults }) {
  const commandText = typeof failureDetail?.command === "string" ? failureDetail.command : "";
  const outputText = (Array.isArray(commandResults) ? commandResults : [])
    .flatMap(result => [result?.stdout, result?.stderr, result?.command])
    .filter(value => typeof value === "string" && value.trim())
    .join("\n")
    .toLowerCase();
  const combined = `${commandText}\n${outputText}`.toLowerCase();

  const explicitExternalPatterns = [
    "credential",
    "credentials",
    "api key",
    "token",
    "oauth",
    "auth required",
    "authentication",
    "unauthorized",
    "forbidden",
    "permission denied",
    "access denied",
    "not logged in",
    "login required",
    "certificate",
    "tls",
    "ssl",
    "econnrefused",
    "econnreset",
    "enotfound",
    "network is unreachable",
    "service unavailable",
    "command not found",
    "executable file not found",
    "enoent"
  ];

  if (explicitExternalPatterns.some(pattern => combined.includes(pattern))) {
    return "inferred_external_dependency_or_credentials";
  }

  return null;
}

function classifyReviewArtifactHint(failureDetail, artifacts) {
  const artifactPath = typeof failureDetail?.path === "string" ? failureDetail.path.toLowerCase() : "";
  const previewText = (Array.isArray(artifacts) ? artifacts : [])
    .map(artifact => (typeof artifact?.preview === "string" ? artifact.preview : ""))
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  const combined = `${artifactPath}\n${previewText}`;

  if (["manual-review", "needs-review", "approval", "signoff", "human-review"].some(pattern => combined.includes(pattern))) {
    return "inferred_manual_review_artifact";
  }

  return null;
}

function maybeAppendVerificationFollowup({ queue, index, item, promptText, verificationResult }) {
  if (verificationResult?.verdict !== "needs_replan") {
    return { queue, verificationResult };
  }

  const maxAttempts = Number.isInteger(item?.retryPolicy?.maxAttempts) && item.retryPolicy.maxAttempts > 0
    ? item.retryPolicy.maxAttempts
    : 1;
  const currentAttempt = Number.isInteger(item?.attempt) && item.attempt >= 0 ? item.attempt : 0;

  if (currentAttempt >= maxAttempts) {
    return {
      queue,
      verificationResult: {
        ...verificationResult,
        verdict: "failed",
        summary: `${verificationResult.summary}; maxAttempts exhausted (${currentAttempt}/${maxAttempts})`,
        failureCategory: "replan_budget",
        failureCode: "max_attempts_exhausted",
        failureDetail: {
          currentAttempt,
          maxAttempts
        }
      }
    };
  }

  const generatedAt = new Date().toISOString();
  const followupItem = buildReplanFollowupItem({
    queue,
    item,
    promptText,
    verificationResult,
    generatedAt
  });
  const nextQueue = appendQueueItems(queue, [followupItem], generatedAt);

  return {
    queue: nextQueue,
    verificationResult: {
      ...verificationResult,
      summary: `${verificationResult.summary}; appended follow-up ${followupItem.id}`,
      followupItemId: followupItem.id,
      followupAttempt: followupItem.attempt
    }
  };
}

function buildReplanFollowupItem({ queue, item, promptText, verificationResult, generatedAt }) {
  const followupId = allocateReplanItemId(queue, item?.id ?? "replan-item");
  const nextAttempt = Number.isInteger(item?.attempt) && item.attempt >= 0 ? item.attempt : 0;
  const summary = typeof verificationResult?.summary === "string" && verificationResult.summary.trim()
    ? verificationResult.summary.trim()
    : "Verification requested replanning.";

  return {
    ...item,
    id: followupId,
    title: buildReplanTitle(item),
    status: "pending",
    attempt: nextAttempt,
    parentId: item?.id ?? null,
    replanSourceItemId: item?.id ?? null,
    originVerdict: verificationResult?.verdict ?? "needs_replan",
    replanReason: summary,
    generatedAt,
    sessionId: undefined,
    messageId: undefined,
    messageReceivedAt: undefined,
    resumedAt: undefined,
    startedAt: undefined,
    completedAt: undefined,
    verifiedAt: undefined,
    verificationStartedAt: undefined,
    verificationVerdict: undefined,
    verificationArtifactPath: undefined,
    verificationSummary: undefined,
    verificationResult: undefined,
    handoffPath: undefined,
    reviewReason: undefined,
    reviewSummary: undefined,
    reviewRequestedAt: undefined,
    runId: undefined,
    promptText: buildReplanPromptText({ item, promptText, verificationResult })
  };
}

function allocateReplanItemId(queue, sourceId) {
  const normalizedSourceId = sanitizeFileToken(sourceId || "replan-item");
  const prefix = `${normalizedSourceId}-replan-`;
  const existingIds = new Set(
    (Array.isArray(queue?.items) ? queue.items : [])
      .map(item => (typeof item?.id === "string" ? item.id.trim() : ""))
      .filter(Boolean)
  );

  let index = 1;
  for (;;) {
    const candidate = `${prefix}${String(index).padStart(3, "0")}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
    index += 1;
  }
}

function buildReplanTitle(item) {
  const baseTitle = typeof item?.title === "string" && item.title.trim() ? item.title.trim() : item?.id ?? "queued item";
  return `${baseTitle} (replan follow-up)`;
}

function buildReplanPromptText({ item, promptText, verificationResult }) {
  const replanGuidance = buildReplanGuidance(verificationResult);
  const sections = [
    `Replan follow-up for ${item?.id ?? "queued item"}.`,
    `Goal: ${item?.goal ?? item?.title ?? "Implement the queued repository increment."}`,
    `Previous verification verdict: ${verificationResult?.verdict ?? "needs_replan"}`,
    `Previous failure taxonomy: ${verificationResult?.failureCategory ?? "verification_acceptance"}/${verificationResult?.failureCode ?? "acceptance_check_failed"}`,
    `Previous verification summary: ${verificationResult?.summary ?? "Verification requested replanning."}`,
    replanGuidance,
    "Revisit the last attempted change, make the next smallest correction, run one focused validation, and explain exactly how this attempt addresses the failed verification evidence."
  ];

  if (typeof promptText === "string" && promptText.trim()) {
    sections.push(`Previous execution prompt:\n${truncateForArtifact(promptText.trim())}`);
  }

  return sections.join("\n\n");
}

function buildReplanGuidance(verificationResult) {
  const failureCategory = verificationResult?.failureCategory;
  const detail = verificationResult?.failureDetail;

  if (failureCategory === "verification_acceptance") {
    return buildMetricTargetedReplanGuidance({
      intro: "Focus on the implementation gap that prevented acceptance from passing.",
      detail,
      fallback: "Inspect the failing acceptance metric, adjust the implementation or produced artifact, and rerun only the narrow verifier path needed to satisfy the threshold."
    });
  }

  if (failureCategory === "verification_constraint") {
    return buildMetricTargetedReplanGuidance({
      intro: "Focus on the constraint regression introduced by the last attempt.",
      detail,
      fallback: "Reduce the specific constrained metric without broadening scope, then rerun the narrow verifier path to confirm the limit now passes."
    });
  }

  if (failureCategory === "verification_artifact") {
    return "Focus on producing the exact missing verification artifact at the declared path before changing anything broader; keep the fix limited to artifact generation and evidence wiring.";
  }

  if (failureCategory === "verification_command") {
    return "Focus on why the verification command itself failed; prefer the smallest fix that makes the declared validation command pass without weakening the command contract.";
  }

  return "Focus on the smallest concrete correction that addresses the recorded verifier failure without broadening scope or changing unrelated behavior.";
}

function buildMetricTargetedReplanGuidance({ intro, detail, fallback }) {
  const metricName = typeof detail?.metricName === "string" && detail.metricName.trim() ? detail.metricName.trim() : null;
  const rule = typeof detail?.rule === "string" && detail.rule.trim() ? detail.rule.trim() : null;
  const actualValue = detail?.actualValue;

  if (!metricName || !rule) {
    return fallback;
  }

  return `${intro} Target metric \`${metricName}\` expected \`${rule}\` but got \`${actualValue ?? "missing"}\`; change only the code or artifact path that influences this metric, then rerun the same verifier evidence path.`;
}

function runVerificationCommands({ repoRoot, commands, commandTimeoutMs }) {
  const normalizedCommands = Array.isArray(commands)
    ? commands.filter(command => typeof command === "string" && command.trim()).map(command => command.trim())
    : [];

  const results = [];
  for (const command of normalizedCommands) {
    const commandResult = spawnSync(command, {
      cwd: repoRoot,
      shell: true,
      encoding: "utf8",
      timeout: Number.isInteger(commandTimeoutMs) && commandTimeoutMs > 0 ? commandTimeoutMs : 300000
    });
    results.push({
      command,
      exitCode: typeof commandResult.status === "number" ? commandResult.status : 1,
      signal: commandResult.signal ?? null,
      stdout: truncateForArtifact(commandResult.stdout),
      stderr: truncateForArtifact(commandResult.stderr),
      timedOut: commandResult.error?.code === "ETIMEDOUT"
    });

    if ((typeof commandResult.status === "number" ? commandResult.status : 1) !== 0) {
      break;
    }
  }

  return results;
}

function readVerificationArtifacts({ repoRoot, artifactPaths, executionHandoffPath, handoffsDir }) {
  const normalizedPaths = Array.isArray(artifactPaths)
    ? artifactPaths.filter(path => typeof path === "string" && path.trim()).map(path => path.trim())
    : [];
  const builtInArtifacts = executionHandoffPath ? [executionHandoffPath] : [];
  const allPaths = [...new Set([...normalizedPaths, ...builtInArtifacts])];

  return allPaths.map(path => {
    const absolutePath = resolve(repoRoot, path);
    const exists = existsSync(absolutePath);
    const artifact = {
      path,
      exists
    };

    if (!exists) {
      return artifact;
    }

    if (absolutePath.startsWith(handoffsDir)) {
      artifact.kind = "handoff";
    }

    try {
      const raw = readFileSync(absolutePath, "utf8");
      artifact.preview = truncateForArtifact(raw);
      if (absolutePath.endsWith(".json")) {
        artifact.json = JSON.parse(raw);
      }
    } catch (error) {
      artifact.readError = error instanceof Error ? error.message : String(error);
    }

    return artifact;
  });
}

function computeAcceptanceVerdict({ item, artifacts }) {
  const reasons = [];
  const failures = [];
  const acceptance = item?.acceptance;
  const constraints = item?.constraints;
  const jsonMetrics = collectJsonMetrics(artifacts);

  if (acceptance?.metrics && typeof acceptance.metrics === "object") {
    for (const [metricName, rule] of Object.entries(acceptance.metrics)) {
      const actualValue = jsonMetrics[metricName];
      if (!evaluateMetricRule(actualValue, rule)) {
        reasons.push(`acceptance metric ${metricName} expected ${rule}, got ${actualValue ?? "missing"}`);
        failures.push({
          category: "verification_acceptance",
          code: "acceptance_metric_failed",
          detail: {
            metricName,
            rule,
            actualValue: actualValue ?? null
          }
        });
      }
    }
  }

  if (constraints && typeof constraints === "object") {
    for (const [metricName, rule] of Object.entries(constraints)) {
      const actualValue = jsonMetrics[metricName];
      if (!evaluateMetricRule(actualValue, rule)) {
        reasons.push(`constraint ${metricName} expected ${rule}, got ${actualValue ?? "missing"}`);
        failures.push({
          category: "verification_constraint",
          code: "constraint_metric_failed",
          detail: {
            metricName,
            rule,
            actualValue: actualValue ?? null
          }
        });
      }
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    failures,
    metrics: Object.keys(jsonMetrics).length > 0 ? jsonMetrics : undefined
  };
}

function collectJsonMetrics(artifacts) {
  const metrics = {};
  for (const artifact of Array.isArray(artifacts) ? artifacts : []) {
    if (!artifact?.json || typeof artifact.json !== "object" || Array.isArray(artifact.json)) {
      continue;
    }

    Object.assign(metrics, flattenNumericObject(artifact.json));
  }
  return metrics;
}

function flattenNumericObject(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const flattened = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof nestedValue === "number") {
      flattened[nextKey] = nestedValue;
      flattened[key] ??= nestedValue;
      continue;
    }

    if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
      Object.assign(flattened, flattenNumericObject(nestedValue, nextKey));
    }
  }

  return flattened;
}

function evaluateMetricRule(actualValue, rule) {
  if (typeof rule === "number") {
    return actualValue === rule;
  }

  if (typeof actualValue !== "number" || typeof rule !== "string") {
    return false;
  }

  const match = rule.trim().match(/^(>=|<=|>|<|==?)\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) {
    return false;
  }

  const operator = match[1];
  const expectedValue = Number.parseFloat(match[2]);
  switch (operator) {
    case ">=":
      return actualValue >= expectedValue;
    case "<=":
      return actualValue <= expectedValue;
    case ">":
      return actualValue > expectedValue;
    case "<":
      return actualValue < expectedValue;
    case "=":
    case "==":
      return actualValue === expectedValue;
    default:
      return false;
  }
}

function buildVerificationSuccessSummary({ mode, commandResults, artifacts, acceptanceVerdict }) {
  const summaryParts = [`mode=${mode}`];
  if (commandResults.length > 0) {
    summaryParts.push(`commands=${commandResults.length}`);
  }
  if (artifacts.length > 0) {
    summaryParts.push(`artifacts=${artifacts.filter(artifact => artifact.exists).length}/${artifacts.length}`);
  }
  if (acceptanceVerdict?.metrics) {
    summaryParts.push(`metrics=${Object.keys(acceptanceVerdict.metrics).length}`);
  }
  return summaryParts.join("; ");
}

function writeVerificationArtifact({ repoRoot, handoffsDir, itemId, completedAt, verificationResult }) {
  const artifactPath = resolve(
    handoffsDir,
    `${toTimestampSlug(new Date(completedAt))}-${sanitizeFileToken(itemId)}.verification.json`
  );
  writeFileSync(
    artifactPath,
    `${JSON.stringify(
      {
        itemId,
        verifiedAt: completedAt,
        ...verificationResult
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return relative(repoRoot, artifactPath).replace(/\\/g, "/");
}

function truncateForArtifact(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.length > 2000 ? `${trimmed.slice(0, 2000)}...` : trimmed;
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
  return await retryJsonRequest({ method, url, headers, body });
}

async function retryJsonRequest({ method, url, headers, body }) {
  const maxAttempts = DEFAULT_NETWORK_RETRY_COUNT + 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestJsonOnce({ method, url, headers, body });
    } catch (error) {
      lastError = error;
      if (!shouldRetryNetworkRequest(error) || attempt >= maxAttempts) {
        throw error;
      }

      await sleep(computeNetworkRetryDelayMs(attempt));
    }
  }

  throw lastError ?? new Error(`OpenCode request failed unexpectedly: ${method} ${url}`);
}

async function requestJsonOnce({ method, url, headers, body }) {
  let response;

  try {
    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    throw normalizeNetworkRequestError(error, { method, url });
  }

  const raw = await response.text();
  if (!response.ok) {
    const requestError = new Error(`OpenCode request failed: ${method} ${url} -> ${response.status} ${raw}`);
    requestError.statusCode = response.status;
    requestError.responseBody = raw;
    throw requestError;
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

function shouldRetryNetworkRequest(error) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (isFetchFailedError(error)) {
    return true;
  }

  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : null;
  if (statusCode && [408, 425, 429, 500, 502, 503, 504].includes(statusCode)) {
    return true;
  }

  return false;
}

function computeNetworkRetryDelayMs(attempt) {
  const exponent = Math.max(0, attempt - 1);
  return DEFAULT_NETWORK_RETRY_BASE_DELAY_MS * 2 ** exponent;
}

function normalizeNetworkRequestError(error, { method, url }) {
  if (error instanceof Error) {
    if (isFetchFailedError(error)) {
      error.requestMethod = method;
      error.requestUrl = url;
      return error;
    }

    return new Error(`${method} ${url} failed: ${error.message}`);
  }

  return new Error(`${method} ${url} failed: ${String(error)}`);
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

function renderHandoff({
  item,
  session,
  message,
  promptText,
  assistantText,
  caveats,
  completedAt,
  finalStatus = "completed",
  verificationResult,
  verificationArtifactPath
}) {
  const resultText = assistantText.trim() ? assistantText.trim() : "(空)";
  const verificationLines = buildVerificationHandoffLines({
    item,
    verificationResult,
    verificationArtifactPath
  });
  const lines = [
    `# ${item.id}`,
    "",
    `- 标题: ${item.title ?? item.id}`,
    `- 状态: ${finalStatus}`,
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
    ...verificationLines,
    ...(caveats.length > 0 ? ["## 备注", ...caveats.map(caveat => `- ${caveat}`), ""] : [""])
  ];

  return `${lines.join("\n")}\n`;
}

function buildVerificationHandoffLines({ item, verificationResult, verificationArtifactPath }) {
  if (!verificationResult) {
    return [];
  }

  const lines = [
    "## 验证",
    `- Verdict: ${verificationResult.verdict ?? "unknown"}`,
    `- Summary: ${verificationResult.summary ?? "(none)"}`,
    ...(verificationArtifactPath ? [`- Artifact: ${verificationArtifactPath}`] : []),
    ...(verificationResult.failureCategory ? [`- Failure Category: ${verificationResult.failureCategory}`] : []),
    ...(verificationResult.failureCode ? [`- Failure Code: ${verificationResult.failureCode}`] : []),
    ...(verificationResult.routingReason ? [`- Routing Reason: ${verificationResult.routingReason}`] : []),
    ...(verificationResult.resumeWhen || item?.resumeWhen ? [`- Resume When: ${verificationResult.resumeWhen ?? item.resumeWhen}`] : []),
    ...(verificationResult.resumeHint || item?.resumeHint ? [`- Resume Hint: ${verificationResult.resumeHint ?? item.resumeHint}`] : [])
  ];

  if (verificationResult.failureDetail && typeof verificationResult.failureDetail === "object") {
    lines.push("- Failure Detail:");
    lines.push("```json");
    lines.push(JSON.stringify(verificationResult.failureDetail, null, 2));
    lines.push("```");
  }

  const operatorSummary = buildOperatorHandoffSummary({ item, verificationResult, verificationArtifactPath });
  if (operatorSummary.length > 0) {
    lines.push("");
    lines.push("## 接管摘要");
    lines.push(...operatorSummary.map(entry => `- ${entry}`));
  }

  lines.push("");
  return lines;
}

function buildOperatorHandoffSummary({ item, verificationResult, verificationArtifactPath }) {
  const verdict = verificationResult?.verdict;
  if (!["needs_replan", "failed", "needs_review", "blocked_external"].includes(verdict)) {
    return [];
  }

  const entries = [];
  if (verdict === "needs_replan") {
    entries.push(`当前尝试未满足 verifier 条件；原任务保留为 ${verdict} 证据项。`);
    if (verificationResult?.followupItemId) {
      entries.push(`自动 follow-up 已追加到 queue：${verificationResult.followupItemId}。`);
    }
    entries.push("优先查看 failure taxonomy 和 verification artifact，确认下一次自动修复是否对准失败点。");
  } else if (verdict === "failed") {
    entries.push("该任务已停止自动重试，需要人工处理后再决定是否恢复。");
    if (item?.retryPolicy?.maxAttempts) {
      entries.push(`当前 retryPolicy.maxAttempts=${item.retryPolicy.maxAttempts}。`);
    }
    entries.push("先查看 verification commands / artifacts / failure detail，再决定是修正验证契约还是修正实现。");
  } else if (verdict === "blocked_external") {
    entries.push("该任务已被 verifier 路由到 blocked_external，当前应等待外部依赖、权限或凭据恢复后再继续。");
    entries.push("优先检查 verification command / artifact 与 failure detail，确认阻塞点是否来自环境、凭据或外部系统，而不是实现本身。");
  } else {
    entries.push("该任务已被 verifier 路由到 needs_review，自动链路已暂停，等待人工判断后再恢复。");
    entries.push("优先检查 verification taxonomy、artifact 和 failure detail，判断是 verifier 合同过严还是实现边界需要人工确认。");
  }

  if (verificationResult?.failureCategory && verificationResult?.failureCode) {
    entries.push(`失败分类：${verificationResult.failureCategory}/${verificationResult.failureCode}。`);
  }
  if (verificationArtifactPath) {
    entries.push(`详细证据见 ${verificationArtifactPath}。`);
  }
  if (verificationResult?.resumeWhen || item?.resumeWhen) {
    entries.push(`恢复条件：${verificationResult?.resumeWhen ?? item.resumeWhen}`);
  }
  if (verificationResult?.resumeHint || item?.resumeHint) {
    entries.push(`恢复入口：${verificationResult?.resumeHint ?? item.resumeHint}`);
  }

  return entries;
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
  const {
    pendingCount,
    completedCount,
    inProgressCount,
    deferredCount,
    verifyingCount,
    needsReviewCount,
    blockedExternalCount,
    needsReplanCount,
    failedCount,
    totalCount
  } = countQueueWork(queue);
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const pickedStatus = items[pickedIndex]?.status;
  const currentWorkReduction = pickedStatus === "pending" || pickedStatus === "in_progress" ? 1 : 0;

  return {
    queueTotal: totalCount,
    queuePending: pendingCount,
    queueCompleted: completedCount,
    queueInProgress: inProgressCount,
    queueDeferred: deferredCount,
    queueVerifying: verifyingCount,
    queueNeedsReview: needsReviewCount,
    queueBlockedExternal: blockedExternalCount,
    queueNeedsReplan: needsReplanCount,
    queueFailed: failedCount,
    remainingAfterPick: Math.max(0, pendingCount + inProgressCount + deferredCount - currentWorkReduction),
    ...buildQueueFamilyCountVisibility(queue)
  };
}

function buildIdleQueueWorkVisibility(queue) {
  const {
    pendingCount,
    completedCount,
    inProgressCount,
    deferredCount,
    verifyingCount,
    needsReviewCount,
    blockedExternalCount,
    needsReplanCount,
    failedCount,
    totalCount
  } = countQueueWork(queue);

  return {
    queueTotal: totalCount,
    queuePending: pendingCount,
    queueCompleted: completedCount,
    queueInProgress: inProgressCount,
    queueDeferred: deferredCount,
    queueVerifying: verifyingCount,
    queueNeedsReview: needsReviewCount,
    queueBlockedExternal: blockedExternalCount,
    queueNeedsReplan: needsReplanCount,
    queueFailed: failedCount,
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

    if (item?.status === "pending" || item?.status === "deferred") {
      pendingByFamily.set(family, (pendingByFamily.get(family) ?? 0) + 1);
      continue;
    }

    if (item?.status === "completed") {
      completedByFamily.set(family, (completedByFamily.get(family) ?? 0) + 1);
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

function buildLoopSessionTitle({ index, item, queue, runStartedAt }) {
  const remaining = countRemainingQueueWork(queue);
  const stagePrefix = item?.plannerSource === "auto-refill" ? "refill " : "";
  return `loop #${index + 1} · ${stagePrefix}${remaining} left · ${item?.id ?? "unknown-item"} · ${formatSessionTitleTime(runStartedAt)}`;
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
    verify: "验证",
    "verify:verdict": "验证结果",
    "queue:normalize": "队列修复",
    "queue:v2-normalize": "队列V2归一化",
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
    "queueVerifying",
    "queueNeedsReview",
    "queueBlockedExternal",
    "queueNeedsReplan",
    "queueFailed",
    "queueTotal",
    "handoffPath",
    "verificationArtifactPath",
    "verificationVerdict",
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
