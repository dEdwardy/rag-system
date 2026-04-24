import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function findLatestQueueFile(loopDir) {
  const materializedDir = path.join(loopDir, 'materialized');
  let entries = [];

  try {
    entries = await readdir(materializedDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const waveFiles = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.queue.json')) continue;
    const filePath = path.join(materializedDir, entry.name);
    const fileStat = await stat(filePath);
    waveFiles.push({ filePath, mtimeMs: fileStat.mtimeMs });
  }

  waveFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return waveFiles[0]?.filePath ?? null;
}

export async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function loadLatestQueue(loopDir) {
  const filePath = await findLatestQueueFile(loopDir);
  if (!filePath) return null;
  return { filePath, queue: await readJson(filePath) };
}

export async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function queueItems(queue) {
  return Array.isArray(queue?.items) ? queue.items : [];
}

export function queueItemById(queue, id) {
  return queueItems(queue).find((item) => item && item.id === id) ?? null;
}

export function completedItemIds(queue) {
  return new Set(
    queueItems(queue)
      .filter((item) => item && item.status === 'completed')
      .map((item) => item.id)
  );
}

export function dependenciesSatisfied(queue, item) {
  const deps = Array.isArray(item?.dependsOn) ? item.dependsOn : [];
  if (deps.length === 0) return true;

  const completedIds = completedItemIds(queue);
  return deps.every((dep) => completedIds.has(dep));
}

export function nextRunnableItem(queue) {
  const items = queueItems(queue);
  const inProgress = items.find(
    (item) => item && item.status === 'in_progress'
  );
  if (inProgress) return inProgress;

  return (
    items.find(
      (item) =>
        item && item.status === 'pending' && dependenciesSatisfied(queue, item)
    ) ?? null
  );
}

export function firstBlockedPendingItem(queue) {
  return (
    queueItems(queue).find(
      (item) =>
        item && item.status === 'pending' && !dependenciesSatisfied(queue, item)
    ) ?? null
  );
}

export function queueSummary(queue) {
  const items = queueItems(queue);
  const counts = items.reduce(
    (acc, item) => {
      const status = item?.status ?? 'unknown';
      acc.total += 1;
      acc.byStatus[status] = (acc.byStatus[status] ?? 0) + 1;
      return acc;
    },
    { total: 0, byStatus: {} }
  );

  const pendingCount = counts.byStatus.pending ?? 0;
  const inProgressCount = counts.byStatus.in_progress ?? 0;
  const completedCount = counts.byStatus.completed ?? 0;
  const blockedCount = items.filter(
    (item) =>
      item && item.status === 'pending' && !dependenciesSatisfied(queue, item)
  ).length;

  return {
    activeWave: queue.materializedWaveId ?? null,
    pendingCount,
    inProgressCount,
    completedCount,
    blockedCount,
    totalCount: counts.total
  };
}
