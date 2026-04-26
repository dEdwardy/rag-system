import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SUMMARY_MAX_LENGTH = 1200;
const DEFAULT_ERROR_MAX_LENGTH = 400;

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
    try {
      // Keep latest-queue selection tied to file activity rather than queue birth time.
      const fileStat = await stat(filePath);
      waveFiles.push({ filePath, ts: fileStat.mtimeMs });
    } catch {
      // skip corrupted or unreadable files
    }
  }

  waveFiles.sort((a, b) => b.ts - a.ts);
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

function truncateText(value, maxLength) {
  if (value.length <= maxLength) return value;
  const suffix = `... [truncated ${value.length - maxLength} chars]`;
  const sliceLength = Math.max(0, maxLength - suffix.length);
  return `${value.slice(0, sliceLength)}${suffix}`;
}

export function sanitizeQueueText(
  value,
  maxLength = DEFAULT_SUMMARY_MAX_LENGTH
) {
  if (typeof value !== 'string') return undefined;

  const normalized = value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\uFFFD+/g, '')
    .trim();

  if (!normalized) return undefined;
  return truncateText(normalized, maxLength);
}

function extractQueueResultLine(text) {
  if (typeof text !== 'string' || !text.includes('QUEUE_RESULT ')) {
    return null;
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].startsWith('QUEUE_RESULT ')) {
      return lines[index];
    }
  }

  return null;
}

export function summarizeExecutionOutput(stdout, stderr) {
  const queueResultLine = extractQueueResultLine(stdout);
  if (queueResultLine) {
    return sanitizeQueueText(queueResultLine, DEFAULT_ERROR_MAX_LENGTH);
  }

  const tail =
    stdout.trim().split('\n').slice(-8).join('\n') ||
    stderr.trim().split('\n').slice(-8).join('\n') ||
    undefined;

  return sanitizeQueueText(tail, DEFAULT_SUMMARY_MAX_LENGTH);
}

function extractQueueResultFromSummary(summary) {
  if (typeof summary !== 'string' || !summary.includes('QUEUE_RESULT ')) {
    return null;
  }

  const match = summary.match(
    /QUEUE_RESULT\s+status=(completed|needs_replan)\b[^\r\n]*/
  );
  if (!match) return null;

  const result = { status: match[1] };
  for (const tokenMatch of match[0].matchAll(
    /(status|item|validation|changed_files|commit)=([^\s"\\]+)/g
  )) {
    result[tokenMatch[1]] = tokenMatch[2];
  }
  return result;
}

export function shouldTreatItemAsCompleted(item) {
  if (!item) return false;
  if (item.status === 'completed') return true;
  if (item.status !== 'needs_replan') return false;

  const summaryQueueResult = extractQueueResultFromSummary(item.lastRunSummary);

  if (summaryQueueResult?.status === 'completed') {
    return true;
  }

  if (item.queueResultStatus === 'completed') {
    return true;
  }

  if (
    item.failureReason === 'missing_queue_result' &&
    typeof item.queueResultCommit === 'string' &&
    item.queueResultCommit.length > 0
  ) {
    return true;
  }

  return (
    item.failureReason === 'missing_queue_result' &&
    item.resultExitCode === 0 &&
    !item.reportedError &&
    !item.queueFailureMarkers
  );
}

export function reconcileQueue(queue) {
  const items = queueItems(queue);
  let changed = false;
  for (const item of items) {
    if (shouldTreatItemAsCompleted(item)) {
      const summaryQueueResult = extractQueueResultFromSummary(
        item.lastRunSummary
      );
      item.status = 'completed';
      item.completedAt =
        item.completedAt ?? item.finishedAt ?? item.updatedAt ?? null;
      item.queueResultStatus =
        item.queueResultStatus ?? summaryQueueResult?.status ?? 'completed';
      item.queueResultCommit =
        item.queueResultCommit ??
        (summaryQueueResult?.commit && summaryQueueResult.commit !== 'none'
          ? summaryQueueResult.commit
          : undefined);
      changed = true;
    }
  }
  return changed;
}

export function queueItemById(queue, id) {
  return queueItems(queue).find((item) => item && item.id === id) ?? null;
}

export function completedItemIds(queue) {
  return new Set(
    queueItems(queue)
      .filter((item) => shouldTreatItemAsCompleted(item))
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
