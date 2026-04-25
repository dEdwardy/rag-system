# Harness Follow-ups

Updated: 2026-04-25

## Codex Backend Baseline

- `pnpm loop:start:codex` uses the Codex CLI through the same queue runner contract as OpenCode.
- Shared backend identifiers, default commands, default models, and environment variable keys live in `loop-runtime/core/backend-config.mjs`.
- The Codex loop baseline is `gpt-5.5` with `model_reasoning_effort=low`.
- The runner supplies the configured Codex default model and default args unless `LOOP_EXECUTOR_MODEL`, `CODEX_LOOP_MODEL`, or explicit flags in `CODEX_LOOP_ARGS` override them.
- This keeps long queue execution independent from the user's global `~/.codex/config.toml` default model.
- Codex JSONL `thread_id` is captured as the loop session id so later continuation/finalizer turns can resume the same CLI thread.
- Startup validation checks that the Codex command is available before marking the runner as started.

## Do Now

1. Improve timeout recovery artifacts.

- Why now: timeout loss still hides the most useful post-failure context.
- Current gap: the recovery artifact is now present, but it is still intentionally compact.
- Target: keep the artifact small and easy to inspect.

2. Improve `loop:status` blocked/needs-replan reporting.

- Why now: status is the main operator view during long runs.
- Current gap: the status line now carries backend and blocked state context, but it can still prefer stale item labels over dependency and queue summary signals.
- Target: make the status command prefer `blockedOn`, `needs_replan`, and queue summaries over the last seen item label.

3. Add per-item timeout overrides and progress-aware finalization.

- Why now: the default timeout still treats short focused items and long drift-prone items the same.
- Current gap: the runner now accepts per-item timeout overrides, but it still lacks a real progress-aware pre-finalization threshold.
- Target: add a shorter idle-progress threshold before forcing finalization.

## Later

4. Reduce heartbeat log noise.

- Why later: this is mostly an operator ergonomics improvement once failure recovery is clearer.
- Current gap: `loop-run.log` still contains many repeated heartbeat lines and only sparse high-signal item results.
- Target: add a compact mode or separate event log so item lifecycle transitions are easy to scan.

5. Queue reconciliation still needs a documented operator path.

- Why later: it matters for manual recovery flows, but it is less urgent than failure handling and status clarity.
- Current gap: there is still no explicit documented reconciliation flow for marking a queue item completed with local validation evidence.
- Target: document a standard reconciliation procedure in the loop README.

## Acceptable Debt

6. Missing `QUEUE_RESULT` can still happen after a task makes real progress.

- Why acceptable for now: the runner already has a finalizer turn and fallback completion logic, so the item can still close out in practice.
- Current gap: the harness still depends on the agent honoring the exact output contract.
- Follow-up: make the finalizer result and fallback path easier to inspect in queue state and status output.

7. `loop:status` can still be a little stale during dependency transitions.

- Why acceptable for now: the blocked / backend / summary signals are already much better than before.
- Current gap: there can still be brief moments where the label trails the true queue state.
- Follow-up: keep refining the status preference order if it becomes noisy again.
