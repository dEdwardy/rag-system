#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { loadLatestQueue, queueSummary } from './queue-utils.mjs';

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

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function safeReadState() {
  try {
    return await readJson(stateFile);
  } catch {
    return null;
  }
}

async function latestWaveSummary() {
  const loaded = await loadLatestQueue(loopDir);
  if (!loaded) return { activeWave: null, fileName: null, pendingCount: 0, inProgressCount: 0, completedCount: 0, blockedCount: 0, totalCount: 0 };

  const summary = queueSummary(loaded.queue);
  return {
    ...summary,
    fileName: path.basename(loaded.filePath),
  };
}

async function writeState(extra) {
  const summary = await latestWaveSummary();
  const state = {
    version: 1,
    repoRoot,
    pid: process.pid,
    status: 'running',
    startedAt: extra.startedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
    ...summary,
    ...extra,
  };
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

async function printStatus() {
  const state = await safeReadState();
  const summary = await latestWaveSummary();
  if (state && pidAlive(state.pid)) {
    const itemPart = state.currentItemId ? ` item=${state.currentItemId}` : '';
    console.log(`running pid=${state.pid} wave=${state.activeWave ?? summary.activeWave ?? 'none'} pending=${state.pendingCount ?? summary.pendingCount}${itemPart} log=${path.relative(repoRoot, logFile)}`);
    return;
  }
  if (state && state.pid && !pidAlive(state.pid)) {
    console.log(`stale state pid=${state.pid} wave=${summary.activeWave ?? 'none'} pending=${summary.pendingCount}`);
    return;
  }
  console.log(`stopped wave=${summary.activeWave ?? 'none'} pending=${summary.pendingCount}`);
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
    windowsHide: true,
  });
  child.unref();

  await writeState({ pid: child.pid, status: 'starting' });
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

  await writeState({ status: 'stopping', stoppedAt: new Date().toISOString() });
  console.log(`stopping pid=${state.pid}`);
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
