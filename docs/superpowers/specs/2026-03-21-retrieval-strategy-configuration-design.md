# Retrieval Strategy Configuration Design

**Date:** 2026-03-21

**Scope:** Backend/API only. No frontend changes in this round.

## Goal

Add a first systematic `RetrievalProfile.strategyJson` contract so retrieval behavior can evolve without continuing to pile more booleans and fixed heuristics into the profile model and retrieval service.

## Constraints

- Keep the change local to `apps/api` plus minimal progress/setup documentation.
- Preserve current behavior for existing retrieval profiles that only use legacy flat fields.
- Do not break the existing `topK`, `chunkWindow`, `scoreThreshold`, and `filtersJson` contract.
- Fit the current MVP architecture instead of introducing a generic retrieval rules engine.

## Current Problem

Current retrieval behavior is partly configurable and partly hard-coded:

- persisted profile fields:
  - `topK`
  - `chunkWindow`
  - `enableHybrid`
  - `enableRerank`
  - `scoreThreshold`
  - `filtersJson`
- hard-coded strategy in service code:
  - query rewrite is always on
  - candidate pool size is always `max(topK * 3, topK)`
  - hybrid merge always uses fixed `0.7 / 0.3` weights
  - retrieval mode is inferred indirectly from booleans

That is enough for the MVP, but it is not a good evolution surface. Every next retrieval tweak would otherwise require another top-level field or another hidden service constant.

## Chosen Design

Add optional `RetrievalProfile.strategyJson` with a narrow, version-friendly shape:

```json
{
  "queryRewrite": {
    "enabled": false
  },
  "candidateSelection": {
    "mode": "lexical",
    "candidateMultiplier": 4,
    "minCandidates": 12
  },
  "hybrid": {
    "vectorWeight": 0.7,
    "lexicalWeight": 0.3
  },
  "rerank": {
    "enabled": true
  }
}
```

All sections are optional. Unknown keys are rejected.

## Compatibility Model

- Existing persisted flat fields remain in place.
- `strategyJson` is additive and optional.
- Retrieval code resolves one internal strategy object from:
  - legacy flat fields
  - then `strategyJson` overrides
- If `strategyJson` is absent, behavior stays aligned with the current implementation:
  - query rewrite enabled
  - `mode = hybrid` when `enableHybrid` is true, otherwise `vector`
  - rerank enabled from `enableRerank`
  - candidate multiplier `3`
  - min candidates `topK`
  - hybrid weights `0.7 / 0.3`

This makes the new strategy contract usable immediately without forcing a migration of existing records or frontend payloads.

## Retrieval Semantics

### Query Rewrite

- `queryRewrite.enabled = false` skips the rewrite call completely.
- Ask flow uses the original user question as the retrieval query.
- Trace `rewrittenQuery` remains `null`.

### Candidate Selection

- `mode = vector`
  - use vector retrieval first
  - if vector retrieval fails or returns nothing useful, keep current lexical fallback behavior
- `mode = hybrid`
  - collect lexical and vector candidates
  - merge them with configured hybrid weights
- `mode = lexical`
  - skip embedding generation and vector search entirely
  - rank only lexical candidates plus existing chunk-window expansion

Candidate pool size becomes:

- `max(topK * candidateMultiplier, minCandidates, topK)`

### Hybrid Weights

- `vectorWeight` and `lexicalWeight` are normalized by their sum during merge.
- Both may be `0`, but not at the same time.
- Default remains effectively `0.7 / 0.3`.

### Rerank

- `rerank.enabled` controls whether the current lexical-boost rerank heuristic is applied.
- This overrides legacy `enableRerank` when present.

## Data Plumbing

- Prisma adds nullable `RetrievalProfile.strategyJson`.
- `retrieval-profile.schemas.ts` validates and normalizes the stored strategy payload.
- `ask-assistant.service.ts` resolves the effective retrieval strategy, decides whether query rewrite runs, and passes the resolved strategy into retrieval.
- `retrieval.service.ts` uses the resolved strategy to:
  - decide lexical/vector/hybrid mode
  - compute candidate limit
  - apply configurable hybrid weights

## Error Handling

- Invalid `strategyJson` payloads fail request validation with the existing zod-driven request path.
- `null` or omitted `strategyJson` means “use legacy behavior”.
- Unknown fields are rejected so the contract remains explicit and testable.

## Testing

- Retrieval unit tests:
  - lexical mode skips vector search
  - hybrid ordering honors configured weights
- Ask orchestration unit test:
  - query rewrite can be disabled
  - resolved strategy is forwarded into retrieval
- HTTP integration test:
  - patch retrieval profile with `strategyJson`
  - ask through default assistant
  - confirm `rewrittenQuery` stays `null`
  - confirm retrieval still succeeds in lexical mode

## Documentation

- Update `docs/current-progress.md` to mark this retrieval strategy task complete.
- Update `docs/current-dev-setup.md` to describe the new `strategyJson` capability alongside existing retrieval profile fields.

## Deferred

- strategy versioning
- per-stage score thresholds
- multiple rerank algorithms
- frontend editor for `strategyJson`
- trace UI exposure of effective strategy
