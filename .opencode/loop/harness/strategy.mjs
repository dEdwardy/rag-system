import { shouldQueueItemWaitForReview } from "./queue.mjs";

export function normalizeLoopStrategy(strategy = {}) {
  if (!strategy || typeof strategy !== "object" || Array.isArray(strategy)) {
    return DEFAULT_LOOP_STRATEGY;
  }

  return {
    selectNextItem:
      typeof strategy.selectNextItem === "function" ? strategy.selectNextItem : DEFAULT_LOOP_STRATEGY.selectNextItem,
    shouldRunItem:
      typeof strategy.shouldRunItem === "function" ? strategy.shouldRunItem : DEFAULT_LOOP_STRATEGY.shouldRunItem,
    onItemFailure:
      typeof strategy.onItemFailure === "function" ? strategy.onItemFailure : DEFAULT_LOOP_STRATEGY.onItemFailure,
    onItemComplete:
      typeof strategy.onItemComplete === "function" ? strategy.onItemComplete : DEFAULT_LOOP_STRATEGY.onItemComplete
  };
}

export const DEFAULT_LOOP_STRATEGY = Object.freeze({
  selectNextItem: ({ pickNextItem }) => pickNextItem(),
  shouldRunItem: item => !shouldQueueItemWaitForReview(item),
  onItemFailure: ({ item }) => {
    if (item?.failureMode === "defer") {
      return "defer";
    }

    if (item?.failureMode === "review" || item?.escalationPolicy?.onFailure === "needs_review") {
      return "needs_review";
    }

    if (item?.failureMode === "blocked_external" || item?.escalationPolicy?.onFailure === "blocked_external") {
      return "blocked_external";
    }

    return "throw";
  },
  onItemComplete: () => null
});
