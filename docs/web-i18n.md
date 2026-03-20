# Web I18n

## Current approach

The current web app uses a lightweight in-repo i18n layer instead of an external library.

Current implementation files:

- [apps/web/src/i18n/I18nProvider.tsx](/D:/FeProjects/rag-system/apps/web/src/i18n/I18nProvider.tsx)
- [apps/web/src/i18n/messages.ts](/D:/FeProjects/rag-system/apps/web/src/i18n/messages.ts)

Recent maintenance note:

- The in-repo dictionary has been normalized back to readable UTF-8 content after a round of corrupted Chinese copy.
- `messages.ts` remains the current source of truth for visible UI text.
- A lightweight regression test now checks representative Chinese copy directly from the dictionary source file.

Supported locales:

- `zh`
- `en`

## Runtime behavior

Language resolution order:

1. `localStorage["rag-system-locale"]`
2. browser language detection
3. default fallback to `en` for missing keys

Additional behavior:

- `document.documentElement.lang` is updated automatically
- date/time formatting is locale-aware through `formatDateTime`
- language switching is exposed in the app shell header

## How to add new copy

When adding new visible UI text:

1. Add the message key in both `en` and `zh` inside [apps/web/src/i18n/messages.ts](/D:/FeProjects/rag-system/apps/web/src/i18n/messages.ts)
2. Read it through `useI18n()`
3. Avoid introducing new hard-coded visible strings in page components

Example pattern:

```tsx
const { t } = useI18n();

<Title order={2}>{t("chat.title")}</Title>
```

Interpolated values are supported:

```tsx
t("documents.uploadSuccess", { fileName: file.name })
```

## Scope covered today

The current i18n pass covers the main user-visible pages:

- app shell navigation/header
- chat page
- documents page
- document detail page
- trace detail page
- knowledge base page
- assistant page

Recent trace-page additions also follow the same dictionary flow:

- query comparison labels for original and rewritten query
- rewrite status labels
- retrieved chunk rank and score breakdown labels
- score ordering/explanation copy

Recent document-detail additions from trace deep links also follow the same dictionary flow:

- trace-origin focus banner copy
- trace rank / score labels
- primary / neighbor / cited focus labels
- back-to-trace entry copy

## Known limitations

- The current dictionary is static and local to the repo
- No ICU pluralization support
- No per-route lazy loading of locale bundles
- Some low-level API/server error messages still come from backend raw strings and are not normalized through frontend i18n

## Validation

Useful checks for dictionary changes:

```bash
node --test apps/web/test/*.test.js
pnpm --filter @rag-system/web typecheck
pnpm --filter @rag-system/web build
```
