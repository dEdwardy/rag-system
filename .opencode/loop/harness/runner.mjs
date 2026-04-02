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

function buildSessionTitle(queue, item) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const totalCount = items.length;
  const completedCount = items.filter((entry) => entry?.status === 'completed').length;
  const currentIndex = Math.min(completedCount + 1, totalCount || 1);
  const remainingAfterCurrent = items.filter((entry) => entry && entry.id !== item.id && entry.status !== 'completed').length;

  return `[${currentIndex}/${totalCount} | left ${remainingAfterCurrent}] ${item.id}`;
}

async function runOpencode(queue, item, queueFileName) {
  const prompt = buildExecutionPrompt(item, queueFileName);
  const title = buildSessionTitle(queue, item);
  const args = ['run', '--agent', item.agent ?? 'rag-build', '--model', 'openai/gpt-5.3-codex', '--title', title, prompt];

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

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
    });

    child.on('close', (exitCode, signal) => {
      currentChild = null;
      resolve({ exitCode: exitCode ?? 1, signal, stdout, stderr });
    });

    child.on('error', (error) => {
      currentChild = null;
      resolve({ exitCode: 1, signal: null, stdout, stderr: `${stderr}${stderr ? '\n' : ''}${error.message}\n` });
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
  };
  await heartbeat();

  const result = await runOpencode(queue, item, path.basename(loaded.filePath));
  const finishedAt = new Date().toISOString();
  const success = result.exitCode === 0 && !stopping;
  const status = success ? 'completed' : 'needs_replan';

  await updateQueueItem(loaded, item.id, cleanObject({
    status,
    updatedAt: finishedAt,
    completedAt: success ? finishedAt : undefined,
    finishedAt,
    resultExitCode: result.exitCode,
    resultSignal: result.signal ?? undefined,
    lastRunSummary: result.stdout.trim().split('\n').slice(-8).join('\n') || result.stderr.trim().split('\n').slice(-8).join('\n') || undefined,
    failureReason: success ? undefined : `opencode_exit_${result.exitCode}`,
  }));

  await appendFile(logFile, `${finishedAt} item=${item.id} status=${status} exit=${result.exitCode}\n`);

  currentRun = {
    phase: status,
    currentItemId: item.id,
    currentItemTitle: item.title,
    currentItemStatus: status,
    lastResult: status,
    lastExitCode: result.exitCode,
    lastCompletedAt: success ? finishedAt : null,
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
