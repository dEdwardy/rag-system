#!/usr/bin/env node
import { mkdir, appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFile } from 'node:child_process';
import {
  loadLatestQueue,
  nextRunnableItem,
  firstBlockedPendingItem,
  queueSummary,
  writeJson
} from './queue-utils.mjs';
import {
  nextRunnerIteration,
  shouldStopAfterNoProgress
} from './runner-loop-policy.mjs';
import { wasExecutionSuperseded } from './execution-guards.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(loopDir, '..', '..');
const runtimeDir = path.join(loopDir, 'runtime');
const stateFile = path.join(runtimeDir, 'loop-state.json');
const logFile = path.join(loopDir, 'loop-run.log');
const intervalMs = Number(process.env.OPENCODE_LOOP_INTERVAL_MS ?? 5000);
const itemTimeoutMs = Number(
  process.env.OPENCODE_LOOP_ITEM_TIMEOUT_MS ?? 1200000
);
let stopping = false;
let currentChild = null;
let currentRun = null;
let startedAt = new Date().toISOString();
let childAbortReason = null;
function buildChildEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('OPENCODE')) {
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

function extractSessionId(stdout) {
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.sessionID) return parsed.sessionID;
      const nested = parsed?.part?.sessionID;
      if (nested) return nested;
    } catch {
      // ignore non-JSON or partial lines
    }
  }
  return null;
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

function extractFailureMarkers(output) {
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
  void beforeSnapshot;
  void afterSnapshot;
  return (
    result.exitCode === 0 &&
    !result.reportedError &&
    !stopping &&
    finalizerUsed &&
    !queueResult?.status &&
    failureMarkers.length === 0
  );
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
  const line = `${now} pid=${process.pid} wave=${summary.activeWave ?? 'none'} pending=${summary.pendingCount} total=${summary.totalCount}\n`;
  await appendFile(logFile, line);
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

function buildExecutionPrompt(item, queueFileName) {
  const validation =
    Array.isArray(item?.verification?.commands) &&
    item.verification.commands.length > 0
      ? item.verification.commands[0]
      : 'none';
  const deps =
    Array.isArray(item?.dependsOn) && item.dependsOn.length > 0
      ? item.dependsOn.join(', ')
      : 'none';

  return [
    `You are executing queue item ${item.id} from ${queueFileName}.`,
    `Upstream dependencies that must already be satisfied: ${deps}.`,
    '',
    item.promptText,
    '',
    'Operational rules for this queue executor:',
    '- Make the smallest correct change.',
    '- Run exactly the focused validation command named in the queue item.',
    '- If validation passes, commit the change on the current branch and do not push.',
    '- If validation fails or you cannot complete the item, stop and report the blocker clearly.',
    '- End with exactly one machine-readable line in this format:',
    `QUEUE_RESULT status=<completed|needs_replan> item=${item.id} validation=${validation} changed_files=<comma-separated-or-none> commit=<hash-or-none>`
  ].join('\n');
}

function buildContinuationPrompt(item, queueFileName) {
  const validation =
    Array.isArray(item?.verification?.commands) &&
    item.verification.commands.length > 0
      ? item.verification.commands[0]
      : 'none';
  return [
    `Continue the current queue session with item ${item.id} from ${queueFileName}.`,
    item.promptText,
    `Validation: ${validation}`,
    `Return exactly one machine-readable line: QUEUE_RESULT status=<completed|needs_replan> item=${item.id} validation=${validation} changed_files=<comma-separated-or-none> commit=<hash-or-none>`
  ].join('\n');
}

function buildFinalizerPrompt(item, queueFileName) {
  const validation =
    Array.isArray(item?.verification?.commands) &&
    item.verification.commands.length > 0
      ? item.verification.commands[0]
      : 'none';
  return [
    `Finalize queue item ${item.id} from ${queueFileName}.`,
    'The main execution already finished, but the machine-readable queue result line was missing.',
    'Do not make additional code changes, do not create another commit, and do not rerun validation unless the prior run clearly failed.',
    'Inspect the current repository state and the just-finished session state, then return exactly one machine-readable line and nothing after it.',
    `QUEUE_RESULT status=<completed|needs_replan> item=${item.id} validation=${validation} changed_files=<comma-separated-or-none> commit=<hash-or-none>`
  ].join('\n');
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

async function runOpencodePrompt(
  prompt,
  title,
  sessionId,
  timeoutMs = itemTimeoutMs
) {
  const args = sessionId
    ? [
        'run',
        '--continue',
        '--session',
        sessionId,
        '--agent',
        'build',
        '--model',
        'openai/gpt-5.3-codex',
        '--format',
        'json',
        '--title',
        title,
        prompt
      ]
    : [
        'run',
        '--agent',
        'build',
        '--model',
        'openai/gpt-5.3-codex',
        '--format',
        'json',
        '--title',
        title,
        prompt
      ];

  return await new Promise((resolve) => {
    const child = spawn('opencode', args, {
      cwd: repoRoot,
      env: buildChildEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    currentChild = child;
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeoutHandle =
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            try {
              child.kill('SIGTERM');
            } catch {
              // ignore
            }
            setTimeout(() => {
              if (!child.killed) {
                try {
                  child.kill('SIGKILL');
                } catch {
                  // ignore
                }
              }
            }, 5000).unref();
          }, timeoutMs)
        : null;

    timeoutHandle?.unref();

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
    });

    child.on('close', (exitCode, signal) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      currentChild = null;
      resolve({
        exitCode: exitCode ?? 1,
        signal,
        stdout,
        stderr,
        sessionId: extractSessionId(stdout),
        reportedError: extractReportedError(stdout),
        timedOut
      });
    });

    child.on('error', (error) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      currentChild = null;
      resolve({
        exitCode: 1,
        signal: null,
        stdout,
        stderr: `${stderr}${stderr ? '\n' : ''}${error.message}\n`,
        sessionId: extractSessionId(stdout),
        reportedError: extractReportedError(stdout),
        timedOut
      });
    });
  });
}

async function runOpencode(queue, item, queueFileName, sessionId) {
  const prompt = sessionId
    ? buildContinuationPrompt(item, queueFileName)
    : buildExecutionPrompt(item, queueFileName);
  return await runOpencodePrompt(
    prompt,
    buildSessionTitle(queue, item),
    sessionId,
    itemTimeoutMs
  );
}

async function runQueueFinalizer(queue, item, queueFileName, sessionId) {
  return await runOpencodePrompt(
    buildFinalizerPrompt(item, queueFileName),
    `${buildSessionTitle(queue, item)} finalize`,
    sessionId,
    Math.min(itemTimeoutMs, 180000)
  );
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
  const loaded = await loadLatestQueue(loopDir);
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
  const item = nextRunnableItem(queue);
  const state = await readState();
  const reusableSessionId =
    state?.activeSessionId &&
    state?.pendingCount > 0 &&
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
    startedBy: 'opencode-loop-runner'
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

  const beforeSnapshot = await gitSnapshot();
  let result = await runOpencode(
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

  const latestLoaded = await loadLatestQueue(loopDir);
  const latestItem =
    latestLoaded?.queue?.items?.find((entry) => entry?.id === item.id) ?? null;
  if (
    childAbortReason === 'execution_superseded' ||
    wasExecutionSuperseded(latestItem, {
      attempt: attemptNumber,
      startedAt: now
    })
  ) {
    await appendFile(
      logFile,
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
  const failureMarkers = extractFailureMarkers(
    `${result.stdout}\n${result.stderr}`
  );
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
      ? `opencode_timeout_${itemTimeoutMs}`
      : result.reportedError
        ? 'opencode_reported_error'
        : queueResult?.status === 'needs_replan'
          ? 'queue_result_needs_replan'
          : !queueResult?.status
            ? commitFallback || noopFallback
              ? undefined
              : 'missing_queue_result'
            : (failureMarkers[0] ?? `opencode_exit_${result.exitCode}`);

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
      reportedError: success ? undefined : (result.reportedError ?? undefined),
      queueResultStatus:
        queueResult?.status ??
        (commitFallback || noopFallback ? 'completed' : undefined),
      queueResultCommit:
        queueResult?.commit ??
        (commitFallback ? (afterSnapshot?.head ?? undefined) : undefined),
      queueFailureMarkers:
        !success && failureMarkers.length > 0
          ? failureMarkers.join(',')
          : undefined,
      timedOutAt: result.timedOut ? finishedAt : undefined,
      sessionId
    })
  );

  await appendFile(
    logFile,
    `${finishedAt} item=${item.id} status=${status} exit=${result.exitCode}${result.timedOut ? ` timeout_ms=${itemTimeoutMs}` : ''}${queueResult?.status ? ` queue_result=${queueResult.status}` : ''}${finalizerUsed ? ' finalized_queue_result=true' : ''}${commitFallback ? ' queue_result=completed_via_commit_fallback' : ''}${noopFallback ? ' queue_result=completed_via_noop_fallback' : ''}${failureMarkers.length > 0 ? ` failure_markers=${failureMarkers.join(',')}` : ''}\n`
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
    currentItemTimedOut: result.timedOut ? true : null
  };

  await heartbeat();

  const loopDecision = nextRunnerIteration({
    itemProcessed: true,
    itemStatus: status,
    stopRequested: stopping
  });

  return loopDecision.progressed;
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

await heartbeat();

while (!stopping) {
  const progressed = await processOneItem();
  if (stopping) break;
  if (!progressed) {
    if (shouldStopAfterNoProgress(currentRun?.phase ?? null)) {
      stopping = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

await heartbeat();
