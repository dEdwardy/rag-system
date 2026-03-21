# Ask Chain E2E Design

## Task Identification

This design covers the current first unchecked task in `docs/current-progress.md`: add a more complete ask-chain E2E validation increment.

## Goal

Add one dedicated backend/API end-to-end test that validates the ask workflow more completely: document-backed grounded asking, conversation reuse, message persistence, trace persistence, and post-reindex ask continuity.

## Scope

- Backend/API only
- Focus on the ask pipeline as the subject under test
- Reuse the real local HTTP server, database, Redis worker, storage, and file-backed vector path
- Keep current client priority aligned to `PC Web`; mobile adaptation remains out of scope
- Add targeted documentation updates for the new validation coverage

## Non-Goals

- Do not add frontend or browser automation
- Do not redesign ask APIs, retrieval strategy, or trace schema
- Do not broaden into unrelated mobile work
- Do not refactor existing integration helpers unless a tiny local helper is needed inside the new test file

## Current State

The repository already has:

- a broader upload -> ready -> ask -> trace HTTP integration test in `apps/api/test/api-flow.test.js`
- ask orchestration and failure-path coverage in `apps/api/test/ask-success.test.js` and `apps/api/test/ask-failures.test.js`
- a dedicated document-chain E2E in `apps/api/test/document-chain-e2e.test.js`

What is still missing is a dedicated ask-chain E2E test that treats the ask workflow itself as the subject under test instead of as one assertion segment inside the broader API flow.

## Chosen Approach

Add one dedicated Node HTTP integration test that:

1. seeds the local default records
2. starts the built API against isolated storage and queue prefixes
3. uploads a deterministic markdown document and waits for it to become `ready`
4. sends a first ask request and verifies grounded response fields, citations, retrieved chunks, context groups, and trace persistence
5. sends a second ask request into the same conversation and verifies conversation reuse, message growth, trace growth, and continued retrieval grounding
6. reindexes the source document and verifies a later ask in the same conversation still retrieves the uploaded marker correctly

This keeps the increment aligned to the current first unchecked task and avoids conflating ask E2E with document-only workflow coverage.

## Alternatives Considered

### 1. Keep extending `apps/api/test/api-flow.test.js`

Pros:

- fewer files
- reuses current bootstrap logic

Cons:

- leaves ask-chain coverage coupled to document-chain assertions
- makes the existing integration test harder to reason about
- obscures the current unchecked task boundary

Rejected because the missing task is specifically a more complete ask-chain E2E increment.

### 2. Add only more unit/integration assertions around `AskAssistantService`

Pros:

- smaller and faster

Cons:

- not true E2E
- does not validate real HTTP behavior, seeded defaults, queue-backed ingestion, or persisted conversation/trace endpoints together

Rejected because it does not satisfy the missing end-to-end coverage.

### 3. Add a dedicated ask-chain HTTP integration test

Pros:

- directly validates the missing workflow
- keeps scope separate from document-chain E2E
- exercises the real API contracts the web app depends on

Cons:

- duplicates a small amount of HTTP bootstrap logic from existing tests

Chosen because it best matches the current unchecked task.

## Design

### Test coverage

The new test should assert:

- upload through `POST /knowledge-bases/default-kb/documents/upload` succeeds and reaches `ready`
- the first `POST /assistants/default-assistant/ask` returns:
  - `conversationId`
  - `traceId`
  - grounded or insufficient-context status
  - citations
  - retrieved chunks containing the uploaded marker
  - context groups containing the uploaded marker
  - quality evaluation fields
- `GET /conversations/:id/messages` returns two messages after the first ask, both linked to the same trace
- `GET /conversations/:id/traces` contains the trace persisted by the first ask
- `GET /traces/:id` exposes rewritten query, citations, retrieval scores, and quality evaluation
- a second ask with the same `conversationId` reuses the conversation and expands message/trace history
- reindexing the source document does not break a later ask in the same conversation

### Implementation strategy

Prefer reusing the helper style already present in:

- `apps/api/test/api-flow.test.js`
- `apps/api/test/document-chain-e2e.test.js`

Keep the new test in its own file instead of extracting shared helpers in this round. If local helper duplication is needed, keep it private to the test file.

### Documentation

Update:

- `docs/current-progress.md` to mark the ask-chain E2E task complete and record the new dedicated coverage
- `docs/current-dev-setup.md` to document the focused command for this test

## Files Expected To Change

- Create: `apps/api/test/ask-chain-e2e.test.js`
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

## Validation

- `pnpm --filter @rag-system/api build`
- `node --test --test-concurrency=1 apps/api/test/ask-chain-e2e.test.js`

## Acceptance Criteria

- A dedicated API E2E test covers the ask workflow without collapsing back into the generic API flow test
- The test proves grounded ask behavior, conversation reuse, message persistence, trace persistence, and reindex continuity through real HTTP endpoints
- `docs/current-progress.md` reflects this task as complete
- `docs/current-dev-setup.md` documents the focused validation command
