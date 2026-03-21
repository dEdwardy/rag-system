# Structured Output Constraints Design

**Date:** 2026-03-21

**Scope:** Backend/API only. No frontend changes in this round.

## Goal

Strengthen the current structured answering contract with an explicit output schema so LLM JSON responses are validated and normalized before the rest of the backend trusts them.

## Constraints

- Keep the change local to `apps/api` plus minimal progress/setup documentation.
- Preserve current ask API shape.
- Do not expand this round into citation-snippet alignment or answer-quality scoring.
- Keep fallback behavior robust when providers return plain text or malformed JSON.

## Current Problem

The backend already asks for structured answer JSON and loosely parses it, but the current parsing path is still permissive:

- shape validation is implicit
- citations are accepted with minimal constraints
- missing-information entries are only weakly filtered
- malformed JSON falls back, but there is no single schema boundary documenting what “valid structured output” means

That is enough for MVP robustness, but it is not yet a real output-constraint layer.

## Chosen Design

Add a dedicated structured-answer schema in the LLM infra layer that validates and normalizes:

- `answer`
- `status`
- `citations`
- `missingInformation`

The schema will:

- require `answer` to be a non-empty string after trim
- allow `status` only as `grounded` or `insufficient_context`
- coerce citation numbers from numbers or numeric strings into positive integers
- deduplicate citation indexes while preserving order
- keep `missingInformation` as a trimmed string array with empty values removed

## Integration

- `LlmService` keeps provider-specific transport behavior unchanged.
- `LlmService.tryParseStructuredAnswer()` delegates candidate payloads to the schema.
- If the schema rejects a candidate payload, parsing continues to the next candidate or falls back to plain-text extraction.
- `AnsweringService` keeps existing citation selection and answer-status defaults, but now receives more strongly normalized structured output.

## Testing

Add focused tests for:

- valid structured payloads being normalized through the schema
- numeric-string citations being coerced and deduplicated
- blank `missingInformation` values being removed
- malformed structured payloads falling back to plain-text marker extraction

## Deferred

- exact citation-to-sentence alignment
- provider-enforced JSON schema response modes
- richer output sections such as summary / evidence / confidence
- persisted validation diagnostics in traces

## Success Criteria

- structured answer output has an explicit backend schema boundary
- invalid structured payloads are rejected cleanly and fall back safely
- normalized structured payloads are deterministic and covered by tests
