# Embedding Base URL Guardrail Design

## Goal

Fail fast during embedding runtime config resolution when configured `OPENAI_BASE_URL` or `OLLAMA_BASE_URL` is malformed or not `http(s)`.

## Scope

- Backend only (`apps/api` embedding runtime config path)
- Validate configured base URLs for OpenAI/Ollama embedding providers
- Keep existing provider order and fallback behavior unchanged
- Add focused regression coverage in `apps/api/test/embedding-runtime-config.test.js`

## Non-Goals

- No embedding provider selection/order changes
- No request/retry behavior redesign
- No broader embedding config refactor

## Current Gap

`embedding-runtime-config` currently normalizes base URLs by trimming a trailing slash only. Malformed or non-`http(s)` values can pass config resolution and fail later during provider requests.

## Design

Add a narrow runtime-config guardrail:

- For configured `OLLAMA_BASE_URL`, require parseable URL with `http:` or `https:` protocol.
- For configured `OPENAI_BASE_URL`, apply the same validation before deriving `/embeddings` endpoint.
- Keep existing trailing-slash normalization behavior.
- Throw `EmbeddingRuntimeConfigError` with explicit env-specific diagnostics when invalid.

## Acceptance Criteria

- `resolveEmbeddingRuntimeConfig(...)` throws `EmbeddingRuntimeConfigError` when:
  - `OLLAMA_BASE_URL` is malformed or uses non-`http(s)` protocol
  - `OPENAI_BASE_URL` is malformed or uses non-`http(s)` protocol
- Existing valid URL behavior remains unchanged.
- Focused embedding runtime config tests pass.
