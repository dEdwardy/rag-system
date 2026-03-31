# Loop Contract Brief

> Doc role: `harness-brief`
> Usage: short planner-facing contract for default loop context ingestion.

## Purpose

- `.opencode/loop/cli.mjs` is a local queue runner for development assistance, not a product runtime path.
- Keep scope narrow: one queue item at a time, one handoff per item, conservative session reuse only for adjacent related items.
- Default posture is cost-aware and reversible: small increments, focused validation, explicit review/blocker routing, no broad autonomous reshaping.

## Default Runtime Contract

- Read `.opencode/loop/queue.json`, pick the next runnable item, execute it, verify it, then write a handoff.
- Fresh items normally create a new session.
- Adjacent related items may reuse the previous session only when they share `sessionAffinityKey` or a compatible planner family.
- Interrupted `in_progress` items with a saved `sessionId` resume the existing session.
- Verification must pass before an item becomes `completed`.

## Cost-Control Defaults

- `OPENCODE_LOOP_AUTO_REFILL_MAX_CYCLES` default is `1`, so planner auto-refill can extend the queue when the current wave drains.
- Verifier-driven replan prompts are delta-sized and do not replay the full prior execution prompt.
- Planner-generated sibling items with the same family, and backlog-materialized sibling items under the same parent, automatically receive a shared `sessionAffinityKey`.

## Planning Boundaries

- Continue the current documented mainline before opening a new track.
- Prefer one small executable increment per queue item.
- Prefer exact files, one focused validation command, and explicit closeout boundaries.
- Do not generate broad refactors, speculative architecture, or multi-theme wave expansion.
- Do not auto-refill a new planner wave while unresolved review/blocker/replan/failure items remain.

## Main Files

- Live queue: `.opencode/loop/queue.json`
- Planner source prompt: `.opencode/loop/prompts/plan-next.md`
- Full harness docs: `.opencode/loop/README.md`
- Backlog source: `.opencode/loop/execution-backlog.jsonc`
- Runtime implementation: `.opencode/loop/harness/runtime.mjs`
- Planner implementation: `.opencode/loop/harness/planner.mjs`

## Focused Validation

- Harness smoke test: `node .opencode/loop/cli.mjs --self-test`
- Queue append/materialize checks: `node .opencode/loop/cli.mjs --materialize-wave <wave-id>` or `--materialize-append-wave <wave-id>`
