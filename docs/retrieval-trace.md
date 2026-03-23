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

- [apps/api/src/infra/llm/llm.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/llm/llm.service.ts)

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
  - `usedFallback`
  - `promptId`
- `execution`
  - `retrievalQuery`
  - `topK`
  - `scoreThreshold`
  - `chunkWindow`
  - `actualMode`
  - `usedFallback`
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
- `contextMode`
- `inputChunkCount`
- `contextGroupCount`
- `citationCount`
- `answerStatus`

This is the stable summary of how answer generation actually ran for the trace.

## Current limitations

- query rewrite is single-shot and does not yet use conversation history
- rerank is heuristic and local, not a dedicated reranker model

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

- [apps/api/src/modules/assistants/assistants.controller.ts](/D:/FeProjects/rag-system/apps/api/src/modules/assistants/assistants.controller.ts)
- [apps/api/src/modules/retrieval/retrieval.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/retrieval/retrieval.service.ts)
- [apps/api/src/modules/traces/traces.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/traces/traces.service.ts)
- [apps/api/test/retrieval.test.js](/D:/FeProjects/rag-system/apps/api/test/retrieval.test.js)
- [apps/api/test/api-flow.test.js](/D:/FeProjects/rag-system/apps/api/test/api-flow.test.js)
