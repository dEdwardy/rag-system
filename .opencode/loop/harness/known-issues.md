# Harness Follow-ups

Updated: 2026-04-16

## Observed Issues

1. Missing `QUEUE_RESULT` can still happen after a task makes real progress.
- We already hardened `runner.mjs` with a finalizer turn and fallback completion logic.
- This recovered the first queue item, but the harness still depends heavily on the agent honoring the exact output contract.
- Follow-up: make the finalizer result and fallback path easier to inspect in queue state and status output.

2. `loop:status` can look stale or misleading during dependency transitions.
- In this wave, `loop:status` briefly reported the next item name while the runtime state was actually `blocked` on an unmet dependency.
- Follow-up: teach the status command to prefer `blockedOn`, `needs_replan`, and `completedCount/pendingCount` summaries over the last seen item label.

3. Timeout failures lose too much structured progress context.
- The second queue item timed out after partial work.
- We could infer changed files from the tool trace embedded in `lastRunSummary`, but there is no dedicated per-item recovery summary file.
- Follow-up: write a small structured recovery artifact on timeout with changed files, last validation command, and last meaningful tool/action.

4. Heartbeat-only logs are noisy during long unattended runs.
- `loop-run.log` contains many repeated pending/total heartbeat lines and only sparse high-signal item results.
- Follow-up: add a compact mode or separate event log so item lifecycle transitions are easy to scan without thousands of heartbeat lines.

5. Timeout tuning is still one-size-fits-all.
- The frontend state-feedback item hit the default 20-minute timeout even though its focused validation was short and the likely issue was long agent drift before closeout.
- Follow-up: support per-item timeout overrides and a shorter idle-progress threshold before forcing finalization.

6. Queue reconciliation still needs a documented operator path.
- When a task is already satisfied outside the runner, there is no explicit documented reconciliation flow for marking the queue item completed with local validation evidence.
- Follow-up: document a standard reconciliation procedure in the loop README.

## Suggested Priority

1. Improve timeout recovery artifacts.
2. Improve `loop:status` blocked/needs-replan reporting.
3. Add per-item timeout overrides and progress-aware finalization.
4. Document queue reconciliation for already-satisfied items.
5. Reduce heartbeat log noise.
