#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { loadLatestQueue, queueSummary } from './queue-utils.mjs';
import { formatStatusLine } from './status-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(loopDir, '..', '..');
const runtimeDir = path.join(loopDir, 'runtime');
const stateFile = path.join(runtimeDir, 'loop-state.json');
const logFile = path.join(loopDir, 'loop-run.log');
const runnerFile = path.join(__dirname, 'runner.mjs');
const command = process.argv[2] ?? 'help';

await mkdir(runtimeDir, { recursive: true });

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForPidExit(pid, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!pidAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return !pidAlive(pid);
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function safeReadState() {
  try {
    if (!existsSync(stateFile)) return null;
    return await readJson(stateFile);
  } catch {
    return null;
  }
}

async function latestWaveSummary() {
  const loaded = await loadLatestQueue(loopDir);
  if (!loaded) {
    return {
      activeWave: null,
      fileName: null,
      pendingCount: 0,
      inProgressCount: 0,
      completedCount: 0,
      blockedCount: 0,
      totalCount: 0
    };
  }

  const summary = queueSummary(loaded.queue);
  return {
    ...summary,
    fileName: path.basename(loaded.filePath)
  };
}

async function writeState(extra, baseState = null) {
  const summary = await latestWaveSummary();
  const now = new Date().toISOString();
  const mergedBase = baseState ?? {};
  const state = {
    version: 1,
    repoRoot,
    ...mergedBase,
    ...summary,
    pid: extra.pid ?? mergedBase.pid ?? process.pid,
    status: extra.status ?? mergedBase.status ?? 'running',
    startedAt: extra.startedAt ?? mergedBase.startedAt ?? now,
    updatedAt: now,
    heartbeatAt: extra.heartbeatAt ?? mergedBase.heartbeatAt ?? now,
    ...extra
  };
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

async function printStatus() {
  const state = await safeReadState();
  const summary = await latestWaveSummary();
  console.log(
    formatStatusLine({
      state,
      summary,
      repoRoot,
      logFile,
      pidAlive,
      relativePath: path.relative(repoRoot, logFile)
    })
  );
}

async function start() {
  const state = await safeReadState();
  if (state && pidAlive(state.pid)) {
    console.log(`already running pid=${state.pid}`);
    await printStatus();
    return;
  }

  const child = spawn(process.execPath, [runnerFile], {
    cwd: repoRoot,
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();

  await writeState(
    {
      pid: child.pid,
      status: 'starting',
      phase: 'starting',
      currentItemId: null,
      currentItemTitle: null,
      currentItemStatus: null,
      blockedOn: null,
      activeSessionId: null
    },
    state
  );
  console.log(`started pid=${child.pid}`);
  await printStatus();
}

async function stop() {
  const state = await safeReadState();
  if (!state || !pidAlive(state.pid)) {
    console.log('not running');
    return;
  }

  try {
    process.kill(state.pid, 'SIGTERM');
  } catch {
    // Ignore and fall through to stale cleanup.
  }

  await writeState(
    { status: 'stopping', stoppedAt: new Date().toISOString() },
    state
  );
  const exited = await waitForPidExit(state.pid);
  console.log(
    exited
      ? `stopped pid=${state.pid}`
      : `stopping pid=${state.pid} timed_out_wait=true`
  );
}

function help() {
  console.log('usage: pnpm loop:start|stop|status');
}

if (command === 'start') {
  await start();
} else if (command === 'stop') {
  await stop();
} else if (command === 'status') {
  await printStatus();
} else {
  help();
}
