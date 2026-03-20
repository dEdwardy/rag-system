# Web I18n Repair Design

**Goal**

Repair the frontend i18n dictionary so the Chinese locale renders readable copy again, without changing routing, page logic, or backend APIs.

**Context**

The current `apps/web/src/i18n/messages.ts` contains a healthy English dictionary but a partially corrupted Chinese dictionary. The corruption is not a type-level problem, so the application still builds successfully, but the runtime user experience in `zh` is degraded across multiple pages.

The fastest safe repair is to keep the current key structure and replace the corrupted Chinese copy with clean UTF-8 text. That preserves every existing `t("...")` call site and minimizes regression risk.

## Chosen Approach

Replace the entire `messages.ts` dictionary with a normalized version that preserves all existing keys and exports. Add a lightweight file-content regression test that asserts several representative Chinese strings are correct, so this does not silently regress again.

## Alternatives Considered

### 1. Patch only the broken Knowledge Base strings

Pros:
- Smallest edit

Cons:
- Leaves the rest of the Chinese UI corrupted
- Kicks the actual problem down the road

Rejected because the corruption is broader than one page.

### 2. Replace the whole dictionary while preserving keys

Pros:
- Cleanest fix
- No page-level refactors
- Best long-term maintainability

Cons:
- Requires careful copy replacement in one large file

Chosen because it repairs the real issue with limited architectural risk.

### 3. Introduce an external i18n library during the repair

Pros:
- Could improve long-term i18n capabilities

Cons:
- Expands scope dramatically
- Unrelated to the immediate bug

Rejected as unnecessary for this round.

## Design

### Dictionary Repair

`apps/web/src/i18n/messages.ts` will be rewritten as a clean UTF-8 file with:

- the same top-level structure
- the same `en` keys
- the same `zh` keys
- the same exported `SupportedLocale` type

English copy remains functionally unchanged except for any small consistency cleanup needed while rewriting the file.

Chinese copy will be rewritten into readable, product-appropriate strings for:

- app shell
- common labels
- chat
- documents
- knowledge base
- assistant
- trace

### Regression Test

Since the current issue is content corruption rather than logic failure, add a lightweight Node test that reads `messages.ts` as text and asserts the presence of several known-good Chinese strings. This avoids needing a full frontend test framework while still giving a red/green loop.

### Documentation

Update `docs/web-i18n.md` to note that the in-repo dictionary has been normalized and remains the current source of truth.

## Files

### Modify

- `apps/web/src/i18n/messages.ts`
- `docs/web-i18n.md`

### Create

- `apps/web/test/i18n-copy.test.js`

## Validation

- `node --test apps/web/test/*.test.js`
- `pnpm --filter @rag-system/web typecheck`
- `pnpm --filter @rag-system/web build`

## Non-Goals

- No new i18n library
- No route-level lazy loading
- No backend changes
- No ICU pluralization work
