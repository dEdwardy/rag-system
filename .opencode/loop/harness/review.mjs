import { markQueueItemNeedsReview, shouldQueueItemWaitForReview } from "./queue.mjs";
import { QUEUE_STATUS, UNRESOLVED_EXCEPTION_QUEUE_STATUSES } from "./state-machine.mjs";

export function promotePendingReviewItems(queue, reviewRequestedAt = new Date().toISOString()) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  let nextQueue = queue;
  let promotedCount = 0;
  const promotedItemIds = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = nextQueue.items[index];
    if (item?.status !== QUEUE_STATUS.pending || !shouldQueueItemWaitForReview(item)) {
      continue;
    }

    nextQueue = markQueueItemNeedsReview({
      queue: nextQueue,
      index,
      reviewReason: "pre_run_review_required",
      reviewSummary: buildReviewSummary(item),
      ...buildResumeGuidanceForSuspendedItem({
        item,
        reviewStatus: "needs_review",
        reviewReason: "pre_run_review_required"
      }),
      reviewRequestedAt
    });
    promotedCount += 1;
    if (typeof item?.id === "string" && item.id.trim()) {
      promotedItemIds.push(item.id.trim());
    }
  }

  return {
    queue: nextQueue,
    promotedCount,
    promotedItemIds
  };
}

export function queueHasUnresolvedExceptionItems(queue) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  return items.some(item => UNRESOLVED_EXCEPTION_QUEUE_STATUSES.has(item?.status));
}

export function classifyReviewReason(error, reviewStatus) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (reviewStatus === "blocked_external") {
    return "external_dependency_blocked";
  }

  if (normalized.includes("credential") || normalized.includes("secret") || normalized.includes("auth")) {
    return "credentials_or_access_required";
  }

  if (normalized.includes("conflict") || normalized.includes("dirty worktree") || normalized.includes("uncommitted")) {
    return "repo_state_conflict";
  }

  return "execution_failed_requires_review";
}

export function summarizeReviewFailure(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.trim() || undefined;
}

export function buildResumeGuidanceForSuspendedItem({ item, reviewStatus, reviewReason }) {
  if (reviewStatus === "blocked_external") {
    return {
      resumeWhen:
        "Resume after the missing credential, external dependency, or environment blocker is fixed and the same verifier/build path can run again.",
      resumeHint: `After unblocking, rerun with \`node .opencode/loop/cli.mjs --resume-item ${item?.id ?? "<item-id>"}\` to put the item back into the pending lane.`
    };
  }

  if (reviewReason === "pre_run_review_required" || item?.reviewRequired === true) {
    return {
      resumeWhen: "Resume only after a human reviewer explicitly approves running this item unattended.",
      resumeHint: `Use \`node .opencode/loop/cli.mjs --resume-item ${item?.id ?? "<item-id>"} --resume-note "approved"\` after review.`
    };
  }

  if (reviewReason === "credentials_or_access_required") {
    return {
      resumeWhen: "Resume after the required credential, access grant, or secret is available in the runtime environment.",
      resumeHint: `After access is restored, run \`node .opencode/loop/cli.mjs --resume-item ${item?.id ?? "<item-id>"}\` to retry the same task.`
    };
  }

  return {
    resumeWhen:
      "Resume after a human has reviewed the failure evidence and decided the same task should continue in the autonomous lane.",
    resumeHint: `Use \`node .opencode/loop/cli.mjs --resume-item ${item?.id ?? "<item-id>"} --resume-note "why it is safe to continue"\` once the review is complete.`
  };
}

export function buildResumeDirective(item) {
  if (!item?.resumeApprovedAt && !item?.resumeNote && !item?.lastSuspendedStatus) {
    return "";
  }

  const lines = [];
  if (item?.lastSuspendedStatus) {
    lines.push(`Previous suspended status: ${item.lastSuspendedStatus}`);
  }
  if (item?.reviewReason) {
    lines.push(`Previous suspend reason: ${item.reviewReason}`);
  }
  if (item?.resumeWhen) {
    lines.push(`Recovered condition: ${item.resumeWhen}`);
  }
  if (item?.resumeApprovedAt) {
    lines.push(`Manual resume approved at: ${item.resumeApprovedAt}`);
  }
  if (item?.resumeNote) {
    lines.push(`Manual resume note: ${item.resumeNote}`);
  }

  return lines.join("\n");
}

function buildReviewSummary(item) {
  const summaryParts = [];
  if (item?.reviewSummary) {
    summaryParts.push(String(item.reviewSummary).trim());
  }
  if (item?.riskLevel) {
    summaryParts.push(`risk=${String(item.riskLevel).trim()}`);
  }
  if (item?.reviewRequired === true) {
    summaryParts.push("reviewRequired=true");
  }

  return summaryParts.filter(Boolean).join("; ") || undefined;
}
