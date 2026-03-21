# Answer Quality Evaluation Design

## Task Identification

This spec covers the current first unfinished task in `docs/current-progress.md` under `3.2 Answering 增强版未完成`: `回答质量评估`.

## Goal

Add a lightweight, structured answer-quality evaluation to the backend ask flow so each answer carries machine-readable quality signals for debugging, product decisions, and later UI exposure.

## Current Gap

The backend already returns:

- `answer`
- `answerStatus`
- `missingInformation`
- `citations`
- retrieval score breakdown in traces

But there is no single, normalized quality assessment object that answers:

- how well-supported was this answer?
- how complete was it?
- were there obvious risk flags?

Today, that interpretation is left to each consumer.

## Scope

In scope:

- backend-only quality evaluation
- ask response extension with a structured `qualityEvaluation`
- trace persistence of the same evaluation payload
- focused unit/integration tests
- incremental docs updates

Out of scope:

- frontend visualization
- second-pass LLM grading
- model-based hallucination detection
- large scoring systems or analytics pipelines

## Chosen Approach

Use a deterministic rule-based evaluator in the backend.

Inputs:

- `answerStatus`
- `missingInformation`
- returned `citations`
- retrieved chunk scores
- whether retrieval returned any chunks

Outputs:

- `overall`: `strong` | `partial` | `weak`
- `grounding`: `grounded` | `partially_grounded` | `ungrounded`
- `completeness`: `complete` | `partial` | `insufficient`
- `flags`: string array
- `summary`: short backend-generated explanation

This keeps the first version cheap, explainable, and stable in tests.

## Evaluation Rules

### 1. Grounding

- `grounded` when `answerStatus === "grounded"` and citations exist
- `partially_grounded` when `answerStatus === "grounded"` but citations are missing or weak
- `ungrounded` when `answerStatus === "insufficient_context"` or no retrieval support exists

### 2. Completeness

- `complete` when answer is grounded and `missingInformation` is empty
- `partial` when answer is grounded but `missingInformation` contains entries
- `insufficient` when the system reports insufficient context or no supporting chunks

### 3. Flags

First-version flags:

- `no_retrieval_hits`
- `no_citations`
- `missing_information`
- `low_retrieval_score`
- `insufficient_context`

The evaluator should emit only relevant flags and keep ordering deterministic.

### 4. Overall Rating

- `strong` when grounding is `grounded`, completeness is `complete`, and no negative flags are present beyond mild score concerns
- `partial` when support exists but there are completeness gaps or warning flags
- `weak` when answer support is missing or the pipeline already classified it as insufficient context

### 5. Summary

Generate a short deterministic string from the final classification, such as:

- `Answer is grounded in cited sources with no reported gaps.`
- `Answer is grounded but incomplete because some information is missing.`
- `Answer quality is weak because supporting context was insufficient.`

## Persistence And API Shape

### Ask Response

Extend `POST /assistants/:id/ask` response with:

```json
{
  "qualityEvaluation": {
    "overall": "strong",
    "grounding": "grounded",
    "completeness": "complete",
    "flags": [],
    "summary": "Answer is grounded in cited sources with no reported gaps."
  }
}
```

### Trace Persistence

Persist the same payload into a new optional `AnswerTrace.qualityEvaluationJson` JSON column so later consumers can inspect historical quality results.

## Testing Strategy

Tests should prove:

- grounded + cited + no gaps answers are rated `strong`
- grounded but incomplete answers are rated `partial`
- insufficient-context answers are rated `weak`
- ask service returns `qualityEvaluation` and persists it to trace updates
- HTTP trace reads expose persisted quality evaluation

## Files Expected To Change

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260321xxxxxx_add_answer_trace_quality_evaluation/migration.sql`
- `apps/api/src/modules/answering/answering.service.ts`
- `apps/api/src/modules/assistants/ask-assistant.service.ts`
- `apps/api/src/modules/traces/traces.service.ts`
- `apps/api/test/answering.test.js`
- `apps/api/test/ask-success.test.js`
- `apps/api/test/api-flow.test.js`
- `docs/current-dev-setup.md`
- `docs/current-progress.md`

## Success Criteria

- ask responses include a structured quality evaluation
- traces persist the same quality evaluation payload
- the evaluation is deterministic and based on existing backend signals
- focused tests and the main ask integration path pass
- `docs/current-progress.md` can mark `回答质量评估` complete
