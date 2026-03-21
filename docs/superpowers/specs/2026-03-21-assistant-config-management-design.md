# Assistant Config Management Design

## Task Identification

This spec implements the current first unchecked item in `docs/current-progress.md` section `3.3`: `更完整的 assistant / config 管理`.

## Goal

Upgrade the web `Assistant` page from a basic assistant editor into a fuller configuration surface that can manage:

- assistant answer policy fields already supported by the backend
- retrieval profile metadata filters

The change should stay incremental, reuse current APIs where possible, and avoid broad frontend refactors.

## Scope

In scope:

- web assistant page updates in `apps/web`
- frontend types and API hook payload updates for `answerPolicyJson` and `filtersJson`
- a small backend/API enhancement so `filtersJson` can be explicitly cleared
- focused regression tests for the new config serialization behavior
- incremental docs updates

Out of scope:

- new pages or major UI redesign
- retrieval `strategyJson` editing
- multi-assistant selection flows
- new backend endpoints
- full frontend component-test infrastructure setup

## Current State

The current Assistant page supports:

- assistant name
- assistant description
- assistant status
- system prompt
- retrieval topK / chunkWindow / enableHybrid / enableRerank / scoreThreshold

But it does not expose:

- the richer `answerPolicyJson` fields added on the backend
- retrieval profile `filtersJson`

There is also a backend edge case: `PATCH /retrieval-profiles/:id` can set `filtersJson`, but it cannot currently clear it through the API because an empty filter payload is normalized away before persistence.

## Design

### 1. Extend The Web API Contract

Add typed frontend support for:

- `Assistant.answerPolicyJson`
- `RetrievalProfile.filtersJson`

Also widen the mutation payload types so the Assistant page can submit these fields explicitly.

This keeps the UI aligned with the current backend contract instead of relying on implicit `any`-style JSON handling.

### 2. Keep The UI Incremental And Form-Oriented

Do not introduce a new visual pattern. Keep the current single-page Assistant form and add two focused sections:

1. `Answer policy`
   - response style
   - tone
   - output format
   - language
   - citation mode
   - max citations
   - no-answer behavior
   - include missing information

2. `Retrieval filters`
   - document id include/exclude
   - section title include/exclude/contains
   - page number include/exclude/min/max

For list-like filters, use simple textarea inputs with comma-or-newline parsing. This is less fancy than chip editors, but it matches current scope, keeps the page lightweight, and is sufficient for internal config management.

### 3. Extract Deterministic Serialization Helpers

Move the policy/filter defaulting and payload-building logic out of the JSX page into a small helper module. The helper should:

- resolve default answer-policy values when the assistant has no `answerPolicyJson`
- map existing JSON values into textarea-friendly form strings
- parse comma/newline-separated string inputs back into normalized arrays
- build `PATCH /assistants/:id` and `PATCH /retrieval-profiles/:id` payloads deterministically
- return `filtersJson: null` when the user clears all retrieval filter inputs

This keeps the page readable and gives us a place for focused tests without introducing a larger test framework.

### 4. Small Backend Support For Clearing Filters

Make `PATCH /retrieval-profiles/:id` accept `filtersJson: null` and persist that as a cleared value.

This is the only backend change needed for this task. It prevents a broken UX where the page could add filters but not fully remove them.

### 5. Validation Strategy

Use focused tests and builds:

- a small web serialization test for Assistant config helper behavior
- a focused backend retrieval-profile filter API regression test for clearing filters
- relevant web typecheck/build

## Files Expected To Change

- `apps/web/src/types/api.ts`
- `apps/web/src/features/api/hooks.ts`
- `apps/web/src/pages/assistant/AssistantPage.tsx`
- `apps/web/src/pages/assistant/assistant-config-form.ts`
- `apps/web/src/i18n/messages.ts`
- `apps/web/test/assistant-config.test.js`
- `apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts`
- `apps/api/src/modules/retrieval-profiles/retrieval-profiles.service.ts`
- `apps/api/test/retrieval-profile-filters.test.js`
- `docs/current-dev-setup.md`
- `docs/current-progress.md`

## Success Criteria

- the Assistant page can edit the richer assistant answer policy fields
- the Assistant page can edit retrieval profile metadata filters
- clearing all retrieval filters from the page results in persisted `filtersJson = null`
- the change stays within the current Assistant page instead of introducing a new management flow
- `docs/current-progress.md` can mark `更完整的 assistant / config 管理` complete
