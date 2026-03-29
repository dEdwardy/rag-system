# Embedding Base URL Guardrail Plan

> **For agentic workers:** implement as one narrow backend-first increment with focused regression validation only.

## Scope

Implement one guardrail in embedding runtime config: reject malformed or non-`http(s)` values for configured `OPENAI_BASE_URL` / `OLLAMA_BASE_URL`.

## Steps

- [ ] Add env-specific base URL validation in `apps/api/src/infra/embedding/embedding-runtime-config.ts`.
- [ ] Add/adjust focused regression coverage in `apps/api/test/embedding-runtime-config.test.js` for invalid `OPENAI_BASE_URL` and `OLLAMA_BASE_URL`.
- [ ] Run one focused validation command:
  - `pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/embedding-runtime-config.test.js`
- [ ] Update `docs/current-progress.md` with a short shipped-behavior note after tests pass.

## Out of Scope

- Provider-order changes
- Embedding redesign/refactor
- Additional validation suites beyond the focused command above
