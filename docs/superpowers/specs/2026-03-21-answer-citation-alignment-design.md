# Answer Citation Alignment Design

## Task Identification

This spec covers the first unfinished task in `docs/current-progress.md` under `3.2 Answering 增强版未完成`: `引用片段与答案的严格结构化对齐`.

## Goal

Make ask-time citations come from an explicit structured contract instead of heuristic snippet guessing, so the backend can return citation snippets that are demonstrably tied to the model-selected evidence.

## Current Gap

The backend already supports structured answer metadata:

- `answer`
- `status`
- `citations`
- `missingInformation`

But each returned citation still builds `snippet` by scanning the retrieved chunk for question terms. That means:

- the snippet may not reflect the exact evidence the answer relied on
- two different questions can produce different snippets for the same cited chunk
- the backend cannot distinguish between "model cited this chunk" and "backend guessed a matching excerpt"

## Scope

In scope:

- backend-only changes in `apps/api`
- answer prompt contract extension for citation evidence
- structured LLM output parsing and validation
- strict backend alignment of citations to retrieved chunks or context groups
- focused regression tests
- incremental progress/setup docs updates

Out of scope:

- frontend citation UI redesign
- answer quality scoring
- new retrieval behavior
- broader refactors of trace persistence

## Design

### 1. Structured Citation Evidence Contract

The answer prompt should request citation objects instead of only numeric citation indexes. Each citation object should contain:

- `source`: 1-based source index
- `quote`: a short verbatim excerpt copied from that source

This keeps the contract simple enough for local and hosted LLMs, while giving the backend a concrete excerpt to validate.

### 2. Backend Validation And Alignment

The backend should treat structured citation evidence as advisory until validated.

For each citation object:

1. resolve the `source` index to the retrieved chunk/context-group used for prompting
2. normalize whitespace in both the quoted text and the source content
3. accept the quote only if it is found inside that same source content
4. if valid, return the matched excerpt as the citation snippet
5. if invalid, fall back to a deterministic backend-generated snippet from that cited source

This preserves robustness while eliminating cross-source mismatches.

### 3. Stable Fallback Rules

Fallback behavior should remain safe and deterministic:

- if structured citation objects are present and valid, use them
- otherwise fall back to numeric `citations` / inline markers to identify cited sources
- if a cited source has no valid quote, derive a snippet from that cited source only
- if no citations are provided at all, preserve existing fallback source selection behavior

### 4. Returned API Shape

Keep the current ask response shape stable. Each citation continues to return:

- `chunkId`
- `documentId`
- `documentTitle`
- `pageNo`
- `sectionTitle`
- `snippet`

The change is that `snippet` becomes evidence-aligned whenever the model returns a valid quote for the cited source.

## Testing Strategy

Tests should prove:

- structured citation quotes are parsed and preserved from model output
- quotes that do not belong to the cited source are rejected
- rejected quotes fall back to deterministic source-local snippets
- existing numeric citation fallback still works
- the HTTP ask flow still returns citations and structured answer metadata

## Files Expected To Change

- `apps/api/src/infra/llm/structured-answer.schema.ts`
- `apps/api/src/infra/llm/llm.types.ts`
- `apps/api/src/infra/llm/prompt-manager.service.ts`
- `apps/api/src/infra/llm/llm.service.ts`
- `apps/api/src/modules/answering/answering.service.ts`
- `apps/api/test/llm.test.js`
- `apps/api/test/answering.test.js`
- `docs/current-dev-setup.md`
- `docs/current-progress.md`

## Success Criteria

- answer prompts request explicit citation evidence
- the backend validates citation quotes against the cited source content
- returned citation snippets prefer validated structured quotes
- invalid or missing structured quotes safely fall back without breaking existing ask responses
- `docs/current-progress.md` can mark this specific answering task complete
