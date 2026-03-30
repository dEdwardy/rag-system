import { countQueueWork, formatDisplayTime } from "./queue.mjs";
import { QUEUE_STATUS } from "./state-machine.mjs";

export function buildQueueWorkVisibility(queue, pickedIndex) {
  const {
    pendingCount,
    completedCount,
    inProgressCount,
    deferredCount,
    verifyingCount,
    needsReviewCount,
    blockedExternalCount,
    needsReplanCount,
    failedCount,
    totalCount
  } = countQueueWork(queue);
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const pickedStatus = items[pickedIndex]?.status;
  const currentWorkReduction =
    pickedStatus === QUEUE_STATUS.pending || pickedStatus === QUEUE_STATUS.inProgress ? 1 : 0;

  return {
    queueTotal: totalCount,
    queuePending: pendingCount,
    queueCompleted: completedCount,
    queueInProgress: inProgressCount,
    queueDeferred: deferredCount,
    queueVerifying: verifyingCount,
    queueNeedsReview: needsReviewCount,
    queueBlockedExternal: blockedExternalCount,
    queueNeedsReplan: needsReplanCount,
    queueFailed: failedCount,
    remainingAfterPick: Math.max(0, pendingCount + inProgressCount + deferredCount - currentWorkReduction),
    ...buildQueueFamilyCountVisibility(queue)
  };
}

export function buildIdleQueueWorkVisibility(queue) {
  const {
    pendingCount,
    completedCount,
    inProgressCount,
    deferredCount,
    verifyingCount,
    needsReviewCount,
    blockedExternalCount,
    needsReplanCount,
    failedCount,
    totalCount
  } = countQueueWork(queue);

  return {
    queueTotal: totalCount,
    queuePending: pendingCount,
    queueCompleted: completedCount,
    queueInProgress: inProgressCount,
    queueDeferred: deferredCount,
    queueVerifying: verifyingCount,
    queueNeedsReview: needsReviewCount,
    queueBlockedExternal: blockedExternalCount,
    queueNeedsReplan: needsReplanCount,
    queueFailed: failedCount,
    remainingQueueWork: pendingCount + inProgressCount + deferredCount,
    ...buildQueueFamilyCountVisibility(queue)
  };
}

export function buildQueueCursorVisibility(queue, pickedIndex) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const cursor = Number.isInteger(queue?.cursor) ? queue.cursor : null;
  const cursorItem = Number.isInteger(cursor) && cursor >= 0 && cursor < items.length ? items[cursor] : null;
  const nextPendingItem = findNextPendingItem(items, pickedIndex);
  const nextPendingCursorDistance = computeCursorDistanceToIndex({
    cursor,
    targetIndex: nextPendingItem?.index,
    itemCount: items.length
  });

  return {
    queueCursor: cursor,
    queueCursorItemId: cursorItem?.id ?? null,
    queueCursorItemStatus: cursorItem?.status ?? null,
    ...buildActiveCursorResumeVisibility(cursorItem),
    nextPendingItemId: nextPendingItem?.id ?? null,
    nextPendingItemIndex: nextPendingItem?.index ?? null,
    nextPendingItemTitle: nextPendingItem?.title ?? null,
    nextPendingCursorDistance
  };
}

function buildQueueFamilyCountVisibility(queue) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const pendingByFamily = new Map();
  const completedByFamily = new Map();

  for (const item of items) {
    const family = resolveQueueItemFamily(item);
    if (!family) {
      continue;
    }

    if (item?.status === QUEUE_STATUS.pending || item?.status === QUEUE_STATUS.deferred) {
      pendingByFamily.set(family, (pendingByFamily.get(family) ?? 0) + 1);
      continue;
    }

    if (item?.status === QUEUE_STATUS.completed) {
      completedByFamily.set(family, (completedByFamily.get(family) ?? 0) + 1);
    }
  }

  return {
    queuePendingByFamily: mapToSortedObject(pendingByFamily),
    queueCompletedByFamily: mapToSortedObject(completedByFamily)
  };
}

function resolveQueueItemFamily(item) {
  const id = typeof item?.id === "string" ? item.id.trim() : "";
  if (!id) {
    return null;
  }

  const [family] = id.split(/[-_:/.]/);
  return family || null;
}

function mapToSortedObject(countMap) {
  if (!(countMap instanceof Map) || countMap.size === 0) {
    return null;
  }

  return Object.fromEntries([...countMap.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function computeCursorDistanceToIndex({ cursor, targetIndex, itemCount }) {
  if (!Number.isInteger(cursor) || !Number.isInteger(targetIndex) || !Number.isInteger(itemCount)) {
    return null;
  }

  if (itemCount <= 0 || cursor < 0 || cursor >= itemCount || targetIndex < 0 || targetIndex >= itemCount) {
    return null;
  }

  if (targetIndex >= cursor) {
    return targetIndex - cursor;
  }

  return itemCount - cursor + targetIndex;
}

function buildActiveCursorResumeVisibility(cursorItem) {
  const title = typeof cursorItem?.title === "string" && cursorItem.title.trim() ? cursorItem.title.trim() : null;
  const sessionId =
    typeof cursorItem?.sessionId === "string" && cursorItem.sessionId.trim() ? cursorItem.sessionId.trim() : null;
  const messageId =
    typeof cursorItem?.messageId === "string" && cursorItem.messageId.trim() ? cursorItem.messageId.trim() : null;
  const startedAt =
    typeof cursorItem?.startedAt === "string" && cursorItem.startedAt.trim() ? cursorItem.startedAt : null;

  if (cursorItem?.status !== QUEUE_STATUS.inProgress) {
    return {
      queueCursorItemTitle: title,
      queueCursorResumePreview: null,
      queueCursorResumeSessionId: null,
      queueCursorResumeMessageId: null,
      queueCursorResumeStartedAt: null
    };
  }

  return {
    queueCursorItemTitle: title,
    queueCursorResumePreview: sessionId ? "resume-awaiting-new-assistant-message" : null,
    queueCursorResumeSessionId: sessionId,
    queueCursorResumeMessageId: messageId,
    queueCursorResumeStartedAt: startedAt ? formatDisplayTime(startedAt) : null
  };
}

function findNextPendingItem(items, pickedIndex) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const normalizedPickedIndex = Number.isInteger(pickedIndex) ? pickedIndex : -1;
  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = (normalizedPickedIndex + offset + items.length) % items.length;
    const item = items[index];
    if (item?.status === QUEUE_STATUS.pending && typeof item?.id === "string") {
      return {
        id: item.id,
        index,
        title: item.title ?? null
      };
    }
  }

  return null;
}
