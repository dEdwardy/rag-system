import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

export const LOOP_SCHEMA_VERSION = 1;
export const DEFAULT_QUEUE_ITEM = {
  id: "build-001",
  title: "Run rag-build on default prompt",
  agent: "rag-build",
  promptFile: "prompts/build.md",
  status: "pending"
};

export function readQueue(queuePath) {
  const queueRaw = readFileSync(queuePath, "utf8");
  const queue = JSON.parse(queueRaw);

  if (!queue || typeof queue !== "object" || Array.isArray(queue)) {
    throw new Error(`Invalid queue payload in ${queuePath}.`);
  }

  if (queue.version !== LOOP_SCHEMA_VERSION || !Array.isArray(queue.items)) {
    throw new Error(`Unsupported queue format in ${queuePath}.`);
  }

  return queue;
}

export function writeQueue(queuePath, queue) {
  const tempPath = `${queuePath}.${process.pid}.${randomUUID()}.tmp`;

  try {
    writeFileSync(tempPath, `${JSON.stringify(decorateQueueForWrite(queue), null, 2)}\n`, "utf8");
    renameSync(tempPath, queuePath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

export function pickNextItem(queue) {
  const recoveryIndex = findItemIndexByStatus(queue.items, "in_progress");
  if (recoveryIndex !== -1) {
    return { index: recoveryIndex, item: queue.items[recoveryIndex] };
  }

  const startIndex = Number.isInteger(queue.cursor) && queue.cursor >= 0 ? queue.cursor : 0;
  const forwardIndex = findPendingIndex(queue.items, startIndex);
  const fallbackIndex = forwardIndex === -1 ? findPendingIndex(queue.items, 0) : -1;
  const index = forwardIndex !== -1 ? forwardIndex : fallbackIndex;

  if (index === -1) {
    return null;
  }

  return { index, item: queue.items[index] };
}

export function updateQueueItem(queue, index, updater) {
  const updatedItems = queue.items.map((queueItem, queueIndex) => {
    if (queueIndex !== index) {
      return queueItem;
    }

    return updater(queueItem);
  });

  return {
    ...queue,
    items: updatedItems,
    updatedAt: new Date().toISOString()
  };
}

export function completeQueueItem({ queue, index, sessionId, messageId, handoffPath, completedAt }) {
  const updatedItems = queue.items.map((queueItem, queueIndex) => {
    if (queueIndex !== index) {
      return queueItem;
    }

    return {
      ...queueItem,
      status: "completed",
      sessionId,
      messageId,
      handoffPath,
      completedAt
    };
  });

  return {
    ...queue,
    items: updatedItems,
    cursor: computeNextCursor(updatedItems, index + 1),
    updatedAt: completedAt
  };
}

function computeNextCursor(items, start) {
  const nextIndex = findPendingIndex(items, start);
  if (nextIndex !== -1) {
    return nextIndex;
  }

  const wrappedIndex = findPendingIndex(items, 0);
  if (wrappedIndex !== -1) {
    return wrappedIndex;
  }

  return items.length;
}

function findPendingIndex(items, start) {
  for (let index = start; index < items.length; index += 1) {
    if (items[index]?.status === "pending") {
      return index;
    }
  }

  return -1;
}

function findItemIndexByStatus(items, status) {
  for (let index = 0; index < items.length; index += 1) {
    if (items[index]?.status === status) {
      return index;
    }
  }

  return -1;
}

function decorateQueueForWrite(queue) {
  const items = Array.isArray(queue.items) ? queue.items.map(decorateQueueItemForWrite) : queue.items;

  return decorateTimestampFields(
    {
      ...queue,
      items
    },
    ["createdAt", "updatedAt"]
  );
}

function decorateQueueItemForWrite(item) {
  return decorateTimestampFields(item, [
    "startedAt",
    "resumedAt",
    "messageReceivedAt",
    "completedAt"
  ]);
}

function decorateTimestampFields(record, keys) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return record;
  }

  const nextRecord = { ...record };

  for (const key of keys) {
    const displayKey = `${key}Display`;
    const value = nextRecord[key];

    if (typeof value === "string" && value.trim()) {
      nextRecord[displayKey] = formatDisplayTime(value);
      continue;
    }

    delete nextRecord[displayKey];
  }

  return nextRecord;
}

function formatDisplayTime(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "invalid-date";
  }

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export { formatDisplayTime };
