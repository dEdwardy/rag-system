import { formatDisplayTime } from "./queue.mjs";

const LABEL_MAP = Object.freeze({
  start: "启动",
  plan: "自动补任务",
  pick: "取任务",
  resume: "恢复",
  verify: "验证",
  "verify:verdict": "验证结果",
  "queue:normalize": "队列修复",
  "queue:v2-normalize": "队列V2归一化",
  "session:create": "建会话",
  "message:send": "发消息",
  "message:timeout-retry": "超时重试",
  "message:timeout-exhausted": "超时回退",
  "item:defer": "失败降级",
  "cursor:recover": "游标恢复",
  refill: "补队列",
  "refill:skip": "补队列跳过",
  complete: "完成",
  idle: "空闲"
});

const ORDERED_KEYS = Object.freeze([
  "itemId",
  "status",
  "sessionId",
  "messageId",
  "agent",
  "model",
  "promptFile",
  "queueCursor",
  "queueCursorItemId",
  "queueCursorItemStatus",
  "queueCursorItemTitle",
  "queueCursorResumePreview",
  "queueCursorResumeSessionId",
  "queueCursorResumeMessageId",
  "queueCursorResumeStartedAt",
  "nextPendingItemId",
  "nextPendingItemIndex",
  "nextPendingItemTitle",
  "nextPendingCursorDistance",
  "remainingAfterPick",
  "remainingQueueWork",
  "queuePending",
  "queuePendingByFamily",
  "queueCompleted",
  "queueCompletedByFamily",
  "queueInProgress",
  "queueDeferred",
  "queueVerifying",
  "queueNeedsReview",
  "queueBlockedExternal",
  "queueNeedsReplan",
  "queueFailed",
  "queueTotal",
  "handoffPath",
  "verificationArtifactPath",
  "verificationVerdict",
  "processedCount",
  "queuePath",
  "cursorFrom",
  "cursorTo",
  "cursorReason",
  "repoRoot",
  "baseUrl",
  "defaultAgent",
  "defaultModel",
  "plannerSessionId",
  "plannerMessageId",
  "generatedCount",
  "generatedItemIds",
  "autoRefillCycle",
  "maxAutoRefillCycles",
  "autoRefillMaxItems",
  "timeoutRetryAttempt",
  "maxTimeoutRetries",
  "timeoutWaitMs",
  "normalizedCount",
  "normalizedItemIds"
]);

export function logStatus(event, fields) {
  const label = LABEL_MAP[event] ?? event;
  const orderedEntries = [];

  for (const key of ORDERED_KEYS) {
    const value = fields[key];
    if (value !== undefined && value !== null && value !== "") {
      orderedEntries.push(`${key}=${JSON.stringify(value)}`);
    }
  }

  for (const [key, value] of Object.entries(fields)) {
    if (ORDERED_KEYS.includes(key)) {
      continue;
    }
    if (value !== undefined && value !== null && value !== "") {
      orderedEntries.push(`${key}=${JSON.stringify(value)}`);
    }
  }

  const suffix = orderedEntries.join(" ");
  const prefix = `[opencode-loop] ${formatDisplayTime(new Date())} ${label}`;
  console.log(suffix ? `${prefix} ${suffix}` : prefix);
}
