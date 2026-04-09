# Retrieval And Trace Notes

> 文档角色：`background`
> 当前使用方式：检索链路与 trace 结构参考；不作为当前阶段优先级主文档。

## Current retrieval pipeline

The current ask pipeline runs retrieval in this order:

1. optional query rewrite
2. vector retrieval
3. lexical candidate generation
4. hybrid merge when `enableHybrid` is enabled
5. rerank when `enableRerank` is enabled
6. chunk window expansion

## Query rewrite

Implementation entry point:

- [apps/api/src/infra/llm/llm.service.ts](../apps/api/src/infra/llm/llm.service.ts)

Current behavior:

- tries LLM-based rewrite first
- falls back to deterministic local rewrite when no model is available or rewrite fails
- stores the final rewritten query in `AnswerTrace.rewrittenQuery` when it differs from the original question

## Trace score payload

Trace score payload is stored in:

- `AnswerTrace.retrievalScoresJson`

Current per-item shape may include:

- `chunkId`
- `documentId`
- `documentTitle`
- `chunkIndex`
- `contentPreview`
- `isPrimary`
- `pageNo`
- `sectionTitle`
- `score`
- `vectorScore`
- `lexicalScore`
- `hybridScore`
- `rerankScore`

Meaning:

- `score`: final score used for ranking at the current stage
- `isPrimary`: whether the chunk is a direct top-ranked hit or a neighbor introduced by chunk window expansion
- `vectorScore`: similarity score from vector retrieval
- `lexicalScore`: score from lexical matching heuristic
- `hybridScore`: merged score after hybrid candidate blending
- `rerankScore`: score after rerank heuristic

## Execution metadata payloads

The ask pipeline now also persists two additive execution-metadata payloads on `AnswerTrace`:

- `retrievalMetadataJson`
- `answeringMetadataJson`

### `retrievalMetadataJson`

Current shape includes:

- `strategy`
- `filters`
- `queryRewrite`
  - `enabled`
  - `applied`
  - `finalQuerySource`
  - `usedFallback`
  - `promptId`
- `strategySummary`
  - `retrievalMode`
  - `strategyMode`
  - `retrievalQuerySource`
  - `rewriteApplied`
  - `rewriteUsedFallback`
  - `fallbackReason`
  - `usedFallback`
- `execution`
  - `retrievalQuery`
  - `topK`
  - `scoreThreshold`
  - `chunkWindow`
  - `actualMode`
  - `usedFallback`
  - `fallbackReason`
  - `rerankApplied`
  - `chunkWindowApplied`
  - `vectorSearchAttempted`
  - `lexicalSearchAttempted`
  - `vectorCandidateLimitHit`
  - `lexicalCandidateLimitHit`
  - `rankingTopKHit`
  - `candidateLimit`
  - `vectorCandidateCount`
  - `lexicalCandidateCount`
  - `mergedCandidateCount`
  - `rankedCandidateCount`
  - `retrievedChunkCount`
  - `contextGroupCount`
  - `primaryChunkCount`
  - `neighborChunkCount`

This is the stable summary of how retrieval actually ran for the trace.

### `answeringMetadataJson`

Current shape includes:

- `promptId`
- normalized `answerPolicy`
- `resolvedLanguage`
- `generationMode`
- `contextMode`
- `inputChunkCount`
- `promptContextCount`
- `contextGroupCount`
- `citationCountBeforeLimit`
- `citationCount`
- `citationLimitHit`
- `citationAttribution`
- `citationSelectionSource`
- `missingInformationCount`
- `missingInformationSource`
- `answerTextSource`
- `answerStatusSource`
- `insufficientContextReason`
- `answerStatus`
- `coverageSummary`
- `summaryMainItems` (currently experimental-only and expected to remain empty on the default shipped path)

This is the stable summary of how answer generation actually ran for the trace.

Current interpretation rules:

- `coverageSummary` is a diagnostic signal for summary/list answer analysis.
- `coverageSummary` should be used for trace reading, evaluation, and quality diagnosis, but not as a direct main-path controller for answer generation.
- the `summaryMainItems` two-step answering experiment is not part of the default path; when the experiment flag is off, `summaryMainItems` should stay empty / absent and should not affect prompt construction or answer generation behavior.

## Trace read summary

Trace read endpoints now also expose additive `traceSummary` on top of the raw persisted payload:

- `GET /traces/:id`
- `GET /conversations/:id/traces`

Current `traceSummary` shape includes:

- `promptId`
- `answerStatus`
- `qualityOverall`
- `primaryIssue`
- `retrievalMode`
- `retrievalQuerySource`
- `strategySummary`
  - `retrievalMode`
  - `strategyMode`
  - `retrievalQuerySource`
  - `rewriteApplied`
  - `rewriteUsedFallback`
  - `fallbackReason`
  - `usedFallback`
- `generationMode`
- `contextMode`
- `rewriteApplied`
- `fallbackReason`
- `resolvedLanguage`
- `citationAttribution`
- `citationSelectionSource`
- `missingInformationCount`
- `missingInformationSource`
- `insufficientContextReason`
- `answerTextSource`
- `answerStatusSource`
- `failedStage`
- `failureMessage`
- `candidateLimit`
- `vectorCandidateCount`
- `lexicalCandidateCount`
- `mergedCandidateCount`
- `rankedCandidateCount`
- `vectorCandidateLimitHit`
- `lexicalCandidateLimitHit`
- `rankingTopKHit`
- `primaryChunkCount`
- `neighborChunkCount`
- `retrievedChunkCount`
- `inputChunkCount`
- `promptContextCount`
- `contextGroupCount`
- `citationCount`
- `citationCountBeforeLimit`
- `citationLimitHit`
- `usedFallback`

This summary is derived from the persisted trace JSON, so callers can read the main execution outcome directly without reconstructing it from `retrievalMetadataJson`, `answeringMetadataJson`, and `qualityEvaluationJson`.

For failed ask traces, the backend now also writes additive `failure` data into `retrievalMetadataJson`:

- `stage`
- `message`

The trace read model lifts that into `traceSummary.failedStage` and `traceSummary.failureMessage`.

Current normalized value sets to rely on:

- `traceSummary.retrievalQuerySource`:
  - `rewritten`
  - `original_disabled`
  - `original_unchanged`
- `traceSummary.failedStage`:
  - `retrieval`
  - `answering`

When retrieval itself throws before the normal success-path trace would have been created, the ask pipeline now creates a failed trace immediately with that same minimal `failure` payload. This keeps `traceId`, `failedStage`, and `failureMessage` available for both one-shot and stream retrieval failures.

## Current limitations

- query rewrite is single-shot and does not yet use conversation history
- rerank is heuristic and local, not a dedicated reranker model
- summary/list answers are mostly usable, but there is still a small boundary around missing peer main items or occasional misclassification of peer items

## Current trace UI behavior

The current trace detail page now exposes retrieval diagnostics more explicitly:

- `userQuery` and `rewrittenQuery` are shown side by side for direct comparison
- retrieved chunks are shown with rank order and final score
- retrieved chunks are tagged as primary hit vs. neighbor expansion when that metadata is available
- retrieved chunks can show a compact content preview without requiring an additional document fetch
- retrieved chunks can be marked as cited when they appear in the citation set
- score breakdown is visualized per chunk when available:
  - `score`
  - `vectorScore`
  - `lexicalScore`
  - `hybridScore`
  - `rerankScore`
- when a chunk is present in citations, the trace page links directly to the document chunk detail target
- trace-to-document deep links now preserve basic trace context such as rank, citation flag, primary/neighbor status, and final score
- trace now also retains stable retrieval/answering execution metadata so future pipeline evolution can be read from the persisted trace rather than reconstructed from mutable config state
- raw payload is still retained as a secondary panel for debugging

Fallback behavior:

- if `retrievalScoresJson` is missing or incomplete for a trace, the UI still shows captured chunk order
- missing score components are rendered as unavailable rather than inferred

## Related files

- [apps/api/src/modules/assistants/assistants.controller.ts](../apps/api/src/modules/assistants/assistants.controller.ts)
- [apps/api/src/modules/retrieval/retrieval.service.ts](../apps/api/src/modules/retrieval/retrieval.service.ts)
- [apps/api/src/modules/traces/traces.service.ts](../apps/api/src/modules/traces/traces.service.ts)
- [apps/api/test/retrieval.test.js](../apps/api/test/retrieval.test.js)
- [apps/api/test/api-flow.test.js](../apps/api/test/api-flow.test.js)
