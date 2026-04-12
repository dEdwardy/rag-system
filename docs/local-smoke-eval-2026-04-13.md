# Local Smoke Eval 2026-04-13

## Scope

- Environment: local web `5173`, local api `3000`
- Assistant: `default-assistant`
- Knowledge base: current local seeded workspace plus uploaded test content under `D:\FeProjects\rag-test\content`
- Question set: [D:\FeProjects\rag-test\question.md](D:\FeProjects\rag-test\question.md)

## Summary

- Total questions: `40`
- Grounded answers: `37`
- Insufficient-context responses: `3`

Section breakdown:

- `人工智能发展`: `10/10` grounded
- `环境保护`: `10/10` grounded
- `太空探索`: `9/10` grounded
- `健康生活方式`: `8/10` grounded

## Current Conclusion

This local smoke run is good enough to serve as a practical regression baseline.

The previous structured-Markdown issue where retrieval often returned only heading chunks has improved materially after the retrieval-side neighbor expansion fix:

- summary/list questions now answer much more reliably
- heading hits can bring along the next body chunk even when `chunkWindow = 0`
- the remaining failures in this run look more like source-coverage limits than clear retrieval regressions

## Passed

All questions in these sections returned `grounded`:

- `人工智能发展`
- `环境保护`

The following sections mostly passed:

- `太空探索`: `9/10`
- `健康生活方式`: `8/10`

Representative successful prompts:

- `图灵测试是在哪一年提出的？`
- `人工智能在医疗健康领域的应用有哪些？`
- `What are the main goals of space exploration?`
- `What technologies are used in space exploration?`
- `What are the challenges of space exploration?`
- `How does space exploration benefit humanity?`

## Reasonable Refusals

These questions returned `insufficient_context`, and based on the current local source content that behavior appears reasonable:

1. `太空探索 / 推理型问题`
   `如何解决长期太空飞行对人体健康的影响？`
   Current retrieved material mentions long-duration spaceflight health impact as a challenge, but does not provide a solution path.

2. `健康生活方式 / 推理型问题`
   `定期健康检查的重要性是什么？`
   Current retrieved material lists health-check items, but does not explain why regular checkups are important.

3. `健康生活方式 / 综合型问题`
   `社会关系对健康的影响是什么？`
   Current retrieved material does not appear to include a dedicated section covering social relationships and health impact.

## Follow-up Candidates

These are not urgent regressions, but they are good candidates for later improvement:

- Add a lightweight smoke runner so this question set can be replayed after retrieval or answering changes.
- Consider a slightly richer structural expansion heuristic for list-driven docs when a question asks for importance, causes, or solutions.
- If these three refused questions are expected to answer, extend the local source content so the knowledge base actually contains the needed explanation text.

## Validation Used

- `pnpm --filter @rag-system/api test:file -- test/retrieval.test.js`
- `pnpm --filter @rag-system/api test:file -- test/ask-success.test.js`
- direct local API smoke run against `http://localhost:3000/assistants/default-assistant/ask`
