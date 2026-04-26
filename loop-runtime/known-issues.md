# Harness Follow-ups

Updated: 2026-04-26

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
- Current gap: the runner now accepts per-item timeout overrides, but long code-reading turns can still hit the idle-progress guard when the executor emits no visible stdout/stderr for a while.
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

## Autonomy Gaps

6. Long-running autonomous development is still not reliable enough.

- Why now: the repo can now auto-feed serial waves into `loop-runtime`, but that is not the same as stable unattended development.
- Current gap: the automation can keep work moving, but it still relies on brittle task-completion signals, repeated ad hoc task discovery, and manual judgment about whether the next task is actually worth doing.
- Target: treat `loop-runtime` as a supervised small-step maintainer for now, not a fully autonomous long-running developer.

7. Wave state handling still needs a harder state machine.

- Why now: later automation decisions depend on whether the current wave is truly done.
- Current gap: queue items have already shown edge cases such as `needs_replan` with `exit=0`, missing explicit queue results, and fallback-only completion paths.
- Target: define stronger wave/item completion rules so follow-up automation can trust `completed`, `blocked`, `needs_replan`, and related states without heuristic interpretation.

8. Unfinished-item recovery is not yet a true closed loop.

- Why now: the automation can avoid starting a new wave when the current one is unfinished, but that only prevents overlap.
- Current gap: it still lacks a mature recovery path that can classify failure modes, rewrite the unfinished item into a smaller recovery task, and retry safely without human intervention.
- Target: add a bounded recovery/replan layer for unfinished items before claiming durable unattended execution.

9. Structured backlog memory is still missing.

- Why now: repeated 15-minute task discovery can drift or re-open low-value work.
- Current gap: candidate work is rediscovered from docs, commits, and queue history each tick instead of being tracked in a durable backlog with status, priority, and dedupe memory.
- Target: keep a structured backlog for queue-suitable work so automation can distinguish `candidate`, `active`, `completed`, `deferred`, and `rejected` items.

10. Task-value filtering is still too weak for indefinite execution.

- Why now: once the obvious bounded follow-ups are done, the system can start generating technically possible but strategically low-value waves.
- Current gap: the current automation can identify plausible work, but it cannot yet reliably reject low-signal maintenance loops or marginal refactors over long horizons.
- Target: add a stricter value filter so only concrete, high-signal, queue-suitable follow-ups become new waves.

## Acceptable Debt

11. Missing `QUEUE_RESULT` can still happen after a task makes real progress.

- Why acceptable for now: the runner already has a finalizer turn and fallback completion logic, so the item can still close out in practice.
- Current gap: the harness still depends on the agent honoring the exact output contract.
- Follow-up: make the finalizer result and fallback path easier to inspect in queue state and status output.

12. `loop:status` can still be a little stale during dependency transitions.

- Why acceptable for now: the blocked / backend / summary signals are already much better than before.
- Current gap: there can still be brief moments where the label trails the true queue state.
- Follow-up: keep refining the status preference order if it becomes noisy again.

## Operator Note

- The current idle-progress env key is `LOOP_ITEM_IDLE_TIMEOUT_MS`, with legacy compatibility for `OPENCODE_LOOP_PROGRESS_IDLE_TIMEOUT_MS`.
- Default idle-progress timeout is `45000` ms (`45s`).
- Recommended OpenCode long-task value is `180000` ms (`3m`) so long read-heavy turns have more room before the runner assumes they are stuck.
- If a task is killed during a quiet code-reading stretch, expect queue state and `loop:status` to show a `needs_replan` / `idle_progress_timeout` style failure instead of a normal completion line.
