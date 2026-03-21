# Prompt Management Design

**Date:** 2026-03-21

**Scope:** Backend/API only. No frontend changes in this round.

## Goal

Add a first systematic prompt-management layer so answer and query-rewrite prompts are no longer assembled as hard-coded inline strings inside `LlmService`.

## Constraints

- Keep the change local to `apps/api` plus minimal progress/setup documentation.
- Preserve current answer quality and API behavior.
- Do not introduce database-backed prompt editing or frontend prompt configuration yet.
- Fit the current MVP architecture instead of building a generic prompt platform.

## Current Problem

Prompt logic is currently scattered inside `LlmService`:

- answer system prompt suffix is hard-coded
- answer user prompt with policy and source formatting is hard-coded
- query rewrite prompt is hard-coded
- no prompt identifier or version exists
- prompt formatting cannot be tested independently from provider code

That makes the prompt layer harder to evolve. Small changes to prompt wording are coupled to transport/provider logic, and there is no stable backend boundary for future prompt evolution.

## Chosen Design

Introduce a dedicated `PromptManagerService` under `apps/api/src/infra/llm/` with:

- named prompt builders for:
  - `answer`
  - `rewrite-query`
- stable prompt version identifiers
- typed inputs for each prompt kind
- a single place for answer/rewrite prompt text, structure, and formatting rules

`LlmService` will depend on `PromptManagerService` and request prompt payloads instead of constructing strings directly.

## Prompt Contract

### Answer Prompt

The manager returns:

- `promptId`: `answer.v1`
- `systemPrompt`
- `userPrompt`
- `fullPrompt`

The answer prompt still includes:

- assistant-provided `systemPrompt`
- repository-standard answer rules
- retrieved source formatting
- answer policy formatting
- structured JSON output instruction

This keeps behavior compatible while giving prompt wording a stable home.

### Rewrite Prompt

The manager returns:

- `promptId`: `rewrite-query.v1`
- `fullPrompt`

The rewrite prompt still includes the current retrieval-query rewrite rules, but it is now versioned and managed in one place.

## LLM Integration

- Ollama answer generation uses `PromptManagerService.buildAnswerPrompt(...).fullPrompt`.
- OpenAI answer generation uses:
  - `systemPrompt` from the prompt manager
  - `userPrompt` from the prompt manager
- Ollama rewrite generation uses `PromptManagerService.buildRewritePrompt(...).fullPrompt`.
- OpenAI rewrite generation uses the prompt manager’s rewrite prompt split into:
  - a system instruction
  - a user question payload

## Testing

Add focused tests for:

- prompt manager answer prompt content and version id
- prompt manager rewrite prompt content and version id
- `LlmService` using prompt manager output for answer generation
- `LlmService` using prompt manager output for rewrite generation

The goal is to prove prompt formatting is now independently testable and no longer hidden inside transport code.

## Deferred

- persisted prompt templates
- assistant-level prompt profile selection
- prompt variables beyond current answer/rewrite inputs
- trace persistence of prompt ids
- prompt diff tooling or prompt A/B evaluation

## Success Criteria

- answer and rewrite prompt construction moves out of `LlmService`
- prompt logic has stable versioned identifiers
- prompt formatting is covered by dedicated tests
- backend answer/rewrite behavior remains compatible with current API and test suite
