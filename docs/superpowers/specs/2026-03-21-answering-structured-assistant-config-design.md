# Answering Structured Output And Assistant Policy Design

## Task Identification

This spec implements the first unfinished task under `docs/current-progress.md` section `8.2`: `Answering 结构化与 assistant 配置增强`.

## Goal

Upgrade the backend answer path so assistant answer policy is a validated API contract instead of an unused JSON field, and make answering return a small structured result that is easier to test, persist, and diagnose.

## Scope

In scope:

- backend-only changes in `apps/api`
- validated `answerPolicyJson` assistant config
- structured answer generation contract
- ask flow propagation of assistant answer policy
- regression tests for assistant update, answering service, and API main path
- incremental docs updates

Out of scope:

- frontend editor work for `answerPolicyJson`
- full prompt management system
- deep answer quality evaluation
- large database refactors

## Current State

The repository already has an `Assistant.answerPolicyJson` database column, but it is not validated in the API update schema and is not used by the ask or answering path. The current answering contract returns free-form `answer`, `citations`, and `retrievedChunks`, with citation extraction mainly inferred from inline markers such as `[1]`.

That leaves three concrete gaps:

1. assistant-level answer behavior is not configurable through the API
2. LLM output is not explicitly structured, which weakens downstream validation
3. citation alignment falls back to heuristics instead of a deliberate contract

## Design

### 1. Assistant Answer Policy Contract

Expose `answerPolicyJson` through assistant update validation with a small, explicit schema:

- `responseStyle`: `concise` or `detailed`
- `citationMode`: `required` or `optional`
- `maxCitations`: integer `1..8`
- `noAnswerBehavior`: `say_insufficient_context` or `best_effort`

This keeps the first version intentionally small while still enabling visible behavior changes in the answer pipeline.

If `answerPolicyJson` is omitted, existing behavior should remain valid through a default normalized policy inside the answering layer.

### 2. Structured Answering Contract

The LLM-facing answer path should prefer a structured JSON payload with these fields:

- `answer`: final user-facing answer text
- `status`: `grounded` or `insufficient_context`
- `citations`: array of 1-based source indexes
- `missingInformation`: optional string array for what the sources do not cover

The backend should parse this payload and normalize it before returning it from `AnsweringService`.

If a provider returns plain text or malformed JSON, the backend should gracefully fall back to current marker extraction behavior so local/fallback paths remain robust.

### 3. Ask API Response Shape

Keep the existing ask response stable, but extend it with:

- `answerStatus`
- `missingInformation`

This is the first structured answering surface. Existing consumers that only use `answer`, `citations`, and `retrievedChunks` remain compatible.

### 4. Prompting And Policy Application

`AskAssistantService` should pass the assistant's normalized answer policy into `AnsweringService`.

`LlmService` should incorporate that policy into the answer prompt:

- `responseStyle=concise` biases short answers
- `responseStyle=detailed` allows fuller explanation
- `citationMode=required` requires citations whenever evidence exists
- `noAnswerBehavior=say_insufficient_context` tells the model to explicitly admit missing support

### 5. Testing Strategy

Backend tests should prove:

- assistant update accepts valid `answerPolicyJson` and rejects invalid values
- structured JSON answer output is parsed correctly
- malformed provider output falls back safely
- ask orchestration passes policy through and returns `answerStatus` / `missingInformation`
- real HTTP integration still covers upload -> ready -> ask -> trace with the extended response contract

## Files Expected To Change

- `apps/api/src/modules/assistants/assistant.schemas.ts`
- `apps/api/src/modules/assistants/assistants.service.ts`
- `apps/api/src/modules/assistants/ask-assistant.service.ts`
- `apps/api/src/modules/answering/answering.service.ts`
- `apps/api/src/infra/llm/llm.types.ts`
- `apps/api/src/infra/llm/llm.service.ts`
- `apps/api/test/answering.test.js`
- `apps/api/test/ask-success.test.js`
- `apps/api/test/api-flow.test.js`
- `apps/api/test/assistants-api.test.js`
- `docs/current-dev-setup.md`
- `docs/current-progress.md`

## Success Criteria

- assistant answer policy becomes a supported backend API field
- ask flow uses assistant answer policy during answer generation
- answering returns a structured first-version contract with status and missing-information fields
- tests cover both structured success and fallback behavior
- `docs/current-progress.md` can mark `8.2` complete without claiming the larger answering roadmap is fully finished
