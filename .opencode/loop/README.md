# OpenCode Loop Harness

> Doc role: `harness`
> Usage: local queue runner for one OpenCode increment at a time.

## Purpose

`.opencode/loop/cli.mjs` is a small repo-local harness entrypoint used to assist development, not a product runtime path. It:

- reads `.opencode/loop/queue.json`
- drains queue items one by one until the queue is empty
- can ask the `plan` command for one guarded refill pass after the queue empties when auto-refill is enabled
- creates, resumes, or reuses an OpenCode session for adjacent related items
- sends the item prompt to the configured agent
- writes an execution handoff markdown file
- runs a minimal verifier phase before completion
- marks each queue item as completed only after verification passes, or escalates/routes it into a review or replan state
- can automatically append one verifier-driven follow-up item when `needs_replan` still has remaining retry budget

It intentionally stays narrow: one queue item, one handoff, and conservative session reuse only for adjacent related items.

For a concise module-and-flow overview, see `.opencode/loop/ARCHITECTURE.md`.
For the short planner-facing contract used by default doc ingestion, see `.opencode/loop/loop-contract-brief.md`.

## Files It Uses

- `.opencode/loop/queue.json` - queue state and cursor
- `.opencode/loop/prompts/*.md` - prompt templates
- `.opencode/loop/handoffs/*.md` - generated run handoffs
- `.opencode/loop/execution-backlog.jsonc` - machine-readable stage backlog for planner/queue materialization
- `.opencode/loop/materialized/*.queue.json` - queue drafts generated from backlog waves
- `.opencode/loop.lock/` - runtime lock directory that prevents concurrent runs
- `.opencode/loop/harness/queue.mjs` - queue schema, read/write, selection, and completion helpers
- `pnpm loop:start|stop|status` - short control commands for the systemd user units
- `.opencode/loop/harness/night-run.sh` - thin wrapper for `systemd --user` or manual night runs; resolves pnpm via corepack/Volta/local shims
- `.opencode/loop/harness/systemd/opencode-loop.service` - user service template with crash restart behavior
- `.opencode/loop/harness/systemd/opencode-loop.timer` - nightly timer template
- `.opencode/loop/harness/planner.mjs` - guarded queue refill planner and generated-prompt writer
- `.opencode/loop/harness/jsonc.mjs` - lightweight JSONC comment-stripping helper for repo config
- `.opencode/loop/harness/runtime.mjs` - queue, lock, and OpenCode API logic
- `.opencode/loop/harness/visibility.mjs` - queue work/cursor visibility payload helpers for terminal logs
- `.opencode/loop/harness/logger.mjs` - ordered Chinese terminal status logging helper
- `.opencode/loop/harness/self-test.mjs` - self-test harness and mock server
- `.opencode/loop/harness/strategy.mjs` - small strategy/callback normalization layer for selection and failure handling

Session titles use the shape `loop #<queue-index> · <remaining> left · <item-id> · MM-DD HH:MM:SS`. Auto-refill follow-up items are labeled as `refill <remaining> left` so a second mini-countdown after the planner run is visually distinguishable from the manual wave countdown.

Backlog/queue layering is intentional:

- `execution-backlog.jsonc` is the editable planning source for backlog waves and queue contracts
- `materialized/*.queue.json` is the generated draft output from a backlog wave
- `queue.json` is the live execution queue that the runtime actually drains and mutates

Typical flow:

```text
execution-backlog.jsonc
  -> materialize wave
  -> materialized/*.queue.json
  -> append into queue.json
  -> runtime drains queue.json
```

## Environment

- `OPENCODE_BASE_URL` - OpenCode server URL, default `http://127.0.0.1:4096`
- `OPENCODE_SERVER_USERNAME` - basic auth username when needed
- `OPENCODE_SERVER_PASSWORD` - basic auth password when needed
- `OPENCODE_LOOP_MESSAGE_WAIT_MS` - max wait for an assistant message
- `OPENCODE_LOOP_POLL_MS` - polling interval while waiting
- `OPENCODE_LOOP_AUTO_REFILL_MAX_CYCLES` - max planner refill passes per queue wave; default `0`, `0` disables refill. The bundled systemd service also pins this to `0` so planner refill is opt-in instead of automatic.
- `OPENCODE_LOOP_AUTO_REFILL_MAX_ITEMS` - max new queue items each refill pass may append; default `2`

## Commands

```bash
pnpm opencode:loop
node .opencode/loop/cli.mjs --self-test
node .opencode/loop/cli.mjs --resume-item <item-id>
pnpm loop:start
pnpm loop:stop
pnpm loop:status
```

## Queue Shape

```json
{
  "version": 1,
  "cursor": 0,
  "createdAt": "...",
  "updatedAt": "...",
  "items": [
    {
      "id": "build-001",
      "version": 2,
      "kind": "build_increment",
      "title": "Read-model metadata convergence increment",
      "goal": "Keep the next implementation increment narrow and verifiable.",
      "agent": "rag-build",
      "promptFile": "prompts/read-model-metadata-build.md",
      "status": "pending",
      "verification": {
        "mode": "command+artifact",
        "commands": ["pnpm test:api:file -- test/example.test.js"],
        "artifacts": ["reports/example.json"]
      },
      "retryPolicy": {
        "maxAttempts": 2,
        "onVerificationFail": "needs_replan"
      },
      "attempt": 0
    }
  ]
}
```

## Prompt Family Guidance

Keep queue prompts task-family specific so metadata work does not silently fall back to the generic build template:

- `prompts/build.md`: generic small build increment
- `prompts/build-small-increment.md`: harness/runtime maintenance increments under `.opencode/loop/*`
- `prompts/read-model-metadata-build.md`: read-model / metadata convergence build increments
- `prompts/plan-next.md`: strict JSON-only planner prompt for guarded queue refill

For read-model / metadata queue items, prefer `prompts/read-model-metadata-build.md` instead of `prompts/build.md`.

Queue items now normalize toward a small V2 task contract with optional `kind`, `goal`, `acceptance`, `constraints`, `verification`, `retryPolicy`, `attempt`, `taskSummary`, and `sessionAffinityKey` fields.
Completed items are enriched with `sessionId`, `messageId`, `handoffPath`, `verificationArtifactPath`, `verificationVerdict`, and `completedAt`.
Queue records also persist `pushEligible`, where only `verificationVerdict === succeeded` yields `true`; every failed/replan/review/blocker verifier outcome is explicitly local-only evidence and not publish-ready.
The harness now centralizes queue-status and verifier-verdict transitions in `harness/state-machine.mjs`, so `runtime` / `queue` / `review` / `verification` all validate against the same transition table instead of hand-rolled status strings.
Verifier failure routing is also table-driven inside `harness/verification.mjs`: each failure family declares its retry-policy keys, default verdict, and optional inferred matchers before the runtime falls back to generic handling.
Verification records now also carry structured failure taxonomy fields such as `verificationResult.failureCategory`, `verificationResult.failureCode`, and `verificationResult.failureDetail`.
When verifier routing is inferred instead of explicitly declared, records also carry `verificationResult.routingReason` so the handoff shows whether the task was routed by retry policy, by an inferred external blocker, or by an inferred manual-review artifact hint.
For `needs_replan` and `failed` outcomes, the markdown handoff now also includes an operator-facing `接管摘要` section that points to the failure taxonomy, verification artifact, and next manual action.
Queue records also carry readable `*Display` timestamp companions such as `startedAtDisplay`, `messageReceivedAtDisplay`, and `completedAtDisplay`.
Suspended review/blocker items now also record `resumeWhen`, `resumeHint`, `lastSuspendedStatus`, `resumeApprovedAt`, and optional `resumeNote` so manual recovery can be explicit instead of ad-hoc.
Interrupted items may stay in `in_progress` until the next run resumes them.
Executed items now pass through `verifying` before they can become `completed`.
When verification returns `needs_replan` and `attempt < retryPolicy.maxAttempts`, the runtime appends a follow-up queue item that inherits the task contract, carries `parentId` / `originVerdict` metadata, keeps a short `taskSummary`, and retries the same goal with a narrower inline delta replan prompt.
That replan prompt is now taxonomy-aware: acceptance failures focus on the missed target metric, constraint failures focus on the regressed bound, artifact failures focus on producing the missing evidence path, and command failures focus on making the declared verifier command itself pass, without replaying the full original execution prompt.
If the verifier keeps returning `needs_replan` after the max attempt budget is exhausted, the runtime converts the item to `failed` instead of spawning infinite follow-ups.
The harness keeps running until the queue has no pending or recoverable items left.
Generated refill items materialize their own execution prompt files under `.opencode/loop/prompts/generated/` before the loop continues.
Queue items may also provide an optional `model` override; otherwise the harness falls back to `opencode.jsonc` `command.build.model` when present.
Queue items may also provide inline `promptText` instead of `promptFile` when the task prompt is best stored directly in the queue.
Queue items may provide `riskLevel`, `reviewRequired`, and `escalationPolicy.onFailure` metadata so unattended runs can stop only on exception paths instead of front-loading manual gates.
Minimal verifier modes currently supported:

- `assistant_only`: legacy compatibility; successful execution reply is accepted and a verification artifact is still written
- `command_only`: run declared verification commands and require exit code `0`
- `command+artifact`: run declared commands, require declared artifacts, and optionally evaluate numeric `acceptance.metrics` / `constraints` rules from JSON artifacts

When a verifier command can be expressed either as a direct package-manager invocation or as a package script that shells back out to the same package manager, prefer the direct form. For example, prefer `node apps/api/scripts/run-test-file.mjs -- test/example.test.js` over `pnpm test:api:file -- test/example.test.js` (and the harness may normalize both `pnpm test:api:file -- ...` and `pnpm --filter @rag-system/api test:file -- ...` to that direct form) when both are equivalent. This reduces nested `pnpm -> script -> pnpm` resolution drift across non-interactive verifier shells.

`retryPolicy` can now also route verifier failures by category:

- `onAcceptanceFailure` / `onConstraintFailure`: override how metric-based verifier misses route
- `onCommandFailure`: route verification command failures into `failed`, `needs_review`, or `blocked_external`
- `onArtifactFailure`: route missing verification evidence into `failed`, `needs_review`, or `blocked_external`

Current verification failure taxonomy is intentionally small and stable:

- `verification_command`: command execution failed, with codes like `command_exit_nonzero` or `command_timeout`
- `verification_artifact`: required artifact evidence is missing, currently `artifact_missing`
- `verification_acceptance` / `verification_constraint`: JSON metric evidence missed an acceptance or constraint rule
- `replan_budget`: the item kept failing verifier-driven replans until `maxAttempts` was exhausted

Verifier-routed suspension is now supported in addition to replan/fail closeout: a queue item may intentionally send `verification_command` or `verification_artifact` outcomes into `blocked_external` or `needs_review` when the retry contract says that failure needs external unblock or manual judgment instead of another autonomous attempt.
The runtime also has a small default inference layer so obvious credential/network/dependency-style command failures can suspend into `blocked_external`, and obvious manual-approval artifact paths like `manual-review` / `approval` can suspend into `needs_review`, even when the planner omitted a per-category override.

The runtime accepts an optional `strategy` object with small callbacks for item selection and failure handling; the default strategy skips `reviewRequired` items, promotes them into `needs_review`, and also supports `failureMode: "defer"`, `failureMode: "review"`, plus `blocked_external` / `needs_review` escalation on failure.

Review-oriented item statuses:

- `needs_review`: human review/approval is required before this item should resume
- `blocked_external`: the item is blocked on credentials, external systems, or another dependency outside the harness
- `needs_replan`: verification evidence says the task ran but did not meet acceptance/constraint targets
- `failed`: verification commands or required artifacts failed before the task could be accepted

Common status transitions:

| From | Trigger | To |
|---|---|---|
| `pending` | picked by runtime | `in_progress` |
| `pending` | `reviewRequired=true` pre-run promotion | `needs_review` |
| `in_progress` | assistant reply captured | `verifying` |
| `in_progress` | timeout retry window exhausted and item reset | `pending` |
| `verifying` | verifier success | `completed` |
| `verifying` | acceptance/constraint miss within retry budget | `needs_replan` + appended follow-up |
| `verifying` | verifier routes to manual judgment | `needs_review` |
| `verifying` | verifier detects env/credential blocker | `blocked_external` |
| `verifying` | verifier hard fail or replan budget exhausted | `failed` |
| `needs_review` / `blocked_external` | manual `--resume-item` recovery | `pending` |

Handoff and verifier artifacts now share the same timestamp-and-item-id naming pattern inside `.opencode/loop/handoffs/`, which keeps scan order and replay evidence aligned.

The loop will continue processing later runnable items in the same queue, but it will not auto-refill a new planner wave while unresolved review/blocker/replan/failure items remain.
When you have manually cleared a `needs_review` or `blocked_external` exception, use `node .opencode/loop/cli.mjs --resume-item <item-id> --resume-note "what changed"` to move it back to `pending`; the next execution prompt will include that resume context.

## Notes

- Fresh pending items create a new session unless they explicitly share a `sessionAffinityKey` or compatible planner family with the immediately preceding completed item; interrupted items with `sessionId` resume the existing one.
- If an item already has `status: in_progress` and `sessionId`, the next run resumes that session instead of creating a second one.
- A runtime lock prevents two `opencode-loop` processes from consuming the same queue at the same time.
- The recommended unattended setup is `systemd --user` plus the thin `night-run.sh` wrapper, so crash restarts stay separate from normal queue-empty exits.
- `pnpm loop:start|stop|status` is the quickest day-to-day entrypoint for starting, stopping, or checking the user service and timer together, and it auto-links the user units if needed.
- After each completed queue item, commit the resulting changes so the work stays isolated, but do not rush to push or open a PR on every commit.
- If verification does not succeed, any commit created during execution is evidence-only: keep it local if needed, but never treat it as push-eligible until a later successful verification closes the same increment.
- Let the loop accumulate a small coherent wave of commits on `dev`, then choose a push/PR point only after validation is green and the branch is stable enough to minimize merge conflict risk.
- Prefer push/PR at wave closeout or other natural handoff points, not mid-increment.
- The runtime execution directive follows the same rule so the loop prompt itself keeps push/PR timing conservative.
- Prompt delivery is execution-oriented: the harness prepends a small execution directive and the repository `command.build.template` before the task-specific prompt, so the session is biased toward implementation instead of search-only output.
- Auto-refill stays intentionally conservative: by default it is disabled, and when enabled it still runs at most one planner pass per queue wave and appends at most two new items.
- Planner-generated items may now optionally return `riskLevel`, `reviewRequired`, and `escalationPolicy` fields in addition to the existing execution prompt fields.
- Adjacent planner-generated sibling items with the same `family` now automatically receive a shared `sessionAffinityKey`, and backlog materialization does the same for sibling tasks under the same parent item, so conservative session reuse does not rely on manual queue editing.
- Planner prompts now also embed a doc-derived planning snapshot from `AGENTS.md`, `docs/current-context.md`, `docs/current-progress.md`, the main planning doc, `README.md`, and `.opencode/loop/loop-contract-brief.md`, including a structured extraction of current objective/mainline, queue-ready candidate tasks, deferred work, recent progress notes, and `blocked_human_late` items, plus an explicit task-decomposition contract so refill generation stays grounded in current repo direction instead of generic backlog ideas.
- A repo-local backlog file now lives at `.opencode/loop/execution-backlog.jsonc` so remaining stage work can be kept close to the harness and later wired into planner-driven queue materialization.
- `node .opencode/loop/cli.mjs --materialize-wave <wave-id>` now turns a backlog wave's `queueContracts` into a queue draft under `.opencode/loop/materialized/`, so backlog-defined P5 waves can be promoted into executable queue items without hand-copying JSON.
- `node .opencode/loop/cli.mjs --materialize-append-wave <wave-id>` appends the same materialized items into `.opencode/loop/queue.json` while skipping existing item ids, making backlog-to-live-queue promotion one CLI step.
- The refill budget is persisted in `.opencode/loop/queue.json`, so restarting the service does not silently unlock another planner refill for the same already-drained manual wave.
- Planner output is audited with a dedicated `planner-auto-refill` handoff file next to normal queue handoffs.
- Terminal output now prints concise Chinese status lines with the key fields first, so item/session/result information is easy to scan at a glance.
- If the immediate `POST /session/:id/message` response is empty or is not an assistant message yet, it falls back to `GET /session/:id/message` and waits for the assistant reply before entering verification.
- Transient `fetch failed` network errors during message send or assistant polling now retry through the same wait path instead of aborting the whole loop immediately.
- Resume recovery is conservative: if an `in_progress` item does not already carry a tracked assistant `messageId`, the harness snapshots the latest preexisting assistant message, resends the queued prompt, and only accepts a newer assistant reply for completion.
- The self-test spins up a tiny mock server and verifies normal draining, resume recovery, guarded auto-refill, review escalation, verifier-based completion, automatic replan follow-up generation, exhausted replan budget fallback, structured verification failure taxonomy, explicit taxonomy-aware verifier routing into `blocked_external` / `needs_review`, the small default inference layer for obvious external blockers or manual-review artifacts, and manual resume of suspended exception items.
- Repo `opencode.jsonc` is parsed through the local JSONC helper so command config comments stay supported without adding a heavier dependency.
