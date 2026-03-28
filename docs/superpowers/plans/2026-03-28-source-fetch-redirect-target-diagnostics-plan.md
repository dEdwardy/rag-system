# Source Fetch Redirect Target Diagnostics Plan

> **For agentic workers:** implement as one narrow backend diagnostics increment with one focused regression validation.

## Scope

Improve redirect-follow diagnostics in `fetch-with-retry` so invalid/non-`http(s)` `Location` failures include bounded raw redirect target text.

## Steps

- [ ] Update redirect-follow error wording in `apps/api/src/infra/http/fetch-with-retry.ts` to include bounded raw `Location` target for invalid/non-`http(s)` cases.
- [ ] Add one focused regression in `apps/api/test/fetch-with-retry.test.js`.
- [ ] Run one focused validation command:
  - `pnpm test:api:file -- test/fetch-with-retry.test.js`
- [ ] Update `docs/current-progress.md` only if shipped diagnostic wording needs recording.

## Out of Scope

- Retry-policy rewrites
- Source-family expansion
- Unrelated cleanup/refactor
