Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, and the web trace contract tests before editing.

Task: keep the web contract aligned with the latest readable `TraceSummary` fields.

Focus files:
- `apps/web/test/trace-summary-contract.test.js`
- `apps/web/src/types/api.ts`
- any trace display component that consumes the readable fields

Rules:
- keep the change additive and behavior-preserving
- do not introduce a UI redesign
- only touch the current contract surface and the smallest related display path

Deliverable:
- web types and tests should guard the current trace summary field set
- run one small web-focused validation command and report the result
