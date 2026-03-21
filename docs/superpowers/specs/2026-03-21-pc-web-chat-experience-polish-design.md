# PC Web Chat Experience Polish Design

> 文档角色：`historical-task-spec`
> 当前使用方式：这是已完成的 `PC Web chat experience polish` 历史设计记录，主要用于回溯和参考，不再代表当前阶段主线任务。

## Task Identification

This design updates the current repository priority so the next controlled increment becomes `PC Web chat experience polish`.

This increment intentionally moves ahead of the previously open `external knowledge source expansion` task based on direct product feedback about poor chat experience and weak visual quality in the current `PC Web` client.

## Goal

Improve the core `PC Web` chat experience so it feels responsive, deliberate, and usable for repeated RAG interaction by addressing two top issues first:

- chat answers are not streamed
- the current chat UI feels visually weak and product-incomplete

## Scope

- `PC Web` only
- prioritize `Chat` page only for this round
- add streamed answer rendering for the ask flow
- redesign the `Chat` page layout, hierarchy, and interaction feedback
- improve input, loading, thinking, and citation presentation
- keep the current backend/API contract surface as stable as practical, but allow backend support changes if streaming requires them
- execute implementation and validation in strict serial order in the current workstation environment

## Non-Goals

- do not redesign every page in the web app in this round
- do not do mobile adaptation
- do not overhaul `Documents`, `Knowledge Base`, `Assistant`, or trace pages beyond narrow consistency touch-ups if required
- do not continue external source expansion in this session
- do not introduce a generic real-time framework beyond what is needed for chat streaming

## Current State

The current `Chat` page already works functionally:

- it loads conversations
- it submits questions
- it loads historical messages
- it shows latest citations

But the experience has two clear product problems:

1. ask responses return only after the full request finishes, which makes the interaction feel stalled
2. the visual composition is a utilitarian MVP layout with weak hierarchy and weak product character

Because `Chat` is the primary repeated-use surface in a RAG product, fixing this page first has higher user value than continuing source-type expansion.

## Chosen Approach

Treat this as one focused `PC Web` chat-polish task with two tightly related sub-goals:

1. first-round streamed answer delivery for the chat interaction
2. a deliberate visual redesign of the `Chat` page around one primary workspace

The page should feel closer to a modern operator workspace than a generic admin form:

- conversation rail on the left
- large central transcript workspace
- supporting citation / trace context on the right
- stronger typography
- calmer surfaces
- fewer generic card stacks
- clearer empty / loading / generating states

## Alternatives Considered

### 1. Continue with backend task order and defer UX work

Pros:

- preserves existing task sequence

Cons:

- ignores direct user pain in the most important visible surface
- reduces confidence in the product despite more feature breadth

Rejected because the priority has now been explicitly changed.

### 2. Redesign the whole web app first

Pros:

- stronger visual consistency across the app

Cons:

- too broad for one controlled increment
- increases risk and review surface
- delays the highest-value chat improvements

Rejected because it is larger than needed.

### 3. Focus on the `Chat` page only, including streaming

Pros:

- highest user-facing value
- directly addresses the core complaints
- keeps scope controlled
- allows later visual expansion to the rest of `PC Web`

Cons:

- temporary visual inconsistency may remain across other pages
- may require a small backend protocol addition for streaming

Chosen because it best matches the new priority.

## Design

### Product outcome

After this increment, the main chat interaction should feel:

- immediate after send
- visibly alive while the answer is being generated
- easier to scan
- more intentional and less like a debug console

### Streaming behavior

The ask interaction should support streamed answer rendering instead of waiting for one final JSON response.

Preferred transport:

- a simple HTTP streaming response that works with the current local web stack

For this first round, a progressive UX stream over the completed ask result is acceptable if it materially improves responsiveness without destabilizing the existing ask pipeline. Native model token streaming can remain a later enhancement.

Expected UI behavior:

- user message appears immediately
- assistant message shell appears immediately in a pending state
- answer text grows progressively as chunks arrive
- final citations and trace metadata attach once the stream completes
- error state is rendered inline if generation fails mid-stream

If backend streaming requires a small new endpoint or alternate response mode, that is acceptable inside this task because it is necessary to deliver the `PC Web` experience fix.

### Visual thesis

The `Chat` page should feel like a calm research console:

- editorial, not dashboard-heavy
- warm neutral base with one restrained accent
- large central reading column
- strong text hierarchy
- soft separators instead of many bordered cards

### Content plan

The page should organize into four jobs:

1. orientation
   - page title, active assistant, chat purpose
2. navigation
   - conversation list with clearer selected state
3. primary workspace
   - transcript and composer
4. supporting context
   - citations, trace entry point, model / execution hints

### Interaction thesis

Use a small number of meaningful motions:

- streamed assistant message reveal
- subtle pending pulse or shimmer while generation is active
- staggered transcript entry animation for new messages

### Layout changes

The current three-column skeleton can remain conceptually, but the styling should change substantially:

- left rail becomes lighter and cleaner
- center workspace becomes visually dominant
- right rail becomes a contextual inspector instead of a stack of generic cards
- transcript bubbles become more readable and role-distinct
- input composer feels like the primary call to action, not a form footer

### Citation experience

Keep citations visible, but improve clarity:

- latest citations grouped in a cleaner side panel
- stronger document title emphasis
- snippet text easier to scan
- trace link visually secondary but present

### Testing

Add or update focused validation for:

- streamed ask behavior at the API / integration level if backend support changes
- `PC Web` smoke or targeted UI validation for the new chat states
- at minimum, focused web build validation

### Documentation

Update:

- `docs/current-progress.md`
- `docs/current-dev-setup.md`

The progress doc should move this task ahead of `external knowledge source expansion`, explicitly keeping the latter deferred rather than completed.

## Files Expected To Change

Likely files:

- `apps/web/src/pages/chat/ChatPage.tsx`
- `apps/web/src/features/api/hooks.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/types/api.ts`
- backend ask-flow files only if needed for streaming transport
- focused web tests and/or integration tests
- `docs/current-progress.md`
- `docs/current-dev-setup.md`

## Validation

Minimum expected validation:

- relevant web build or typecheck
- focused chat interaction validation
- broader validation only if backend ask flow changes
- run these validations serially rather than in parallel on the current workstation

## Acceptance Criteria

- `PC Web` chat answers render progressively instead of only at the end of the visible interaction
- the user sees clear pending / generating / error states during ask
- the `Chat` page visual hierarchy is materially stronger than the current MVP layout
- citations remain accessible and easier to scan
- mobile scope remains deferred
- `external knowledge source expansion` remains open but deferred behind this new chat-polish task
