# Retrieval Profile Metadata Filter Design

**Date:** 2026-03-21

**Scope:** Backend/API only. No frontend changes in this round.

## Goal

Activate the existing `RetrievalProfile.filtersJson` field so a retrieval profile can constrain retrieval candidates by persisted chunk metadata before ranking and answer generation.

## Constraints

- Keep the change local to `apps/api` plus minimal progress documentation.
- Preserve current retrieval behavior when no filters are configured.
- Avoid schema migrations because `filtersJson` already exists in Prisma.
- Fit the current MVP structure instead of introducing a generic query DSL that the rest of the stack cannot validate or test yet.

## Chosen Design

Implement a first usable metadata filter object on retrieval profiles:

```json
{
  "documentIds": ["doc-1"],
  "sectionTitles": ["Overview"],
  "pageNumbers": [1, 2]
}
```

All fields are optional. Matching semantics are:

- across fields: logical `AND`
- within one field: logical `OR`
- empty or missing arrays: ignored

This keeps the shape explicit, easy to validate, and directly supported by existing persisted data on `DocumentChunk` and vector store records.

## Retrieval Behavior

- Lexical retrieval filters `DocumentChunk.findMany` by the configured metadata before scoring.
- Vector retrieval filters vector store records before cosine ranking.
- Chunk-window expansion only expands neighbors within the already matched document set and any configured page/section constraints.
- Lexical fallback also respects the same filters.
- If filters exclude everything, retrieval returns the existing fallback shape from the filtered candidate set rather than silently searching outside the configured scope.

## Data Plumbing

- `retrieval-profile.schemas.ts` will validate and normalize `filtersJson`.
- `retrieval-profiles.service.ts` will persist the normalized filter object.
- `ask-assistant.service.ts` will pass `assistant.retrievalProfile.filtersJson` into retrieval.
- `retrieval.service.ts` will compile the filter object into:
  - Prisma `where` constraints for chunk queries
  - vector store predicate input
- `vector-store.service.ts` will apply the same filter against stored vector records.

## Supported Metadata

- `documentIds`
  - uses `DocumentChunk.documentId`
  - uses vector record `documentId`
- `sectionTitles`
  - exact match against `DocumentChunk.sectionTitle`
  - exact match against vector record `sectionTitle`
- `pageNumbers`
  - exact match against `DocumentChunk.pageNo`
  - exact match against vector record `pageNo`

Exact matching is intentional for the first version. It is deterministic and easy to reason about in tests. Fuzzy/contains/range support can be added later if needed.

## Error Handling

- Invalid `filtersJson` payloads fail request validation with existing zod-driven request handling.
- Null or omitted `filtersJson` means no metadata filtering.
- Unknown keys are rejected to keep the contract narrow and stable.

## Testing

- Unit tests for retrieval behavior:
  - lexical retrieval obeys `documentIds`
  - vector retrieval obeys page/section filters
  - fallback retrieval stays inside filter scope
- Integration-style API test:
  - patch retrieval profile with `filtersJson`
  - ask through default assistant
  - confirm retrieved chunks are constrained by the filter

## Documentation

- Update `docs/current-progress.md` with the newly completed retrieval metadata filter capability and validation commands.

## Deferred

- Generic nested filter DSL
- filter operators beyond exact-in-set matching
- frontend editor support for metadata filters
- trace UI exposure of active filter configuration
