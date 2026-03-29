# Source Fetch Redirect Target Diagnostics Design

## Goal

When redirect follow fails because `Location` is invalid or non-`http(s)`, keep the raw redirect target visible in the error message with bounded length for easier run diagnostics.

## Scope

- Backend only (`apps/api/src/infra/http/fetch-with-retry.ts`)
- Diagnostics-only wording improvement for redirect-follow failures
- Add one focused regression in `apps/api/test/fetch-with-retry.test.js`

## Non-Goals

- No retry policy changes
- No source-family behavior changes
- No ingestion/persistence/contract changes

## Current Gap

Current redirect-follow failures for invalid or non-`http(s)` `Location` values do not include the raw redirect target, which makes upstream misconfiguration harder to diagnose from run errors.

## Design

- Add one bounded formatter for redirect target diagnostics in `fetch-with-retry`.
- Include formatted raw `Location` value in:
  - invalid redirect location error
  - non-`http(s)` redirect target error
- Keep existing redirect-follow behavior and error categories unchanged.

## Acceptance Criteria

- Invalid redirect location errors include readable bounded raw target text.
- Non-`http(s)` redirect target errors include readable bounded raw target text.
- Existing redirect follow/retry behavior remains unchanged.
