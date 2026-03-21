# Assistant Answer Policy Expansion Design

## Task Identification

This spec implements the current first unchecked item in `docs/current-progress.md` section `3.2`: `更完整的 assistant / answer policy 配置能力`.

## Goal

Expand the backend `answerPolicyJson` contract from a first-pass policy object into a more complete assistant answer policy surface that can drive both prompt construction and a small amount of deterministic answer post-processing.

## Scope

In scope:

- backend/API changes in `apps/api`
- backward-compatible `answerPolicyJson` schema expansion
- prompt manager policy rendering updates
- deterministic answer post-processing for a subset of policy fields
- focused API and service regression tests
- incremental docs updates

Out of scope:

- frontend assistant settings editor work
- database schema changes
- large response-shape redesigns
- new trace storage fields for the resolved policy

## Current State

The current backend supports a small `answerPolicyJson` object with:

- `responseStyle`
- `citationMode`
- `maxCitations`
- `noAnswerBehavior`

That first version is useful, but it has two limitations:

1. most policy control is still effectively hidden inside the system prompt and cannot be configured
2. only `maxCitations` has deterministic backend enforcement; the other fields are mostly prompt hints

## Design

### 1. Backward-Compatible Policy Expansion

Keep the existing flat `answerPolicyJson` shape, but expand it with optional fields:

- `tone`: `neutral` | `friendly` | `direct`
- `outputFormat`: `paragraph` | `bullets` | `markdown`
- `language`: `auto` | `same_as_question` | `zh` | `en`
- `includeMissingInformation`: `boolean`

Also widen `responseStyle` from:

- `concise` | `detailed`

to:

- `concise` | `balanced` | `detailed`

The older payloads remain valid. Missing new fields are resolved through backend defaults.

### 2. Resolved Policy Defaults

Normalize assistant policy in the answering layer with these defaults:

- `responseStyle`: `concise`
- `tone`: `neutral`
- `outputFormat`: `paragraph`
- `language`: `auto`
- `citationMode`: `required`
- `maxCitations`: `3`
- `noAnswerBehavior`: `say_insufficient_context`
- `includeMissingInformation`: `true`

This keeps existing assistants stable while enabling more policy control for updated assistants.

### 3. Prompt-Level Policy Rendering

`PromptManagerService` should render all resolved policy fields into the managed answer prompt and make the instructions more explicit:

- response length/detail from `responseStyle`
- wording style from `tone`
- answer layout from `outputFormat`
- answer language from `language`
- citation expectations from `citationMode`
- gap disclosure behavior from `includeMissingInformation`
- unsupported-answer behavior from `noAnswerBehavior`

The managed prompt id should advance to a new version because the prompt contract meaningfully changes.

### 4. Deterministic Backend Enforcement

Not every policy field can be enforced deterministically, but two should be:

1. `citationMode`
   - `required`: keep current citation fallback behavior when the model does not return explicit citations
   - `optional`: do not invent heuristic citations when the model gives none; still respect explicit source markers or structured citations when present

2. `includeMissingInformation`
   - `true`: keep current `missingInformation` behavior
   - `false`: clear `missingInformation` in the final answer result, even if the model returned advisory gaps

`maxCitations` continues to cap the final citation list.

### 5. Testing Strategy

Focused tests should prove:

- assistant API accepts expanded valid policy objects and rejects invalid new field values
- prompt manager renders the expanded policy fields into the managed prompt
- answering service respects `citationMode=optional` and `includeMissingInformation=false`
- ask orchestration forwards the expanded policy object unchanged into answering

## Files Expected To Change

- `apps/api/src/modules/assistants/assistant.schemas.ts`
- `apps/api/src/modules/assistants/ask-assistant.service.ts`
- `apps/api/src/modules/answering/answering.service.ts`
- `apps/api/src/infra/llm/llm.types.ts`
- `apps/api/src/infra/llm/prompt-manager.service.ts`
- `apps/api/test/assistants-api.test.js`
- `apps/api/test/answering.test.js`
- `apps/api/test/ask-success.test.js`
- `apps/api/test/prompt-manager.test.js`
- `docs/current-dev-setup.md`
- `docs/current-progress.md`

## Success Criteria

- `PATCH /assistants/:id` supports the richer `answerPolicyJson` contract
- existing assistants remain valid without migration
- prompt construction reflects the richer policy surface
- `citationMode=optional` and `includeMissingInformation=false` change backend output behavior deterministically
- `docs/current-progress.md` can mark this task complete without claiming frontend assistant policy editing is complete
