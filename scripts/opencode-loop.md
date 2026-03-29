# OpenCode Loop

> Doc role: `harness`
> Usage: local queue runner for one OpenCode increment at a time.

## Purpose

`scripts/opencode-loop.mjs` is a small repo-local harness entrypoint used to assist development, not a product runtime path. It:

- reads `.opencode/loop/queue.json`
- drains queue items one by one until the queue is empty
- can ask the `plan` command for one guarded refill pass after the queue empties
- creates or resumes an OpenCode session per item
- sends the item prompt to the configured agent
- writes a handoff markdown file
- marks each queue item as completed

It intentionally stays narrow: one queue item, one session, one handoff.

## Files It Uses

- `.opencode/loop/queue.json` - queue state and cursor
- `.opencode/loop/prompts/*.md` - prompt templates
- `.opencode/loop/handoffs/*.md` - generated run handoffs
- `.opencode/loop.lock/` - runtime lock directory that prevents concurrent runs
- `scripts/opencode-loop/queue.mjs` - queue schema, read/write, selection, and completion helpers
- `pnpm loop:start|stop|status` - short control commands for the systemd user units
- `scripts/opencode-loop/night-run.sh` - thin wrapper for `systemd --user` or manual night runs; resolves pnpm via corepack/Volta/local shims
- `scripts/opencode-loop/systemd/opencode-loop.service` - user service template with crash restart behavior
- `scripts/opencode-loop/systemd/opencode-loop.timer` - nightly timer template
- `scripts/opencode-loop/planner.mjs` - guarded queue refill planner and generated-prompt writer
- `scripts/opencode-loop/jsonc.mjs` - lightweight JSONC comment-stripping helper for repo config
- `scripts/opencode-loop/runtime.mjs` - queue, lock, and OpenCode API logic
- `scripts/opencode-loop/self-test.mjs` - self-test harness and mock server
- `scripts/opencode-loop/strategy.mjs` - small strategy/callback normalization layer for selection and failure handling

Session titles use the shape `loop #<queue-index> <item-id> YYYY-MM-DD HH:MM:SS` so the active queue item is easier to identify at a glance.

## Environment

- `OPENCODE_BASE_URL` - OpenCode server URL, default `http://127.0.0.1:4096`
- `OPENCODE_SERVER_USERNAME` - basic auth username when needed
- `OPENCODE_SERVER_PASSWORD` - basic auth password when needed
- `OPENCODE_LOOP_MESSAGE_WAIT_MS` - max wait for an assistant message
- `OPENCODE_LOOP_POLL_MS` - polling interval while waiting
- `OPENCODE_LOOP_AUTO_REFILL_MAX_CYCLES` - max planner refill passes per queue wave; default `1`, `0` disables refill. The bundled systemd service also pins this to `1` for a conservative one-closeout-pass policy.
- `OPENCODE_LOOP_AUTO_REFILL_MAX_ITEMS` - max new queue items each refill pass may append; default `2`

## Commands

```bash
pnpm opencode:loop
node scripts/opencode-loop.mjs --self-test
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
      "title": "Read-model metadata convergence increment",
      "agent": "rag-build",
      "promptFile": "prompts/read-model-metadata-build.md",
      "status": "pending"
    }
  ]
}
```

## Prompt Family Guidance

Keep queue prompts task-family specific so metadata work does not silently fall back to the generic build template:

- `prompts/build.md`: generic small build increment
- `prompts/build-small-increment.md`: harness/runtime maintenance increments under `scripts/opencode-loop*`
- `prompts/read-model-metadata-build.md`: read-model / metadata convergence build increments
- `prompts/plan-next.md`: strict JSON-only planner prompt for guarded queue refill

For read-model / metadata queue items, prefer `prompts/read-model-metadata-build.md` instead of `prompts/build.md`.

Completed items are enriched with `sessionId`, `messageId`, `handoffPath`, and `completedAt`.
Queue records also carry readable `*Display` timestamp companions such as `startedAtDisplay`, `messageReceivedAtDisplay`, and `completedAtDisplay`.
Interrupted items may stay in `in_progress` until the next run resumes them.
The harness keeps running until the queue has no pending or recoverable items left.
Generated refill items materialize their own execution prompt files under `.opencode/loop/prompts/generated/` before the loop continues.
Queue items may also provide an optional `model` override; otherwise the harness falls back to `opencode.jsonc` `command.build.model` when present.
Queue items may also provide inline `promptText` instead of `promptFile` when the task prompt is best stored directly in the queue.
The runtime accepts an optional `strategy` object with small callbacks for item selection and failure handling; the default strategy keeps current behavior but can defer items whose queue metadata sets `failureMode: "defer"`.

## Notes

- Fresh pending items create a new session; interrupted items with `sessionId` resume the existing one.
- If an item already has `status: in_progress` and `sessionId`, the next run resumes that session instead of creating a second one.
- A runtime lock prevents two `opencode-loop` processes from consuming the same queue at the same time.
- The recommended unattended setup is `systemd --user` plus the thin `night-run.sh` wrapper, so crash restarts stay separate from normal queue-empty exits.
- `pnpm loop:start|stop|status` is the quickest day-to-day entrypoint for starting, stopping, or checking the user service and timer together, and it auto-links the user units if needed.
- After each completed queue item, commit the resulting changes so the work stays isolated, but do not rush to push or open a PR on every commit.
- Let the loop accumulate a small coherent wave of commits on `dev`, then choose a push/PR point only after validation is green and the branch is stable enough to minimize merge conflict risk.
- Prefer push/PR at wave closeout or other natural handoff points, not mid-increment.
- The runtime execution directive follows the same rule so the loop prompt itself keeps push/PR timing conservative.
- Prompt delivery is execution-oriented: the harness prepends a small execution directive and the repository `command.build.template` before the task-specific prompt, so the session is biased toward implementation instead of search-only output.
- Auto-refill stays intentionally conservative: by default it runs at most one planner pass per queue wave and appends at most two new items.
- The refill budget is persisted in `.opencode/loop/queue.json`, so restarting the service does not silently unlock another planner refill for the same already-drained manual wave.
- Planner output is audited with a dedicated `planner-auto-refill` handoff file next to normal queue handoffs.
- Terminal output now prints concise Chinese status lines with the key fields first, so item/session/result information is easy to scan at a glance.
- If the immediate `POST /session/:id/message` response is empty or is not an assistant message yet, it falls back to `GET /session/:id/message` and waits for the assistant reply before marking the item complete.
- Transient `fetch failed` network errors during message send or assistant polling now retry through the same wait path instead of aborting the whole loop immediately.
- Resume recovery is conservative: if an `in_progress` item does not already carry a tracked assistant `messageId`, the harness snapshots the latest preexisting assistant message, resends the queued prompt, and only accepts a newer assistant reply for completion.
- The self-test spins up a tiny mock server and verifies normal draining, resume recovery, and one guarded auto-refill pass.
- Repo `opencode.jsonc` is parsed through the local JSONC helper so command config comments stay supported without adding a heavier dependency.
