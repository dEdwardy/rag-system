#!/usr/bin/env node
import { mkdir, appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import {
  loadLatestQueue,
  nextRunnableItem,
  firstBlockedPendingItem,
  queueSummary,
  queueItems,
  reconcileQueue,
  writeJson
} from './queue-utils.mjs';
import {
  nextRunnerIteration,
  shouldStopAfterNoProgress
} from './runner-loop-policy.mjs';
import { wasExecutionSuperseded } from './execution-guards.mjs';
import {
  resolveExecutionBackend,
  runExecutionPrompt,
  validateExecutionBackend
} from '../adapters/execution-adapters.mjs';
import {
  buildBackendEnv,
  EXECUTION_BACKENDS,
  LEGACY_LOOP_ENV_KEYS,
  LOOP_ENV_KEYS,
  resolveLoopNumberEnv,
  shouldStripBackendRuntimeEnv
} from './backend-config.mjs';
import {
  inferRecoveryRootCause,
  buildRecoveryNextSteps
} from './recovery-utils.mjs';
import { shouldWriteHeartbeatLog } from './heartbeat-log-utils.mjs';
import {
  buildContinuationPrompt,
  buildExecutionPrompt,
  buildFinalizerPrompt
} from './prompt-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(loopDir, '..');
const runtimeDir = path.join(loopDir, 'runtime');
const recoveryDir = path.join(runtimeDir, 'recovery');
const stateFile = path.join(runtimeDir, 'loop-state.json');
const logFile = path.join(loopDir, 'loop-run.log');
const intervalMs = resolveLoopNumberEnv(
  process.env,
  LOOP_ENV_KEYS.intervalMs,
  LEGACY_LOOP_ENV_KEYS.intervalMs,
  5000
);
const itemTimeoutMs = resolveLoopNumberEnv(
  process.env,
  LOOP_ENV_KEYS.itemTimeoutMs,
  LEGACY_LOOP_ENV_KEYS.itemTimeoutMs,
  1200000
);
const itemIdleTimeoutMs = resolveLoopNumberEnv(
  process.env,
  LOOP_ENV_KEYS.itemIdleTimeoutMs,
  LEGACY_LOOP_ENV_KEYS.itemIdleTimeoutMs,
  45000
);
let stopping = false;
let currentChild = null;
let currentRun = null;
let startedAt = new Date().toISOString();
let childAbortReason = null;
let lastHeartbeatSignature = null;
const executionBackend = resolveExecutionBackend();

async function safeAppendLog(line) {
  try {
    await appendFile(logFile, line);
  } catch {
    // ignore log write failures so one bad append does not kill the runner
  }
}

async function failCurrentItem(loaded, item, error, extra = {}) {
  const finishedAt = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const sessionId = extra.sessionId ?? currentRun?.activeSessionId ?? null;

  try {
    await updateQueueItem(
      loaded,
      item.id,
      cleanObject({
        status: 'needs_replan',
        updatedAt: finishedAt,
        finishedAt,
        resultExitCode: 1,
        failureReason: extra.failureReason ?? 'runner_internal_error',
        reportedError: message,
        queueFailureMarkers:
          extra.queueFailureMarkers ?? 'runner_internal_error',
        timedOutAt: extra.timedOut ? finishedAt : undefined,
        sessionId
      })
    );
  } catch (updateError) {
    await safeAppendLog(
      `${finishedAt} item=${item.id} status=runner_error queue_update_failed=${updateError instanceof Error ? updateError.message : String(updateError)}\n`
    );
  }

  currentRun = {
    phase: 'needs_replan',
    currentItemId: item.id,
    currentItemTitle: item.title,
    currentItemStatus: 'needs_replan',
    lastResult: 'needs_replan',
    lastExitCode: 1,
    lastCompletedAt: null,
    activeSessionId: sessionId,
    blockedOn: extra.blockedOn ?? null
  };

  await safeAppendLog(
    `${finishedAt} item=${item.id} status=needs_replan exit=1 failure_reason=${extra.failureReason ?? 'runner_internal_error'} reported_error=${JSON.stringify(message)}\n`
  );

  try {
    await heartbeat();
  } catch {
    // ignore heartbeat failures here; the runner should keep looping
  }
}
function buildChildEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (shouldStripBackendRuntimeEnv(key)) {
      delete env[key];
    }
  }
  return env;
}

const heartbeatTimer = setInterval(() => {
  heartbeat().catch((error) => {
    appendFile(
      logFile,
      `${new Date().toISOString()} heartbeat_error=${error.message}\n`
    ).catch(() => {});
  });
}, intervalMs);

heartbeatTimer.unref();

await mkdir(runtimeDir, { recursive: true });
await mkdir(recoveryDir, { recursive: true });

const backendCheck = await validateExecutionBackend(process.env);
if (!backendCheck.ok) {
  currentRun = {
    phase: 'blocked',
    currentItemId: null,
    currentItemTitle: null,
    currentItemStatus: null,
    blockedOn: backendCheck.message
  };
  await safeAppendLog(
    `${new Date().toISOString()} runner_blocked reason=${JSON.stringify(backendCheck.message)}\n`
  );
  await heartbeat();
  process.exit(1);
}

async function readState() {
  try {
    const raw = await readFile(stateFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) => entry !== undefined && entry !== null && entry !== ''
    )
  );
}

function extractReportedError(stdout) {
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(trimmed);
      const message = parsed?.error?.data?.message ?? parsed?.error?.message;
      if (message) return message;
    } catch {
      // ignore non-JSON or partial lines
    }
  }
  return null;
}

function extractQueueResult(stdout) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.startsWith('QUEUE_RESULT ')) continue;
    const result = {};
    for (const match of line.matchAll(
      /(status|item|validation|changed_files|commit)=([^\s]+)/g
    )) {
      result[match[1]] = match[2];
    }
    return result;
  }
  return null;
}

function extractFailureMarkers(stdout, stderr) {
  // Exclude JSON lines from stdout to avoid false positives from JSONL output
  const stdoutPlain = stdout
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('{'))
    .join('\n');
  const output = `${stdoutPlain}\n${stderr}`;
  const markers = [];
  const checks = [
    [/\bQUEUE_RESULT status=needs_replan\b/, 'queue_result_needs_replan'],
    [/\bFailed Tests?\b/, 'failed_tests_summary'],
    [/\bFailed Suites?\b/, 'failed_suites_summary'],
    [/\bNo test suite found\b/, 'no_test_suite_found'],
    [/\bERR_PNPM_[A-Z0-9_]+\b/, 'pnpm_command_failure'],
    [/Command "vitest" not found/, 'vitest_command_missing'],
    [/\n\s*[✖×]\s/, 'explicit_test_failure_marker'],
    [/\n\s*FAIL\s+/m, 'fail_banner'],
    [/\bAssertionError\b/, 'assertion_error']
  ];

  for (const [pattern, code] of checks) {
    if (pattern.test(output)) markers.push(code);
  }

  return [...new Set(markers)];
}

function summarizeOutput(stdout, stderr) {
  return (
    stdout.trim().split('\n').slice(-8).join('\n') ||
    stderr.trim().split('\n').slice(-8).join('\n') ||
    undefined
  );
}

function getItemTimeoutMs(item) {
  const candidates = [
    item?.timeoutMs,
    item?.timeout_ms,
    item?.execution?.timeoutMs,
    item?.execution?.timeout_ms
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return itemTimeoutMs;
}

function buildRecoveryArtifactPath(itemId, finishedAt) {
  const safeTime = finishedAt.replace(/[:.]/g, '-');
  return path.join(recoveryDir, `${safeTime}-${itemId}.json`);
}

async function writeTimeoutRecoveryArtifact({
  item,
  queueFileName,
  finishedAt,
  result,
  queueResult,
  failureMarkers,
  beforeSnapshot,
  afterSnapshot,
  validationCommand,
  finalizerUsed
}) {
  const changedFiles = afterSnapshot?.statusShort
    ? afterSnapshot.statusShort
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
  const rootCause = inferRecoveryRootCause({
    result,
    queueResult,
    failureMarkers,
    changedFiles
  });
  const commitCreated = commitCreatedDuringRun(beforeSnapshot, afterSnapshot);
  const artifact = cleanObject({
    itemId: item.id,
    itemTitle: item.title,
    queueFileName,
    finishedAt,
    timeoutMs: getItemTimeoutMs(item),
    validationCommand,
    finalizerUsed,
    queueResultStatus: queueResult?.status ?? undefined,
    queueResultCommit: queueResult?.commit ?? undefined,
    failureMarkers: failureMarkers.length > 0 ? failureMarkers : undefined,
    exitCode: result.exitCode,
    signal: result.signal ?? undefined,
    reportedError: result.reportedError ?? undefined,
    stdoutTail: summarizeOutput(result.stdout, result.stderr),
    changedFiles: changedFiles.length > 0 ? changedFiles : undefined,
    beforeHead: beforeSnapshot?.head ?? undefined,
    afterHead: afterSnapshot?.head ?? undefined,
    diagnosis: {
      rootCause,
      worktreeClean: afterSnapshot?.worktreeClean ?? false,
      commitCreated,
      changedFileCount: changedFiles.length
    },
    nextSteps: buildRecoveryNextSteps({
      rootCause,
      changedFiles,
      validationCommand,
      commitCreated,
      queueFileName
    })
  });

  await writeFile(
    buildRecoveryArtifactPath(item.id, finishedAt),
    `${JSON.stringify(artifact, null, 2)}\n`
  );
}

function runGitCommand(args) {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      { cwd: repoRoot, windowsHide: true },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: typeof stdout === 'string' ? stdout.trim() : '',
          stderr: typeof stderr === 'string' ? stderr.trim() : ''
        });
      }
    );
  });
}

async function gitSnapshot() {
  const [head, status] = await Promise.all([
    runGitCommand(['rev-parse', 'HEAD']),
    runGitCommand(['status', '--short'])
  ]);

  return {
    head: head.ok ? head.stdout || null : null,
    statusShort: status.ok ? status.stdout : null,
    worktreeClean: status.ok ? status.stdout === '' : false
  };
}

function commitCreatedDuringRun(beforeSnapshot, afterSnapshot) {
  return Boolean(
    beforeSnapshot?.head &&
    afterSnapshot?.head &&
    beforeSnapshot.head !== afterSnapshot.head
  );
}

function successfulCommitFallback(
  result,
  queueResult,
  failureMarkers,
  beforeSnapshot,
  afterSnapshot
) {
  return (
    result.exitCode === 0 &&
    !result.reportedError &&
    !stopping &&
    !queueResult?.status &&
    failureMarkers.length === 0 &&
    commitCreatedDuringRun(beforeSnapshot, afterSnapshot) &&
    afterSnapshot?.worktreeClean
  );
}

function successfulNoopFallback(
  result,
  queueResult,
  failureMarkers,
  beforeSnapshot,
  afterSnapshot,
  finalizerUsed
) {
  if (
    result.exitCode !== 0 ||
    result.reportedError ||
    stopping ||
    !finalizerUsed ||
    queueResult?.status ||
    failureMarkers.length > 0
  ) {
    return false;
  }
  // Finalizer-based noop recovery must still prove a commit happened during the run.
  return commitCreatedDuringRun(beforeSnapshot, afterSnapshot);
}

async function heartbeat() {
  const loaded = await loadLatestQueue(loopDir);
  if (currentChild && currentRun?.phase === 'executing' && loaded?.queue) {
    const executingItem = Array.isArray(loaded.queue.items)
      ? loaded.queue.items.find(
          (entry) => entry?.id === currentRun.currentItemId
        )
      : null;
    if (
      wasExecutionSuperseded(executingItem, {
        attempt: currentRun.currentAttempt,
        startedAt: currentRun.currentStartedAt
      })
    ) {
      childAbortReason = 'execution_superseded';
      try {
        currentChild.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
  }
  const summary = loaded
    ? {
        ...queueSummary(loaded.queue),
        fileName: path.basename(loaded.filePath)
      }
    : {
        activeWave: null,
        fileName: null,
        pendingCount: 0,
        inProgressCount: 0,
        completedCount: 0,
        blockedCount: 0,
        totalCount: 0
      };
  const now = new Date().toISOString();
  const heartbeatDecision = shouldWriteHeartbeatLog({
    summary,
    currentRunState: currentRun,
    isStopping: stopping,
    previousSignature: lastHeartbeatSignature
  });
  if (heartbeatDecision.shouldWrite) {
    lastHeartbeatSignature = heartbeatDecision.signature;
    const line = `${now} pid=${process.pid} wave=${summary.activeWave ?? 'none'} pending=${summary.pendingCount} total=${summary.totalCount}\n`;
    await appendFile(logFile, line);
  }
  const state = cleanObject({
    version: 1,
    pid: process.pid,
    status: stopping ? 'stopping' : (currentRun?.phase ?? 'running'),
    startedAt,
    updatedAt: now,
    heartbeatAt: now,
    ...summary,
    ...currentRun
  });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

function buildSessionTitle(queue, item) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const activeItems = items.filter(
    (entry) => entry && entry.status !== 'completed'
  );
  const totalCount = activeItems.length;
  const currentIndex = Math.max(
    1,
    activeItems.findIndex((entry) => entry.id === item.id) + 1
  );
  const remainingAfterCurrent = Math.max(0, totalCount - currentIndex);

  return `[${currentIndex}/${totalCount} | left ${remainingAfterCurrent}] ${item.id}`;
}

async function runQueueItem(queue, item, queueFileName, sessionId) {
  const prompt = sessionId
    ? buildContinuationPrompt(item, queueFileName)
    : buildExecutionPrompt(item, queueFileName);
  const opencodeEnv = buildBackendEnv(process.env, EXECUTION_BACKENDS.opencode);
  const codexEnv = buildBackendEnv(process.env, EXECUTION_BACKENDS.codex);
  const result = await runExecutionPrompt({
    backend: executionBackend,
    prompt,
    title: buildSessionTitle(queue, item),
    sessionId,
    cwd: repoRoot,
    env: buildChildEnv(),
    timeoutMs: getItemTimeoutMs(item),
    idleTimeoutMs: itemIdleTimeoutMs,
    onSpawn: (child) => {
      currentChild = child;
    },
    onExit: (child) => {
      if (currentChild === child) {
        currentChild = null;
      }
    },
    opencodeEnv,
    codexEnv
  }).catch((error) => ({
    exitCode: 1,
    signal: null,
    stdout: '',
    stderr: `${error.message}\n`,
    timedOut: false,
    reportedError: error.message,
    sessionId: sessionId ?? null
  }));

  return {
    ...result,
    sessionId: result.sessionId ?? sessionId ?? null,
    reportedError: result.reportedError ?? null
  };
}

async function runQueueFinalizer(queue, item, queueFileName, sessionId) {
  const opencodeEnv = buildBackendEnv(process.env, EXECUTION_BACKENDS.opencode);
  const codexEnv = buildBackendEnv(process.env, EXECUTION_BACKENDS.codex);
  return await runExecutionPrompt({
    backend: executionBackend,
    prompt: buildFinalizerPrompt(item, queueFileName),
    title: `${buildSessionTitle(queue, item)} finalize`,
    sessionId,
    cwd: repoRoot,
    env: buildChildEnv(),
    timeoutMs: Math.min(getItemTimeoutMs(item), 180000),
    idleTimeoutMs: Math.min(itemIdleTimeoutMs, 30000),
    onSpawn: (child) => {
      currentChild = child;
    },
    onExit: (child) => {
      if (currentChild === child) {
        currentChild = null;
      }
    },
    opencodeEnv,
    codexEnv
  }).catch((error) => ({
    exitCode: 1,
    signal: null,
    stdout: '',
    stderr: `${error.message}\n`,
    timedOut: false,
    reportedError: error.message,
    sessionId: sessionId ?? null
  }));
}

async function updateQueueItem(loaded, itemId, updates) {
  const queue = loaded.queue;
  const item = queue.items.find((entry) => entry && entry.id === itemId);
  if (!item) return null;
  Object.assign(item, updates);
  queue.updatedAt = new Date().toISOString();
  await writeJson(loaded.filePath, queue);
  return item;
}

async function processOneItem() {
  let loaded;
  try {
    loaded = await loadLatestQueue(loopDir);
  } catch (error) {
    currentRun = {
      phase: 'blocked',
      currentItemId: null,
      currentItemTitle: null,
      currentItemStatus: null,
      blockedOn: `queue_load_error:${error.message}`
    };
    await heartbeat();
    return false;
  }
  if (!loaded) {
    currentRun = {
      phase: 'idle',
      currentItemId: null,
      currentItemTitle: null,
      currentItemStatus: null
    };
    await heartbeat();
    return false;
  }

  const queue = loaded.queue;
  if (reconcileQueue(queue)) {
    queue.updatedAt = new Date().toISOString();
    await writeJson(loaded.filePath, queue);
  }
  const item = nextRunnableItem(queue);
  const state = await readState();
  const livePendingCount = queueItems(queue).filter(
    (i) => i?.status === 'pending' || i?.status === 'in_progress'
  ).length;
  const reusableSessionId =
    state?.activeSessionId &&
    livePendingCount > 0 &&
    state?.currentWaveId ===
      (queue.materializedWaveId ??
        path.basename(loaded.filePath, '.queue.json'))
      ? state.activeSessionId
      : null;

  if (!item) {
    const blocked = firstBlockedPendingItem(queue);
    currentRun = {
      phase: blocked ? 'blocked' : 'idle',
      currentItemId: blocked?.id ?? null,
      currentItemTitle: blocked?.title ?? null,
      currentItemStatus: blocked?.status ?? null,
      blockedOn: blocked
        ? (Array.isArray(blocked.dependsOn) ? blocked.dependsOn : []).join(
            ', '
          ) || null
        : null
    };
    await heartbeat();
    return false;
  }

  const now = new Date().toISOString();
  const attemptNumber = Number(item.attempt ?? 0) + 1;
  await updateQueueItem(loaded, item.id, {
    status: 'in_progress',
    attempt: attemptNumber,
    startedAt: now,
    updatedAt: now,
    startedBy: 'loop-runtime-runner'
  });

  childAbortReason = null;
  currentRun = {
    phase: 'executing',
    currentItemId: item.id,
    currentItemTitle: item.title,
    currentItemStatus: 'in_progress',
    currentWaveId:
      queue.materializedWaveId ?? path.basename(loaded.filePath, '.queue.json'),
    currentWaveFile: path.basename(loaded.filePath),
    currentAttempt: attemptNumber,
    currentStartedAt: now,
    activeSessionId: reusableSessionId
  };
  await heartbeat();

  try {
    const beforeSnapshot = await gitSnapshot();
    const validationCommand =
      Array.isArray(item?.verification?.commands) &&
      item.verification.commands.length > 0
        ? item.verification.commands[0]
        : 'none';
    let result = await runQueueItem(
      queue,
      item,
      path.basename(loaded.filePath),
      reusableSessionId
    );
    let sessionId = result.sessionId ?? reusableSessionId ?? null;
    let queueResult = extractQueueResult(result.stdout);
    let finalizerUsed = false;

    if (
      !queueResult?.status &&
      result.exitCode === 0 &&
      !result.reportedError &&
      !stopping
    ) {
      const finalizerResult = await runQueueFinalizer(
        queue,
        item,
        path.basename(loaded.filePath),
        sessionId
      );
      result = {
        exitCode:
          finalizerResult.exitCode === 0
            ? result.exitCode
            : finalizerResult.exitCode,
        signal: finalizerResult.signal ?? result.signal,
        stdout: `${result.stdout}${result.stdout && finalizerResult.stdout ? '\n' : ''}${finalizerResult.stdout}`,
        stderr: `${result.stderr}${result.stderr && finalizerResult.stderr ? '\n' : ''}${finalizerResult.stderr}`,
        sessionId: finalizerResult.sessionId ?? sessionId,
        reportedError: result.reportedError ?? finalizerResult.reportedError,
        timedOut: result.timedOut || finalizerResult.timedOut
      };
      sessionId = result.sessionId ?? sessionId;
      queueResult = extractQueueResult(result.stdout);
      finalizerUsed = true;
    }

    let latestLoaded;
    try {
      latestLoaded = await loadLatestQueue(loopDir);
    } catch {
      latestLoaded = null;
    }
    const latestItem =
      latestLoaded?.queue?.items?.find((entry) => entry?.id === item.id) ??
      null;
    if (
      childAbortReason === 'execution_superseded' ||
      wasExecutionSuperseded(latestItem, {
        attempt: attemptNumber,
        startedAt: now
      })
    ) {
      await safeAppendLog(
        `${new Date().toISOString()} item=${item.id} status=superseded reason=external_queue_change\n`
      );
      currentRun = {
        phase: 'idle',
        currentItemId: null,
        currentItemTitle: null,
        currentItemStatus: null,
        activeSessionId: reusableSessionId
      };
      childAbortReason = null;
      await heartbeat();
      return false;
    }

    const afterSnapshot = await gitSnapshot();
    const finishedAt = new Date().toISOString();
    const failureMarkers = extractFailureMarkers(result.stdout, result.stderr);
    const commitFallback = successfulCommitFallback(
      result,
      queueResult,
      failureMarkers,
      beforeSnapshot,
      afterSnapshot
    );
    const noopFallback = successfulNoopFallback(
      result,
      queueResult,
      failureMarkers,
      beforeSnapshot,
      afterSnapshot,
      finalizerUsed
    );
    const success =
      commitFallback ||
      noopFallback ||
      (result.exitCode === 0 &&
        !result.reportedError &&
        !stopping &&
        queueResult?.status === 'completed' &&
        failureMarkers.length === 0);
    const status = success ? 'completed' : 'needs_replan';
    const failureReason = success
      ? undefined
      : result.timedOut
        ? `executor_timeout_${getItemTimeoutMs(item)}`
        : result.idleTimedOut
          ? `executor_idle_timeout_${itemIdleTimeoutMs}`
          : result.reportedError
            ? 'executor_reported_error'
            : queueResult?.status === 'needs_replan'
              ? 'queue_result_needs_replan'
              : !queueResult?.status
                ? commitFallback || noopFallback
                  ? undefined
                  : 'missing_queue_result'
                : (failureMarkers[0] ?? `executor_exit_${result.exitCode}`);
    const commitCreated = commitCreatedDuringRun(beforeSnapshot, afterSnapshot);

    await updateQueueItem(
      loaded,
      item.id,
      cleanObject({
        status,
        updatedAt: finishedAt,
        completedAt: success ? finishedAt : undefined,
        finishedAt,
        resultExitCode: result.exitCode,
        resultSignal: result.signal ?? undefined,
        lastRunSummary: summarizeOutput(result.stdout, result.stderr),
        failureReason,
        reportedError: success
          ? undefined
          : (result.reportedError ?? undefined),
        queueResultStatus:
          queueResult?.status ??
          (commitFallback || noopFallback ? 'completed' : undefined),
        queueResultCommit:
          queueResult?.commit ??
          (commitFallback
            ? (afterSnapshot?.head ?? undefined)
            : failureReason === 'missing_queue_result' && commitCreated
              ? (afterSnapshot?.head ?? undefined)
              : undefined),
        queueFailureMarkers:
          !success && failureMarkers.length > 0
            ? failureMarkers.join(',')
            : !success && result.idleTimedOut
              ? 'idle_progress_timeout'
              : undefined,
        timedOutAt: result.timedOut ? finishedAt : undefined,
        sessionId
      })
    );

    if (result.timedOut) {
      await writeTimeoutRecoveryArtifact({
        item,
        queueFileName: path.basename(loaded.filePath),
        finishedAt,
        result,
        queueResult,
        failureMarkers,
        beforeSnapshot,
        afterSnapshot,
        validationCommand,
        finalizerUsed
      });
    }

    await safeAppendLog(
      `${finishedAt} item=${item.id} status=${status} exit=${result.exitCode}${result.timedOut ? ` timeout_ms=${getItemTimeoutMs(item)}` : ''}${result.idleTimedOut ? ` idle_timeout_ms=${itemIdleTimeoutMs}` : ''}${queueResult?.status ? ` queue_result=${queueResult.status}` : ''}${finalizerUsed ? ' finalized_queue_result=true' : ''}${commitFallback ? ' queue_result=completed_via_commit_fallback' : ''}${noopFallback ? ' queue_result=completed_via_noop_fallback' : ''}${failureMarkers.length > 0 ? ` failure_markers=${failureMarkers.join(',')}` : ''}${!failureMarkers.length && result.idleTimedOut ? ' failure_markers=idle_progress_timeout' : ''}\n`
    );

    currentRun = {
      phase: status,
      currentItemId: item.id,
      currentItemTitle: item.title,
      currentItemStatus: status,
      lastResult: status,
      lastExitCode: result.exitCode,
      lastCompletedAt: success ? finishedAt : null,
      activeSessionId: sessionId,
      currentItemTimedOut: result.timedOut ? true : null,
      currentItemIdleTimedOut: result.idleTimedOut ? true : null
    };

    await heartbeat();

    const loopDecision = nextRunnerIteration({
      itemProcessed: true,
      itemStatus: status,
      stopRequested: stopping
    });

    return loopDecision.progressed;
  } catch (error) {
    currentChild = null;
    await failCurrentItem(loaded, item, error, {
      failureReason: 'runner_internal_error'
    });
    return true;
  }
}

process.on('SIGTERM', () => {
  stopping = true;
  if (currentChild) {
    try {
      currentChild.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
});

process.on('SIGINT', () => {
  stopping = true;
  if (currentChild) {
    try {
      currentChild.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
});

try {
  await heartbeat();
} catch (error) {
  await safeAppendLog(
    `${new Date().toISOString()} runner_startup_heartbeat_error=${error instanceof Error ? error.message : String(error)}\n`
  );
}

let blockedRetries = 0;
while (!stopping) {
  let progressed = false;
  try {
    progressed = await processOneItem();
  } catch (error) {
    currentRun = {
      phase: 'blocked',
      currentItemId: null,
      currentItemTitle: null,
      currentItemStatus: null,
      blockedOn: `runner_loop_error:${error instanceof Error ? error.message : String(error)}`
    };
    await safeAppendLog(
      `${new Date().toISOString()} runner_loop_error=${JSON.stringify(error instanceof Error ? error.message : String(error))}\n`
    );
    try {
      await heartbeat();
    } catch {
      // ignore
    }
  }
  if (stopping) break;
  if (progressed) {
    blockedRetries = 0;
  } else {
    const phase = currentRun?.phase ?? null;
    if (phase === 'blocked') {
      blockedRetries += 1;
    } else {
      blockedRetries = 0;
    }
    if (shouldStopAfterNoProgress(phase, blockedRetries)) {
      await safeAppendLog(
        `${new Date().toISOString()} runner_stopping reason=no_progress phase=${phase ?? 'unknown'} blocked_retries=${blockedRetries}\n`
      );
      stopping = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

try {
  await heartbeat();
} catch (error) {
  await safeAppendLog(
    `${new Date().toISOString()} runner_shutdown_heartbeat_error=${error instanceof Error ? error.message : String(error)}\n`
  );
}
