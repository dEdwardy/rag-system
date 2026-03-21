# Chunk Window Context Groups Design

**Date:** 2026-03-21

**Scope:** Backend/API only. No frontend changes in this round.

## Goal

Upgrade the current `chunkWindow` behavior from a raw neighbor expansion into a more structured context-organization step so ask responses can expose contiguous context segments instead of only flat chunk lists.

## Current Problem

The current retrieval flow expands neighbor chunks around primary hits and returns them as a flat `retrievedChunks` array. This preserves raw evidence, but it has two limitations:

- contiguous context is not explicitly grouped
- downstream answering still sees fragmented chunks instead of coherent local passages

The result is that `chunkWindow` improves recall, but not the structure or readability of the returned context.

## Constraints

- Keep the change local to `apps/api` plus minimal progress/setup documentation.
- Preserve backward compatibility for the existing `POST /assistants/:id/ask` response.
- Do not add database schema changes.
- Do not broaden scope into frontend rendering or trace persistence in this round.
- Keep citation behavior chunk-based so existing tests and consumers stay stable.

## Chosen Design

Keep `retrievedChunks` unchanged and add a second organized representation: `contextGroups`.

Each context group represents one contiguous chunk span inside a single document after chunk-window expansion. Groups are created by:

1. starting from the expanded chunk list
2. sorting by `documentId` and `chunkIndex`
3. merging adjacent chunks when:
   - they belong to the same document
   - their `chunkIndex` values are consecutive

No cross-document merge is allowed. No summarization is introduced. The first version only performs deterministic concatenation.

## Response Shape

`POST /assistants/:id/ask` will continue returning `retrievedChunks` and will additionally return:

```json
[
  {
    "documentId": "doc-1",
    "documentTitle": "Doc 1",
    "startChunkIndex": 3,
    "endChunkIndex": 5,
    "chunkIds": ["chunk-3", "chunk-4", "chunk-5"],
    "primaryChunkIds": ["chunk-4"],
    "mergedContent": "chunk 3...\n\nchunk 4...\n\nchunk 5...",
    "pageNumbers": [2, 3],
    "sectionTitles": ["Overview", "Details"]
  }
]
```

Field semantics:

- `chunkIds`: all chunks in the contiguous group, ordered by `chunkIndex`
- `primaryChunkIds`: chunk ids that were ranked primary hits before window expansion
- `mergedContent`: ordered concatenation of group chunk content with a simple double-newline separator
- `pageNumbers`: deduplicated ordered page numbers for chunks that have `pageNo`
- `sectionTitles`: deduplicated ordered section titles for chunks that have `sectionTitle`

## Internal Data Flow

- `RetrievalService.retrieve()` still returns expanded chunk-level results.
- A new grouping step will derive `contextGroups` from the expanded chunk list.
- `AskAssistantService` will pass both `retrievedChunks` and `contextGroups` into answering.
- `AnsweringService` will prefer `contextGroups[].mergedContent` when building answer context.
- If no groups are present, answering falls back to the current chunk-based behavior.

This keeps the external compatibility surface small while making chunk-window output immediately more useful.

## Why This Design

### Option A: Internal-only grouping

Group chunks for answering, but do not expose the groups in the ask response.

Rejected because the new capability would remain invisible to API consumers and harder to validate externally.

### Option B: Add `contextGroups` and keep `retrievedChunks`

Recommended and chosen.

It provides a useful structured output while preserving all existing fields and test assumptions.

### Option C: Replace chunk retrieval with segment-first retrieval

Rejected for this round because it would force larger changes across ranking, citations, traces, and tests.

## Compatibility

- `retrievedChunks` remains present and unchanged.
- citations remain chunk-based
- existing ask consumers can ignore `contextGroups`
- existing retrieval profile config stays unchanged

This is an additive API change, not a breaking one.

## Testing

Add focused backend coverage for:

- retrieval grouping of contiguous expanded chunks
- non-contiguous chunks staying in separate groups
- stable `primaryChunkIds` propagation
- ask service forwarding `contextGroups`
- ask HTTP response containing both `retrievedChunks` and `contextGroups`
- answering preferring grouped merged context over raw chunk-only context

## Deferred

- trace persistence of `contextGroups`
- frontend rendering of grouped context
- group-level citations
- semantic passage merging beyond adjacent chunk indices
- summarization/compression of merged group content

## Documentation

- Update `docs/current-progress.md` when the task is complete.
- Update `docs/current-dev-setup.md` to mention the additive ask response field and chunk-window grouping behavior.
