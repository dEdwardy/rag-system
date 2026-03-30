Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, and the trace summary readability code before editing.

Task: normalize unknown and fallback wording for trace readability labels.

Focus files:
- `apps/api/src/modules/traces/traces.service.ts`
- `apps/api/test/traces.service.test.js`

Rules:
- only adjust wording, not semantics
- preserve raw values when they exist
- keep the sentence style consistent with the rest of the trace read-model

Deliverable:
- unify the fallback wording for the targeted labels
- update focused tests for the wording change
