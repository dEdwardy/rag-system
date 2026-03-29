Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, `docs/current-dev-setup.md`, and `README.md` before proposing follow-up queue work.

Current planning bias:
- stay on one narrow mainline increment at a time
- prefer backend/API-first closeout work over new expansion
- prefer additive, behavior-preserving readability/diagnostics/contract alignment work
- do not open a new architecture track, new source family, retrieval semantic rewrite, schema/persistence redesign, or broad UI pass

When choosing the next items:
- use the latest completed queue items and handoff results as the immediate context
- use the doc-derived structured extraction snapshot first: current objective, active mainline, executable candidates, deferred candidates, blocked-human-late candidates
- continue the same wave if there is still a small concrete gap to close
- prefer tasks that name exact files or codepaths and can be finished with one focused validation command
- prefer tasks that also keep `docs/current-progress.md` aligned when behavior or workflow changes
- prefer executable candidates first; keep human-needed items in `blocked_human_late` until the executable wave is mostly drained
- avoid repeating already-completed work or proposing cleanup-only chores

Return JSON array only.
Each item must be an object with:
- `title`: short concrete task title
- `family`: stable family prefix such as `trace`, `loop`, `docs`, `contract`, `embedding`, `source`
- `kind`: optional stable task kind such as `build_increment`, `contract_sync`, `eval_guard`
- `goal`: one-sentence task goal that states what success means
- `prompt`: execution-ready build prompt for `rag-build`
- `agent`: usually `rag-build`
- `model`: omit unless a non-default model is clearly needed
- `acceptance`: optional object, preferably with machine-checkable metrics such as `{ "metrics": { "score": ">=0.9" } }`
- `constraints`: optional object with guardrails such as latency/cost thresholds
- `verification`: optional object; supported shape is `{ "mode": "assistant_only"|"command_only"|"command+artifact", "commands": [...], "artifacts": [...] }`
- `retryPolicy`: optional object; currently supports `{ "maxAttempts": number, "onVerificationFail": "needs_replan"|"failed"|"needs_review"|"blocked_external", "onAcceptanceFailure": ..., "onConstraintFailure": ..., "onCommandFailure": ..., "onArtifactFailure": ... }`; omit the per-category overrides when the default runtime heuristics should infer obvious external blocker or manual-review artifact cases
- `riskLevel`: optional `low|medium|high|critical`
- `reviewRequired`: optional boolean; set `true` only when the item should pause for human review before execution
- `escalationPolicy`: optional object; currently only `{"onFailure":"defer"|"needs_review"|"blocked_external"|"throw"}` is supported

Prompt requirements:
- tell the builder to inspect the relevant code path first, then make the smallest concrete change
- name the target files, tests, or docs when they are inferable
- require exactly one focused validation command
- require reporting exact changed files and command results
- bias the prompt toward one safe executable increment, not open-ended exploration
- keep scope to one meaningful increment; no bundled refactors

Hard limits:
- return at most the requested number of items
- if no good next task exists, return `[]`
- do not emit markdown fences, prose, or explanations outside the JSON array
