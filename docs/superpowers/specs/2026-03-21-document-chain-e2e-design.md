# Document Chain E2E Design

## Task Identification

This design covers the current first unchecked task in `docs/current-progress.md`: add a more complete document-chain E2E validation increment.

## Goal

Add one backend/API end-to-end test that validates the document lifecycle more completely: upload, ingestion readiness, document listing, chunk inspection, reindex, and deletion.

## Scope

- Backend/API only
- Focus on the document pipeline before ask
- Reuse the real local HTTP server, database, Redis worker, storage, and file-backed vector path
- Add targeted documentation updates for the new validation coverage

## Non-Goals

- Do not expand into ask-chain E2E
- Do not add frontend or browser automation
- Do not redesign document APIs
- Do not refactor unrelated ingestion or indexing code
- Do not treat mobile adaptation as in-scope

## Current State

The repository already has:

- orchestrator-level ingestion coverage in `apps/api/test/ingestion.orchestrator.test.js`
- a broader upload -> ready -> ask -> trace HTTP integration test in `apps/api/test/api-flow.test.js`

What is still missing is a dedicated end-to-end test that treats the document workflow itself as the subject under test, without coupling the result to the ask path.

## Chosen Approach

Add a dedicated Node HTTP integration test that:

1. seeds the local default records
2. starts the built API against isolated storage and queue prefixes
3. verifies the default knowledge base can be fetched
4. uploads a markdown document through the real upload endpoint
5. polls until the document reaches `ready`
6. verifies knowledge-base document listing and chunk inspection
7. triggers `reindex` and verifies the document becomes `ready` again with the same content retrievable through chunk APIs
8. deletes the document and verifies the knowledge-base document list is empty and the document endpoints return `404`

This keeps the increment aligned to the current first unchecked task and leaves the later ask E2E task intact.

## Alternatives Considered

### 1. Extend `apps/api/test/api-flow.test.js`

Pros:

- reuses current HTTP setup
- fewer files

Cons:

- keeps document coverage coupled to ask coverage
- makes the current test harder to reason about
- risks blurring the boundary with the next unchecked ask E2E task

Rejected because the missing task is specifically document-chain E2E.

### 2. Add only more ingestion orchestrator assertions

Pros:

- smaller and faster

Cons:

- not true E2E
- does not verify HTTP behavior, queue startup, list endpoints, reindex API, or delete API

Rejected because it does not satisfy the missing end-to-end coverage.

### 3. Add a dedicated document-chain HTTP integration test

Pros:

- directly validates the missing workflow
- keeps scope cleanly separated from ask E2E
- exercises the real API contracts the web app depends on

Cons:

- duplicates a small amount of server bootstrap logic from existing integration tests

Chosen because it best matches the current unchecked task.

## Design

### Test coverage

The new test should assert:

- `GET /knowledge-bases/default-kb` succeeds
- `GET /knowledge-bases/default-kb/documents` is initially empty after reset
- `POST /knowledge-bases/default-kb/documents/upload` creates a document
- `GET /documents/:id` eventually reaches `ready`
- `GET /knowledge-bases/default-kb/documents` includes the uploaded document with `ready` status
- `GET /documents/:id/chunks` returns at least one chunk containing the uploaded marker
- `POST /documents/:id/reindex` re-enters processing and returns to `ready`
- chunk inspection still returns the marker after reindex
- `DELETE /documents/:id` succeeds
- `GET /documents/:id` and `GET /documents/:id/chunks` return `404` after deletion

### Implementation strategy

Prefer reusing the helper style already present in `apps/api/test/api-flow.test.js`:

- isolated `STORAGE_ROOT`
- isolated `QUEUE_PREFIX`
- polling helpers for health and document readiness
- seeded default records through Prisma seed script

If that duplication becomes noisy, extract only a very small shared helper later. Do not start with shared test refactors in this round.

### Documentation

Update:

- `docs/current-progress.md` to mark the document-chain E2E task complete and record the new dedicated coverage
- `docs/current-dev-setup.md` to document the focused command for this test

## Files Expected To Change

- Create: `apps/api/test/document-chain-e2e.test.js`
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

## Validation

- `pnpm --filter @rag-system/api build`
- `node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js`

## Acceptance Criteria

- A dedicated API E2E test covers the document workflow without invoking ask
- The test proves upload, readiness, listing, chunk retrieval, reindex, and deletion through real HTTP endpoints
- `docs/current-progress.md` reflects this task as complete
- `docs/current-dev-setup.md` documents the focused validation command
