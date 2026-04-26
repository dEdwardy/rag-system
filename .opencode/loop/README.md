## Loop Workspace

- `materialized/`: active wave snapshots only.
- `handoffs/`: active handoff drop zone only.
- `prompts/generated/`: active recovery prompts only.
- `archive/`: historical loop records.
- `loop-run.log`: runtime log, not default context.

### Default Read

- `materialized/` only when a wave is still actionable
- the newest file in `handoffs/` only when a run is in progress
- a short human summary of current mode, boundaries, and next step

### Default Skip

- `archive/`
- old generated prompts
- old handoffs
- old wave snapshots
- `loop-run.log`

Only load archived items when tracing a specific regression, decision, or interrupted run.

### Validation Rule

- queue items must use the repository's Vitest-based validation path for tests
- queue items should run exactly one small focused validation command only; do not chain broad suites, multi-step fallback commands, or mixed checks in a single item
- prefer direct focused commands such as `pnpm --filter @rag-system/api exec vitest run test/<file>.test.js` or `pnpm --filter @rag-system/web exec vitest run test/<file>.test.js`
- prefer file-scoped or same-area focused Vitest invocations over package-wide aliases so the validation surface stays obvious in the queue item itself
- if the needed behavior is still covered only by a legacy `node:test` command or alias, migrate that coverage to Vitest before creating the queue item instead of queueing the legacy command first
- do not create new queue items that validate with raw `node --test`, `pnpm test:harness`, or other legacy aliases that still resolve to `node:test`
- if an old test file still only runs through the legacy path, treat migrating or replacing that validation path as part of the task before queueing it

### Recovery Rule

- when an item fails because validation is broad or legacy, recover by rewriting the item to one focused command and a Vitest-based test command
- do not recover by adding a second validation command, appending a broad suite, or falling back to `node --test`; rewrite the item so the next attempt still validates with one small focused Vitest command
- keep recovery follow-ups small and bounded: one fix wave, one focused validation command, then requeue
- if the original item bundled unrelated checks together, split the retry into the next single actionable increment rather than preserving the old wider validation surface

### Harness Notes

- harness/known-issues.md: observed reliability gaps and follow-up optimizations from unattended loop runs.
