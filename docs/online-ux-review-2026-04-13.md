# Online UX Review - 2026-04-13

## Context

- Reviewed live site: `https://edw4rd.cn/ragora`
- Flow exercised with a real browser:
  - invite gate
  - login
  - chat
  - documents
  - knowledge base
  - assistant settings
  - traces
- Repo context used for comparison:
  - `docs/current-context.md`
  - `docs/next_steps_rag_project_plan.md`
  - current `apps/api` / `apps/web` implementation

## Overall Assessment

- The product is already beyond MVP skeleton stage.
- The core closed loop is working:
  - invite -> login -> documents -> chat -> trace -> settings
- The current highest-value work is no longer adding broad new surface area.
- The current highest-value work is tightening correctness, UX clarity, and diagnosis trustworthiness in the existing flow.

## Confirmed Findings

### 1. Live login works, but the local default password note can be miscommunicated

- Live login succeeded with:
  - email: `default-user@example.com`
  - password: `local-password-1`
- The repository seed default password is:
  - `local-password-1`
- Evidence:
  - `apps/api/prisma/seed.js`
  - `apps/web/src/pages/auth/LoginPage.tsx`

Why this matters:

- Smoke credentials are easy to mistype when passed around manually.
- This is not a product bug by itself, but it is a recurring operator/support footgun.

Suggested fix:

- Keep one canonical documented default credential pair in docs and smoke notes.
- If local-dev credentials are intended for operators, consider exposing them more explicitly in development-only guidance.

Priority:

- `P3`

### 2. Answering is currently too conservative in at least one real retrieval-hit case

- Tested question:
  - `What is the significance of reusable rocket technology for space exploration?`
- Observed result:
  - answer returned `insufficient_context`
- But trace detail showed retrieval already hit relevant chunks from `space_exploration.md`, including a chunk explicitly mentioning reusable rockets.
- Example live trace:
  - `cmnw0r8y0004rqh0kke47dsjl`

Why this matters:

- This is a trust issue, not just a polish issue.
- From a user perspective, "the system found the right passage but still refused to answer" feels broken.
- This likely sits in the answering / answer-status decision layer rather than retrieval itself.

Likely code areas:

- `apps/api/src/infra/llm/prompt-manager.service.ts`
- `apps/api/src/modules/answering/answering.service.ts`

Suggested fix direction:

- Re-check the answer prompt and structured-answer normalization for the "supported enough to answer" threshold.
- Add one focused regression test using a question materially equivalent to the reusable-rocket case.
- Prefer fixing this through answer-status calibration before broad retrieval changes.

Priority:

- `P0`

### 3. Trace detail shows score inconsistency that weakens diagnosis trust

- In the same live trace:
  - summary-level primary score displayed a non-zero value
  - per-chunk final scores displayed as `0.0000`
- This strongly suggests a frontend score-mapping or fallback-display issue.

Why this matters:

- Trace pages are now part of the product's working surface, not just internal debugging.
- If score summaries and chunk cards disagree, users lose confidence in the diagnostics view.

Likely code areas:

- `apps/web/src/pages/traces/TraceDetailPage.tsx`
- especially the scored/unscored fallback path used when chunk ids do not line up with score records

Suggested fix direction:

- Verify the `retrievalScoresJson` shape against the live payload.
- Ensure score records match retrieved chunk ids before rendering.
- Avoid defaulting unscored items to a visual `0.0000` if the real state is "score unavailable".

Priority:

- `P1`

### 4. Some live UI copy is leaking untranslated i18n keys

- Observed examples on the live site:
  - `ASSISTANT.ADVANCEDTUNING`
  - `TRACE.COPY.REWRITEAPPLIED`
  - `TRACE.COPY.REWRITENOTAPPLIED`
  - `TRACE.COPY.SLOWESTSTAGE`

Why this matters:

- This is one of the fastest ways to make a live app feel unfinished.
- It also makes the product harder to use for non-technical users.

Likely code areas:

- `apps/web/src/pages/assistant/AssistantSettingsForm.tsx`
- `apps/web/src/pages/traces/TraceListPage.tsx`
- related `apps/web/src/i18n/*`

Suggested fix direction:

- Audit the translation keys used by assistant/traces pages.
- Add missing entries in both `messages.zh.ts` and `messages.en.ts`.
- Add or extend a guard test so raw translation keys do not leak into these surfaces again.

Priority:

- `P1`

### 5. Some Chinese copy appears mojibake/garbled in the live UI

- Observed in multiple places:
  - login overlay text
  - trace detail labels and helper copy
- The repository source also shows mojibake-like strings in some files.

Why this matters:

- This is a direct user-facing quality issue.
- It also makes future copy maintenance risky because some strings are already corrupted at source level.

Likely code areas:

- `apps/web/src/pages/auth/LoginPage.tsx`
- `apps/web/src/pages/traces/TraceDetailPage.tsx`
- possibly other files edited under a non-UTF8 path at some point

Suggested fix direction:

- Normalize these files to UTF-8 clean source text.
- Replace corrupted literals with clean Chinese copy.
- Run a targeted scan for common mojibake fragments before calling the pass complete.

Priority:

- `P1`

### 6. Chat input still exposes an unfinished capability hint

- Live chat input area currently shows:
  - `文件上传即将支持`
- But the documents page already supports file upload as a main workflow.

Why this matters:

- The message is misleading in the current shipped state.
- It makes the product feel less coherent than it actually is.

Suggested fix direction:

- Replace with wording that points users to the existing documents page flow.
- Example direction:
  - upload documents from the library page, then return here to ask questions

Priority:

- `P2`

## Suggested Repair Order

1. Fix answering over-conservatism on retrieval-hit cases.
2. Fix trace score-display inconsistency.
3. Fix untranslated keys on assistant/traces surfaces.
4. Fix mojibake/corrupted Chinese literals.
5. Clean up misleading chat composer copy.
6. Tighten operator-facing credential documentation.

## Good News Worth Keeping

- Invite gate works and is easy to understand.
- Login flow works once correct credentials are used.
- Document workspace is readable and already feels structured.
- KB/readiness surfaces are coherent.
- Trace surface is genuinely useful already; it is worth improving, not replacing.
- End-to-end live flow is viable enough that current work should focus on tightening the existing product rather than opening a large new feature wave.

## One-Line Conclusion

The live product is already usable, but the next best gains come from fixing answer conservatism, restoring diagnostics trust, and removing visible UI-quality leaks before expanding scope.
