# source-sitemap-index-013

- 标题: Expand sitemap-index stability
- 状态: completed
- 代理: rag-build
- 会话: ses_2cc0b0ea6ffeISCokAK53yqVAT
- 消息: msg_d33f6f551001HSmCQlc5c8iFWo
- 开始: 2026-03-28 18:19:43
- 收到: 2026-03-28 18:22:07
- 完成: 2026-03-28 18:22:07

## 结果
Implemented one **minimal sitemap index handling increment** end-to-end (inspect → change → focused validation → commit).

### What code path I inspected first
- `apps/api/src/infra/sitemap-source/sitemap-source.service.ts`
- `apps/api/test/parsing.test.js`

### Chosen edge case (single focused increment)
**Sitemap index XML with namespace-prefixed tags** (e.g. `<sm:sitemapindex>`, `<sm:sitemap>`, `<sm:urlset>`, `<sm:url>`, `<sm:loc>`).

Previously, parsing logic only matched non-prefixed tag names, so valid namespaced sitemap-index payloads could be treated as unsupported/empty extraction paths.

### Exact behavior improved
The sitemap source flow now correctly parses one-level sitemap indexes and child urlsets even when sitemap tags are namespace-prefixed, while keeping the same source family and overall behavior boundaries.

---

### Files changed
1. `apps/api/src/infra/sitemap-source/sitemap-source.service.ts`
   - Made sitemap tag detection/extraction regex namespace-tolerant for:
     - root format detection (`urlset`, `sitemapindex`)
     - page URL extraction (`url` + `loc`)
     - child sitemap extraction (`sitemap` + `loc`)
     - nested sitemap-index guard in child xml

2. `apps/api/test/parsing.test.js`
   - Added focused regression test:
     - `SitemapSourceService parses namespaced sitemap index and child urlset tags`

3. `docs/current-progress.md`
   - Added one progress entry for this increment and its focused validation result.

---

### Focused validation run
```bash
pnpm test:api:file -- test/parsing.test.js
```

Result:
- `test/parsing.test.js` passed
- `26/26` tests passed

---

### Commit
- Branch: `dev`
- Commit: `69c05d4`
- Message: `fix: accept namespaced sitemap index tags`

No push / PR performed (kept for wave closeout as requested).

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.
Commit each completed increment on the current branch, but keep push and PR decisions for a stable wave closeout point after validation is green.
Prefer `dev` for backend work unless the task explicitly requires a different branch transition.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read AGENTS.md and the primary docs.

Implement one minimal sitemap index handling improvement.

Priority guidance:
- focus on one `sitemap index` edge case
- prefer clearer parsing, recovery, or error reporting
- do not add a new source family
- do not broaden into a connector platform rewrite

Choose one small focused increment, validate it minimally, and report the exact sitemap behavior it improves.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

