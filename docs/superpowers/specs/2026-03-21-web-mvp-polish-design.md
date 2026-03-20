# Web MVP Polish Design

**Goal**

Improve the current web MVP without changing backend scope by making the Knowledge Base page more informative and aligning its loading, empty, and error states with the rest of the app.

**Context**

The current web app already has functional `Chat`, `Documents`, `Document Detail`, `Trace Detail`, and `Assistant` pages. The weakest page in the current MVP is `Knowledge Base`, which only shows the default knowledge base name, description, document count, and chunk count. It does not yet help the user understand the operational state of the knowledge base or navigate to the next useful action.

The backend already exposes enough data for a stronger summary page:

- `GET /knowledge-bases`
- `GET /knowledge-bases/:id/documents`
- `GET /assistants`

This means the next iteration should stay frontend-only and avoid introducing new API or schema work.

## Chosen Approach

Use the existing frontend patterns and data hooks to turn the `Knowledge Base` page into a compact operational overview page. The page should compute summary metrics from documents and assistants already loaded in the browser, then surface clear navigation to the `Documents` and `Assistant` pages.

At the same time, align this page with the existing `StatePanel` pattern so loading, missing data, and error handling behave consistently with the other pages.

## Alternatives Considered

### 1. Add a dedicated backend summary endpoint

Pros:

- Cleaner server-side aggregation
- Lower frontend derivation logic

Cons:

- Expands backend scope unnecessarily
- Adds contract work while current backend priorities are elsewhere

Rejected for this round because the existing APIs already provide enough data.

### 2. Keep the page minimal and move directly to broader frontend polish

Pros:

- Smallest change set

Cons:

- Leaves the weakest MVP page underpowered
- Misses an easy win using already available data

Rejected because this would postpone a high-value, low-risk improvement.

### 3. Frontend-only derived summary with stronger state handling

Pros:

- Fits current scope
- Reuses existing patterns
- No backend changes required

Cons:

- Some aggregation logic stays in the page layer

Chosen because it delivers the most value with the least scope expansion.

## Design

### Knowledge Base Page

The page will become a structured overview with three layers:

1. Core identity card
   - name
   - description
   - last updated time
   - current status

2. Summary metrics cards
   - total documents
   - total chunks
   - number of ready documents
   - number of processing documents
   - number of failed documents
   - number of assistants bound to the knowledge base

3. Action-oriented sections
   - a short status summary explaining whether the knowledge base is healthy, still processing, or has failed documents
   - direct navigation actions to `Documents` and `Assistant`

This keeps the page within current MVP expectations while making it much more useful.

### State Handling

The page should use `StatePanel` instead of bare loaders wherever possible:

- loading knowledge base data
- knowledge base load failure
- no knowledge base found
- document load failure

This matches the existing application language and avoids a page that feels visually unfinished.

### i18n

All new visible strings should go through the existing in-repo i18n dictionary. No new hard-coded copy should be added directly to the page.

### Documentation

`docs/current-progress.md` should be updated to reflect that the Knowledge Base page is no longer just a basic placeholder summary. The wording should stay practical and incremental.

## Files

### Modify

- `apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx`
- `apps/web/src/features/api/hooks.ts`
- `apps/web/src/i18n/messages.ts`
- `docs/current-progress.md`

### Reuse

- `apps/web/src/components/StatePanel.tsx`

## Validation

- `pnpm --filter @rag-system/web typecheck`
- `pnpm --filter @rag-system/web build`

## Non-Goals

- No backend endpoint additions
- No `packages/shared` changes
- No auth, multi-tenant, or permissions work
- No large visual redesign outside existing Mantine patterns
