# OpenCode Loop

> Doc role: `harness`
> Usage: local queue runner for one OpenCode increment at a time.

## Purpose

`scripts/opencode-loop.mjs` is a small harness-style entrypoint that:

- reads `.opencode/loop/queue.json`
- drains queue items one by one until the queue is empty
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
- `scripts/opencode-loop/runtime.mjs` - queue, lock, and OpenCode API logic
- `scripts/opencode-loop/self-test.mjs` - self-test harness and mock server

## Environment

- `OPENCODE_BASE_URL` - OpenCode server URL, default `http://127.0.0.1:4096`
- `OPENCODE_SERVER_USERNAME` - basic auth username when needed
- `OPENCODE_SERVER_PASSWORD` - basic auth password when needed
- `OPENCODE_LOOP_MESSAGE_WAIT_MS` - max wait for an assistant message
- `OPENCODE_LOOP_POLL_MS` - polling interval while waiting

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
      "title": "Run rag-build on default prompt",
      "agent": "rag-build",
      "promptFile": "prompts/build.md",
      "status": "pending"
    }
  ]
}
```

Completed items are enriched with `sessionId`, `messageId`, `handoffPath`, and `completedAt`.
Queue records also carry readable `*Display` timestamp companions such as `startedAtDisplay`, `messageReceivedAtDisplay`, and `completedAtDisplay`.
Interrupted items may stay in `in_progress` until the next run resumes them.
The harness keeps running until the queue has no pending or recoverable items left.
Queue items may also provide an optional `model` override; otherwise the harness falls back to `opencode.jsonc` `command.build.model` when present.

## Notes

- Fresh pending items create a new session; interrupted items with `sessionId` resume the existing one.
- If an item already has `status: in_progress` and `sessionId`, the next run resumes that session instead of creating a second one.
- A runtime lock prevents two `opencode-loop` processes from consuming the same queue at the same time.
- The recommended unattended setup is `systemd --user` plus the thin `night-run.sh` wrapper, so crash restarts stay separate from normal queue-empty exits.
- `pnpm loop:start|stop|status` is the quickest day-to-day entrypoint for starting, stopping, or checking the user service and timer together, and it auto-links the user units if needed.
- After each completed queue item, commit the resulting changes before the loop moves on to the next item, so the checkout does not accumulate unfinished work.
- Prompt delivery is execution-oriented: the harness prepends a small execution directive and the repository `command.build.template` before the task-specific prompt, so the session is biased toward implementation instead of search-only output.
- Terminal output now prints concise Chinese status lines with the key fields first, so item/session/result information is easy to scan at a glance.
- If the immediate `POST /session/:id/message` response is empty or is not an assistant message yet, it falls back to `GET /session/:id/message` and waits for the assistant reply before marking the item complete.
- Transient `fetch failed` network errors during message send or assistant polling now retry through the same wait path instead of aborting the whole loop immediately.
- Resume recovery is conservative: if an `in_progress` item does not already carry a tracked assistant `messageId`, the harness snapshots the latest preexisting assistant message, resends the queued prompt, and only accepts a newer assistant reply for completion.
- The self-test spins up a tiny mock server and verifies draining multiple items plus resume recovery.
