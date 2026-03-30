import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import {
  QUEUE_STATUS,
  SUSPENDED_QUEUE_STATUSES,
  assertQueueStatusTransition,
  normalizeVerificationVerdictStatus
} from "./state-machine.mjs";

export const LOOP_SCHEMA_VERSION = 1;
export const DEFAULT_QUEUE_ITEM = {
  id: "build-001",
  version: 2,
  kind: "build_increment",
  title: "Run rag-build on default prompt",
  goal: "Implement the next smallest repository increment.",
  agent: "rag-build",
  promptFile: "prompts/build.md",
  status: "pending",
  verification: {
    mode: "assistant_only"
  },
  retryPolicy: {
    maxAttempts: 1,
    onVerificationFail: "needs_replan"
  },
  attempt: 0
};

const RECOVERABLE_QUEUE_STATUSES = new Set(["deferred"]);
const REVIEW_QUEUE_STATUSES = SUSPENDED_QUEUE_STATUSES;
const TERMINAL_SUCCESS_QUEUE_STATUSES = new Set(["completed", "succeeded"]);
const RECOVERABLE_QUEUE_ITEM_FIELDS = ["startedAt", "sessionId", "messageId", "messageReceivedAt", "resumedAt", "runId"];

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

export function pickNextItem(queue, shouldRunItem = () => true) {
  return pickNextItemWithPredicate(queue, shouldRunItem);
}

export function pickNextItemWithPredicate(queue, shouldRunItem) {
  const recoveryIndex = findItemIndexByStatus(queue.items, "in_progress");
  if (recoveryIndex !== -1) {
    return { index: recoveryIndex, item: queue.items[recoveryIndex] };
  }

  const cursorResolution = resolveQueueCursor(queue);
  const startIndex = cursorResolution.cursor;
  const forwardIndex = findPendingIndex(queue.items, startIndex, shouldRunItem);
  const fallbackIndex = forwardIndex === -1 ? findPendingIndex(queue.items, 0, shouldRunItem) : -1;
  const index = forwardIndex !== -1 ? forwardIndex : fallbackIndex;

  if (index === -1) {
    return null;
  }

  return { index, item: queue.items[index] };
}

export function resolveQueueCursor(queue) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const firstPendingIndex = findPendingIndex(items, 0);
  const safePendingCursor = firstPendingIndex !== -1 ? firstPendingIndex : items.length;
  const rawCursor = queue?.cursor;

  if (!Number.isInteger(rawCursor)) {
    return {
      cursor: safePendingCursor,
      recovered: true,
      from: describeCursorValue(rawCursor),
      reason: "non_integer"
    };
  }

  if (rawCursor < 0) {
    return {
      cursor: safePendingCursor,
      recovered: true,
      from: rawCursor,
      reason: "negative"
    };
  }

  if (rawCursor > items.length) {
    return {
      cursor: safePendingCursor,
      recovered: true,
      from: rawCursor,
      reason: "out_of_range"
    };
  }

  if (rawCursor === items.length && firstPendingIndex !== -1) {
    return {
      cursor: safePendingCursor,
      recovered: true,
      from: rawCursor,
      reason: "past_pending"
    };
  }

  return {
    cursor: rawCursor,
    recovered: false,
    from: null,
    reason: null
  };
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

export function normalizeQueueItemV2(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return item;
  }

  const normalized = {
    ...item,
    version: Number.isInteger(item.version) && item.version >= 2 ? item.version : 2,
    kind: typeof item.kind === "string" && item.kind.trim() ? item.kind.trim() : "build_increment",
    goal:
      typeof item.goal === "string" && item.goal.trim()
        ? item.goal.trim()
        : typeof item.title === "string" && item.title.trim()
          ? item.title.trim()
          : "Implement the queued repository increment.",
    acceptance: normalizeStructuredField(item.acceptance),
    constraints: normalizeStructuredField(item.constraints),
    verification: normalizeVerificationConfig(item.verification),
    retryPolicy: normalizeRetryPolicy(item.retryPolicy),
    attempt: Number.isInteger(item.attempt) && item.attempt >= 0 ? item.attempt : 0
  };

  return normalized;
}

export function normalizeQueueV2(queue, updatedAt = new Date().toISOString()) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  let changed = false;

  const normalizedItems = items.map(item => {
    const normalizedItem = normalizeQueueItemV2(item);
    if (queueItemNeedsV2Normalization(item)) {
      changed = true;
    }
    return normalizedItem;
  });

  if (!changed) {
    return { queue, normalizedCount: 0 };
  }

  return {
    queue: {
      ...queue,
      items: normalizedItems,
      updatedAt
    },
    normalizedCount: normalizedItems.length
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

export function markQueueItemVerifying({ queue, index, verificationStartedAt = new Date().toISOString() }) {
  return updateQueueItem(queue, index, queueItem => ({
    ...assertStatusChange(queueItem, QUEUE_STATUS.verifying, "mark-verifying"),
    ...queueItem,
    status: QUEUE_STATUS.verifying,
    verificationStartedAt
  }));
}

export function finalizeQueueItemVerification({
  queue,
  index,
  verdict,
  verificationArtifactPath,
  verificationSummary,
  verificationResult,
  verifiedAt = new Date().toISOString()
}) {
  const normalizedVerdict =
    typeof verdict === "string" && verdict.trim() ? verdict.trim() : "failed";
  const nextStatus = normalizeVerificationVerdictStatus(normalizedVerdict);

  return updateQueueItem(queue, index, queueItem => ({
    ...assertStatusChange(queueItem, nextStatus, "finalize-verification"),
    ...queueItem,
    status: nextStatus,
    verificationVerdict: normalizedVerdict,
    verificationArtifactPath,
    verificationSummary,
    verificationResult,
    resumeWhen:
      normalizedVerdict === "needs_review" || normalizedVerdict === "blocked_external"
        ? verificationResult?.resumeWhen ?? queueItem?.resumeWhen
        : queueItem?.resumeWhen,
    resumeHint:
      normalizedVerdict === "needs_review" || normalizedVerdict === "blocked_external"
        ? verificationResult?.resumeHint ?? queueItem?.resumeHint
        : queueItem?.resumeHint,
    verifiedAt
  }));
}

export function deferQueueItem({ queue, index, deferredAt = new Date().toISOString() }) {
  const updatedItems = queue.items.map((queueItem, queueIndex) => {
    if (queueIndex !== index) {
      return queueItem;
    }

    return {
      ...assertStatusChange(queueItem, QUEUE_STATUS.deferred, "defer-item"),
      ...queueItem,
      status: QUEUE_STATUS.deferred,
      runId: undefined,
      sessionId: undefined,
      messageId: undefined,
      messageReceivedAt: undefined,
      resumedAt: undefined
    };
  });

  return {
    ...queue,
    items: updatedItems,
    cursor: computeNextCursor(updatedItems, index + 1),
    updatedAt: deferredAt
  };
}

export function markQueueItemNeedsReview({
  queue,
  index,
  reviewReason,
  reviewSummary,
  resumeWhen,
  resumeHint,
  reviewStatus = "needs_review",
  reviewRequestedAt = new Date().toISOString()
}) {
  const normalizedReviewStatus = REVIEW_QUEUE_STATUSES.has(reviewStatus) ? reviewStatus : "needs_review";
  const updatedItems = queue.items.map((queueItem, queueIndex) => {
    if (queueIndex !== index) {
      return queueItem;
    }

    return {
      ...assertStatusChange(queueItem, normalizedReviewStatus, "mark-needs-review"),
      ...queueItem,
      status: normalizedReviewStatus,
      reviewReason: typeof reviewReason === "string" && reviewReason.trim() ? reviewReason.trim() : "manual_review_required",
      reviewSummary: typeof reviewSummary === "string" && reviewSummary.trim() ? reviewSummary.trim() : undefined,
      resumeWhen: typeof resumeWhen === "string" && resumeWhen.trim() ? resumeWhen.trim() : undefined,
      resumeHint: typeof resumeHint === "string" && resumeHint.trim() ? resumeHint.trim() : undefined,
      reviewRequestedAt,
      runId: undefined,
      sessionId: undefined,
      messageId: undefined,
      messageReceivedAt: undefined,
      resumedAt: undefined
    };
  });

  return {
    ...queue,
    items: updatedItems,
    cursor: computeNextCursor(updatedItems, index + 1),
    updatedAt: reviewRequestedAt
  };
}

export function resumeQueueItem({
  queue,
  index,
  resumedAt = new Date().toISOString(),
  resumeNote,
  resumedBy = "manual_cli"
}) {
  const updatedItems = queue.items.map((queueItem, queueIndex) => {
    if (queueIndex !== index) {
      return queueItem;
    }

    return {
      ...assertStatusChange(queueItem, QUEUE_STATUS.pending, "resume-item"),
      ...queueItem,
      status: QUEUE_STATUS.pending,
      reviewRequired: false,
      lastSuspendedStatus: queueItem?.status,
      resumeApprovedAt: resumedAt,
      resumeApprovedBy: typeof resumedBy === "string" && resumedBy.trim() ? resumedBy.trim() : "manual_cli",
      resumeNote: typeof resumeNote === "string" && resumeNote.trim() ? resumeNote.trim() : undefined
    };
  });

  return {
    ...queue,
    items: updatedItems,
    cursor: computeNextCursor(updatedItems, index),
    updatedAt: resumedAt
  };
}

function assertStatusChange(queueItem, nextStatus, context) {
  assertQueueStatusTransition({
    from: queueItem?.status,
    to: nextStatus,
    context
  });
  return {};
}

export function appendQueueItems(queue, items, updatedAt = new Date().toISOString()) {
  const nextItems = Array.isArray(items) ? items.filter(Boolean) : [];

  if (nextItems.length === 0) {
    return {
      ...queue,
      updatedAt
    };
  }

  const mergedItems = [...queue.items, ...nextItems];

  return {
    ...queue,
    items: mergedItems,
    cursor: computeNextCursor(mergedItems, queue.cursor),
    updatedAt
  };
}

export function normalizeQueueForExecution(queue, updatedAt = new Date().toISOString(), options = {}) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const preserveDeferredIds = options?.preserveDeferredIds instanceof Set ? options.preserveDeferredIds : new Set();
  let normalizedCount = 0;
  const normalizedItemIds = [];

  const normalizedItems = items.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return item;
    }

    if (!RECOVERABLE_QUEUE_STATUSES.has(item.status)) {
      return item;
    }

    if (item.status === "deferred" && typeof item.id === "string" && preserveDeferredIds.has(item.id)) {
      return item;
    }

    normalizedCount += 1;
    if (typeof item.id === "string" && item.id.trim()) {
      normalizedItemIds.push(item.id.trim());
    }

    const nextItem = {
      ...item,
      status: "pending"
    };

    for (const field of RECOVERABLE_QUEUE_ITEM_FIELDS) {
      delete nextItem[field];
    }

    return nextItem;
  });

  if (normalizedCount === 0) {
    return {
      queue,
      normalizedCount: 0,
      normalizedItemIds: []
    };
  }

  return {
    queue: {
      ...queue,
      items: normalizedItems,
      updatedAt
    },
    normalizedCount,
    normalizedItemIds
  };
}

export function countQueueWork(queue) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  let pendingCount = 0;
  let completedCount = 0;
  let inProgressCount = 0;
  let deferredCount = 0;
  let verifyingCount = 0;
  let needsReviewCount = 0;
  let blockedExternalCount = 0;
  let needsReplanCount = 0;
  let failedCount = 0;

  for (const item of items) {
    if (item?.status === "pending") {
      pendingCount += 1;
    } else if (TERMINAL_SUCCESS_QUEUE_STATUSES.has(item?.status)) {
      completedCount += 1;
    } else if (item?.status === "in_progress") {
      inProgressCount += 1;
    } else if (item?.status === "deferred") {
      deferredCount += 1;
    } else if (item?.status === "verifying") {
      verifyingCount += 1;
    } else if (item?.status === "needs_review") {
      needsReviewCount += 1;
    } else if (item?.status === "blocked_external") {
      blockedExternalCount += 1;
    } else if (item?.status === "needs_replan") {
      needsReplanCount += 1;
    } else if (item?.status === "failed") {
      failedCount += 1;
    }
  }

  return {
    pendingCount,
    completedCount,
    inProgressCount,
    deferredCount,
    verifyingCount,
    needsReviewCount,
    blockedExternalCount,
    needsReplanCount,
    failedCount,
    totalCount: items.length
  };
}

export function countRemainingQueueWork(queue) {
  const { pendingCount, inProgressCount, deferredCount } = countQueueWork(queue);
  return pendingCount + inProgressCount + deferredCount;
}

export function computeNextCursor(items, start) {
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

export function shouldQueueItemWaitForReview(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return false;
  }

  if (item.status === "needs_review" || item.status === "blocked_external") {
    return true;
  }

  return item.reviewRequired === true;
}

function findPendingIndex(items, start, shouldRunItem = () => true) {
  for (let index = start; index < items.length; index += 1) {
    if (items[index]?.status === "pending" && shouldRunItem(items[index], index, items)) {
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

function describeCursorValue(value) {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  return typeof value === "number" ? value : String(value);
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
    "verificationStartedAt",
    "reviewRequestedAt",
    "resumeApprovedAt",
    "resumedAt",
    "messageReceivedAt",
    "verifiedAt",
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

export function formatSessionTitleTime(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "invalid-date";
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");

  return `${month}-${day} ${hour}:${minute}:${second}`;
}

export { formatDisplayTime };

function normalizeStructuredField(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value;
}

function normalizeVerificationConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { mode: "assistant_only" };
  }

  const mode =
    typeof value.mode === "string" && ["assistant_only", "command_only", "command+artifact"].includes(value.mode)
      ? value.mode
      : Array.isArray(value.artifacts) && value.artifacts.length > 0
        ? "command+artifact"
        : Array.isArray(value.commands) && value.commands.length > 0
          ? "command_only"
          : "assistant_only";
  const commands = Array.isArray(value.commands)
    ? value.commands.filter(command => typeof command === "string" && command.trim()).map(command => command.trim())
    : undefined;
  const artifacts = Array.isArray(value.artifacts)
    ? value.artifacts.filter(path => typeof path === "string" && path.trim()).map(path => path.trim())
    : undefined;
  const commandTimeoutMs = Number.isInteger(value.commandTimeoutMs) && value.commandTimeoutMs > 0 ? value.commandTimeoutMs : undefined;

  return {
    mode,
    ...(commands?.length ? { commands } : {}),
    ...(artifacts?.length ? { artifacts } : {}),
    ...(commandTimeoutMs ? { commandTimeoutMs } : {})
  };
}

function normalizeRetryPolicy(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      maxAttempts: 1,
      onVerificationFail: "needs_replan"
    };
  }

  const maxAttempts = Number.isInteger(value.maxAttempts) && value.maxAttempts > 0 ? value.maxAttempts : 1;
  const onVerificationFail =
    typeof value.onVerificationFail === "string" &&
    ["needs_replan", "failed", "needs_review", "blocked_external"].includes(value.onVerificationFail)
      ? value.onVerificationFail
      : "needs_replan";
  const onAcceptanceFailure =
    typeof value.onAcceptanceFailure === "string" &&
    ["needs_replan", "failed", "needs_review", "blocked_external"].includes(value.onAcceptanceFailure)
      ? value.onAcceptanceFailure
      : undefined;
  const onConstraintFailure =
    typeof value.onConstraintFailure === "string" &&
    ["needs_replan", "failed", "needs_review", "blocked_external"].includes(value.onConstraintFailure)
      ? value.onConstraintFailure
      : undefined;
  const onCommandFailure =
    typeof value.onCommandFailure === "string" &&
    ["needs_replan", "failed", "needs_review", "blocked_external"].includes(value.onCommandFailure)
      ? value.onCommandFailure
      : undefined;
  const onArtifactFailure =
    typeof value.onArtifactFailure === "string" &&
    ["needs_replan", "failed", "needs_review", "blocked_external"].includes(value.onArtifactFailure)
      ? value.onArtifactFailure
      : undefined;

  return {
    maxAttempts,
    onVerificationFail,
    ...(onAcceptanceFailure ? { onAcceptanceFailure } : {}),
    ...(onConstraintFailure ? { onConstraintFailure } : {}),
    ...(onCommandFailure ? { onCommandFailure } : {}),
    ...(onArtifactFailure ? { onArtifactFailure } : {})
  };
}

function queueItemNeedsV2Normalization(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return false;
  }

  return !(
    Number.isInteger(item.version) &&
    item.version >= 2 &&
    typeof item.kind === "string" &&
    item.kind.trim() &&
    typeof item.goal === "string" &&
    item.goal.trim() &&
    item.verification &&
    typeof item.verification === "object" &&
    !Array.isArray(item.verification) &&
    item.retryPolicy &&
    typeof item.retryPolicy === "object" &&
    !Array.isArray(item.retryPolicy) &&
    Number.isInteger(item.attempt) &&
    item.attempt >= 0
  );
}
