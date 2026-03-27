# Native Answer Streaming Design

## Task Identification

This design defines the next controlled increment for chat streaming after the first-round `NDJSON` progressive UX transport.

The current implementation already improves the visible `PC Web` chat experience, but it is still not true model-native streaming. The backend completes the full ask pipeline first and only then progressively reveals the finished answer to the client.

This increment upgrades that behavior to real answer-generation streaming while keeping the existing first-round protocol and metadata shape as stable as practical.

## Goal

Deliver true text streaming for `POST /assistants/:id/ask/stream` so the user starts seeing answer text as the provider generates it, while still attaching citations, trace identifiers, and final execution metadata only when generation completes.

## Scope

- backend-first change
- keep current `NDJSON` transport
- stream real provider text deltas during answer generation
- keep final citations / trace / metadata in the `final` event
- preserve the existing non-stream `POST /assistants/:id/ask` path
- preserve the current product statement that this is not full structured end-to-end real-time execution metadata streaming
- execute implementation and validation in strict serial order

## Non-Goals

- do not replace `NDJSON` with SSE or WebSocket in this increment
- do not make retrieval, query rewrite, or citation validation themselves stream progressively
- do not attempt full token-level structured citation attribution while the model is still generating
- do not redesign the `Chat` page again in this task
- do not expand mobile scope

## Current State

The current streamed ask path in `[assistants.controller.ts](../../../apps/api/src/modules/assistants/assistants.controller.ts)` behaves like this:

1. validate request
2. execute the full `askAssistant()` flow
3. emit `status`
4. split the completed answer into chunks
5. emit `answer_delta` events
6. emit `final`

That means:

- visible streaming exists
- first token latency is still bounded by the full answer generation time
- the stream is a UX transport, not a provider-native generation stream

The current backend answering stack also assumes completed output:

- `[llm.service.ts](../../../apps/api/src/infra/llm/llm.service.ts)` only exposes one-shot generation
- `[answering.service.ts](../../../apps/api/src/modules/answering/answering.service.ts)` parses structured output after the full answer is available
- `[ask-assistant.service.ts](../../../apps/api/src/modules/assistants/ask-assistant.service.ts)` persists the assistant message and final trace only after the full answer is ready

## Chosen Approach

Upgrade only the answer-generation phase to provider-native streaming, while leaving the rest of the ask pipeline in its current staged form.

The request lifecycle should become:

1. validate request
2. resolve assistant and conversation
3. persist user message
4. run query rewrite if enabled
5. run retrieval and build answer context
6. start provider-native answer stream
7. forward provider text deltas to the client as `answer_delta`
8. accumulate the complete answer server-side
9. after generation completes, run the existing finalization logic:
   - structured answer parsing
   - citation selection and validation
   - quality evaluation
   - assistant message persistence
   - trace update
10. emit one `final` event with the existing result payload

This keeps the highest-value UX gain, earlier visible answer text, while avoiding a much larger redesign of the citation and metadata pipeline.

## Alternatives Considered

### 1. Keep the current progressive reveal transport

Pros:

- already implemented
- lower engineering risk

Cons:

- first token latency remains poor
- not a real streaming system
- product wording stays awkward and easy to misunderstand

Rejected because it does not solve the main remaining responsiveness problem.

### 2. Make only answer text truly stream, keep final metadata at completion

Pros:

- materially better user-perceived latency
- bounded backend changes
- reuses most current answer finalization logic
- avoids schema churn

Cons:

- retrieval and rewrite are still pre-stream stages
- citations still appear only at the end

Chosen because it gives the best value-to-risk ratio.

### 3. Make the whole ask pipeline fully real-time and structured while streaming

Pros:

- strongest long-term architecture
- richest real-time telemetry

Cons:

- large redesign
- high protocol complexity
- citation correctness becomes much harder
- higher testing burden

Rejected for this increment because it is too large and too risky.

## Design

### Protocol shape

Keep the existing `NDJSON` event family:

- `status`
- `answer_delta`
- `final`
- `error`

Recommended phase values:

- `started`
- `retrieving`
- `generating`

Protocol intent:

- `status` communicates coarse pipeline progress
- `answer_delta` carries provider-native text increments
- `final` carries the completed ask payload, still including answer, citations, ids, and metadata
- `error` preserves structured diagnostics with `message`, `code`, `traceId`, and `details`

### Backend boundaries

#### 1. LLM service

Add a stream-capable answer API beside the existing one-shot API.

Expected responsibility:

- provider selection
- provider-specific streaming normalization
- yielding text deltas through one internal abstraction
- returning the accumulated text and provider metadata when complete

This should not move citation logic into the LLM layer.

#### 2. Answering service

Split answer generation from answer finalization conceptually:

- stream phase:
  - request provider-native text streaming
  - accumulate text
- finalize phase:
  - parse structured output from accumulated text
  - resolve citations
  - build quality evaluation
  - build answering metadata

This keeps the current deterministic post-processing model intact.

#### 3. Ask assistant service

Add a dedicated streaming orchestration path instead of continuing to reuse the one-shot `askAssistant()` path directly.

It should:

- create conversation if needed
- create user message before streaming
- create the initial trace before answer generation
- emit progress callbacks upward
- finalize persistence only after answer completion
- preserve structured failure handling and trace updates

#### 4. Controller

The controller remains the transport boundary.

It should:

- validate the request
- configure `NDJSON` response headers
- subscribe to streaming callbacks from the service
- serialize events in order
- end the response exactly once

It should no longer fabricate stream deltas by splitting a completed answer string.

### Frontend impact

Frontend changes should stay small.

The current web stack already understands:

- `status`
- `answer_delta`
- `final`
- `error`

So the main frontend requirement is to tolerate more realistic phase timing and possibly an earlier `generating` state with a longer live-stream period. The optimistic message model in `[chat-stream-state.ts](../../../apps/web/src/pages/chat/chat-stream-state.ts)` can remain.

### Error handling

Failures must stay diagnosable.

Cases to preserve:

- failure before answer streaming starts
- failure during provider streaming
- failure during finalization after provider output completes

Requirements:

- if a trace already exists, include `traceId`
- keep structured `error` diagnostics
- ensure trace status reflects failure
- avoid silently treating stream failures as successful completion

### Provider support expectations

The current repo supports Ollama and OpenAI generation plus a local fallback path.

For this increment:

- Ollama native streaming should be supported if configured
- OpenAI native streaming should be supported if configured
- fallback mode may continue to use a synthetic one-shot result internally if needed, as long as the protocol still completes correctly

This avoids blocking the increment on making the fallback engine itself truly streaming.

## Testing

Add focused validation for:

- normalized provider streaming behavior at the backend service level
- stream event ordering and completion
- stream error diagnostics
- existing final payload completeness
- focused frontend stream-client handling

At minimum, the protocol should prove:

- `answer_delta` is emitted before `final`
- concatenated deltas reconstruct the completed answer text
- final citations and trace ids still arrive
- stream failures still surface structured diagnostics

## Documentation

Update:

- `docs/current-dev-setup.md`
- `docs/current-progress.md`

The wording must stay precise:

- current completed first round: `NDJSON` progressive UX transport
- next planned increment: native answer-generation streaming with final metadata completion

Do not collapse those two states into one description.

## Files Expected To Change

Likely files:

- `apps/api/src/infra/llm/llm.types.ts`
- `apps/api/src/infra/llm/llm.service.ts`
- `apps/api/src/modules/answering/answering.service.ts`
- `apps/api/src/modules/assistants/ask-assistant.service.ts`
- `apps/api/src/modules/assistants/assistants.controller.ts`
- `apps/api/test/ask-stream-e2e.test.js`
- new focused backend stream tests
- `apps/web/src/lib/api.ts`
- `apps/web/src/features/api/hooks.ts`
- `apps/web/src/pages/chat/ChatPage.tsx`
- focused web stream tests
- `docs/current-dev-setup.md`
- `docs/current-progress.md`

## Validation

Minimum expected validation:

- `pnpm --filter @rag-system/api build`
- focused backend native-stream tests
- `node --test --test-concurrency=1 apps/api/test/ask-stream-e2e.test.js`
- focused web stream-client tests
- `pnpm --filter @rag-system/web build`

All validation should run strictly serially.

## Acceptance Criteria

- `POST /assistants/:id/ask/stream` emits real answer-generation deltas from the provider instead of splitting a completed answer
- the final `final` event still includes citations, `traceId`, `assistantMessageId`, and other existing ask metadata
- structured stream failure diagnostics remain available
- the normal non-stream ask path remains supported
- documentation clearly distinguishes the existing first-round transport from this native-streaming increment
