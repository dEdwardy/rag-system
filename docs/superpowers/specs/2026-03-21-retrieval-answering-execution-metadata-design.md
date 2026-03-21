# Retrieval And Answering Execution Metadata Design

## Goal

Complete the current `retrieval / answering systematic evolution` task with a backend-first increment that makes the ask pipeline's effective retrieval and answering configuration explicitly traceable.

This increment does not add a new retrieval algorithm. It adds a stable execution-metadata layer so future retrieval and answering changes can evolve against an explicit persisted contract instead of implicit service logic.

## Current Problem

The repository already has the first-version pieces for systematic retrieval and answering:

- retrieval strategy resolution through `RetrievalProfile.strategyJson`
- answer policy validation through `Assistant.answerPolicyJson`
- versioned prompt construction through `PromptManagerService`
- trace persistence for rewritten query, retrieval scores, citations, and answer quality

What is still missing is a unified record of which retrieval and answering settings actually ran for a given ask.

Today, someone reading a trace can infer parts of execution from:

- `rewrittenQuery`
- `retrievalScoresJson`
- `qualityEvaluationJson`
- current assistant and retrieval-profile records

That is not a stable execution contract. Once retrieval and answering continue evolving, trace consumers would need to reconstruct runtime behavior from scattered fields and mutable config state.

## Scope

Additive backend scope only:

1. Persist structured retrieval execution metadata on `AnswerTrace`
2. Persist structured answering execution metadata on `AnswerTrace`
3. Return the same metadata in the `POST /assistants/:id/ask` response
4. Extend focused backend tests and API/E2E coverage
5. Update practical docs

Out of scope:

- new retrieval heuristics
- prompt-content redesign
- frontend implementation work
- mobile work
- auth / multi-tenant expansion

## Design

### 1. Trace Schema Extension

Add two nullable JSON fields to `AnswerTrace`:

- `retrievalMetadataJson`
- `answeringMetadataJson`

These fields are additive and keep the existing trace payload compatible.

### 2. Retrieval Metadata Contract

Persist a normalized object that records the effective retrieval execution inputs and outcomes:

- resolved `strategy`
- normalized `filters`
- query rewrite execution details:
  - `enabled`
  - `applied`
  - `usedFallback`
  - `promptId`
- retrieval execution summary:
  - `retrievalQuery`
  - `topK`
  - `scoreThreshold`
  - `chunkWindow`
  - `retrievedChunkCount`
  - `contextGroupCount`
  - `primaryChunkCount`

This contract is intentionally descriptive rather than overly verbose. It should explain how retrieval ran without duplicating the full trace-score array.

### 3. Answering Metadata Contract

Persist a normalized object that records the effective answering execution inputs and outcomes:

- `promptId`
- normalized `answerPolicy`
- `contextMode`: `chunks` or `context_groups`
- `inputChunkCount`
- `contextGroupCount`
- `citationCount`
- `answerStatus`

This gives future answering evolution a stable place to record which policy and prompt version produced the result.

### 4. Prompt Version Propagation

The prompt manager already has stable prompt ids:

- `answer.v2`
- `rewrite-query.v1`

Those ids should be surfaced through LLM outputs so orchestration code can persist them without duplicating prompt-version knowledge.

### 5. Ask Pipeline Behavior

`AskAssistantService` will:

- build retrieval metadata immediately after retrieval completes
- store that retrieval metadata when creating the trace
- persist the same retrieval metadata on failure updates
- persist answering metadata on successful trace update
- return both metadata objects in the ask response

This keeps failure traces useful while keeping the success path richer.

## Testing Strategy

Focused coverage:

- unit coverage for ask orchestration metadata persistence
- unit coverage for answering metadata shaping
- API/E2E assertions that trace payloads expose the new fields

Broader coverage:

- API build
- `pnpm test:api`

## Why This Is The Right Increment

This is the smallest backend-first step that meaningfully completes the current task:

- it directly advances retrieval/answering systematization
- it avoids speculative new heuristics
- it strengthens observability for future retrieval and answering changes
- it preserves current web priority and avoids mobile expansion
