export const QUEUE_STATUS = Object.freeze({
  pending: "pending",
  inProgress: "in_progress",
  verifying: "verifying",
  completed: "completed",
  deferred: "deferred",
  needsReview: "needs_review",
  blockedExternal: "blocked_external",
  needsReplan: "needs_replan",
  failed: "failed"
});

export const VERIFICATION_VERDICT = Object.freeze({
  succeeded: "succeeded",
  needsReplan: "needs_replan",
  needsReview: "needs_review",
  blockedExternal: "blocked_external",
  failed: "failed"
});

export const SUSPENDED_QUEUE_STATUSES = new Set([QUEUE_STATUS.needsReview, QUEUE_STATUS.blockedExternal]);
export const UNRESOLVED_EXCEPTION_QUEUE_STATUSES = new Set([
  QUEUE_STATUS.needsReview,
  QUEUE_STATUS.blockedExternal,
  QUEUE_STATUS.needsReplan,
  QUEUE_STATUS.failed
]);

const ALLOWED_QUEUE_STATUS_TRANSITIONS = new Map(
  Object.entries({
    [QUEUE_STATUS.pending]: new Set([
      QUEUE_STATUS.pending,
      QUEUE_STATUS.inProgress,
      QUEUE_STATUS.deferred,
      QUEUE_STATUS.needsReview,
      QUEUE_STATUS.blockedExternal
    ]),
    [QUEUE_STATUS.inProgress]: new Set([
      QUEUE_STATUS.inProgress,
      QUEUE_STATUS.pending,
      QUEUE_STATUS.verifying,
      QUEUE_STATUS.deferred,
      QUEUE_STATUS.needsReview,
      QUEUE_STATUS.blockedExternal
    ]),
    [QUEUE_STATUS.verifying]: new Set([
      QUEUE_STATUS.completed,
      QUEUE_STATUS.needsReplan,
      QUEUE_STATUS.needsReview,
      QUEUE_STATUS.blockedExternal,
      QUEUE_STATUS.failed
    ]),
    [QUEUE_STATUS.deferred]: new Set([QUEUE_STATUS.pending]),
    [QUEUE_STATUS.needsReview]: new Set([QUEUE_STATUS.pending]),
    [QUEUE_STATUS.blockedExternal]: new Set([QUEUE_STATUS.pending]),
    [QUEUE_STATUS.needsReplan]: new Set([QUEUE_STATUS.pending, QUEUE_STATUS.failed]),
    [QUEUE_STATUS.failed]: new Set([QUEUE_STATUS.pending])
  })
);

export function assertQueueStatusTransition({ from, to, context = "queue" }) {
  if (from === undefined || from === null) {
    return;
  }

  if (from === to) {
    return;
  }

  const allowedTargets = ALLOWED_QUEUE_STATUS_TRANSITIONS.get(from);
  if (!allowedTargets || !allowedTargets.has(to)) {
    throw new Error(`Invalid ${context} status transition: ${String(from)} -> ${String(to)}`);
  }
}

export function normalizeVerificationVerdictStatus(verdict) {
  return verdict === VERIFICATION_VERDICT.succeeded ? QUEUE_STATUS.completed : verdict;
}

export function isKnownVerificationVerdict(value) {
  return Object.values(VERIFICATION_VERDICT).includes(value);
}
