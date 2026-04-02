#!/usr/bin/env node
import { mkdir, appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import {
  loadLatestQueue,
  nextRunnableItem,
  firstBlockedPendingItem,
  queueSummary,
  writeJson,
} from './queue-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(loopDir, '..', '..');
const runtimeDir = path.join(loopDir, 'runtime');
const stateFile = path.join(runtimeDir, 'loop-state.json');
const logFile = path.join(loopDir, 'loop-run.log');
const intervalMs = Number(process.env.OPENCODE_LOOP_INTERVAL_MS ?? 5000);
const itemTimeoutMs = Number(process.env.OPENCODE_LOOP_ITEM_TIMEOUT_MS ?? 1200000);
let stopping = false;
let currentChild = null;
let currentRun = null;
let startedAt = new Date().toISOString();
const heartbeatTimer = setInterval(() => {
  heartbeat().catch((error) => {
    appendFile(logFile, `${new Date().toISOString()} heartbeat_error=${error.message}\n`).catch(() => {});
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
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ''));
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

async function heartbeat() {
  const loaded = await loadLatestQueue(loopDir);
  const summary = loaded ? { ...queueSummary(loaded.queue), fileName: path.basename(loaded.filePath) } : { activeWave: null, fileName: null, pendingCount: 0, inProgressCount: 0, completedCount: 0, blockedCount: 0, totalCount: 0 };
  const now = new Date().toISOString();
  const line = `${now} pid=${process.pid} wave=${summary.activeWave ?? 'none'} pending=${summary.pendingCount} total=${summary.totalCount}\n`;
  await appendFile(logFile, line);
  const state = cleanObject({
    version: 1,
    pid: process.pid,
    status: stopping ? 'stopping' : currentRun?.phase ?? 'running',
    startedAt,
    updatedAt: now,
    heartbeatAt: now,
    ...summary,
    ...currentRun,
  });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

function buildExecutionPrompt(item, queueFileName) {
  const validation = Array.isArray(item?.verification?.commands) && item.verification.commands.length > 0 ? item.verification.commands[0] : 'none';
  const deps = Array.isArray(item?.dependsOn) && item.dependsOn.length > 0 ? item.dependsOn.join(', ') : 'none';

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
    `QUEUE_RESULT status=<completed|needs_replan> item=${item.id} validation=${validation} changed_files=<comma-separated-or-none> commit=<hash-or-none>`,
  ].join('\n');
}

function buildContinuationPrompt(item, queueFileName) {
  const validation = Array.isArray(item?.verification?.commands) && item.verification.commands.length > 0 ? item.verification.commands[0] : 'none';
  return [
    `Continue the current queue session with item ${item.id} from ${queueFileName}.`,
    item.promptText,
    `Validation: ${validation}`,
    `Return exactly one machine-readable line: QUEUE_RESULT status=<completed|needs_replan> item=${item.id} validation=${validation} changed_files=<comma-separated-or-none> commit=<hash-or-none>`,
  ].join('\n');
}

function buildSessionTitle(queue, item) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const activeItems = items.filter((entry) => entry && entry.status !== 'completed');
  const totalCount = activeItems.length;
  const currentIndex = Math.max(1, activeItems.findIndex((entry) => entry.id === item.id) + 1);
  const remainingAfterCurrent = Math.max(0, totalCount - currentIndex);

  return `[${currentIndex}/${totalCount} | left ${remainingAfterCurrent}] ${item.id}`;
}

async function runOpencode(queue, item, queueFileName, sessionId) {
  const prompt = sessionId ? buildContinuationPrompt(item, queueFileName) : buildExecutionPrompt(item, queueFileName);
  const title = buildSessionTitle(queue, item);
  const args = sessionId
    ? ['run', '--continue', '--session', sessionId, '--agent', 'build', '--model', 'openai/gpt-5.3-codex', '--format', 'json', '--title', title, prompt]
    : ['run', '--agent', 'build', '--model', 'openai/gpt-5.3-codex', '--format', 'json', '--title', title, prompt];

  return await new Promise((resolve) => {
    const child = spawn('opencode', args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    currentChild = child;
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeoutHandle = Number.isFinite(itemTimeoutMs) && itemTimeoutMs > 0
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
        }, itemTimeoutMs)
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
      resolve({ exitCode: exitCode ?? 1, signal, stdout, stderr, sessionId: extractSessionId(stdout), reportedError: extractReportedError(stdout), timedOut });
    });

    child.on('error', (error) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      currentChild = null;
      resolve({ exitCode: 1, signal: null, stdout, stderr: `${stderr}${stderr ? '\n' : ''}${error.message}\n`, sessionId: extractSessionId(stdout), reportedError: extractReportedError(stdout), timedOut });
    });
  });
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
    currentRun = { phase: 'idle', currentItemId: null, currentItemTitle: null, currentItemStatus: null };
    await heartbeat();
    return false;
  }

  const queue = loaded.queue;
  const item = nextRunnableItem(queue);
  const state = await readState();
  const reusableSessionId = state?.activeSessionId && state?.pendingCount > 0 && state?.currentWaveId === (queue.materializedWaveId ?? path.basename(loaded.filePath, '.queue.json')) ? state.activeSessionId : null;

  if (!item) {
    const blocked = firstBlockedPendingItem(queue);
    currentRun = {
      phase: blocked ? 'blocked' : 'idle',
      currentItemId: blocked?.id ?? null,
      currentItemTitle: blocked?.title ?? null,
      currentItemStatus: blocked?.status ?? null,
      blockedOn: blocked ? (Array.isArray(blocked.dependsOn) ? blocked.dependsOn : []).join(', ') || null : null,
    };
    await heartbeat();
    return false;
  }

  const now = new Date().toISOString();
  await updateQueueItem(loaded, item.id, {
    status: 'in_progress',
    attempt: Number(item.attempt ?? 0) + 1,
    startedAt: now,
    updatedAt: now,
    startedBy: 'opencode-loop-runner',
  });

  currentRun = {
    phase: 'executing',
    currentItemId: item.id,
    currentItemTitle: item.title,
    currentItemStatus: 'in_progress',
    currentWaveId: queue.materializedWaveId ?? path.basename(loaded.filePath, '.queue.json'),
    currentWaveFile: path.basename(loaded.filePath),
    currentAttempt: Number(item.attempt ?? 0) + 1,
    activeSessionId: reusableSessionId,
  };
  await heartbeat();

  const result = await runOpencode(queue, item, path.basename(loaded.filePath), reusableSessionId);
  const finishedAt = new Date().toISOString();
  const success = result.exitCode === 0 && !result.reportedError && !stopping;
  const status = success ? 'completed' : 'needs_replan';
  const sessionId = result.sessionId ?? reusableSessionId ?? null;

  await updateQueueItem(loaded, item.id, cleanObject({
    status,
    updatedAt: finishedAt,
    completedAt: success ? finishedAt : undefined,
    finishedAt,
    resultExitCode: result.exitCode,
    resultSignal: result.signal ?? undefined,
    lastRunSummary: result.stdout.trim().split('\n').slice(-8).join('\n') || result.stderr.trim().split('\n').slice(-8).join('\n') || undefined,
    failureReason: success ? undefined : result.timedOut ? `opencode_timeout_${itemTimeoutMs}` : result.reportedError ? 'opencode_reported_error' : `opencode_exit_${result.exitCode}`,
    reportedError: success ? undefined : result.reportedError ?? undefined,
    timedOutAt: result.timedOut ? finishedAt : undefined,
    sessionId,
  }));

  await appendFile(logFile, `${finishedAt} item=${item.id} status=${status} exit=${result.exitCode}${result.timedOut ? ` timeout_ms=${itemTimeoutMs}` : ''}\n`);

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
  };

  await heartbeat();

  if (!success) {
    stopping = true;
  }

  return success;
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
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

await heartbeat();
