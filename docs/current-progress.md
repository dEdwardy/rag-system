# Current Progress

> 文档角色：`current-status`
> 当前使用方式：用于记录当前实现进度、已完成增量、未完成方向和验证快照；现阶段优先级判断以 `docs/next_steps_rag_project_plan.md` 为主。

更新时间：2026-03-28

> 当前说明：
> 现阶段任务方向、优先级判断、superpowers 使用方式、AI review 策略，以 `docs/next_steps_rag_project_plan.md` 为主。
> 本文档主要用于记录当前实现进度、已完成增量、未完成方向和验证快照。

补充进展（2026-03-27）：

补充进展（2026-03-28）：

- ✅ trace summary now enforces contract-safe enum values for `answerTextSource` / `answerStatusSource`
  - `apps/api/src/modules/traces/traces.service.ts` now normalizes these two fields through explicit trace-contract enum guards, so out-of-contract legacy/raw values no longer leak into `traceSummary` typed fields
  - invalid/raw source values are still preserved in readability labels (`unknown ... (<raw>)`) for diagnostics readability
  - `apps/api/test/traces.service.test.js` updates the invalid-stage regression path to assert contract-safe `null` values plus preserved raw readability labels
  - scope remains trace read-model contract guard only: no retrieval/answering execution semantics, persistence schema, or API route changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed (`26/26`)

- ✅ ask / ask-stream final payload now expose additive `answerEvidenceSource` + `answerEvidenceSourceReadabilityLabel` aligned with trace-summary evidence-source wording
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now includes the two fields in both one-shot ask and stream final payload using the existing attribution-source resolution path (`answerEvidenceSource` mirrors `answerAttributionSource`)
  - `apps/web/src/types/api.ts` `AskResponse` now includes optional `answerEvidenceSource` + `answerEvidenceSourceReadabilityLabel` to keep web-side contract typing aligned with backend payload
  - `apps/api/test/ask-success.test.js` and `apps/api/test/ask-stream-service.test.js` now assert the new fields on representative one-shot and stream final response paths
  - scope remains additive/read-model contract alignment only: no retrieval execution semantics, ranking/defaults, or source-family behavior changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/ask-success.test.js test/ask-stream-service.test.js`
  - 实测结果：focused ask tests passed (`48/48`)

- ✅ feed Atom canonical alternate-link extraction now accepts mixed-case multi-token `rel` values containing `alternate`
  - `apps/api/src/infra/feed-source/feed-source.service.ts` now treats Atom `<link rel>` as tokenized (case-insensitive) and continues preferring canonical alternate href when any `rel` token is `alternate`
  - `apps/api/test/parsing.test.js` adds one focused regression for `rel="Via ALTERNATE preview"` to guard canonical alternate-link preference over self link
  - scope remains one feed parsing edge case only: no feed dedup/refresh-window/source-family behavior changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed (`30/30`)

- ✅ feed Atom canonical link extraction now tolerates single-quoted attributes and `rel`/`href` order variants
  - `apps/api/src/infra/feed-source/feed-source.service.ts` now parses Atom `<link>` tag attributes quote-agnostically and resolves canonical entry links by preferring `rel="alternate"` regardless of attribute order; when no alternate link exists, existing first-link fallback remains
  - `apps/api/test/parsing.test.js` adds focused regression coverage for Atom entries using single-quoted `rel`/`href` attributes in both `rel->href` and `href->rel` orders
  - scope remains one feed parsing edge case only: no refresh-window changes, no dedup redesign, no new source-family work
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed (`29/29`)

- ✅ sitemap source fetch now tolerates missing/`text/plain` content-type only when payload clearly looks like sitemap XML
  - `apps/api/src/infra/sitemap-source/sitemap-source.service.ts` now applies one narrow sitemap payload fallback in both root sitemap fetch and child sitemap fetch path: when `content-type` is missing (`unknown`) or starts with `text/plain`, payloads containing `<urlset>` or `<sitemapindex>` proceed through existing sitemap parsing
  - strict behavior is preserved for non-sitemap payloads under `text/plain`/missing content-type (`Unsupported sitemap content type` remains)
  - `apps/api/test/parsing.test.js` adds focused regression coverage for sitemap-index root `unknown` content-type + child `text/plain` sitemap XML acceptance, and a guard test that `text/plain` non-XML payload still fails
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed (`28/28`)

- ✅ sitemap-index parsing now accepts namespaced XML tags (`<sm:sitemapindex>`, `<sm:urlset>`) in one-level index expansion flow
  - `apps/api/src/infra/sitemap-source/sitemap-source.service.ts` now uses namespace-tolerant sitemap regex patterns for root format detection and `<url>/<loc>` / `<sitemap>/<loc>` extraction, so valid prefixed sitemap-index payloads no longer fail as unsupported format
  - `apps/api/test/parsing.test.js` adds focused regression coverage for namespaced sitemap-index + namespaced child urlset parsing
  - scope remains one sitemap-index parsing edge case only: no new source family, no retry-policy rewrite, no ingestion/persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed (`26/26`)；带 XML namespace 前缀的 sitemap-index/child-urlset 现在可正常展开页面并继续抓取内容

- ✅ feed freshness window selection now avoids timestamp-only reordering when feed entries have mixed date availability
  - `apps/api/src/infra/feed-source/feed-source.service.ts` now keeps the original feed polling order (`slice(0, maxItems)`) when `maxItems` truncation applies but extracted entries contain mixed timestamp availability (some entries dated, some undated)
  - this closes one narrow stale-feed refresh gap in existing `feed` source updates: undated entries (common in partial/legacy feeds) are no longer dropped purely because other entries include parseable dates
  - full freshness sort-by-date behavior is preserved when all candidate entries have timestamps
  - `apps/api/test/parsing.test.js` adds focused regression coverage for the mixed-timestamp truncation path
  - scope remains feed refresh-window selection only: no new source family, no retry-policy rewrite, no ingestion/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed (`25/25`)；feed 轮询窗口在“日期字段混合缺失”场景下现在优先保持源顺序，避免把顶部无日期的新条目误当成旧条目而被截断

- ✅ external-source stale-run guard now short-circuits before remote fetch when a newer document version is already active
  - `apps/api/src/modules/documents/documents.service.ts` now applies a pre-fetch stale guard (`shouldContinueCurrentExternalRun`) immediately after reserving/queueing an external-source run (`createWebPageDocument` / `createFeedDocument` / `createSitemapDocument` / `resyncExternalDocument`), so superseded runs are skipped before calling remote source fetchers
  - this closes one narrow duplicate-fetch edge case in concurrent external resync/create paths: when version `N` is superseded by `N+1` before fetch starts, the stale `N` run no longer performs redundant upstream HTTP fetch + local generated-file persistence attempt
  - `apps/api/test/external-source-sync.test.js` adds focused coverage for this pre-fetch stale path (`createWebPageDocument` skips fetch and records `EXTERNAL_SOURCE_RUN_SUPERSEDED`)
  - scope remains stale-run guard only: no source-family expansion, no retry-policy rewrite, no ingestion/persistence schema changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/external-source-sync.test.js`
  - 实测结果：focused external-source sync tests passed；并发场景下被新版本 supersede 的旧 run 会在 fetch 前直接标记 skipped，不再重复抓取同一 external source

- ✅ external-source redirect diagnostics now fail clearly when upstream redirect response omits `Location`
  - `apps/api/src/infra/http/fetch-with-retry.ts` now treats `301/302/303/307/308` without `Location` as an explicit redirect-follow failure: `Failed to follow redirect for <url>: missing redirect location header.`
  - this closes one narrow redirect edge case across existing `web page` / `feed` / `sitemap` fetches: malformed redirect responses no longer flow downstream as opaque non-2xx HTTP/content-type failures
  - `apps/api/test/fetch-with-retry.test.js` adds focused coverage for the missing-`Location` redirect path
  - scope remains redirect diagnostics-only: no source-family expansion, no retry-policy rewrite, no ingestion/persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/fetch-with-retry.test.js`
  - 实测结果：focused fetch-with-retry tests passed；当上游返回 `302` 但缺失 `Location` header 时，错误现在会直接提示 `missing redirect location header`，便于快速定位上游响应问题

- ✅ feed source fetch now accepts RSS/Atom XML payload when upstream content-type is mis-labeled as `text/plain`
  - `apps/api/src/infra/feed-source/feed-source.service.ts` now adds one narrow fallback: when `content-type` is missing (`unknown`) or starts with `text/plain`, and payload clearly looks like feed XML (`<rss>` / `<feed>`), it proceeds with existing feed parsing instead of immediately failing with `Unsupported feed content type`
  - this closes one narrow HTTP response edge case for existing `feed` source ingestion where upstream serves valid RSS/Atom payload but labels response as plain text
  - behavior remains strict for explicit non-feed content types/payloads (unsupported content-type and unsupported feed format paths are preserved)
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed；被标成 `text/plain` 的 RSS/Atom feed payload 现在可以继续解析并生成内容，不再在 source-fetch 阶段被误判为 unsupported content type

- ✅ external-source fetch failures now include exhausted retry-attempt context on final network/timeout errors
  - `apps/api/src/infra/http/fetch-with-retry.ts` now appends one additive suffix on final retry-exhausted fetch exceptions: `(after <N> attempts).` (for `Fetch request failed ...` and `Fetch request timed out ...` paths only)
  - this closes one narrow fetch-visibility gap across existing `web page` / `feed` / `sitemap` source families: diagnostics can now immediately distinguish one-shot failure from retry-exhausted failure without inferring from runtime config
  - `apps/api/test/fetch-with-retry.test.js` adds focused coverage for the retry-exhausted network-failure path (`attempts=2`)
  - scope remains diagnostics-only: no source-family expansion, no retry-policy rewrite, no ingestion/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/fetch-with-retry.test.js`
  - 实测结果：focused fetch-with-retry tests passed (`11/11`)；重试耗尽时错误消息现在会显式附带尝试次数（例如 `... (after 2 attempts).`）

- ✅ feed-source dedup now prefers canonical entry link identity to avoid duplicate ingestion when metadata drifts
  - `apps/api/src/infra/feed-source/feed-source.service.ts` now resolves feed-entry dedup key as:
    - `link:<normalized-link>` when link exists (including relative-link resolution against feed URL and hash stripping)
    - fallback to metadata-only key (`title + publishedAt + summary`) when link is missing
  - this closes one narrow duplicate-ingest edge case in existing `feed` source flow: repeated entries with the same URL but changed title/summary/pubDate are now treated as duplicates and skipped
  - `apps/api/test/parsing.test.js` adds focused regression coverage for same-link feed entries with different metadata
  - scope remains dedup-guard-only: no source-family expansion, no retry-policy rewrite, no ingestion/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed (`23/23`)

- ✅ external-source re-sync now recovers legacy web-page documents when stored `sourceConfigJson` is missing
  - `apps/api/src/modules/documents/documents.service.ts` now applies one narrow legacy fallback during `POST /documents/:id/reindex` parsing: when external config is missing but the document identity is still `sourceType=web_page` + `sourceName=<url>`, re-sync reconstructs `{ kind: "web_page", url: sourceName }` and continues re-fetch instead of failing early with `EXTERNAL_SOURCE_CONFIG_INVALID`
  - `apps/api/test/external-source-sync.test.js` adds focused regression coverage for this stale-state path (`sourceConfigJson: null` on a legacy web-page document) and asserts re-sync proceeds through fetch/finalize/enqueue
  - scope remains re-sync recovery only: no new source family, no retry-policy rewrite, no ingestion/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/external-source-sync.test.js`
  - 实测结果：focused external-source sync tests passed；legacy web-page source config 丢失时不再直接失败，可继续 remote re-fetch 并进入后续 ingestion

- ✅ sitemap source URL dedup now ignores hash-only differences to avoid duplicate page fetches in urlset/sitemapindex flows
  - `apps/api/src/infra/sitemap-source/sitemap-source.service.ts` now normalizes sitemap URL dedup keys by stripping URL fragment (`#...`) before duplicate checks for:
    - direct `urlset` page URL extraction
    - merged page URL collection across `sitemapindex` child sitemaps
    - child sitemap URL extraction from `sitemapindex`
  - this closes one narrow external-source duplication failure mode: the same page/sitemap repeated with hash-only variants (for example `.../page#intro` vs `.../page#summary`) no longer consumes `maxPages` budget or causes redundant page fetch attempts
  - `apps/api/test/parsing.test.js` adds focused regression coverage for hash-only duplicate page URLs across sitemap-index children
  - scope remains duplicate-suppression-only: no source-family expansion, no retry-policy rewrite, no ingestion/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed

- ✅ external-source fetch-failure diagnostics now include explicit source identity fields for run-level attribution
  - `apps/api/src/modules/documents/documents.service.ts` now appends additive `sourceType` + `sourceName` fields on `EXTERNAL_SOURCE_FETCH_FAILED` diagnostics when current document context is available
  - this closes one narrow source-execution visibility gap: failed runs can now be attributed to the exact source family and normalized source URL without relying only on free-form error message parsing
  - `apps/api/test/external-source-sync.test.js` updates the existing web-page fetch-failure assertion path to guard the new diagnostic fields on both document failure state and run failure record
  - scope remains diagnostics-only: no retry-policy changes, no ingestion state/persistence semantics changes, no source-family expansion
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/external-source-sync.test.js`
  - 实测结果：focused external-source sync tests passed (`23/23`)

- ✅ P0 closeout queue `opencode model split review`：当前 root/api/web 分工保持不变（无需调整）
  - 复核文件：`opencode.jsonc`、`apps/api/opencode.jsonc`、`apps/web/opencode.jsonc`
  - 结论：继续保持 `plan/review-risk -> gpt-5.4`、`build -> gpt-5.3-codex`、`explore -> gpt-5.3-mini`
  - 保持原因：
    - root 与 app-local 配置当前语义一致，未出现分工漂移
    - 当前进度未记录由模型分工导致的稳定质量回归或持续成本/时延压力
    - 现有分工已匹配本阶段“plan/review 质量优先、build 快验证、explore 低成本检索”的执行策略
  - 未变更内容：未改 loop harness、未改 command 模板语义、未改 plugin 边界

- ✅ opencode loop harness cleanup is complete
  - `scripts/opencode-loop/jsonc.mjs` now handles repo config comments, so `scripts/opencode-loop/runtime.mjs` stays focused on orchestration
  - self-test passed after the split: `node scripts/opencode-loop.mjs --self-test`
  - loop has been stopped cleanly; `p0-complete-010` is done and `007` / `009` remain `deferred`
  - docs now keep commit cadence and push/PR timing separate from the harness itself

- ✅ embedding runtime diagnostics now make partial OpenAI embedding env drift and model-source resolution easier to spot
  - `apps/api/src/infra/embedding/embedding-runtime-config.ts` now adds one additive unusable-provider hint when `OPENAI_EMBEDDING_MODEL` is set without `OPENAI_API_KEY` (and includes configured `OPENAI_BASE_URL` when present)
  - OpenAI embedding dimension-mismatch diagnostics now also include `Resolved OpenAI embedding model source: <env|default>` so it is explicit when the default model path won
  - `apps/api/test/embedding-runtime-config.test.js` adds focused coverage for the new unusable-provider wording and model-source hint
  - scope remains diagnostics-only: no provider-order changes, no retrieval behavior changes, no schema/persistence changes

- ✅ P0 closeout queue `eval/regression baseline`：已补最小可复用回归基线清单
  - 变更文件：`docs/next_steps_rag_project_plan.md`（在 queue item 8 下补充 closeout wave baseline）
  - baseline 命令（可重复执行）：
    - `pnpm test:api:file -- test/traces.service.test.js`
    - `pnpm test:api:file -- test/ask-success.test.js`
    - `node --test apps/web/test/trace-summary-contract.test.js`
  - 回归确认口径：三条命令全部通过即可判定本轮 ask/trace contract closeout 未回归；失败时先在对应路径修复后重跑同一组命令
  - 未变更内容：未引入新测试框架、未改 backend/web 运行时语义、未改 retrieval 或持久化行为

- ✅ P0 closeout queue `progress closeout note`：已补本轮简短收口记录
  - 变更内容：仅追加 `docs/current-progress.md` 当前进展条目，记录本轮完成状态
  - 未变更内容：未改 `apps/api` / `apps/web` / `packages/shared` 实现，未改 retrieval 语义、共享契约或持久化行为
  - 验证：`git diff --check -- "docs/current-progress.md"` 通过

- ✅ P0 closeout queue 已按计划完成，当前波次收口结束
  - `docs/next_steps_rag_project_plan.md` 已补入详细 queue-ready tasks，并附上可直接作为 queue item title 使用的短标题版：`ask/trace contract align`、`web trace contract guard`、`legacy fallback regressions`、`unknown/fallback wording unify`、`trace-summary doc sync`、`progress closeout note`、`third-party boundary note`、`eval/regression baseline`、`opencode model split review`、`mark P0 complete`
  - 完成结论：本轮仅做既定 closeout，不引入新方向；`P0: read-model / metadata convergence` 现已可标记完成

- ✅ P0 closeout queue `mark P0 complete`：已完成 phase closeout 状态更新
  - 变更文件：`docs/next_steps_rag_project_plan.md`、`docs/current-progress.md`
  - 完成说明：仅更新 P0 状态与收口结论，不追加新实现任务

- ✅ opencode loop now has a dedicated read-model/metadata build prompt template in the prompt path
  - added `.opencode/loop/prompts/read-model-metadata-build.md` to avoid reusing generic `prompts/build.md` wording for read-model/metadata convergence queue work
  - `scripts/opencode-loop/runtime.mjs` now ensures the dedicated prompt template exists under `.opencode/loop/prompts/` alongside existing default prompt bootstrap
  - `scripts/opencode-loop.md` prompt-family guidance and queue example now point read-model/metadata items to `prompts/read-model-metadata-build.md`
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；loop prompt path 现在提供了专用 read-model/metadata build 模板，不再要求这类任务复用 generic build prompt wording

- ✅ trace summary unknown/fallback readability wording now aligns for failed-stage and answer-source labels
  - `apps/api/src/modules/traces/traces.service.ts` now keeps known labels unchanged, while aligning null-fallback wording to `failed stage unavailable` / `answer status source unavailable` / `answer text source unavailable`; raw unknown values still keep `unknown ... (<raw>)`
  - `apps/api/test/traces.service.test.js` updates focused assertions for the aligned null-fallback wording
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；本轮仅收口可读文案，不改 retrieval 语义、契约、持久化或其他无关标签

- ✅ trace summary legacy fallback coverage now includes execution-level `fallbackReason -> strategySummary.usedFallback` backfill path
  - `apps/api/test/traces.service.test.js` adds one focused regression case to lock consistency when older retrieval metadata only has `retrievalMetadata.execution.fallbackReason` (missing explicit `usedFallback` fields)
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed (`24/24`)；legacy execution fallback-reason-only traces now have explicit regression guard that `traceSummary.strategySummary.usedFallback` resolves to `true` and aligns with strategy readability wording

- ✅ opencode loop now correctly parses repo `opencode.jsonc` comments for command model split
  - `scripts/opencode-loop/runtime.mjs` now strips JSONC line/block comments before parsing the repo command config, so `command.plan` / `command.build` can be loaded from `opencode.jsonc`
  - this closes the earlier fallback-to-`server-default` path when the repo config contained comments
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；loop 现在可以正确读取带注释的 `opencode.jsonc`，不再因为 `JSON.parse` 直接失败而忽略模型分工配置

- ✅ opencode loop can now auto-refill a small follow-up queue wave before exiting
  - added `scripts/opencode-loop/planner.mjs` as a guarded planner path that uses the repo `command.plan` agent/model when available, asks for strict JSON follow-up tasks, writes planner audit handoffs, and materializes generated prompts under `.opencode/loop/prompts/generated/`
  - `scripts/opencode-loop/runtime.mjs` now triggers one optional refill pass when the queue drains, appends generated items back into `.opencode/loop/queue.json`, then keeps processing them in the same run
  - `scripts/opencode-loop/queue.mjs` now exposes `appendQueueItems(...)` for atomic append-style queue growth during refill; `scripts/opencode-loop.mjs` now supports `OPENCODE_LOOP_AUTO_REFILL_MAX_CYCLES` and `OPENCODE_LOOP_AUTO_REFILL_MAX_ITEMS`
  - tuned `.opencode/loop/prompts/plan-next.md` toward the current repository wave (single-line mainline, backend/API-first, additive read-model/diagnostics/contract closeout) and set the systemd loop service template to run with `OPENCODE_LOOP_AUTO_REFILL_MAX_CYCLES=2`
  - `scripts/opencode-loop/self-test.mjs` now covers three harness paths together: normal draining, interrupted-session resume, and one guarded auto-refill cycle
  - `scripts/opencode-loop.md` now documents the planner/refill behavior and the new env knobs
  - scope kept conservative on purpose: default refill budget is one planner pass and two generated items per loop invocation, so the runner can continue automatically without turning into an unbounded self-expanding queue
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；空队列时 loop 现在可先生成一小波后续任务并继续执行，同时保留 planner handoff 审计轨迹

- ✅ current-progress closeout note appended for this increment
  - changed files: `docs/current-progress.md`
  - focused validation: `git diff --check -- "docs/current-progress.md"`

- ✅ ask final payload and trace summary now share one backend helper for answer-attribution readability wording
  - added `apps/api/src/modules/answering/answer-attribution-summary.ts` with `buildAnswerAttributionSummary(...)` to centralize attribution/source label and readability sentence/resolved-label mapping
  - `apps/api/src/modules/traces/traces.service.ts` now uses the shared helper when composing `traceSummary.answerAttributionSummary`
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now uses the same shared helper for ask final payload `answerAttributionSummary`
  - scope kept additive/readability-only; no retrieval behavior changes, no schema/persistence changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 46/46 passed；ask final payload 与 trace summary 的 attribution readability wording now comes from the same helper path, reducing drift risk

- ✅ trace summary now exposes additive `rewriteReadabilityLabel` for one-line rewrite provenance readability
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `rewriteReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.rewriteReadabilityLabel` from resolved rewrite metadata (`rewriteEnabled` / `rewriteApplied` / `rewriteUsedFallback` / `rewritePromptId`) with stable wording (`rewrite <enabled|disabled>; rewrite applied: <yes|no>; rewrite fallback: <yes|no|unknown>; rewrite prompt: <id|unknown>.`)
  - `apps/api/test/traces.service.test.js` now asserts the new field in both default/no-rewrite and rewrite-fallback strategy-summary paths; `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract field
  - `docs/current-dev-setup.md` trace-summary field list now includes `rewriteReadabilityLabel`
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取 rewrite 启用/是否生效/是否 fallback/prompt 来源的一行可读摘要，减少跨字段拼接阅读成本

- ✅ OpenAI embedding dimension-mismatch guardrail now logs the resolved embedding endpoint for faster config drift diagnosis
  - `apps/api/src/infra/embedding/embedding-runtime-config.ts` now appends one additive endpoint hint on OpenAI dimension mismatch: `Resolved OpenAI embedding endpoint: <OPENAI_BASE_URL>/embeddings.`
  - this keeps the increment strictly diagnostics-only on one existing guardrail path: no provider-order changes, no retrieval behavior changes, no schema/persistence changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/embedding-runtime-config.test.js`
  - 实测结果：focused embedding runtime config tests passed；当 OpenAI embedding 返回维度与模型不匹配时，报错会同时给出当前实际命中的 embedding endpoint，便于直接识别 `OPENAI_BASE_URL` 端点漂移

- ✅ OpenAI embedding dimension-mismatch diagnostics now explicitly clarify default-model fallback selection
  - `apps/api/src/infra/embedding/embedding-runtime-config.ts` now appends one extra hint only when OpenAI embedding model selection comes from the default path (`OPENAI_EMBEDDING_MODEL` unset): `OPENAI_EMBEDDING_MODEL is unset, so the default embedding model "text-embedding-3-small" is currently in use.`
  - `apps/api/test/embedding-runtime-config.test.js` now adds focused coverage for this default-model mismatch wording
  - this is a narrow embedding model-selection clarity increment only: no provider-order changes, no retrieval behavior changes, no schema/persistence changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/embedding-runtime-config.test.js`
  - 实测结果：focused embedding runtime config tests 13/13 passed；当 OpenAI embedding 维度不匹配且模型来自默认路径时，报错会明确提示“当前在用默认模型”，降低“未显式设置模型却误以为用了自定义模型”的排障歧义

- ✅ feed-source entry dedup now ignores URL hash-only differences to avoid duplicate ingestion of the same entry
  - `apps/api/src/infra/feed-source/feed-source.service.ts` now normalizes feed entry dedup links by stripping URL fragment (`#...`) before dedup key comparison (with existing safe fallback for non-URL link strings)
  - this is a narrow dedup guard increment for existing `feed` source extraction only: no source-family expansion, no fetch retry policy change, no ingestion persistence/schema behavior change
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed；当同一 feed entry 仅 `#fragment` 不同（如 `.../a#top` 与 `.../a#latest`）时，现在会被视为重复条目并跳过后者，避免重复 entry 写入生成内容

- ✅ external-source fetch network-failure errors now include explicit source URL attribution
  - `apps/api/src/infra/http/fetch-with-retry.ts` now normalizes non-redirect fetch exceptions into `Fetch request failed for <url>: <original message>` while preserving existing redirect-follow diagnostics wording
  - this is a narrow source-fetch diagnostics increment for existing `web page` / `feed` / `sitemap` paths only: no source-family expansion, no retry-policy rewrite, no ingestion/persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/fetch-with-retry.test.js`
  - 实测结果：focused fetch-with-retry tests passed；当上游网络失败仅返回通用 `fetch failed` 时，错误现在会携带具体 source URL（例如 `Fetch request failed for https://example.com/source.xml: fetch failed`），便于 run diagnostics 直接定位失败来源

- ✅ external-source fetch now reports clearer redirect-follow failures when upstream redirects to non-HTTP(S) targets
  - `apps/api/src/infra/http/fetch-with-retry.ts` now performs one bounded manual redirect-follow loop (`301/302/303/307/308`, max `5`) so invalid redirect targets can be reported deterministically; when a redirect points to non-HTTP(S) scheme, the helper now throws `Failed to follow redirect for <url>: redirect target must use http/https.`
  - this is a narrow source-fetch diagnostics increment for existing `web page` / `feed` / `sitemap` fetch paths only: no source-family expansion, no retry-policy rewrite, no ingestion state/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/fetch-with-retry.test.js`
  - 实测结果：focused fetch-with-retry tests passed；当上游返回 `302` 且 Location 为 `mailto:` 等非 HTTP(S) scheme 时，错误信息现在会直接指向“redirect target must use http/https”，不再仅返回模糊的 `fetch failed`

- ✅ opencode loop `pick` status now shows cursor-distance steps to the next pending item
  - `scripts/opencode-loop/runtime.mjs` now computes one additive visibility field in `buildQueueCursorVisibility()`:
    - `nextPendingCursorDistance`
  - the value reports how many queue steps the active cursor is away from the next pending task index (wrap-around aware)
  - this is a narrow queue observability increment only: no queue schema change, no pick/complete semantics change, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；`pick` 日志现在可直接看到“游标距离下一个 pending 任务还差几步”，无需再手动对比 `queueCursor` 与 `nextPendingItemIndex`

- ✅ opencode loop `pick` status now adds resume-preview fields around the active queue cursor item
  - `scripts/opencode-loop/runtime.mjs` now adds a small `buildActiveCursorResumeVisibility()` helper and extends the existing cursor visibility payload with:
    - `queueCursorItemTitle`
    - `queueCursorResumePreview`
    - `queueCursorResumeSessionId`
    - `queueCursorResumeMessageId`
    - `queueCursorResumeStartedAt`
  - resume-preview fields only appear when the active cursor item is `in_progress`, preserving current queue format and scheduling semantics
  - this is a narrow queue observability increment only: no queue schema change, no pick/complete behavior change, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；恢复/中断任务在 `pick` 状态里现在可直接读到“是否已有可复用 session、是否已有已跟踪 assistant message、以及该中断任务起始时间”

- ✅ opencode loop status now adds pending/completed family counts (derived from queue item id prefix)
  - `scripts/opencode-loop/runtime.mjs` now adds a small `buildQueueFamilyCountVisibility()` helper and includes two additive status fields on existing `pick` / `idle` logs:
    - `queuePendingByFamily`
    - `queueCompletedByFamily`
  - family is resolved from the queue item `id` prefix (split by `-` / `_` / `:` / `/` / `.`), preserving current queue format and scheduling behavior
  - this is a narrow queue observability increment only: no queue schema change, no pick/complete semantics change, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；状态日志现在可直接看到按任务 family/prefix 聚合的 pending/completed 计数（例如默认 `build-*` 队列会显示 `queuePendingByFamily={"build":...}`）

- ✅ trace summary `failedStageReadabilityLabel` now includes raw diagnostics stage when stage value is outside trace contract
  - `apps/api/src/modules/traces/traces.service.ts` now keeps current normalized `failedStage` behavior (`retrieval` / `answering` only) and, for non-contract stage values, emits readability wording as `unknown failed stage (<raw-stage>)` instead of dropping the raw diagnostic stage context
  - this is a narrow readability-only increment for failure traces; no retrieval execution semantics, stage normalization semantics, or persistence contracts are changed
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；当失败诊断里出现 `source_fetch` 这类非 trace 合约 stage 时，`traceSummary.failedStageReadabilityLabel` 现在会直接显示 `unknown failed stage (source_fetch)`，比仅显示 `unknown failed stage` 更易读

- ✅ trace summary `strategyReadabilityLabel` now includes explicit fallback-usage wording for clearer retrieval-mode fallback provenance
  - `apps/api/src/modules/traces/traces.service.ts` now appends `fallback used: yes|no|unknown` to existing strategy readability sentence, derived from resolved `strategySummary.usedFallback`
  - this keeps the increment additive/readability-only while preserving existing retrieval execution semantics and mode resolution behavior
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；即使 `fallbackReason` 缺失（例如 legacy 仅有 `usedFallback=true`），trace summary 一行策略摘要也能直接读出 fallback 是否发生

- ✅ trace summary now exposes additive `answerEvidenceSource` + `answerEvidenceSourceReadabilityLabel` for clearer final-answer evidence-source readability
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with:
    - `answerEvidenceSource: TraceCitationSelectionSource | null`
    - `answerEvidenceSourceReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits both fields from existing final-answer citation selection metadata, with stable fallback wording (`structured evidence source` / `inline-marker evidence source` / `heuristic evidence source` / `no evidence source` / `unknown evidence source`)
  - `apps/api/test/traces.service.test.js` now asserts the new fields for both missing-metadata and populated-metadata summary paths; `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract fields
  - `docs/current-dev-setup.md` trace-summary field list now includes `answerEvidenceSource` and `answerEvidenceSourceReadabilityLabel`
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取 answer evidence source 的别名与可读标签，减少仅看 `citationSelectionSource` 时的语义跳转

- ✅ OpenAI embedding dimension mismatch error now includes explicit endpoint/model compatibility guidance
  - `apps/api/src/infra/embedding/embedding-runtime-config.ts` now appends one actionable hint when OpenAI embedding response dimensions mismatch expected model dimensions: `Check OPENAI_EMBEDDING_MODEL and OPENAI_BASE_URL compatibility for the embedding endpoint.`
  - `apps/api/test/embedding-runtime-config.test.js` now asserts this guidance in the existing OpenAI dimension-mismatch path
  - this is a narrow embedding config diagnostics increment only: no provider-order changes, no retrieval behavior changes, no schema/persistence changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/embedding-runtime-config.test.js`
  - 实测结果：focused embedding runtime config tests passed；当代理或模型配置导致维度不匹配时，报错会直接提示检查 `OPENAI_EMBEDDING_MODEL` 与 `OPENAI_BASE_URL` 的兼容性，降低“只看到维度数字但定位不到配置漂移点”的排障风险

- ✅ external-source finalize/failure updates now use atomic `id + version` guard to avoid stale overwrite under concurrent re-sync
  - `apps/api/src/modules/documents/documents.service.ts` now applies external finalize/failure document writes through version-guarded `updateMany({ where: { id, version } })` first, instead of relying only on pre-check then blind `update`
  - when the guarded write misses (`count=0`), the existing stale-run skip path is preserved (`EXTERNAL_SOURCE_RUN_SUPERSEDED`), so stale fetch/persist responses cannot overwrite newer in-flight source versions between check and write
  - `apps/api/test/external-source-sync.test.js` now adds focused coverage for this concurrent stale-response race (`finalize uses version-guarded update`)
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/external-source-sync.test.js`
  - 实测结果：focused external-source sync tests 23/23 通过；并发 resync 下旧版本 finalize 响应即使晚到，也会被 `id+version` 原子写入保护拦截，不会回写覆盖新版本文档状态

- ✅ web-page source fetch now accepts HTML payload when upstream content-type is missing or mis-labeled as `text/plain`
  - `apps/api/src/infra/web-page/web-page.service.ts` now adds one narrow fallback: when response `content-type` is missing (`unknown`) or starts with `text/plain`, and payload clearly looks like HTML (`<!doctype html>` / `<html>` / `<head>` / `<body>` / `<title>`), it proceeds with existing HTML extraction instead of immediately failing with `Unsupported web page content type`
  - this closes one real HTTP response edge case for existing `web page` and downstream `sitemap` page fetches where upstream serves valid HTML but omits or mislabels content type
  - behavior remains strict for explicit non-HTML content types (for example `application/pdf` still fails)
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed；被标成 `text/plain`（或缺失 `content-type`）的 HTML 页面现在可继续提取 title/content，不再在 source-fetch 阶段被误判为 unsupported content type

- ✅ opencode loop `pick` status now previews next pending queue item index/title for faster cursor-target readability
  - `scripts/opencode-loop/runtime.mjs` now expands existing queue cursor visibility logs with:
    - `nextPendingItemIndex`
    - `nextPendingItemTitle`
  - existing `nextPendingItemId` is preserved; this is a narrow observability-only increment to make the next pending target easier to identify at a glance
  - no queue schema change, no scheduling-policy change, no pick/complete semantics change, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；`pick` 日志现在可同时看到 next pending item 的 `id + index + title`，更容易快速判断下一项具体指向

- ✅ opencode loop `idle` status now reports remaining queue work at a glance
  - `scripts/opencode-loop/runtime.mjs` now adds `buildIdleQueueWorkVisibility()` and extends the existing `logStatus("idle", ...)` payload with:
    - `remainingQueueWork`
    - `queuePending`
    - `queueInProgress`
    - `queueCompleted`
    - `queueTotal`
  - this is a narrow idle-log observability increment only: no queue schema change, no pick/complete behavior change, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；队列空闲时现在可直接看到剩余工作是否为 `0`，并同时看到 pending/in-progress/completed 的当前计数

- ✅ trace read-model now backfills `strategySummary.usedFallback` from legacy top-level `retrievalMetadata.usedFallback`
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.usedFallback` in this order: `retrievalMetadata.execution.usedFallback` -> persisted `strategySummary.usedFallback` -> legacy `retrievalMetadata.usedFallback` -> derived from resolved `fallbackReason`
  - this closes a minimal fallback-clarity gap where older traces could persist top-level fallback usage without `execution` / `strategySummary`, causing resolved strategy summary to under-report effective fallback usage
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；legacy top-level `usedFallback` metadata 下 `traceSummary.strategySummary.usedFallback` 现在可直接对齐

- ✅ trace summary now exposes additive `candidateCountReadabilityLabel` for at-a-glance candidate-flow count wording
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `candidateCountReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.candidateCountReadabilityLabel` from existing `candidateLimit` / `vectorCandidateCount` / `lexicalCandidateCount` / `mergedCandidateCount` / `rankedCandidateCount` with stable wording (`vector <V>, lexical <L>, merged <M>, ranked <R> (candidate limit <C>)`)
  - `apps/api/test/traces.service.test.js` now asserts the new field for both failed and successful trace-summary paths
  - `docs/current-dev-setup.md` trace-summary field list now includes `candidateCountReadabilityLabel`
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取 `candidateCountReadabilityLabel`，比分散读取多个 candidate 数字更容易一眼识别候选流规模

- ✅ trace summary now exposes additive `citationCountReadabilityLabel` for at-a-glance citation-count wording
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `citationCountReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.citationCountReadabilityLabel` from existing `citationCount` / `citationCountBeforeLimit` / `citationLimitHit` with stable wording (`no citations` / `1 citation` / `<N> citations` / `<N> citations shown (<M> before limit)`)
  - `apps/api/test/traces.service.test.js` now asserts the new field for both non-limited and citation-limit-hit trace-summary paths
  - `docs/current-dev-setup.md` trace-summary field list now includes `citationCountReadabilityLabel`
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取 `citationCountReadabilityLabel`，比裸 `citationCount` / `citationCountBeforeLimit` 更容易一眼识别“是否命中 citation 限制”

- ✅ trace summary now exposes additive `missingInformationCountReadabilityLabel` for at-a-glance missing-information count wording
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `missingInformationCountReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.missingInformationCountReadabilityLabel` from existing `missingInformationCount` with stable wording (`no missing-information items` / `1 missing-information item` / `<N> missing-information items`)
  - `apps/api/test/traces.service.test.js` now asserts the new field for both zero-count and singular-count trace-summary paths; `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract field
  - `docs/current-dev-setup.md` trace-summary field list now includes `missingInformationCountReadabilityLabel`
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取 `missingInformationCountReadabilityLabel`，比裸数字更容易一眼理解缺失信息条目数量

- ✅ trace summary now exposes additive `failedStageReadabilityLabel` for failed-stage readability at a glance
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `failedStageReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.failedStageReadabilityLabel` with stable wording from existing `failedStage` (`retrieval stage failed` / `answering stage failed` / `unknown failed stage`)
  - `apps/api/test/traces.service.test.js` now asserts the new field for failed and invalid-stage trace-summary paths
  - `docs/current-dev-setup.md` trace-summary field list now includes `failedStageReadabilityLabel`
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取 `failedStageReadabilityLabel`，更快识别失败阶段语义

- ✅ trace summary now exposes additive `answerStatusSourceReadabilityLabel` for final-answer status-source readability
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `answerStatusSourceReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.answerStatusSourceReadabilityLabel` with stable fallback wording (`model-decided answer status` / `retrieval-inferred answer status` / `deterministic policy answer status` / `unknown answer status source`) derived from existing `answerStatusSource`
  - `apps/api/test/traces.service.test.js` now asserts the new field for both missing-metadata and populated-metadata trace-summary paths
  - `docs/current-dev-setup.md` trace-summary field list now includes `answerStatusSourceReadabilityLabel`
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 20/20 passed；trace summary 现在可直接读取 `answerStatusSourceReadabilityLabel` 来快速识别最终答案状态来源语义

- ✅ trace summary now exposes additive `answerTextSourceReadabilityLabel` for final-answer text-source readability
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `answerTextSourceReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.answerTextSourceReadabilityLabel` with stable fallback wording (`model-generated answer text` / `deterministic policy answer text` / `unknown answer text source`) derived from existing `answerTextSource`
  - `apps/api/test/traces.service.test.js` now asserts the new field for both missing-metadata and populated-metadata trace-summary paths
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取 `answerTextSourceReadabilityLabel` 来快速识别最终答案文本来源语义

- ✅ opencode loop `pick` status now includes queue cursor item and next pending item at a glance
  - `scripts/opencode-loop/runtime.mjs` now adds `buildQueueCursorVisibility()` and extends the existing `logStatus("pick", ...)` payload with:
    - `queueCursor`
    - `queueCursorItemId`
    - `queueCursorItemStatus`
    - `nextPendingItemId`
  - this is a narrow queue observability increment only: no queue schema change, no pick/complete behavior change, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；`pick` 日志现在可同时看到“当前游标指向哪个任务”与“下一个 pending 任务 id”，更快判断当前项与后续项

- ✅ trace summary now exposes additive `missingInformationProvenanceSentence` for one-line missing-information provenance readability
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `missingInformationProvenanceSentence: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.missingInformationProvenanceSentence` with stable fallback wording (`Missing-information source is <...>; insufficient-context reason is <...>; missing-information count is <...>.`) from existing `missingInformationSource` / `insufficientContextReason` / `missingInformationCount`
  - `apps/api/test/traces.service.test.js` now asserts the new field for both missing-metadata and populated-metadata trace-summary paths; `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract field
  - compatibility preserved: additive trace read-model clarity only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取一行 `missingInformationProvenanceSentence` 来快速识别缺失信息来源、insufficient-context 原因与缺失条目数量

- ✅ opencode loop now recovers stale "end-of-queue" cursor when pending items still exist
  - `scripts/opencode-loop/queue.mjs` now treats `cursor === items.length` with remaining pending items as recoverable stale state and normalizes it back to the first safe pending index (`reason: "past_pending"`)
  - `scripts/opencode-loop/self-test.mjs` now adds focused coverage for this `past_pending` cursor recovery edge case
  - this is a narrow queue guardrail increment only: no queue schema change, no scheduling-policy change, no pick/complete semantics redesign
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；当手工把游标放到队列尾部但仍有 pending 任务时，loop 会先回写安全游标并继续按既有 pending 选择逻辑执行

- ✅ embedding runtime now derives OpenAI embedding endpoint from `OPENAI_BASE_URL`
  - `apps/api/src/infra/embedding/embedding-runtime-config.ts` now resolves OpenAI embedding `apiUrl` as `${OPENAI_BASE_URL}/embeddings` (with existing default `https://api.openai.com/v1`), instead of hard-coding only the hosted OpenAI endpoint
  - `apps/api/test/embedding-runtime-config.test.js` now adds focused coverage for the `OPENAI_BASE_URL`-derived embedding endpoint path
  - `docs/current-dev-setup.md` now clarifies that `OPENAI_BASE_URL` applies to both chat/rewrite and embeddings
  - this is a narrow backend env/default alignment increment only: no provider ordering changes, no retrieval behavior changes, no schema/persistence changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/embedding-runtime-config.test.js`
  - 实测结果：focused embedding runtime config tests passed；当使用 OpenAI-compatible proxy 时，embedding 请求不再默认漂移到 hosted OpenAI 根端点

- ✅ trace summary now exposes additive `answerProvenanceSentence` for one-line final-answer provenance readability
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `answerProvenanceSentence: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.answerProvenanceSentence` using stable fallback wording (`Answer text source is <...>; status source is <...>; attribution summary is <...>.`) from existing `answerTextSource` / `answerStatusSource` and resolved attribution label
  - `apps/api/test/traces.service.test.js` now asserts the new field for both missing-metadata and populated-metadata trace-summary paths; `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract field
  - compatibility preserved: additive trace read-model clarity only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取一行 `answerProvenanceSentence` 来快速识别最终答案文本来源、答案状态来源与归因摘要

- ✅ embedding runtime now rejects orphan `OLLAMA_EMBEDDING_DIMENSIONS` config when Ollama embedding provider is not enabled
  - `apps/api/src/infra/embedding/embedding-runtime-config.ts` now fails fast when `OLLAMA_EMBEDDING_DIMENSIONS` is set without Ollama provider prerequisites (`OLLAMA_BASE_URL` + `OLLAMA_EMBEDDING_MODEL` or `OLLAMA_MODEL`), instead of silently ignoring the dimension guardrail setting
  - `apps/api/test/embedding-runtime-config.test.js` now adds focused coverage for this orphan-env guardrail path
  - this is a narrow backend config validation increment only: no provider selection order changes, no retrieval behavior changes, no schema or persistence changes
  - 新增 / 更新验证：
    - `pnpm test:api:fast:llm`
  - 实测结果：focused embedding runtime config tests passed；配置了 `OLLAMA_EMBEDDING_DIMENSIONS` 但未启用 Ollama provider 时会立刻报错，避免“以为启用了维度 guardrail、实际未生效”的静默漂移

- ✅ opencode loop now auto-recovers out-of-range queue cursor before picking work
  - `scripts/opencode-loop/queue.mjs` now adds `resolveQueueCursor()` and uses it in `pickNextItem()`, so a stale manual cursor like `cursor: 99` no longer stays opaque and is normalized to a safe pending index
  - `scripts/opencode-loop/runtime.mjs` now persists the corrected cursor and logs one explicit `游标恢复` status with `cursorFrom` / `cursorTo` / `cursorReason`
  - `scripts/opencode-loop/self-test.mjs` now includes focused coverage for the out-of-range cursor recovery edge case
  - this is a narrow queue guardrail increment only: no queue schema changes, no new scheduling policy, no pick/complete semantics redesign
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；当队列游标越界时，loop 会先回写安全游标并记录恢复原因，然后继续按现有 pending 任务选择逻辑执行

- ✅ opencode loop `pick` status now also shows completed queue count at a glance
  - `scripts/opencode-loop/runtime.mjs` now extends queue visibility fields with `queueCompleted` in the existing `logStatus("pick", ...)` summary
  - this is a narrow observability-only increment for queue status logs: no queue schema changes, no pick/complete behavior changes, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；`pick` 日志现在可同时看到 `queuePending` 与 `queueCompleted`，更容易快速判断剩余与已完成进度

- ✅ external source re-sync now recovers legacy feed/sitemap bounds when stored source config misses `maxItems` / `maxPages`
  - `apps/api/src/modules/documents/documents.service.ts` now treats missing `maxItems` / `maxPages` in persisted external source config as a legacy shape and falls back to the existing default bound `20` during `POST /documents/:id/reindex` re-sync parsing
  - this closes one stale-state missed-update scenario where older external source documents could fail re-sync with `EXTERNAL_SOURCE_CONFIG_INVALID` before any re-fetch, even though URL/kind were still valid
  - `apps/api/test/external-source-sync.test.js` now adds focused coverage for a legacy feed config (kind+url only) and asserts re-sync proceeds with `maxItems: 20`
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/external-source-sync.test.js`
  - 实测结果：focused external-source sync tests passed；legacy feed/sitemap config 缺失数量边界时不再直接失败，可继续触发 re-fetch 并进入后续 ingestion

- ✅ external-source fetch retry now also treats upstream HTTP 408 as transient
  - `apps/api/src/infra/http/fetch-with-retry.ts` now retries once for `408` in addition to existing `429` / `5xx` statuses, so transient upstream request-timeout responses in existing `web page` / `feed` / `sitemap` fetch paths are less likely to fail immediately
  - `apps/api/test/fetch-with-retry.test.js` now adds focused coverage for `408 -> 200` retry recovery
  - this is a minimal backend retry guardrail increment for existing source families only: no new source family, no connector architecture changes, no ingestion state/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/fetch-with-retry.test.js`
  - 实测结果：focused retry tests passed；当上游首次返回 `408 Request Timeout` 时，当前 source fetch helper 会按配置尝试一次重试并在第二次成功时继续返回成功响应

- ✅ opencode loop `pick` log now exposes remaining queue work at selection time
  - `scripts/opencode-loop/runtime.mjs` now adds a narrow `buildQueueWorkVisibility()` helper and includes `remainingAfterPick` / `queuePending` / `queueInProgress` / `queueTotal` in `logStatus("pick", ...)`
  - this is an observability-only increment for queue runtime logs: no queue schema changes, no pick/complete semantics changes, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；每次 `pick` 状态日志现在可直接看到“当前取走此任务后剩余多少待处理工作”

- ✅ feed all-invalid failure diagnostics now include a concrete failed entry anchor
  - `apps/api/src/infra/feed-source/feed-source.service.ts` now appends `First failed entry ref: <ref>.` when feed extraction fails because all selected entries are invalid
  - this is a minimal backend diagnostics clarity increment for existing `feed` flow only: no source-family expansion, no retry policy rewrite, no ingestion state/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests 18/18 通过；当 feed 因全部 entry 无效而失败时，错误信息现在可直接定位首个失败 entry（例如 `Broken Entry`），减少排查时的上下文丢失

- ✅ final answer attribution readability now also exposes additive `readabilityResolvedLabel` for always-readable fallback wording across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` extends `TraceAnswerAttributionSummary` with `readabilityResolvedLabel: string` (always present, with unknown fallback wording)
  - `apps/api/src/modules/traces/traces.service.ts` now emits `answerAttributionSummary.readabilityResolvedLabel` as a stable resolved label (`<attribution label or unknown attribution> via <source label or unknown source>`) while preserving existing readability/readabilityHint/readabilitySentence semantics
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now emits the same `answerAttributionSummary.readabilityResolvedLabel` in one-shot and stream final payloads with aligned mapping
  - `apps/api/test/traces.service.test.js` and `apps/api/test/ask-success.test.js` now assert the new additive resolved-label field
  - compatibility preserved: additive read-model/metadata readability only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 45/45 通过；ask final payload 与 trace summary 现在都可直接读取 `answerAttributionSummary.readabilityResolvedLabel`（例如 `explicit attribution via structured source`、`unknown attribution via unknown source`），并继续兼容现有 attribution readability 字段

- ✅ final answer attribution readability now also exposes additive `readabilitySentence` for clearer human-readable wording across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` extends `TraceAnswerAttributionSummary` with `readabilitySentence: string | null`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `answerAttributionSummary.readabilitySentence` as a stable sentence (`Answer attribution is <value>; source evidence is <value>.`) derived from resolved attribution/source metadata (with `unknown` fallback)
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now emits the same `answerAttributionSummary.readabilitySentence` in one-shot and stream final payloads with aligned mapping
  - `apps/api/test/traces.service.test.js` and `apps/api/test/ask-success.test.js` now assert the new additive sentence field; `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract field
  - compatibility preserved: additive read-model/metadata readability only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 45/45 通过；ask final payload 与 trace summary 现在都可直接读取 `answerAttributionSummary.readabilitySentence`（例如 `Answer attribution is explicit; source evidence is structured.`），并继续兼容现有 attribution readability 字段

- ✅ final answer attribution readability now also exposes additive `readabilityHint` for partial-metadata clarity across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` extends `TraceAnswerAttributionSummary` with `readabilityHint: string | null`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `answerAttributionSummary.readabilityHint` as a readable fallback hint when attribution/source metadata is partially missing (e.g. `explicit attribution via unknown source`), while preserving existing `readabilityLabel` semantics
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now emits the same `answerAttributionSummary.readabilityHint` in one-shot and stream final payloads with aligned mapping
  - `apps/api/test/traces.service.test.js`, `apps/api/test/ask-success.test.js`, and `apps/web/test/trace-summary-contract.test.js` now assert the new additive hint field
  - compatibility preserved: additive read-model/metadata readability only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 45/45 通过；ask final payload 与 trace summary 在 attribution/source 元数据不完整时现在可直接读取可读 fallback hint，同时保持现有 `readability` / `readabilityLabel` 兼容

- ✅ final answer attribution readability now also exposes additive split labels (`attributionLabel` / `sourceLabel`) across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` extends `TraceAnswerAttributionSummary` with:
    - `attributionLabel: string | null`
    - `sourceLabel: string | null`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.answerAttributionSummary.attributionLabel` and `sourceLabel` from resolved attribution/source, while keeping existing `readability` + `readabilityLabel`
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now emits top-level `answerAttributionSummary.attributionLabel` and `sourceLabel` in one-shot and stream final payloads with the same mapping
  - `apps/api/test/traces.service.test.js` and `apps/api/test/ask-success.test.js` now assert the new additive split-label fields
  - compatibility preserved: additive read-model/metadata clarity only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 44/44 通过；ask final payload 与 trace summary 现在都可直接读取 `answerAttributionSummary.attributionLabel` / `sourceLabel`（例如 `explicit attribution` + `structured source`），并继续兼容现有 `attribution` / `source` / `readability` / `readabilityLabel`

- ✅ final answer attribution readability now also exposes additive human-readable `readabilityLabel` across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` extends `TraceAnswerAttributionSummary` with `readabilityLabel: string | null`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.answerAttributionSummary.readabilityLabel` from resolved attribution + source
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now emits `answerAttributionSummary.readabilityLabel` in one-shot and stream final payloads
  - `apps/api/test/traces.service.test.js` and `apps/api/test/ask-success.test.js` now assert the new additive label field
  - compatibility preserved: additive read-model/metadata clarity only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 44/44 通过；ask final payload 与 trace summary 现在都可直接读取 `answerAttributionSummary.readabilityLabel`（例如 `explicit attribution via structured source`），同时保持现有 attribution/source/readability 字段兼容

- ✅ final answer attribution readability now also exposes additive combined `readability` key in grouped summary (`<attribution>:<source>`) across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` adds `TraceAnswerAttributionReadability` and extends `TraceAnswerAttributionSummary` with `readability: TraceAnswerAttributionReadability | null`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.answerAttributionSummary.readability` from resolved attribution + source
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now emits `answerAttributionSummary.readability` in one-shot and stream final payloads
  - `apps/api/test/traces.service.test.js` and `apps/api/test/ask-success.test.js` now assert the new combined readability field
  - compatibility preserved: additive read-model/metadata clarity only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 44/44 通过；ask final payload 与 trace summary 现在都可直接读取 `answerAttributionSummary.readability`（例如 `explicit:structured`），同时保持现有 attribution/source 字段兼容

- ✅ final answer attribution readability now also exposes additive grouped `answerAttributionSummary` across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` adds `TraceAnswerAttributionSummary` and `TraceSummary.answerAttributionSummary` (`{ attribution, source }`) as a compact readability view while preserving existing flat fields (`answerAttribution` / `answerAttributionSource` and legacy `citation*` compatibility aliases)
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.answerAttributionSummary` from resolved attribution + source
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now includes top-level `answerAttributionSummary` in both one-shot and stream final payloads
  - `apps/web/src/types/api.ts` and web contract guards now include additive ask response field `answerAttributionSummary?: TraceAnswerAttributionSummary`
  - compatibility preserved: additive read-model/metadata clarity only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 44/44 通过；ask final payload 与 trace summary 现在都可直接读取 grouped `answerAttributionSummary`，同时保持现有 attribution/source 字段兼容

- ✅ final answer attribution readability now also exposes additive `answerAttributionSource` alias across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` adds `TraceSummary.answerAttributionSource: TraceCitationSelectionSource | null` as a readability alias while preserving existing `citationSelectionSource`
  - `apps/api/src/modules/traces/traces.service.ts` now resolves citation selection source once and emits both `answerAttributionSource` and `citationSelectionSource` in `buildTraceSummary()`
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now includes top-level `answerAttributionSource` in both one-shot and stream final payloads, derived from `answeringMetadata.citationSelectionSource` via a narrow normalization helper
  - `apps/web/src/types/api.ts` and web contract guards now include additive ask response field `answerAttributionSource?: TraceCitationSelectionSource | null`
  - compatibility preserved: additive read-model/metadata clarity only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 44/44 通过；ask final payload 与 trace summary 现在都可直接读取 `answerAttributionSource`，同时保持原有 `citationSelectionSource` 兼容

- ✅ answer attribution readability now has an additive top-level alias aligned across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` adds `TraceSummary.answerAttribution: TraceCitationAttribution | null` as a readability alias while preserving existing `citationAttribution`
  - `apps/api/src/modules/traces/traces.service.ts` now resolves citation attribution once and emits both `answerAttribution` and `citationAttribution` in `buildTraceSummary()`
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now includes top-level `answerAttribution` in both one-shot and stream final payloads, derived from `answeringMetadata.citationAttribution` via a narrow normalization helper
  - `apps/web/src/types/api.ts` and web contract guards now include the additive ask response field `answerAttribution?: TraceCitationAttribution | null`
  - compatibility preserved: additive read-model/metadata clarity only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 19/19 通过；trace summary 与 ask final payload 现在都可直接读取 `answerAttribution`，同时保持原有 `citationAttribution` 兼容

- ✅ ask/trace shared contract guard now also locks `strategySummary.rewriteApplied` alignment
  - `apps/web/test/ask-retrieval-metadata-contract.test.js` now also asserts shared `RetrievalStrategySummary.rewriteApplied: boolean`
  - `apps/web/test/trace-summary-contract.test.js` now also asserts shared `RetrievalStrategySummary.rewriteApplied: boolean`
  - this keeps ask response retrieval metadata usage and trace summary strategy-summary usage aligned with shared rewrite-applied provenance semantics while staying additive and behavior-preserving
  - 新增 / 更新验证：
    - `node --test apps/web/test/ask-retrieval-metadata-contract.test.js apps/web/test/trace-summary-contract.test.js`
  - 实测结果：focused web contract tests 2/2 通过；ask response、trace summary 与 shared strategy summary 的 `rewriteApplied` 合约 guard 对齐已补齐

- ✅ ask-side strategy summary contract guard now also locks shared `rewritePromptId` / `rewriteUsedFallback` alignment
  - `apps/web/test/ask-retrieval-metadata-contract.test.js` now also asserts shared `RetrievalStrategySummary` includes:
    - `rewritePromptId: string | null`
    - `rewriteUsedFallback: boolean | null`
  - this keeps ask response retrieval metadata strategy-summary usage aligned with trace summary / shared contract rewrite provenance fields while staying additive and behavior-preserving
  - 新增 / 更新验证：
    - `node --test apps/web/test/ask-retrieval-metadata-contract.test.js`
  - 实测结果：focused web contract test 1/1 通过；ask response、trace summary 与 shared strategy summary 的 rewrite prompt/fallback provenance guard 对齐已补齐

- ✅ trace read-model now backfills `rewriteApplied` from `queryRewrite.finalQuerySource="rewritten"` when `applied` is missing
  - `TracesService.buildTraceSummary()` now resolves `rewriteApplied` in this order: `trace.rewrittenQuery` -> `retrievalMetadata.queryRewrite.applied` -> persisted `strategySummary.rewriteApplied` -> `retrievalMetadata.queryRewrite.finalQuerySource="rewritten"` -> persisted `strategySummary.retrievalQuerySource="rewritten"` -> legacy top-level `retrievalMetadata.retrievalQuerySource="rewritten"`
  - this closes a minimal readability gap where older traces could carry `queryRewrite.finalQuerySource="rewritten"` without `queryRewrite.applied`, causing `traceSummary.rewriteApplied` / `strategySummary.rewriteApplied` to under-report effective rewrite application
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 19/19 通过；legacy `queryRewrite.finalQuerySource="rewritten"` metadata 下 `traceSummary.rewriteApplied` 现在可直接读出 `true`

- ✅ trace read-model now backfills `rewriteApplied` from persisted `strategySummary.retrievalQuerySource="rewritten"`
  - `TracesService.buildTraceSummary()` now resolves `rewriteApplied` in this order: `trace.rewrittenQuery` -> `retrievalMetadata.queryRewrite.applied` -> persisted `strategySummary.rewriteApplied` -> persisted `strategySummary.retrievalQuerySource="rewritten"` -> legacy top-level `retrievalMetadata.retrievalQuerySource="rewritten"`
  - this closes a minimal trace readability gap where older traces could persist `strategySummary.retrievalQuerySource="rewritten"` without `rewriteApplied`, causing `traceSummary.rewriteApplied` / `strategySummary.rewriteApplied` to under-report effective rewrite application
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 18/18 通过；legacy strategy-summary-only rewrite query-source metadata 下 `traceSummary.rewriteApplied` 现在可直接读出 `true`

- ✅ trace read-model now backfills `retrievalQuerySource` from resolved rewrite-enabled state when legacy final query source is missing
  - `TracesService.buildTraceSummary()` still resolves `retrievalQuerySource` from `queryRewrite.finalQuerySource` / persisted `strategySummary.retrievalQuerySource` / legacy top-level source first; when all are missing, it now additionally derives `original_disabled` or `original_unchanged` from the resolved `rewriteEnabled` signal
  - this closes a minimal readability gap where older traces could persist `queryRewrite.enabled` without `finalQuerySource`, causing `traceSummary.retrievalQuerySource` and `strategySummary.retrievalQuerySource` to under-report the effective final query source
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 17/17 通过；legacy rewrite-enabled metadata 缺失 `finalQuerySource` 时，trace summary 现在可直接读出 `original_unchanged` / `original_disabled` 语义

- ✅ trace read-model now backfills `strategySummary.rewriteEnabled` from legacy top-level `retrievalMetadata.rewriteEnabled`
  - `TracesService.buildTraceSummary()` now resolves `rewriteEnabled` in this order: `retrievalMetadata.queryRewrite.enabled` -> persisted `strategySummary.rewriteEnabled` -> legacy `retrievalMetadata.rewriteEnabled` -> derived from resolved rewrite/query-source signals
  - this closes a minimal readability gap where older traces could persist top-level rewrite enablement without `queryRewrite` / `strategySummary`, causing `traceSummary.strategySummary.rewriteEnabled` to under-report effective rewrite enablement provenance
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 16/16 通过；legacy top-level rewrite enablement metadata 下 `traceSummary.strategySummary.rewriteEnabled` 现在可直接对齐

- ✅ trace read-model now backfills rewrite prompt/model provenance from legacy top-level retrieval metadata
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.rewritePromptId` in this order: `retrievalMetadata.queryRewrite.promptId` -> persisted `strategySummary.rewritePromptId` -> legacy `retrievalMetadata.rewritePromptId`
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.rewriteModelName` in this order: `retrievalMetadata.queryRewrite.modelName` -> persisted `strategySummary.rewriteModelName` -> legacy `retrievalMetadata.rewriteModelName`
  - this closes a minimal resolved-strategy provenance readability gap where older traces could persist rewrite prompt/model at top level without `queryRewrite` / `strategySummary`, causing strategy summary provenance to under-report effective rewrite metadata
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 15/15 通过；legacy top-level rewrite provenance metadata 下 `traceSummary.strategySummary.rewritePromptId` 与 `rewriteModelName` 现在可直接对齐

- ✅ trace read-model now backfills `strategySummary.rewriteUsedFallback` from legacy top-level `retrievalMetadata.rewriteUsedFallback`
  - `TracesService.buildTraceSummary()` now resolves `rewriteUsedFallback` in this order: `retrievalMetadata.queryRewrite.usedFallback` -> persisted `strategySummary.rewriteUsedFallback` -> legacy `retrievalMetadata.rewriteUsedFallback`
  - this closes a minimal provenance-readability gap where older traces persisted rewrite fallback usage at top level without `queryRewrite`/`strategySummary`, causing `traceSummary.strategySummary.rewriteUsedFallback` to under-report effective rewrite fallback
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 14/14 通过；legacy top-level rewrite fallback metadata 下 `traceSummary.strategySummary.rewriteUsedFallback` 读取现在可直接对齐

- ✅ trace read-model now backfills `strategySummary.retrievalQuerySource` from legacy top-level `retrievalMetadata.retrievalQuerySource`
  - `TracesService.buildTraceSummary()` now resolves `retrievalQuerySource` in this order: `retrievalMetadata.queryRewrite.finalQuerySource` -> persisted `strategySummary.retrievalQuerySource` -> legacy `retrievalMetadata.retrievalQuerySource` -> derived from `rewriteApplied`
  - for older traces that only persisted top-level `retrievalQuerySource="rewritten"`, `rewriteApplied` now also backfills from that same legacy value, so strategy summary readability stays internally aligned
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 13/13 通过；legacy top-level retrieval metadata 下 `traceSummary.retrievalQuerySource` 与 `strategySummary.retrievalQuerySource`/`rewriteApplied` 读取现在可直接对齐

- ✅ trace read-model now backfills `strategySummary.retrievalMode` from legacy top-level `retrievalMetadata.retrievalMode`
  - `TracesService.buildTraceSummary()` now resolves `retrievalMode` in this order: `retrievalMetadata.execution.actualMode` -> persisted `strategySummary.retrievalMode` -> legacy `retrievalMetadata.retrievalMode`
  - this closes a minimal resolved-strategy readability gap where older traces persisted top-level `retrievalMode` without `execution`/`strategySummary`, causing `traceSummary.strategySummary.retrievalMode` to under-report effective retrieval mode provenance
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 11/11 通过；legacy top-level retrieval metadata 下 `traceSummary.retrievalMode` 与 `strategySummary.retrievalMode`/`strategySummary.strategyMode` 读取现在可直接对齐

- ✅ trace read-model now backfills `strategySummary.fallbackReason` from legacy top-level `retrievalMetadata.fallbackReason`
  - `TracesService.buildTraceSummary()` now resolves `fallbackReason` in this order: `retrievalMetadata.execution.fallbackReason` -> persisted `strategySummary.fallbackReason` -> legacy `retrievalMetadata.fallbackReason`
  - this closes a minimal readability gap where older traces could persist fallback provenance without `execution`/`strategySummary`, causing `traceSummary.strategySummary.fallbackReason` to under-report effective fallback cause
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 10/10 通过；legacy fallback metadata 下 `traceSummary.fallbackReason` 与 `strategySummary.usedFallback` 读取现在可直接对齐

- ✅ trace read-model now backfills `strategySummary.usedFallback` from legacy `fallbackReason`
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.usedFallback` in this order: `retrievalMetadata.execution.usedFallback` -> persisted `strategySummary.usedFallback` -> derived from resolved `fallbackReason`
  - this closes a minimal readability gap where legacy traces could persist `fallbackReason` but miss `usedFallback`, causing strategy summary fallback provenance to under-report effective fallback resolution
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 9/9 通过；legacy strategy summary 下 `fallbackReason` 与 `usedFallback` 读取现在可直接对齐

- ✅ trace read-model now backfills `strategySummary.rewriteEnabled` from legacy `queryRewrite.applied`
  - `TracesService.buildTraceSummary()` now resolves `rewriteEnabled` in this order: `retrievalMetadata.queryRewrite.enabled` -> persisted `strategySummary.rewriteEnabled` -> derived from resolved `rewriteApplied` -> derived from `retrievalQuerySource`
  - this closes a minimal readability gap where legacy traces could persist `queryRewrite.applied=true` without `enabled` / `finalQuerySource`, causing `traceSummary.strategySummary.rewriteEnabled` to under-report rewrite enablement while `rewriteApplied` was already true
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 8/8 通过；legacy rewrite metadata 下 `strategySummary.rewriteEnabled` 与 `rewriteApplied` 读取一致，ask response / trace summary / shared contract 的策略摘要语义保持对齐

- ✅ trace read-model now backfills `strategySummary.strategyMode` from legacy `retrievalMode`
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.strategyMode` in this order: `retrievalMetadata.strategy.candidateSelection.mode` -> persisted `strategySummary.strategyMode` -> persisted `strategySummary.retrievalMode` -> resolved `retrievalMode`
  - this closes a minimal contract-alignment gap where older traces persisted `retrievalMode` but no `strategyMode`, causing `traceSummary.strategySummary.strategyMode` to under-report the effective mode versus ask-side strategy summary readability
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family scope changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 7/7 通过；ask response、trace summary 与 shared strategy summary 的 `strategyMode` 读取对齐覆盖已补齐 legacy retrievalMode 回填路径

- ✅ trace read-model now backfills `strategySummary.rewriteApplied` from persisted `queryRewrite.applied`
  - `TracesService.buildTraceSummary()` now resolves `rewriteApplied` in this order: `trace.rewrittenQuery` -> `retrievalMetadata.queryRewrite.applied` -> persisted `strategySummary.rewriteApplied` -> `false`
  - this closes a minimal contract-alignment gap where legacy traces could carry `queryRewrite.applied=true` without `rewrittenQuery`/`strategySummary`, causing trace summary to under-report rewrite application
  - compatibility preserved: additive read-model fallback only; no retrieval execution semantics/ranking/default/source-family scope changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 6/6 通过；ask metadata 的 query-rewrite applied provenance 与 trace summary/shared strategy summary 的 `rewriteApplied` 读取保持一致

- ✅ `strategySummary` now carries additive `rewriteEnabled` for ask/trace/shared contract alignment
  - `packages/shared/src/trace-contracts.ts` updates `RetrievalStrategySummary` with `rewriteEnabled: boolean`
  - `AskAssistantService` now persists `strategySummary.rewriteEnabled` from resolved retrieval strategy on both success and retrieval-failure metadata paths
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.rewriteEnabled` from `queryRewrite.enabled` first, then falls back to persisted `strategySummary.rewriteEnabled`, and finally derives from `retrievalQuerySource` for legacy traces
  - compatibility preserved: additive read-model/metadata alignment only; no retrieval execution semantics/ranking/default/source-family changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/ask-success.test.js test/traces.service.test.js`
  - 实测结果：focused API tests 30/30 通过；ask response、trace summary 与 shared contract 现在可一致表达 query rewrite 是否启用

- ✅ ask-side strategy summary contract guard now explicitly locks shared `rewriteModelName` alignment
  - `apps/web/test/ask-retrieval-metadata-contract.test.js` now also asserts:
    - `AskRetrievalMetadata.strategySummary?: RetrievalStrategySummary`
    - shared `RetrievalStrategySummary.rewriteModelName: string | null`
  - this keeps ask response / retrieval metadata strategy summary usage aligned with the shared contract while staying additive and behavior-preserving
  - 新增 / 更新验证：
    - `node --test apps/web/test/ask-retrieval-metadata-contract.test.js`
  - 实测结果：focused web contract test 1/1 通过；ask response、trace summary 与 shared strategy summary 的 rewrite model provenance guard 继续对齐

- ✅ ask read-model contract guard now also locks `queryRewrite.modelName` alignment
  - `apps/web/test/ask-retrieval-metadata-contract.test.js` now asserts `AskRetrievalMetadata.queryRewrite.modelName: string | null`
  - this keeps ask response retrieval metadata and shared `strategySummary.rewriteModelName` provenance alignment guarded from future type drift
  - compatibility preserved: additive contract-guard only, no retrieval execution/ranking/default/source-scope changes
  - 新增 / 更新验证：
    - `node --test apps/web/test/ask-retrieval-metadata-contract.test.js`
  - 实测结果：focused web contract test 1/1 通过；ask response 的 query rewrite model provenance 字段现在有显式 guard

- ✅ `strategySummary` now carries additive `rewriteModelName` for ask/trace/shared contract convergence
  - `packages/shared/src/trace-contracts.ts` updates `RetrievalStrategySummary` with `rewriteModelName: string | null`
  - `AskAssistantService` now writes query-rewrite model provenance into both `retrievalMetadata.queryRewrite.modelName` and `strategySummary.rewriteModelName` on success and retrieval-failure metadata paths
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.rewriteModelName` from `queryRewrite.modelName` first, then falls back to persisted `strategySummary.rewriteModelName`
  - web API type alignment: `apps/web/src/types/api.ts` now includes `AskRetrievalMetadata.queryRewrite.modelName`
  - compatibility preserved: no retrieval execution semantics/ranking/default changes, no source-family scope changes, additive metadata/read-model contract alignment only
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/ask-success.test.js test/traces.service.test.js`
  - 实测结果：focused API tests 30/30 通过；ask response、trace summary、shared contract 现在可一致携带 query rewrite model 归因字段

- ✅ `strategySummary` now carries additive `rewritePromptId` for ask/trace/shared contract alignment
  - `packages/shared/src/trace-contracts.ts` updates `RetrievalStrategySummary` with `rewritePromptId: string | null`
  - `AskAssistantService` now writes `strategySummary.rewritePromptId` from query-rewrite prompt metadata on both success and retrieval-failure metadata paths
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.rewritePromptId` from `queryRewrite.promptId` first, then falls back to persisted `strategySummary.rewritePromptId`
  - compatibility preserved: no retrieval execution semantics/ranking/default changes, no source-family scope changes, additive metadata/read-model contract convergence only
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 5/5 通过；ask response、trace summary、shared contract 的 strategy summary 现在可一致携带 rewrite prompt 归因字段
- ✅ 继续压缩 web 首屏负担，去掉了不必要的外链字体和首屏通知层
  - `apps/web/src/styles/global.css` now uses a local/system font stack only, so the app no longer depends on Google Fonts at runtime
  - `apps/web/index.html` no longer preconnects to Google Fonts origins
  - `apps/web/src/app/App.tsx` removed the always-mounted Mantine notifications layer and its stylesheet import
  - `apps/web/src/styles/theme.ts` now uses the same system font stack for Mantine theme text and headings
  - `apps/web/src/app/AppShell.tsx` no longer hard-codes a missing display font family for the shell brand mark and title
  - `apps/web/src/features/api/hooks.ts` now allows shell-level queries to be deferred until hydration, so the workspace badges do not compete with the first paint
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/web build`
  - 实测结果：web build passed again, with the main initial JS chunk dropping from roughly 442.73 kB to 396.95 kB and HTML shrinking slightly as well

- ✅ 5174 Lighthouse static test setup now avoids cross-origin API calls
  - `apps/web/src/lib/api.ts` now uses a same-origin `/api` base when the app is served from port 5174
  - `apps/web/serve-dist.mjs` now reverse-proxies `/api/*` to the local API server on `localhost:3000`
  - this removes the browser-side CORS dependency for local Lighthouse testing while preserving the static dist serving path, brotli compression, and cache headers
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/web build`
    - `node --check apps/web/serve-dist.mjs`
    - `curl http://127.0.0.1:5174/api/health`
  - 实测结果：`/api/health` now returns the proxied API response from 3000 through 5174 without cross-origin fetches

- ✅ web entry now has better SEO and lower initial route weight
  - `apps/web/src/app/router.tsx` now lazy-loads route pages instead of statically importing every page component up front, which should reduce initial JS pressure and unused bundle weight
  - `apps/web/index.html` now includes a meta description plus font preconnect hints
  - `apps/web/public/robots.txt` now exists with valid allow-all syntax so the app has a real robots file for crawler audits
  - this is a frontend performance/SEO hardening increment only: no backend contract changes and no visual redesign
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/web build`
  - 实测结果：web build passed after the route-splitting and SEO header update

- ✅ OpenCode loop night-run wrapper now prefers corepack for pnpm resolution
  - `scripts/opencode-loop/night-run.sh` now launches `pnpm` through `corepack` first, with Volta/local shim fallbacks if needed
  - this fixes the systemd startup failure caused by the user service lacking the interactive shell PATH; queue semantics and execution flow stay unchanged

- ✅ OpenCode loop start helper now auto-links systemd user units
  - `pnpm loop:start|stop|status` now link the service/timer from `scripts/opencode-loop/systemd/` before managing them, so there is no separate manual copy step
  - this removes the unit-install error seen when the timer was not yet present in the user systemd search path; queue semantics and execution flow stay unchanged

- ✅ OpenCode loop now has pnpm aliases for control commands
  - `pnpm loop:start|status|stop` now wrap `scripts/opencode-loop/control.sh`
  - `README.md` now shows the short pnpm commands for day-to-day unattended loop management
  - this is an operations-only convenience increment; queue semantics and execution flow stay unchanged

- ✅ OpenCode loop now has a one-command start/stop/status helper for the systemd setup
  - added `scripts/opencode-loop/control.sh` so the loop can be started, stopped, or inspected without remembering separate `systemctl` invocations
  - this wraps the existing `systemd --user` setup and keeps the same crash-only restart behavior; it does not change queue semantics or execution flow
  - 新增 / 更新验证：
    - `bash -n scripts/opencode-loop/control.sh`
  - 实测结果：helper syntax is valid and the commands map cleanly to the expected user-unit operations

- ✅ OpenCode loop unattended startup now triggers immediately instead of waiting for a fixed clock time
  - `scripts/opencode-loop/systemd/opencode-loop.timer` now starts the service right after activation rather than only at 23:00
  - this keeps the crash-restart behavior from `systemd --user` while removing the time gate, so the loop will run whenever you start the user unit
  - this is an operations-only increment: no queue semantics change, no prompt change, no execution-flow change
  - 新增 / 更新验证：
    - `bash -n scripts/opencode-loop/night-run.sh`
    - `systemd-analyze verify scripts/opencode-loop/systemd/opencode-loop.service scripts/opencode-loop/systemd/opencode-loop.timer`
  - 实测结果：the unit templates still verify cleanly after removing the 23:00 restriction

- ✅ OpenCode loop now has a systemd --user night-run option with crash-only restarts
  - added `scripts/opencode-loop/night-run.sh` plus `scripts/opencode-loop/systemd/opencode-loop.service` and `scripts/opencode-loop/systemd/opencode-loop.timer`
  - the recommended unattended setup is now `systemd --user` rather than `pm2`, so the loop can restart on failure without turning a normal empty-queue exit into noise
  - this is an operations-only increment: no queue semantics change, no prompt change, no execution-flow change
  - 新增 / 更新验证：
    - `bash -n scripts/opencode-loop/night-run.sh`
    - `systemd-analyze verify scripts/opencode-loop/systemd/opencode-loop.service scripts/opencode-loop/systemd/opencode-loop.timer`
  - 实测结果：service/timer templates are ready for user installation; crash-restart behavior is expressed in the unit file instead of the loop core

- ✅ OpenCode loop handoff and terminal logs are now more scan-friendly
  - handoff markdown now puts the shortest key metadata first and uses concise Chinese section labels so status, session, and timing are easier to spot quickly
  - terminal status lines now keep a fixed short shape with concise Chinese labels and the most important fields front-loaded
  - this is a readability/operations increment only: no queue semantics change, no resume behavior change, no execution flow change
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test passed after the handoff/log simplification update

- ✅ OpenCode loop session titles are now easier to map to queue items
  - new OpenCode sessions now use a readable title shape like `loop #<queue-index> <item-id> YYYY-MM-DD HH:MM:SS`, so it is easier to tell which queue item a session belongs to
  - this is a UX/readability increment only: no queue semantics change, no resume behavior change, no execution flow change
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test still passed after the session title formatting change

- ✅ OpenCode loop queue helpers are now centralized in a dedicated module
  - queue schema/read/write/pick/complete logic now lives in `scripts/opencode-loop/queue.mjs` instead of being spread across `runtime.mjs` and the self-test harness
  - `scripts/opencode-loop/runtime.mjs` now focuses on orchestration, lock handling, prompt composition, and API interaction
  - this is a structure/maintainability increment only: queue semantics, resume behavior, and unattended execution flow stay the same
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test still passed after the queue-module extraction; queue draining and resume recovery remain intact

- ✅ OpenCode loop queue writes now use atomic temp-file replacement
  - `scripts/opencode-loop/runtime.mjs` now writes queue state through a same-directory temp file plus rename, so a crash or interruption is much less likely to leave `.opencode/loop/queue.json` truncated
  - this is a safety hardening increment for unattended night execution only: no queue semantics change, no task-order change, no retrieval / answer behavior change
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test still passed after the queue-write hardening; resume recovery and completion flow remain intact

- ✅ Ollama embedding runtime now enforces an optional expected-dimension guardrail
  - `apps/api/src/infra/embedding/embedding-runtime-config.ts` now reads `OLLAMA_EMBEDDING_DIMENSIONS` as a positive integer when configured
  - `EmbeddingService` now rejects Ollama responses whose vector length does not match the configured dimension, so local embedding config drift fails fast instead of silently propagating
  - this remains a minimal backend config/correctness increment: no provider ranking changes, no retrieval behavior changes, no schema migration
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:fast:llm`
  - 实测结果：focused embedding runtime tests passed; configured Ollama vector dimensions now act as a strict runtime guardrail

- ✅ OpenCode loop harness now provides a narrow queue-driven local execution entrypoint
  - `pnpm opencode:loop` now launches `scripts/opencode-loop.mjs`
  - the harness drains `.opencode/loop/queue.json` one item at a time, manages resume/recovery, writes handoff markdown, and keeps a lock to avoid concurrent consumption
  - `node scripts/opencode-loop.mjs --self-test` now covers fresh queue draining plus interrupted-session resume recovery against a local mock server
  - this is a workflow/supporting-tooling increment only: no core API/retrieval behavior changes
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test passed; queue processing, handoff generation, and resume recovery all behave as expected

- ✅ sitemap all-failure diagnostics now include a concrete failed URL anchor
  - `SitemapSourceService` now appends the first failed URL when throwing terminal aggregate failures:
    - all sitemap pages failed: message now includes `First failed page URL`
    - all child sitemap fetches failed: message now includes `First failed child sitemap URL`
  - this is a minimal backend diagnostics clarity increment for existing `sitemap` / `sitemap index` flows only: no source-family expansion, no retry policy rewrite, no state-machine/schema changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests 18/18 通过；当 sitemap 或 sitemap-index 进入全量失败时，错误信息现在直接带出可定位的首个失败 URL，减少排查时的上下文丢失

- ✅ `strategySummary` now carries additive `rewriteUsedFallback` for query-rewrite provenance readability
  - `packages/shared/src/trace-contracts.ts` updates `RetrievalStrategySummary` with `rewriteUsedFallback: boolean | null`
  - `AskAssistantService` now writes `strategySummary.rewriteUsedFallback` from `queryRewrite.usedFallback` on success/failure metadata paths
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.rewriteUsedFallback` from `queryRewrite.usedFallback` first, then falls back to persisted `strategySummary.rewriteUsedFallback`
  - compatibility preserved: no retrieval behavior/default/ranking changes, no persistence/schema migration changes, additive read-model/contract clarity only
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed; trace summary 的策略摘要现在可直接读出 query rewrite 是否走了 fallback

- ✅ `strategySummary` now carries additive `usedFallback` for ask/trace/shared convergence
  - `packages/shared/src/trace-contracts.ts` updates `RetrievalStrategySummary` with `usedFallback: boolean | null`
  - `AskAssistantService` now writes `strategySummary.usedFallback` on both success (`execution.usedFallback`) and retrieval-failure (`null`) paths
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.usedFallback` from execution metadata first, then falls back to persisted `strategySummary.usedFallback`
  - `AskResponse` now also exposes a top-level additive `strategySummary` so the ask response, trace summary, and shared contract stay aligned on resolved retrieval provenance
  - compatibility preserved: no retrieval behavior/default/ranking changes, no persistence/schema migration changes, additive read-model/contract clarity only
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
    - `pnpm --filter @rag-system/api test:file -- test/ask-success.test.js`
    - `node --test apps/web/test/trace-summary-contract.test.js apps/web/test/ask-retrieval-metadata-contract.test.js`
  - 实测结果：all focused API/Web contract tests passed; `ask response`、`trace summary` 与 shared contract 的 fallback 使用标记已完成 additive 对齐

- ✅ traceSummary strategy readability now falls back to persisted `retrievalMetadata.strategySummary`
  - `TracesService.buildTraceSummary()` now reads `retrievalMetadata.strategySummary` as a fallback source for additive strategy fields when detailed execution/query-rewrite subfields are missing:
    - `retrievalMode`
    - `retrievalQuerySource`
    - `rewriteApplied`
    - `fallbackReason`
  - this is a minimal backend read-model clarity increment: no retrieval execution changes, no ask-path orchestration changes, no schema/persistence changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 5/5 通过；当 trace 仅保留 `strategySummary` 而缺失 execution/query-rewrite 细节时，`traceSummary` 仍可输出可读的最终策略摘要

- ✅ ask response / trace summary / shared contract now share additive `strategySummary` metadata
  - `packages/shared/src/trace-contracts.ts` adds `RetrievalStrategySummary` and includes `traceSummary.strategySummary`
  - `AskAssistantService` now writes `retrievalMetadata.strategySummary` for both success and retrieval-failure trace metadata paths
  - `TracesService.buildTraceSummary()` now exposes additive `traceSummary.strategySummary` while preserving existing flattened strategy fields (`retrievalMode` / `retrievalQuerySource` / `rewriteApplied` / `fallbackReason`) for compatibility
  - `apps/web/src/types/api.ts` now references shared strategy enums and includes optional `AskRetrievalMetadata.strategySummary`
  - this increment is metadata/read-model convergence only: no retrieval execution behavior changes, no strategy default rewrites, no schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
    - `node --test apps/web/test/trace-summary-contract.test.js apps/web/test/ask-retrieval-metadata-contract.test.js`
  - 实测结果：focused traces service tests 和 web contract tests 通过；ask retrieval metadata、trace summary、shared contract 的策略摘要表达已完成 additive 对齐

- ✅ trace strategy summary now carries explicit requested strategy mode provenance
  - `RetrievalStrategySummary.strategyMode` now records the resolved config mode from `retrievalMetadata.strategy.candidateSelection.mode`
  - `AskAssistantService` persists the field in both success and failed retrieval metadata, and `TracesService.buildTraceSummary()` reads it back for trace detail/list views
  - current trace summary can now distinguish the resolved strategy config mode from the runtime `retrievalMode` that actually executed
  - this is still additive read-model / metadata clarity only: no retrieval behavior changes, no schema migration

- ✅ traceSummary failed-stage output now rejects invalid retrieval failure stage values
  - `TracesService.buildTraceSummary()` no longer forwards arbitrary `retrievalMetadataJson.failure.stage` strings into `traceSummary.failedStage`
  - current output only keeps the shared-contract enum values (`retrieval` / `answering`); invalid or legacy stage strings now safely fall back to `null`
  - this is a minimal backend trace read-model correctness increment: no trace persistence write-path changes, no retrieval/answering behavior changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 4/4 通过；当 `failure.stage` 为非法字符串（例如 `source_fetch`）时，trace detail/list 的 `traceSummary.failedStage` 都会回落为 `null`

- ✅ CI validate now generates Prisma client before API build/typecheck
  - 根因是仓库此前只提供了 `apps/api` 的手动脚本 `prisma:generate`，但 CI `validate` 流程没有显式执行它
  - `apps/api/package.json` 的 `build` 现已改为先执行 `pnpm run prisma:generate` 再 `nest build`
  - `.github/workflows/ci.yml` 现已在 `pnpm install --frozen-lockfile` 后显式执行：
    - `pnpm --filter @rag-system/api prisma:generate`
  - 这样可避免 CI 因隐式 postinstall 未可靠触发而出现 `@prisma/client` 导出缺失，进而导致 API build/typecheck 大面积失败
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api prisma:generate && pnpm build && pnpm typecheck`
  - 实测结果：本地按 CI 等价路径复验通过；API build/typecheck 已可稳定拿到生成后的 Prisma client

- ✅ source diagnostics / run-summary follow-up now keeps boundary drop counts accurate and web summary typing aligned
  - `SitemapSourceService` 在 `sitemapindex` 场景下不再把跨 child sitemap 的重复 page URL 误计入 `boundary.droppedPageUrlCount`
  - 当前仅在**唯一 page URL** 因命中 `maxPages` 被跳过时才累计 dropped page count，因此 `boundaryStats` 与 `latestBoundaryHit.boundarySummary` 不再把去重误报成边界丢弃
  - `apps/web/src/types/api.ts` 现已同步 knowledge-base run summary 的新增响应结构：
    - `boundaryStats`
    - `latestPartialSourceFailure`
    - `latestBoundaryHit.boundarySummary`
  - 这一轮继续保持为单主题 source diagnostics / run-summary 收口：不包含 reopen guard / ingestion reliability 变更
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
    - `pnpm typecheck`
  - 实测结果：focused sitemap parsing tests 与 typecheck 通过；边界 dropped-page 统计现在只反映真实的 limit drop，web 类型定义也已与后端 summary 响应对齐

- ✅ source boundary diagnostics now expose dropped-item counts in run summary anchors
  - `SitemapSourceService` now records explicit boundary counters when `maxPages`/`maxChildSitemaps` bounds are hit:
    - `totalExtractedPageUrlCount` / `selectedPageUrlCount` / `droppedPageUrlCount`
    - `totalExtractedChildSitemapCount` / `selectedChildSitemapCount` / `droppedChildSitemapCount`
  - `DocumentsService.buildExternalSourcePartialDiagnostics()` now preserves canonical partial-envelope fields (`code` / `failedStage` / `sourceKind` / `schemaVersion` / `category` / `message`) even when raw source diagnostics carry overlapping keys
  - `DocumentRunsService` summary now adds bounded boundary aggregation and anchor details:
    - `boundaryStats` (`runsWithBoundaryHit`, `byReason`, and dropped page/child/feed counters)
    - `latestBoundaryHit.boundarySummary` (`reasons` and dropped counters)
  - this remains a minimal backend observability increment: no source-family expansion, no run-state-machine rewrite, no retrieval/answering scope growth
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
    - `pnpm test:api:file -- test/external-source-sync.test.js`
    - `pnpm test:api:file -- test/document-runs-summary.test.js`
    - `pnpm test:api:file -- test/sitemap-source-e2e.test.js`（当前环境缺少 `DATABASE_URL`，seed 阶段失败）
  - 实测结果：3 组 focused fast tests 全部通过；sitemap source E2E 在本地环境前置配置缺失（`DATABASE_URL`）时于 seed 阶段失败，本轮未虚报通过

- ✅ external source stabilization phase 2 (backend-first) now adds boundary-aware diagnostics, dedup signals, and new run-summary anchors
  - `FeedSourceService` 现在在 partial diagnostics 中补充了统一的边界与去重信号：
    - `sourceKind` / `schemaVersion`
    - `retryableFailureCount` / `nonRetryableFailureCount`
    - `skippedDuplicateEntryCount` / `skippedDuplicateEntryRefs`
    - `boundaryHit` / `boundaryReasons` / `boundary`
  - `SitemapSourceService` 现在在 sitemap-index 扩展过程中显式暴露执行边界信息：
    - child sitemap 扩展上限命中（`MAX_CHILD_SITEMAPS_REACHED`）
    - page 收集上限命中（`MAX_PAGES_REACHED`）
    - 对应 `boundaryHit` / `boundaryReasons` / `boundary` 结构
  - `DocumentsService.buildExternalSourcePartialDiagnostics()` 现在会输出更统一的 partial envelope：
    - `category: "external_source_partial"`
    - `partialFailureCount`
    - `retryableFailureCount` / `nonRetryableFailureCount`
    - `boundaryHit` / `boundaryReasons`
  - `DocumentRunsService` summary 现在新增两个轻量 anchor：
    - `latestPartialSourceFailure`
    - `latestBoundaryHit`
  - `DocumentRunsService` 对 `retryable` 的读取也补了兜底：当顶层 `retryable` 缺失时，会回退读取 `retryableFailureCount > 0`
  - 这一轮保持为最小 backend diagnostics / observability 增量：不改外部 source family 范围，不引入 connector 平台化改造
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/parsing.test.js`
    - `pnpm --filter @rag-system/api test:file -- test/external-source-sync.test.js`
    - `pnpm --filter @rag-system/api test:file -- test/document-runs-summary.test.js`
    - `pnpm build`
    - `pnpm typecheck`
  - 实测结果：上述 focused tests 与 build/typecheck 均通过，当前 P0 第二阶段的边界诊断、partial 结构标准化和 summary anchor 能力已落地

- ✅ document-run output now rejects invalid diagnostics `failedStage` values
  - `DocumentRunsService.buildFailureSummary()` 现在只接受属于 `DocumentRunFailedStage` 枚举的 diagnostics `failedStage`，非法字符串不再进入 API 输出
  - 这修复了历史/异常 diagnostics 输入可能把非枚举阶段值透传到 `listDocumentRuns` 输出的问题
  - 这一轮保持为最小 backend diagnostics 增量：不改 run 状态机和失败聚合策略，只补输出层 failedStage 归一化
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/document-runs-summary.test.js`
  - 实测结果：focused document-runs summary tests 18/18 通过；当 diagnostics 里出现非法 failedStage 时，输出会安全回落为 `null`

- ✅ listDocumentRuns now backfills failedStage from diagnostics for terminal runs with null stage columns
  - `DocumentRunsService.resolveOutputFailedStage()` 现在在 `failed/skipped/ready` 的 terminal run 上都支持从 diagnostics 回填 `failedStage`（仅 `pending/processing` 继续固定返回 `null`）
  - 这修复了历史或异常数据中“run.status=failed 但 failedStage 列为空”时 API 输出阶段信息丢失的问题
  - 这一轮保持为最小 backend diagnostics 增量：不改 run 状态机和聚合语义，只补输出层阶段回填一致性
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/document-runs-summary.test.js`
  - 实测结果：focused document-runs summary tests 17/17 通过；`listDocumentRuns` 对 failed run 的 `failedStage` 输出与 diagnostics 对齐

- ✅ issueOnly document-run list/summary behavior no longer drops older issue anchors
  - `DocumentRunsService.listKnowledgeBaseRuns()` 在 `issueOnly=true` 时不再固定“先取前 100 条再过滤后截断”，而是按批次向后扫描，直到收集到请求 `limit` 的 issue runs 或没有更多数据
  - `DocumentRunsService.getKnowledgeBaseRunSummary()` 在 `issueOnly=true` 时仍然保留 `latestSkipped` 锚点，不会因为 issue filter 先行而把 skip anchor 一起过滤掉
  - 这一轮保持为最小 backend diagnostics correctness 增量：不改 issue counters/failure 聚合语义，只修 issueOnly 结果可见性与截断遗漏
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/document-runs-summary.test.js`
  - 实测结果：focused document-runs summary tests 16/16 通过，`issueOnly=true` 现在既能保留 `latestSkipped`，也能在前 100 条非 issue 的情况下返回更老的 issue run

- ✅ issueOnly run summary now keeps `latestSkipped` visible
  - `DocumentRunsService.getKnowledgeBaseRunSummary()` 现在在 `issueOnly=true` 时，仍然会从完整已取 runs 集合里计算 `latestSkipped`，不再因为 issue filter 先行生效而把 skip anchor 一起过滤掉
  - 这一轮保持为最小 backend diagnostics 增量：不改 issueOnly 的 counters / failure aggregates，只修 `latestSkipped` 这个 summary anchor 的可见性
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/document-runs-summary.test.js`
  - 实测结果：focused document-runs summary tests 15/15 通过；`issueOnly=true` 时仍能返回 `latestSkipped`，同时 issue counters 继续只统计 ready/failed issue runs

- ✅ feed source E2E tests now use the current built-entry fallback and tolerate fast in-flight completion
  - `apps/api/test/feed-source-e2e.test.js` 已把 9 处硬编码 `apps/api/dist/main.js` 统一切到 `resolveBuiltApiEntry()` fallback 模式
  - 同文件里一条稳定复现的竞态断言也已收紧：`in-flight reindex from a partial-ready source...` 现在允许 version 2 run 在轮询时已经从 `processing` 快速推进到 `ready`
  - 当前优先尝试 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮保持为最小单文件 source-E2E baseline 增量：不改 runtime，只修 feed source 这一个文件的 built-entry drift 与过严测试期望
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/feed-source-e2e.test.js`
  - 实测结果：focused feed source E2E tests 9/9 通过，当前构建产物布局变化与短暂 processing 过渡都不会再让这组测试误失败

- ✅ sitemap source E2E tests now use the current built-entry fallback
  - `apps/api/test/sitemap-source-e2e.test.js` 已把 12 处硬编码 `apps/api/dist/main.js` 统一切到 `resolveBuiltApiEntry()` fallback 模式
  - 当前优先尝试 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮保持为最小单文件 source-E2E baseline 增量：只修 sitemap source 这一个文件的 built-entry drift，不改断言逻辑
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/sitemap-source-e2e.test.js`
  - 实测结果：focused sitemap source E2E tests 12/12 通过，当前构建产物布局变化不会再让这组 sitemap source 流程测试因入口路径硬编码而误失败

- ✅ web-page source E2E tests now use the current built-entry fallback
  - `apps/api/test/web-page-source-e2e.test.js` 已把 7 处硬编码 `apps/api/dist/main.js` 统一切到 `resolveBuiltApiEntry()` fallback 模式
  - 当前优先尝试 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮保持为最小单文件 source-E2E baseline 增量：只修 web-page source 这一个文件的 built-entry drift，不扩成 feed/sitemap 批量清理
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/web-page-source-e2e.test.js`
  - 实测结果：focused web-page source E2E tests 7/7 通过，当前构建产物布局变化不会再让这组 web source 流程测试因入口路径硬编码而误失败

- ✅ api-flow integration test now uses the current built-entry fallback
  - `apps/api/test/api-flow.test.js` 已从硬编码 `apps/api/dist/apps/api/src/main.js` 切到统一的 `resolveBuiltApiEntry()` fallback 模式
  - 当前优先尝试 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮保持为最小单文件 integration baseline 增量：只修一处 built-entry drift，不改 API flow 断言逻辑
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/api-flow.test.js`
  - 实测结果：focused API flow integration test 已通过，当前构建产物布局变化不会再让这条核心链路测试因入口路径硬编码而误失败

- ✅ stale local enqueue-failure supersede handling now has focused regression coverage
  - `DocumentsService` 里已存在的 stale enqueue-failure guard 现在有了 focused test：当旧版本 document 的本地 ingestion enqueue 失败，但数据库里已经有更新版本激活时，不再把旧版本标记为 failed，而是记录 `stale_guard` skip
  - 新增覆盖位于 `apps/api/test/documents.enqueue-failure.test.js`，断言这条路径会写入：
    - `failedStage: "stale_guard"`
    - `code: "INGESTION_RUN_SUPERSEDED"`
    - message: `Skipped stale ingestion enqueue failure handling because a newer document version is already active.`
  - 这一轮保持为最小 observability/test 增量：不改 runtime 行为，只补已存在 stale supersede 保护的回归覆盖
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/documents.enqueue-failure.test.js`
  - 实测结果：focused documents enqueue-failure tests 2/2 通过，stale enqueue-failure supersede path 已被锁定

- ✅ initial ingestion state-write failures now preserve the correct failed-stage classification
  - `DocumentIngestionProcessor` 不再把“初始 processing/parsing 状态写入失败”错误归类成 `INGESTION_INDEXING_FAILED`
  - 当前这类失败会记录为 `INGESTION_STATE_WRITE_FAILED`，并保持 `failedStage: "parsing"`，避免把最初状态写入问题误报成 indexing 阶段故障
  - 这一轮保持为最小 backend correctness / diagnostics 增量：只修正初始状态写入失败的诊断归类，不改其他 ingestion 阶段语义
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/ingestion.orchestrator.test.js`
  - 实测结果：focused ingestion orchestrator tests 13/13 通过，初始状态写入失败路径已改为记录 `INGESTION_STATE_WRITE_FAILED` + `failedStage: "parsing"`

- ✅ retrieval-profile filters focused test now uses the current built-entry fallback
  - `apps/api/test/retrieval-profile-filters.test.js` 已从 3 处硬编码 `apps/api/dist/main.js` 切到与同族 `retrieval-profile-strategy.test.js` 一致的 `resolveBuiltApiEntry()` fallback 模式
  - 当前优先尝试 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮保持为最小单文件 retrieval-profile 测试基线增量：只修这一处 built-entry drift，不扩成整批测试清理
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/retrieval-profile-filters.test.js`
  - 实测结果：3 个 focused retrieval-profile filters tests 全部通过，当前构建产物路径变化不会再让这组测试因启动入口硬编码而误失败

- ✅ ask-stream E2E focused test now uses the current built-entry fallback
  - `apps/api/test/ask-stream-e2e.test.js` 已从硬编码 `apps/api/dist/main.js` 切到与现有已修测试一致的 `resolveBuiltApiEntry()` fallback 模式
  - 当前优先尝试 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮保持为最小单文件 stream E2E 基线增量：只修一处 built-entry drift，不扩成多文件批量清理
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/ask-stream-e2e.test.js`
  - 实测结果：focused ask-stream E2E 已通过，当前构建产物路径变化不会再让这条 stream 路径测试因启动入口硬编码而误失败

- ✅ assistants API focused test now uses the current built-entry fallback
  - `apps/api/test/assistants-api.test.js` 已从硬编码 `apps/api/dist/main.js` 切到与现有已修测试一致的 `resolveBuiltApiEntry()` fallback 模式
  - 当前优先尝试 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮保持为最小单文件测试基线增量：只修一处 API integration test 的 built-entry drift，不扩成多文件批量清理
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/assistants-api.test.js`
  - 实测结果：focused assistants API test 已通过，当前构建产物路径变化不会再让这条测试因启动入口硬编码而误失败

- ✅ removed the stray empty Prisma migration artifact
  - 已删除本地未跟踪的空 migration stub：`apps/api/prisma/migrations/20260325201719_ensure_latest_embedding_config_normalization/migration.sql`
  - 审计结论确认这不是实际待收口 schema 变更：
    - `migration.sql` 原本为空
    - `apps/api/prisma/schema.prisma` 没有对应未提交 schema 变更
    - embedding config normalization 已落在 runtime / vector-store 代码中，而不是 Prisma schema
  - 这一轮保持为最小 cleanup 增量：不改数据库 schema、不生成新 migration、不改 runtime 行为，只移除误留的本地 artifact
  - 新增 / 更新验证：
    - `git status --short --branch`
    - glob 校对 `apps/api/prisma/migrations/20260325201719_ensure_latest_embedding_config_normalization/**` 已无文件
  - 实测结果：该 migration 不再出现在工作区未跟踪列表中，当前只剩 `.sisyphus/*` 本地规划文件未跟踪

- ✅ current dev setup doc now matches the current traceSummary field surface
  - `docs/current-dev-setup.md` 的 `current trace read semantics` 段已补齐剩余的 `traceSummary` 字段列表漂移，并和 `docs/retrieval-trace.md` / `packages/shared/src/trace-contracts.ts` 对齐
  - 补齐字段覆盖：
    - `promptId`
    - `missingInformationSource`
    - retrieval candidate-flow counts / limit-hit flags
    - `primaryChunkCount` / `neighborChunkCount`
    - `inputChunkCount` / `promptContextCount` / `contextGroupCount`
    - `citationCountBeforeLimit` / `citationLimitHit`
  - 这一轮保持为最小 doc-only 跟进：只同步 setup 文档中的 traceSummary 列表，不改 runtime、测试或其他文档结构
  - 新增 / 更新验证：
    - read-back 校对 `docs/current-dev-setup.md` 的 `current traceSummary fields are:` 列表，并与 `docs/retrieval-trace.md` 对照一致
  - 实测结果：`current-dev-setup.md` 当前已完整列出 38 个 `traceSummary` 字段，setup 文档与主参考文档已收口一致

- ✅ retrieval trace reference doc now matches the current traceSummary field surface
  - `docs/retrieval-trace.md` 的 `Trace read summary` 段已补齐当前共享 `TraceSummary` contract 中此前遗漏的字段，包括：
    - `promptId`
    - `missingInformationSource`
    - retrieval candidate-flow counts / limit-hit flags
    - `primaryChunkCount` / `neighborChunkCount`
    - `inputChunkCount` / `promptContextCount` / `contextGroupCount`
    - `citationCountBeforeLimit` / `citationLimitHit`
  - 这一轮保持为最小 doc-only 同步：只更新 trace 主参考文档里的字段列表，不改 `current-dev-setup.md`，不改运行时代码或测试
  - 新增 / 更新验证：
    - read-back 校对 `docs/retrieval-trace.md` 中 `Current traceSummary shape includes:` 列表，确认已和 `packages/shared/src/trace-contracts.ts` 对齐
  - 实测结果：`retrieval-trace.md` 当前已完整列出 38 个 `traceSummary` 字段，可直接作为本轮 trace read-model / contract 对齐后的主参考

- ✅ ask-chain E2E traceSummary baseline now matches the current shared contract
  - `apps/api/test/ask-chain-e2e.test.js` 现在已补齐 conversation trace list 与 trace detail 对 `traceSummary` 的新字段断言，包括：
    - `promptId`
    - `missingInformationSource`
    - retrieval candidate-flow counts / limit-hit flags
    - `primaryChunkCount` / `neighborChunkCount`
    - `inputChunkCount` / `promptContextCount` / `contextGroupCount`
    - `citationCountBeforeLimit` / `citationLimitHit`
  - 同文件也顺手修正了过期的 built API entry 路径：优先使用 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮仍然保持为最小测试基线增量：不改 backend runtime 行为、不改 shared contract、不改 API payload，只补 ask-chain E2E 对现状的验证覆盖
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/ask-chain-e2e.test.js`
  - 实测结果：在最小本地 fallback embedding 环境下，ask-chain E2E 已通过，traceSummary 断言与当前共享 contract 对齐

- ✅ web traceSummary contract guard now covers the latest shared fields
  - `apps/web/test/trace-summary-contract.test.js` 现在不再只守旧的 query-source / failed-stage / candidate-flow 子集，也同步守住共享 `TraceSummary` 里最近补齐的字段：
    - `promptId`
    - `missingInformationSource`
    - `primaryChunkCount`
    - `neighborChunkCount`
    - `inputChunkCount`
    - `promptContextCount`
    - `contextGroupCount`
    - `citationCountBeforeLimit`
    - `citationLimitHit`
  - 这一轮继续保持为最小 contract-guard 增量：不改 web runtime 行为、不改 backend read model、不改共享类型定义，只补 source-level drift 防护
  - 新增 / 更新验证：
    - `node --test apps/web/test/trace-summary-contract.test.js`
  - 实测结果：contract test 通过，当前 web 侧对共享 `TraceSummary` 的 source guard 已和最新 shared contract 对齐

- ✅ traceSummary now preserves legacy promptContextCount semantics
  - `TracesService` 现在在读取旧 trace 时，不再把缺失的 `traceSummary.promptContextCount` 一律回退成 `0`
  - 当前会按已有 answering metadata 语义回推：`contextMode=context_groups` 时回退到 `contextGroupCount`，否则回退到 `inputChunkCount`
  - 这一轮继续保持为纯 read-model / traceability correctness 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 legacy trace 在缺失 `promptContextCount` 时仍能按 `contextMode` 回推出正确值
    - `pnpm test:api:file -- test/traces.service.test.js`
    - `pnpm --filter @rag-system/api build`
  - 实测结果：focused traces test 通过；手动构造 legacy `context_groups` trace 时，`traceSummary.promptContextCount=2`、`inputChunkCount=3`、`contextGroupCount=2`，不再错误回退为 `0`

- ✅ traceSummary now exposes neighborChunkCount
  - `TraceSummary` 现在会把持久化在 `retrievalMetadataJson.execution` 里的 `neighborChunkCount` 提升到轻量 summary 读模型，便于直接看见最终进入回答上下文的检索块里，有多少来自 chunk-window / neighbor 扩展，而不必回读整块 retrieval metadata
  - 这一轮和刚落地的 `primaryChunkCount` 一样，属于 retrieval-composition 的纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.neighborChunkCount`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `neighborChunkCount`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `neighborChunkCount`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `retrievalMetadataJson.execution.neighborChunkCount` 对齐；缺失时默认回退为 `0`

- ✅ traceSummary now exposes primaryChunkCount
  - `TraceSummary` 现在会把持久化在 `retrievalMetadataJson.execution` 里的 `primaryChunkCount` 提升到轻量 summary 读模型，便于直接看见最终进入回答上下文的检索块里，有多少是 primary 命中而不是 window/neighbor 扩展块
  - 这一轮标志着此前 answering-side traceSummary 小字段链已经收口，并转入相邻的 retrieval-composition 读模型增量；仍然不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.primaryChunkCount`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `primaryChunkCount`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `primaryChunkCount`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `retrievalMetadataJson.execution.primaryChunkCount` 对齐

- ✅ traceSummary now exposes contextGroupCount
  - `TraceSummary` 现在会把持久化在 `answeringMetadataJson` 里的 `contextGroupCount` 提升到轻量 summary 读模型，便于直接看见回答阶段经过上下文分组后的 group 数量，而不必回读整块 answering metadata
  - 这一轮和前几条 traceSummary 增量一样，属于纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.contextGroupCount`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `contextGroupCount`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `contextGroupCount`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `answeringMetadataJson.contextGroupCount` 对齐

- ✅ traceSummary now exposes promptId
  - `TraceSummary` 现在会把持久化在 `answeringMetadataJson` 里的 `promptId` 提升到轻量 summary 读模型，便于直接看见具体是哪一版 answer prompt 产出了这条 trace，而不必回读整块 answering metadata
  - 这一轮和前几条 traceSummary 增量一样，属于纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.promptId`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `promptId`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `promptId`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `answeringMetadataJson.promptId` 对齐

- ✅ traceSummary now exposes inputChunkCount
  - `TraceSummary` 现在会把持久化在 `answeringMetadataJson` 里的 `inputChunkCount` 提升到轻量 summary 读模型，便于直接看见回答阶段在上下文整形前的原始 chunk 数量，而不必回读整块 answering metadata
  - 这一轮和前几条 traceSummary 增量一样，属于纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.inputChunkCount`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `inputChunkCount`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `inputChunkCount`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `answeringMetadataJson.inputChunkCount` 对齐

- ✅ traceSummary now exposes promptContextCount
  - `TraceSummary` 现在会把持久化在 `answeringMetadataJson` 里的 `promptContextCount` 提升到轻量 summary 读模型，便于直接看见真正进入回答阶段 prompt 的上下文单元数量，而不必回读整块 answering metadata
  - 这一轮和前几条 traceSummary 增量一样，属于纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.promptContextCount`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `promptContextCount`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `promptContextCount`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `answeringMetadataJson.promptContextCount` 对齐

- ✅ traceSummary now exposes citationCountBeforeLimit
  - `TraceSummary` 现在会把持久化在 `answeringMetadataJson` 里的 `citationCountBeforeLimit` 提升到轻量 summary 读模型，便于直接看见 citation 在应用上限前的原始数量，而不必回读整块 answering metadata
  - 这一轮和前两条 `missingInformationSource` / `citationLimitHit` 一样，属于纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.citationCountBeforeLimit`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `citationCountBeforeLimit`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `citationCountBeforeLimit`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `answeringMetadataJson.citationCountBeforeLimit` 对齐

- ✅ traceSummary now exposes citationLimitHit
  - `TraceSummary` 现在会把持久化在 `answeringMetadataJson` 里的 `citationLimitHit` 提升到轻量 summary 读模型，便于直接区分“最终 citation 数量本来就少”和“citation 被策略上限截断”
  - 这一轮和上一条 `missingInformationSource` 一样，属于纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.citationLimitHit`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `citationLimitHit`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `citationLimitHit`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `answeringMetadataJson.citationLimitHit` 对齐

- ✅ traceSummary now exposes missingInformationSource
  - `TraceSummary` 现在会把持久化在 `answeringMetadataJson` 里的 `missingInformationSource` 提升到轻量 summary 读模型，便于在 trace detail 与 conversation trace list 中直接看见缺失信息来源，而不必回读整块 answering metadata
  - 这一轮是纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.missingInformationSource`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `missingInformationSource`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `missingInformationSource`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `answeringMetadataJson.missingInformationSource` 对齐

- ✅ initial ingestion state-write failure recording after run activation
  - `DocumentIngestionProcessor` 现在会把第一条 `document.status=processing / processingStage=parsing` 的状态写入也纳入统一的失败收口路径；不再存在“run 已激活，但第一次 document 状态写入抛错后直接逃出 `try/catch`”的窗口
  - 这样同版本 job 在 run activation 成功后，如果最早的 document 状态更新失败，也会正确把 document/run 收口为 failed，而不会把 run 卡在 `processing` 并让后续同版本 retry 无法继续
  - 这一轮只收这个入口窗口，不扩 generic diagnostics 分类策略；当前仍沿用既有 `buildIngestionDiagnostics()` 的默认 generic error 归类
  - 新增 focused coverage：
    - `apps/api/test/ingestion.orchestrator.test.js`
      - initial document state update failure after run activation records failed document and run
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/ingestion.orchestrator.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用真实 Prisma + 真实 `DocumentRunsService` 跑一个隔离 proof，只在第一次 `document.update(processing/parsing)` 注入 `Synthetic initial document state update failure.`
    - 实测结果：最终 document/run 都收口为 `failed`，`initialStateFailureRecorded=true`，且 `processingHangAvoided=true`

- ✅ enqueue-failure recording after run/document state advances
  - `DocumentsService` 现在会在 document/run 已经推进到 `pending` 之后，如果 `enqueueDocument()` / BullMQ `Queue.add()` 失败，立刻把当前 version 的 document 和 run 收口为 failed，而不再留成“看起来已排队、实际无 job”的假 pending 状态
  - local ingestion 路径现在记为 `INGESTION_ENQUEUE_FAILED`；external source 路径现在记为 `EXTERNAL_SOURCE_ENQUEUE_FAILED`
  - 这一轮继续只收 producer enqueue failure 的状态收口，不改 queue 基础设施、Redis 配置或更大的 producer retry 设计
  - 新增 focused coverage：
    - `apps/api/test/documents.enqueue-failure.test.js`
      - local reindex enqueue failure records failed document and run
    - `apps/api/test/external-source-sync.test.js`
      - external enqueue failure after finalize records failed document and run
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/documents.enqueue-failure.test.js`
    - `pnpm --filter @rag-system/api test:file -- test/external-source-sync.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用真实 Prisma 跑一个 local `reindexDocument` proof，并让 producer `enqueueDocument()` 抛出 `Synthetic queue add failure.`
    - 实测结果：最终 `document(version=2)` 与对应 run 都收口为 `failed/parsing`，诊断码一致为 `INGESTION_ENQUEUE_FAILED`，`enqueueFailureRecorded=true`

- ✅ retryable-only same-version run reopen semantics
  - `DocumentRunsService.markRunProcessing()` 现在不再把所有 `failed` run 一律重新拉回 `processing`；当前只允许 `pending`，以及 `diagnosticsJson.retryable === true` 的 `failed` run 重新激活
  - 这样 run-level 语义和前面补上的 processor 入口 guard 现在对齐：non-retryable failed run 仍保持 terminal，而 retryable failed run 继续保留自动重试路径
  - 这一轮只收 run-level reopen 规则，不改 BullMQ `attempts` 配置，也不扩成更大的 retry-policy 重构
  - 新增 focused coverage：
    - `apps/api/test/document-runs.service.test.js`
      - retryable failed run reopens, non-retryable failed run stays blocked
    - `apps/api/test/ingestion.orchestrator.test.js`
      - processor-level non-retryable same-version retry still short-circuits
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/document-runs.service.test.js`
    - `pnpm --filter @rag-system/api test:file -- test/ingestion.orchestrator.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用真实 Prisma 写入一条 `retryable failed` run 和一条 `non-retryable failed` run，再实际调用 `markRunProcessing()`
    - 实测结果：`retryableResult.count=1` 且 run 进入 `processing`；`nonRetryableResult.count=0` 且 run 保持 `failed`，`onlyRetryableReopened=true`

- ✅ external-source post-fetch persistence failure recording
  - `DocumentsService` 现在会把 external source 在 fetch 成功后的持久化阶段异常也收口为失败：包括 `saveGeneratedTextFile()` 和 finalize/update 链路抛错
  - 这样 external source run 在已创建、fetch 已成功后，如果落盘或 finalize 失败，不会再把 document/run 留在 `pending/uploaded` 的未决状态
  - 这一轮继续只收在 external-source 后处理的 failure-recording 缺口，沿用既有 `source_fetch` failedStage，不扩 enum 或更大的 source workflow 重构
  - 新增 focused coverage：
    - `apps/api/test/external-source-sync.test.js`
      - external source persistence failure after fetch records failed document and run
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/external-source-sync.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用真实 Prisma 跑一个 external `reindexDocument` proof：fetch 成功后让 `saveGeneratedTextFile()` 抛出 `Synthetic external persistence failure.`
    - 实测结果：最终 `document(version=2)` 与对应 run 都收口为 `failed/source_fetch`，诊断码一致为 `EXTERNAL_SOURCE_PERSIST_FAILED`，`failedStateRecorded=true`

- ✅ non-retryable same-version ingestion retry guard
  - `DocumentIngestionProcessor` 现在会在处理开始前识别“当前 document 已处于 `failed` 且 `diagnosticsJson.retryable === false`”的情况，并直接跳过同版本 queue retry
  - 这样对 unsupported file type / empty content 之类的 terminal parsing failure，BullMQ 的自动重试不会再把同一 document version 重新拉回 `processing`
  - 这一轮刻意只收 processor 入口 guard，不改 queue `attempts` 配置，也不扩成更大的 run-state / retry-policy 重构
  - 新增 focused coverage：
    - `apps/api/test/ingestion.orchestrator.test.js`
      - non-retryable failed same-version run does not reopen on queue retry
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/ingestion.orchestrator.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用真实 Prisma 跑一个隔离 proof：先写入 `status=failed`、`retryable=false` 的 document + run，再手动调用同版本 `processDocument`
    - 实测结果：日志显示直接跳过 non-retryable retry，最终 document 与 run 均保持 `failed/parsing`，`stayedFailed=true`、`remainedNonRetryable=true`

- ✅ indexing expected-version guard for stale mid-index vector writes
  - `IndexingService.indexDocument()` 现在支持可选 `expectedVersion`，并且会在真正执行 vector delete / replace 之前再次确认当前 `document.version` 仍匹配本次运行版本
  - 这样旧 ingestion job 即使已经进入 indexing，并在 embedding 计算期间被新版本覆盖，也不会在稍后恢复时继续删除或覆盖当前 vectors
  - `DocumentIngestionProcessor` 现会把当前 `document.version` 传入 indexing，使这道 guard 只收在既有 ingestion → indexing 链路内，不扩到 queue / schema / retrieval
  - 新增 focused coverage：
    - `apps/api/test/indexing.test.js`
      - stale expected version blocks vector replace
      - stale expected version blocks vector delete
    - `apps/api/test/ingestion.orchestrator.test.js`
      - indexing call now threads `expectedVersion`
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/indexing.test.js`
    - `pnpm --filter @rag-system/api test:file -- test/ingestion.orchestrator.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用真实 Prisma + 本地 file-backed vector store 跑一个隔离 proof：先启动被阻塞的 `indexDocument(documentId, 1)`，在 embedding 阶段把 document 提升到 `version=2` 并写入 `NEW_TOKEN` chunks/vectors，再释放旧 indexing
    - 实测结果：最终 vector 文件只保留 `NEW_TOKEN`，`preservedNewVectors=true`、`staleOldVectorsAbsent=true`，旧 indexing 未发生 stale overwrite

- ✅ ingestion stale mid-flight chunk/vector side-effect guard
  - `DocumentIngestionProcessor` 现在不只在 terminal write 前检查 supersede；在进入 `chunking` 写路径前，以及进入 `indexing` 写路径前，也会再次确认当前 `document.version` 仍匹配运行中的 job
  - 这样旧 ingestion job 如果在 parsing 完成后、chunk rebuild 前，或在 chunk rebuild 完成后、vector replacement 前被新版本覆盖，会直接收口为 `skipped / stale_guard`，不再继续改写当前 document 的 chunks / vectors
  - 这一轮继续只收 ingestion 内部的 stale side-effect 窗口，不改 queue 语义、schema，也不扩成更大的 indexing 架构调整
  - 新增 focused coverage：
    - `apps/api/test/ingestion.orchestrator.test.js`
      - stale before chunk mutation leaves chunks and indexing untouched
      - stale after chunk rebuild leaves indexing untouched
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/ingestion.orchestrator.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用真实 Prisma + 本地 storage/vector 文件跑一个隔离 proof：先为同一 document seed `ORIGINAL_TOKEN` 的 chunk 和 vector，再在 parsing 结束后把 document 抬到 `version=2`
    - 实测结果：旧 `version=1` run 收口为 `skipped/stale_guard`，document 保持 `version=2 / pending / uploaded`，chunk 与 vector 内容都仍是 `ORIGINAL_TOKEN`，未被旧 job 改写

- ✅ ingestion queue jobId dedupe for same document version
  - `QueueService` 现在会为带 `documentVersion` 的 ingestion enqueue 生成稳定 `jobId`：同一 `documentId + version` 重复 enqueue 时不再创建第二个 BullMQ ingestion job
  - 这一轮只收口 queue producer 去重，不改已有 run-level stale guard、same-version terminal-run guard 或更大的调度语义
  - 新增 focused coverage：
    - `apps/api/test/queue.service.test.js`
      - duplicate enqueue for the same document version leaves exactly one queued ingestion job
  - focused validation rerun：
    - `pnpm test:api:file -- test/queue.service.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 直接用本地 Redis + BullMQ `QueueService` 在隔离 `QUEUE_PREFIX` 下连续 enqueue 两次同一 `documentId + version`
    - 实测结果只保留 `1` 条 queued job，且两次返回的 `jobId` 相同：`ingest-document-document-runtime-proof-1-8`

- ✅ external source expected-version guard for stale finalize/failure writes
  - `DocumentsService` 现在会在 external source 的 finalize 与 failure 落库前确认当前 document `version` 仍等于本次预留版本
  - 如果旧的 external fetch / resync 在较慢返回时发现自己已被新版本覆盖，当前请求不会再按 `id` 回写 `title` / `storageKey` / `failed` 状态，也不会错误 enqueue 新版本
  - 被覆盖的旧 external run 现在会收口为 `skipped / stale_guard`，诊断码为 `EXTERNAL_SOURCE_RUN_SUPERSEDED`
  - 新增 focused coverage：
    - `apps/api/test/external-source-sync.test.js`
      - stale external finalize does not overwrite a newer document version
      - stale external fetch failure does not overwrite a newer document version
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/external-source-sync.test.js`
    - `pnpm test:api:focus:documents`
    - `pnpm --filter @rag-system/api build`
  - real runtime verification：
    - 用最新 build 的本地 API（port `3012`）配合一个慢速本地 web source，连续发起两次同 URL 的 `createWebPageDocument`
    - 最终只保留 `version=2 / title="Second Title"` 的最新结果，旧 `version=1` 收口为 `skipped/stale_guard`，未发生 stale overwrite

- ✅ ingestion duplicate same-version run activation guard
  - `DocumentIngestionProcessor` 现在会先尝试把对应 run 从可激活状态切到 `processing`，只有激活成功后才会把 document 本身改到 `processing/parsing`
  - `DocumentRunsService.markRunProcessing()` 现仅允许既有 run 处于 `pending` 或 `failed` 时重新进入 `processing`；已是 `ready` / `skipped` 的同版本重复 job 会直接退出，不再把 terminal run 重新打开
  - 新增 focused coverage：
    - `apps/api/test/ingestion.orchestrator.test.js`
      - duplicate same-version job does not reopen a terminal run
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/ingestion.orchestrator.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用最新 build 的本地 API（port `3011`）先 upload 一个文档至 `ready`
    - 再手动向 BullMQ 注入同一 `documentId + version` 的 duplicate ingestion job
    - 结果保持：document 仍为 `ready/completed`，run 仍只有 1 条，未被重新打开

- ✅ ingestion mid-flight supersede hardening minimum increment
  - `DocumentIngestionProcessor` 现在不再只在 job 开头做一次 stale guard；在 terminal write 前会再确认当前 document `version` 仍与运行中的 job 一致
  - 当旧 ingestion job 在处理中被新的 `reindex` / `external_resync` 版本覆盖时，旧 job 现在会收口为 `skipped / stale_guard`，而不是继续把 document 终态写成 `ready` 或 `failed`
  - 这一轮刻意只修最危险的 terminal-state overwrite 风险，没有扩成更大的并发重构，也没有重开 source-family / retrieval 范围
  - 新增 focused coverage：
    - `apps/api/test/ingestion.orchestrator.test.js`
      - mid-flight superseded success path does not overwrite ready state
      - mid-flight superseded failure path does not overwrite failed state
  - focused validation rerun:
    - `pnpm --filter @rag-system/api test:file -- test/ingestion.orchestrator.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification:
    - 本地 API 实跑 upload + 连续两次 `POST /documents/:id/reindex`
    - 观察到 runs 收口为：最新 `v3=ready`，被覆盖的 `v2=skipped/stale_guard`，未出现旧版本覆盖新版本终态

补充进展（2026-03-25）：

- current source-family backend hardening 现已补一个最后的 bounded follow-up，继续只收在既有 `web page` / `feed` / `sitemap` / `sitemap index` family：
  - `sitemap` partial-ready diagnostics 不再把所有 partial case 一律记成 `retryable: true`
  - 当前会按实际 child-sitemap / page failure 结果收口 top-level retryable 语义，避免 run summary 的 `latestRetryableFailure` 被非可重试 partial case 误锚定
  - `sitemap` partial run message 现在也会区分：
    - partial page fetch failures
    - partial child sitemap fetch failures
    - mixed child sitemap + page fetch failures
  - 上述 source hardening follow-up 现已补齐 focused coverage：
    - `apps/api/test/external-source-sync.test.js`
    - `apps/api/test/sitemap-source-e2e.test.js`
  - 本地验证已按要求尝试：
  - `pnpm test:api:focus:sources`
  - `pnpm --filter @rag-system/api test:file -- test/external-source-sync.test.js`
  - 当前工作区存在现成环境阻塞：缺少本地 `node_modules` / `vitest`，两条命令均在测试执行前失败；本次先保留该验证阻塞说明，不虚报通过

- `packages/shared` 现已开始承载真实跨包 contract，首个收口 family 为 `traceSummary`：
  - `packages/shared/src/trace-contracts.ts` 现定义 trace read-model 的共享联合类型与 `TraceSummary`
  - backend `TracesService` 现直接以该共享 contract 约束返回形状
  - web `TraceRecord.traceSummary` 现改为直接复用共享类型，而不再在 `apps/web/src/types/api.ts` 内联重复声明整段 payload
  - `apps/web/test/trace-summary-contract.test.js` 现也改为断言 web 类型从 `@rag-system/shared` 导入并跟随共享源文件

- web ask-response contract 现也已对齐 backend 已稳定返回的 `qualityEvaluation` 最小结构：
  - `overall`
  - `grounding`
  - `completeness`
  - `primaryIssue`
  - `flags`
  - `summary`
- 这样当前前端消费 ask / stream final payload 时，不再把 backend 已稳定返回的质量评估结果继续保留为完全无类型的 `JsonValue`
- 上述 ask quality-evaluation contract alignment 现已补齐最小 source-level 回归覆盖：
  - `apps/web/test/ask-quality-evaluation-contract.test.js`

- web ask-response contract 现也已对齐 backend 已稳定返回的 `answeringMetadata` 最小结构：
  - `promptId`
  - `usedFallback`
  - `answerPolicy`
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
  - `insufficientContextReason`
  - `answerStatusSource`
  - `answerStatus`
- 这样当前前端消费 ask / stream final payload 时，不再把 backend 已稳定返回的 answering execution metadata 继续保留为完全无类型的 `JsonValue`
- 上述 ask answering-metadata contract alignment 现已补齐最小 source-level 回归覆盖：
  - `apps/web/test/ask-answering-metadata-contract.test.js`

- web ask-response contract 现也已对齐 backend 已稳定返回的 `retrievalMetadata` 最小结构：
  - `strategy`
  - `filters`
  - `queryRewrite`
  - `execution`
- 其中 `execution` 当前也已覆盖现有稳定的 candidate-flow / context-shaping 字段：
  - `candidateLimit`
  - `vectorCandidateCount`
  - `lexicalCandidateCount`
  - `mergedCandidateCount`
  - `rankedCandidateCount`
  - `retrievedChunkCount`
  - `contextGroupCount`
  - `primaryChunkCount`
  - `neighborChunkCount`
- 这样当前前端消费 ask / stream final payload 时，不再把 backend 已稳定返回的 retrieval execution metadata 继续保留为完全无类型的 `JsonValue`
- 上述 ask retrieval-metadata contract alignment 现已补齐最小 source-level 回归覆盖：
  - `apps/web/test/ask-retrieval-metadata-contract.test.js`

- trace 读取接口的 additive `traceSummary` 现已继续补齐 retrieval candidate-flow 诊断字段：
  - `candidateLimit`
  - `vectorCandidateCount`
  - `lexicalCandidateCount`
  - `mergedCandidateCount`
  - `rankedCandidateCount`
  - `vectorCandidateLimitHit`
  - `lexicalCandidateLimitHit`
  - `rankingTopKHit`
- 这样上层读取 `GET /traces/:id` 与 `GET /conversations/:id/traces` 时，不再只能回退到原始 `retrievalMetadataJson.execution` 才能判断候选池是否打满、fallback 前拿到了多少 vector candidates，以及排序前后候选规模
- 当前改动保持为 trace read-model 收口，不改 retrieval 排序、fallback、ask / stream 行为
- 上述 trace-summary candidate-flow 收口现已补齐最小回归覆盖：
  - `apps/api/test/traces.service.test.js`
  - `apps/api/test/api-flow.test.js`
  - `apps/web/test/trace-summary-contract.test.js`

- retrieval execution diagnostics 现在会在 `no_ranked_candidates` 触发 lexical fallback 时，继续保留 fallback 之前已经拿到的 vector candidate 统计：
  - `vectorCandidateCount`
  - `vectorCandidateLimitHit`
- 这样当向量检索“有候选但全被阈值/排序淘汰”时，execution metadata 不再误报成“完全没有 vector candidates”
- 当前改动只收口 retrieval read-model 级执行诊断，不改变既有 fallback 判定、排序或返回 chunk 语义
- 上述 fallback-diagnostics 边界现已补齐最小 source-level 回归覆盖：
  - `apps/api/test/retrieval.test.js`

- web ask-response contract 现也已对齐 backend `contextGroups` 的完整返回形状：
  - `documentId`
  - `documentTitle`
  - `startChunkIndex`
  - `endChunkIndex`
  - `chunkIds`
  - `primaryChunkIds`
  - `mergedContent`
  - `pageNumbers`
  - `sectionTitles`
- 这样当前前端消费 ask / stream final payload 时，不再把 backend 已稳定返回的 context-group metadata 缩窄成只剩 `primaryChunkIds` 和 `mergedContent`
- 上述 ask context-group contract alignment 现已补齐最小 source-level 回归覆盖：
  - `apps/web/test/ask-context-groups-contract.test.js`

- web document-run contract 现也已对齐 backend 已返回的 `failureSummary` 字段：
  - `DocumentRunRecord`
  - `KnowledgeBaseDocumentRunRecord`
  - `KnowledgeBaseDocumentRunSummary.latestRetryableFailure`
  - `KnowledgeBaseDocumentRunSummary.latestSkipped`
  - `KnowledgeBaseDocumentRunSummary.latestFailure`
- 这样当前前端消费 run list / summary anchors 时，不再把 backend 已稳定返回的最小失败摘要遗漏在过时类型之外
- 上述 document-run contract alignment 现已补齐最小 source-level 回归覆盖：
  - `apps/web/test/document-run-contract.test.js`

- web trace contract 现已对齐 backend 已落地的 additive `traceSummary` 枚举值：
  - `retrievalQuerySource`: `rewritten` / `original_disabled` / `original_unchanged`
  - `failedStage`: `retrieval` / `answering`
- 这样当前前端消费 trace summary 时，不再把 backend 已存在的 `original_unchanged` 查询来源和 `retrieval` 失败阶段误缩窄成过时联合类型
- 上述 trace-contract alignment 现已补齐最小 source-level 回归覆盖：
  - `apps/web/test/trace-summary-contract.test.js`

- knowledge-base scoped run summary 现已支持与 run list 对齐的窄过滤输入：
  - `documentId`
  - `sourceType`
  - `status`
  - `trigger`
  - `issueOnly`
  - `sinceHours`
- 这样 `GET /knowledge-bases/:id/document-runs/summary` 不再只能做全量 recent-window 聚合，现也可按已有 observability 过滤口径收窄统计和 latest anchors
- `Knowledge Base` 页当前 recent runs summary 也已跟随现有 `all / failed / processing` 过滤切换同口径请求，避免摘要与下方列表出现口径漂移
- 上述 summary-filter follow-up 现已补齐最小 source-level 回归覆盖：
  - `apps/api/test/document-runs-summary.test.js`

- `traceSummary` 的集成 / E2E 验证基线现已对齐最近新增的 provenance 字段：
  - `apps/api/test/api-flow.test.js`
  - `apps/api/test/ask-chain-e2e.test.js`
- 这样 `GET /traces/:id` 与 `GET /conversations/:id/traces` 的现有重型链路验证，不再只覆盖旧版 summary 结构

- trace 读取接口的 additive `traceSummary` 现已继续补齐常用执行归因字段：
  - `retrievalQuerySource`
  - `contextMode`
  - `resolvedLanguage`
  - `citationSelectionSource`
  - `answerTextSource`
  - `answerStatusSource`
- 这样上层读取 trace 时，不再只能从原始 `retrievalMetadataJson` / `answeringMetadataJson` 中自行重建“最终查询来源、上下文组织方式、语言分流和答案归因”
- 当前改动保持为 read-model 收口，不改 trace 持久化写路径，也不改 ask / stream 行为
- 上述 trace-summary provenance 提升现已补齐最小 source-level 回归覆盖：
  - `apps/api/test/traces.service.test.js`

- streamed answering finalization 现已和 one-shot fallback 结果进一步收口：
  - 当 native stream 走 `fallback-local` 且结构化解析缺少 `answerStatus` / `missingInformation` / citation 选择时，backend 会在 `AnsweringService.finalizeStreamedAnswer()` 内先补齐与 one-shot 相同的 fallback 归一化结果
  - 这样 grounded fallback stream 不再把 `answerStatusSource` 错记为纯 retrieval 推断，也不再把 one-shot 已稳定暴露的 fallback citation provenance 丢成 inline-marker / inferred 语义
  - no-hit `best_effort` fallback stream 现在也会和 one-shot 一样保留稳定的 insufficient-context provenance，而不是让 final payload / trace 退回到二次推断的 `missingInformationSource`
  - 上述 stream/one-shot convergence 现已补齐 focused 回归覆盖：
    - `apps/api/test/answering.test.js`
    - `pnpm test:api:focus:ask`
    - `pnpm --filter @rag-system/api test:file -- test/llm-answer-stream.test.js`

- knowledge-base scoped recent run list 现已支持最小 `issueOnly` 过滤，可直接聚焦真正“需要关注”的 completed issue runs
- 该过滤会对齐现有 run summary 的 failureSummary 口径：
  - 包含 terminal `failed` runs
  - 包含带 partial failureSummary 的 `ready` runs
  - 不包含 `skipped` runs
  - 不包含仅临时保留 partial diagnostics 的 `pending` / `processing` runs
- 当前实现保持现有 `status` 过滤语义不变，只在 `GET /knowledge-bases/:id/document-runs` 上新增窄范围可选过滤
- 上述 issue-only 过滤边界现已补齐最小 source-level 回归覆盖：
  - `apps/api/test/document-runs-summary.test.js`

- API fast test lane 现已切到 `Vitest`，integration / E2E 继续保留当前 Node test runner + `dist` 启动路径，形成快慢分层的 backend test workflow
- `PATCH /retrieval-profiles/:id` 现也已支持 `strategyJson: null`，可显式清空已保存的 retrieval strategy override，回退到既有 flat fields 推导的默认策略语义
- `Assistant` 页面现也已补齐 retrieval `strategyJson` 覆盖编辑能力，可直接管理 query rewrite、candidate mode、candidate budget、hybrid weights 和 rerank override，并在关闭覆盖时提交 `strategyJson: null`
- 上述 `Assistant strategy` 配置区现也已补齐最小 source-level 回归覆盖，锁定关键区块和控件的稳定 selector，便于后续浏览器级验证继续接入
- `pnpm test:api:file -- <path>` 现已按测试文件类型自动分流：fast-lane 文件直接走 `Vitest`，heavy 文件先做 build freshness 检查，再走原 runner
- heavy API test lane 现已具备 on-demand build 检查；仅当 `src/`、`prisma/` 或关键 API 配置文件比当前 built entry（优先 `dist/apps/api/src/main.js`，兼容 `dist/main.js` 旧路径）更新时，才会重新 build
- integration / chain E2E / source E2E 文件现已统一为“每文件 seed 一次默认数据、每条测试前 reset mutable state”，减少重复 seed 与重测试启动成本
- fast-lane test support 现已新增通用 helper：
  - `apps/api/test/support/llm-test-helpers.js`
  - `apps/api/test/support/ask-assistant-test-helpers.js`
- `AskAssistantService` fast tests 的当前支撑层收口已完成到既定 helper 边界；`ask-success.test.js`、`ask-stream-service.test.js`、`ask-failures.test.js`、`ask-stream-retrieval-failure.test.js` 已复用统一依赖默认值和 assistant-record scaffolding
- `ask-success.test.js` / `ask-stream-service.test.js` 中剩余的 localized summary cases 现也已清掉外层手写 `new AskAssistantService(...)` 装配，改为复用统一 helper；当前未继续向更深层 localized payload 文本抽象，以避免为历史编码块引入高风险重写
- 当前这轮 backend test work 的目标仍是“测试支撑层提效”，重点放在减少 fast tests 中重复的 service mock 构造与默认依赖样板，不涉及业务行为调整

- trace 读取接口现在会直接返回 additive `traceSummary`，把 `answerStatus`、`qualityOverall`、`primaryIssue`、`retrievalMode`、`generationMode`、`rewriteApplied`、`fallbackReason`、`citationAttribution`、`missingInformationCount`、`insufficientContextReason`、`failedStage`、`failureMessage`、`retrievedChunkCount`、`citationCount`、`usedFallback` 从持久化 trace JSON 中归一化提取出来
- ask 失败路径现在也会把最小 `failure` 元数据写进现有 `retrievalMetadataJson`，供 trace read-model 直接提取失败阶段和失败消息
- one-shot / stream ask 在 retrieval 阶段抛错时，现在也会先创建 failed trace，再返回 `ASK_PIPELINE_FAILED`，不再只有 answering 阶段失败才能拿到 `traceId`
- 这样 `GET /traces/:id` 与 `GET /conversations/:id/traces` 不再要求上层自己拼接这几项执行结论
- answering / retrieval backend 收口继续推进中
- strong quality summary 现在也会单独区分 `required citation` 下由 backend heuristic 回填的引用路径，不再与普通 `retrieved without citations` 共用同一条文案
- 上述 heuristic-citation strong summary 现已补齐最小 `en` / `zh` 回归覆盖
- `fallback_generation + low_retrieval_score` 的 grounded partial 组合现在也已对齐 `primaryIssue` 优先级：主因继续锚定 `fallback_generation`，而不是被低检索分覆盖
- grounded fallback answer 在 `missing_information` 组合下的 `primaryIssue` 现在也继续锚定 `fallback_generation`，不再被信息缺口标记覆盖
- `POST /assistants/:id/ask` 的 deterministic no-hit `say_insufficient_context` 旁路结果现在已复用 answering 层统一结果构造，不再在 ask service 内手写英文 `missingInformation` / `qualityEvaluation.summary`
- 这使 one-shot no-hit deterministic answer 的 answer 文本、`missingInformation`、弱质量总结在 `en` / `zh` 下保持一致本地化语义
- one-shot no-hit deterministic bypass 现在也会在 assistant 未显式配置 `answerPolicyJson` 时生效，和 backend 默认 `noAnswerBehavior=say_insufficient_context` 语义保持一致
- `POST /assistants/:id/ask/stream` 的 deterministic no-hit 旁路现在也直接复用同一 centralized insufficient-context result shaping，不再先旁路 provider stream 再绕回 streamed finalization
- `best_effort` 的 no-hit ask-service 编排语义现已补齐回归覆盖：one-shot 仍走 answer generation，stream 仍走 streamed generation + finalization，不会误落到 deterministic insufficient-context bypass
- `insufficient_context` 且模型漏掉 `missingInformation` 时，backend 现在也会按 retrieval 实际命中情况区分默认理由：`no hits` 与 `hit but still insufficient` 不再共用同一条“没检索到来源”的默认文案
- 上述 hit-aware 默认 `missingInformation` 理由现已补齐中文回归覆盖，和已有的 `no-hit` 中英文分支一起构成最小 `en` / `zh` 闭环
- weak `insufficient_context` summary 现在也会在已有 `low_retrieval_score` flag 时显式带出“检索置信度偏低”，不再只停留在“上下文仍不足”的单因文案
- 上述 weak low-confidence insufficient-context summary 现已补齐中文回归覆盖，和英文分支保持一致
- 中文回归覆盖继续补齐到另一条弱 insufficient-context 组合路径：`hit but still insufficient` + `missing_information` + `low_retrieval_score`
- partial summary 的另一条双因路径 `missing_information + low_retrieval_score` 现也已补齐中文回归覆盖

## 1. 状态总览

### 当前结论

项目已经完成本地优先 RAG MVP 的主链路，当前可以稳定跑通：

- 文档上传
- 异步 ingestion
- chunking
- embedding
- indexing
- retrieval
- ask
- conversation / message / trace 持久化
- Web 核心页面联调

当前阶段已经不再是骨架或纯设计稿，适合继续按小步增量推进。

### 当前阶段判断

- 当前主线状态：`MVP 可运行 + 第一版可诊断 + 第一版可配置`
- 当前最适合继续推进的方向：
  - `PC Web chat experience polish` 这一轮收口已完成，可先视为 done
  - `external knowledge source expansion` 在当前限定范围内已完成 backend / API 收口
  - 下一步更适合切到新的 backend-first 增量，而不是继续在现有 source family 上重复补洞
  - 继续保持 `PC Web` 优先、移动端后置
- 当前本地执行约束：
  - 优先严格串行执行
  - 不并行跑重型测试或 build
  - 不把 AI review 和重型验证叠在一起

---

## 2. 第一版已完成

本节表示“已经落地并可用”，但不代表该方向已经 fully done。

### 2.1 工程与基础设施

- ✅ `pnpm` monorepo 已落地
- ✅ 仓库结构已拆分为：
  - `apps/api`
  - `apps/web`
  - `packages/shared`
  - `docs`
- ✅ PostgreSQL 已接入
- ✅ Redis 已接入
- ✅ Docker 本地开发基础设施已提供
- ✅ 本地开发文档已提供：
  - [README.md](../README.md)
  - [docs/current-dev-setup.md](current-dev-setup.md)
  - [docs/local-dev-infra.md](local-dev-infra.md)

### 2.2 后端骨架

- ✅ NestJS API 已初始化
- ✅ 全局异常过滤已接入
- ✅ 健康检查接口可用：`GET /health`
- ✅ 核心模块边界已建立：
  - `knowledge-bases`
  - `documents`
  - `assistants`
  - `retrieval-profiles`
  - `conversations`
  - `messages`
  - `traces`
  - `ingestion`
  - `indexing`
  - `retrieval`
  - `answering`
  - `infra/database`
  - `infra/storage`
  - `infra/queue`
  - `infra/llm`
  - `infra/vector-store`

### 2.3 数据库与默认数据

- ✅ Prisma schema 已建立
- ✅ migration 已建立
- ✅ seed 脚本已建立
- ✅ 默认数据已固定：
  - tenant: `default-tenant`
  - user: `default-user`
  - knowledge base: `default-kb`
  - retrieval profile: `default-retrieval-profile`
  - assistant: `default-assistant`

### 2.4 文档链路第一版

- ✅ 文档上传
- ✅ 原始文件本地存储
- ✅ 文档元数据入库
- ✅ Redis 队列异步处理
- ✅ Markdown 解析
- ✅ TXT 解析
- ✅ text-based PDF 解析
- ✅ chunking 第一版
  - 标题感知切分
  - 超长段落切分
  - 更稳定的 chunk 长度控制
- ✅ chunk 落库
- ✅ indexing 接入
- ✅ embedding 生成
- ✅ 本地 file-backed vector store 写入
- ✅ 文档状态流转：
  - `pending`
  - `processing`
  - `ready`
  - `failed`
- ✅ document run history 第一版
  - run 级持久化已覆盖 `upload` / `reindex` / `external_resync`
  - 当前每次 run 会记录：
    - `documentId`
    - `version`
    - `trigger`
    - `status`
    - `failedStage`
    - `diagnosticsJson`
    - `startedAt` / `finishedAt`
  - stale ingestion job 当前也会把旧 run 显式落为 `skipped`
- ✅ `reindex`

当前相关 API：

- ✅ `GET /knowledge-bases/:id/documents`
- ✅ `GET /knowledge-bases/:id/document-runs`
- ✅ `POST /knowledge-bases/:id/documents`
- ✅ `POST /knowledge-bases/:id/documents/upload`
- ✅ `GET /documents/:id`
- ✅ `GET /documents/:id/runs`
- ✅ `GET /documents/:id/chunks`
- ✅ `DELETE /documents/:id`
- ✅ `POST /documents/:id/reindex`

### 2.5 Retrieval 第一版

- ✅ 默认优先向量召回
- ✅ lexical fallback
- ✅ chunk window 扩展第一版
- ✅ hybrid retrieval 第一版
- ✅ rerank 第一版
- ✅ query rewrite 第一版
- ✅ RetrievalProfile metadata filter 第一版
  - `documentIds`
  - `sectionTitles`
  - `pageNumbers`
- ✅ retrieval score breakdown 持久化第一版
  - `score`
  - `vectorScore`
  - `lexicalScore`
  - `hybridScore`
  - `rerankScore`

### 2.6 Ask / Answering / Trace 第一版

- ✅ `assistant -> retrieval profile -> retrieval -> answering` 主链路打通
- ✅ conversation 持久化
- ✅ message 持久化
- ✅ trace 持久化
- ✅ citation-aware prompt 第一版
- ✅ citations 返回
- ✅ retrievedChunks 返回
- ✅ `AnswerTrace.rewrittenQuery` 持久化
- ✅ ask 失败诊断增强第一版
  - `ASK_PIPELINE_FAILED`
  - `traceId`
  - `details`
- ✅ 全局 HTTP exception filter 保留结构化错误字段

当前相关 API：

- ✅ `GET /assistants`
- ✅ `GET /assistants/:id`
- ✅ `PATCH /assistants/:id`
- ✅ `POST /assistants/:id/ask`
- ✅ `GET /retrieval-profiles`
- ✅ `GET /retrieval-profiles/:id`
- ✅ `POST /retrieval-profiles`
- ✅ `PATCH /retrieval-profiles/:id`
- ✅ `GET /conversations`
- ✅ `GET /conversations/:id`
- ✅ `GET /conversations/:id/messages`
- ✅ `GET /conversations/:id/traces`
- ✅ `GET /traces/:id`

### 2.7 LLM / Embedding 第一版

- ✅ Ollama 生成接入
- ✅ OpenAI 生成接入
- ✅ 本地 fallback answer
- ✅ Ollama embedding 接入
- ✅ OpenAI embedding 接入
- ✅ deterministic fallback embedding

### 2.8 Web MVP 第一版

- ✅ `Chat` 页面接真实 API
- ✅ `Documents` 页面接真实 API
- ✅ `Knowledge Base` 页面接真实 API
- ✅ `Assistant` 页面接真实 API
- ✅ Web i18n 第一版：`zh` / `en`
- ✅ App shell 语言切换器
- ✅ 文档详情页
- ✅ trace 详情页
- ✅ citation -> 文档 chunk 深链跳转
- ✅ 文档详情 trace 上下文高亮
- ✅ Documents / Chat 更清晰的 loading / empty / error 状态第一版
- ✅ Knowledge Base 页面运营概览增强第一版
- ✅ Assistant 页面已暴露 retrieval 基础配置字段：
  - `topK`
  - `chunkWindow`
  - `enableHybrid`
  - `enableRerank`
  - `scoreThreshold`

### 2.9 测试与验证第一版

- ✅ `pnpm typecheck`
- ✅ `pnpm build`
- ✅ `pnpm test:api`
- ✅ 最小 API 测试底座已建立
- ✅ 当前已覆盖：
  - PDF parsing
  - DOCX parsing
  - chunking
  - retrieval chunk window
  - hybrid retrieval
  - rerank
  - ingestion orchestrator
  - ask success orchestrator
  - citation-aware answering
  - ask failure diagnostics
  - retrieval profile filters
  - upload -> ready -> ask -> trace HTTP integration
  - document chunks / conversation messages / conversation traces integration assertions
- ✅ API integration tests 已支持 `QUEUE_PREFIX` 隔离，避免 Redis worker 串扰
- ✅ API 测试命令已串行执行，避免共享数据库状态的 HTTP 集成测试并发互相干扰
- ✅ web page source ingestion E2E
- ✅ feed source ingestion E2E
- ✅ sitemap source ingestion E2E
- ✅ sitemap index source ingestion E2E

---

## 3. 增强版未完成

本节表示“第一版已经有，但后续增强版还没做完”。

### 3.1 Retrieval 增强版未完成

- ✅ metadata filter 更完整的策略化能力
  - 已支持向后兼容的策略化过滤：
    - `documentIds.include` / `documentIds.exclude`
    - `sectionTitles.include` / `sectionTitles.exclude` / `sectionTitles.contains`
    - `pageNumbers.include` / `pageNumbers.exclude` / `pageNumbers.min` / `pageNumbers.max`
- ✅ chunk window 扩展后的更强拼接 / 组织策略
  - `ask` 响应现已新增 `contextGroups`
  - 连续且同文档的 window chunks 会按 `chunkIndex` 组织为 context group
  - group 当前返回：
    - `startChunkIndex` / `endChunkIndex`
    - `chunkIds` / `primaryChunkIds`
    - `mergedContent`
    - `pageNumbers` / `sectionTitles`
- ✅ 更系统的 retrieval 策略配置与演进能力
  - `RetrievalProfile.strategyJson` 已支持第一版系统化检索策略配置
  - 当前支持：
    - `queryRewrite.enabled`
    - `candidateSelection.mode`: `vector` / `hybrid` / `lexical`
    - `candidateSelection.candidateMultiplier`
    - `candidateSelection.minCandidates`
    - `hybrid.vectorWeight` / `hybrid.lexicalWeight`
    - `rerank.enabled`
  - 保持兼容既有 `enableHybrid` / `enableRerank` 平铺字段
  - `ask` 已按解析后的 retrieval strategy 决定是否 query rewrite
  - retrieval 已按策略控制候选池规模，以及 lexical / vector / hybrid 模式与 hybrid merge 权重

### 3.2 Answering 增强版未完成

- ✅ 更系统的 prompt 管理
  - 已新增 backend `PromptManagerService`
  - answer / rewrite prompt 已从 `LlmService` 内联字符串中抽离
  - 当前已支持版本化 prompt 标识：
    - `answer.v2`
    - `rewrite-query.v1`
  - Ollama / OpenAI 的 answer 与 rewrite 路径已统一经由 prompt manager 构造 prompt
- ✅ 输出结构约束
  - LLM structured answer JSON 已新增显式 schema 校验与标准化
  - 当前会约束并标准化：
    - `answer`
    - `status`
    - `citations`
    - `missingInformation`
  - `citations` 已支持 numeric string -> integer 归一化与去重
  - 非法 structured payload 仍会安全回退到 plain-text 解析路径
- ✅ 引用片段与答案的严格结构化对齐
- ✅ 回答质量评估
- ✅ 更完整的 assistant / answer policy 配置能力
- ✅ retrieval / answering execution metadata
  - ask 响应现已返回：
    - `retrievalMetadata`
    - `answeringMetadata`
  - `AnswerTrace` 现已持久化：
    - `retrievalMetadataJson`
    - `answeringMetadataJson`

### 3.3 Web 增强版未完成

- ✅ 更完整的 assistant / config 管理
  - RetrievalProfile `filtersJson` 前端编辑能力
  - 更完整的 answering / assistant policy 配置
  - RetrievalProfile `strategyJson` override 前端编辑与清空能力
- ✅ `PC Web` Chat 体验增强第一轮
  - NDJSON-based streamed ask rendering 第一轮
  - answer generation native text streaming 已升级完成
  - chat workspace UI / UX polish 第一轮
- ✅ 更多联调级自动化验证
- 当前客户端范围：`PC Web` 优先，移动端适配后置到功能和验证覆盖更稳定之后再推进

### 3.4 测试增强版未完成

- ✅ orchestrator / 模块集成测试
- ✅ 更完整的文档链 E2E
- ✅ 更完整的 ask 链路 E2E
- ✅ 前后端联调级自动化验证

### 3.5 Next Controlled Increment

- ✅ retrieval / answering systematic evolution
- [x] `PC Web` chat experience polish
  - NDJSON transport and progressive answer rendering: done
  - native answer-generation text streaming: done
  - chat workspace UI / UX polish: done
- [x] external knowledge source expansion
  - web page source ingestion minimum increment: done
  - feed source ingestion minimum increment: done
  - sitemap source ingestion minimum increment: done
  - sitemap index source ingestion minimum increment: done
  - backend / API consistency, recovery semantics, partial diagnostics, and run-summary coverage for the current source family are now closed in the current scope
- keep backend / API first
- keep `PC Web` as the current client priority
- do not expand mobile work yet

---

## 4. 仍未完整支持

- ✅ DOCX 支持
- ✅ 网页内容抓取 / 网页知识源接入
- ✅ 外部知识源接入第一轮最小增量

说明：

- 这里的 `[x]` 表示“外部知识源接入的第一轮最小可用能力已经落地”，不代表该方向已经整体完成
- 当前已完成的最小增量主要是：
  - one direct `http` / `https` web page source
  - one direct RSS / Atom feed source
  - one direct sitemap `urlset` source
  - one root sitemap `sitemapindex` source that expands child direct sitemaps
- 当前 source family 的 backend / API 收口已完成；后续如再继续外部知识源方向，应视为新的后续增量而不是当前这一轮未完成残项

---

## 5. 暂未开始且不属于当前主优先级

- [ ] 鉴权
- [ ] 用户登录
- [ ] 多租户隔离
- [ ] ACL / 文档权限
- [ ] 企业级审计与治理能力

---

## 6. 已过期旧状态

以下说法已经被后续实现推翻，仅保留作历史纠正：

- ~~hybrid retrieval 尚未实现~~
- ~~rerank 尚未实现~~
- ~~query rewrite 尚未实现~~
- ~~RetrievalProfile metadata filter 尚未实现~~
- ~~文档详情页尚未完成~~
- ~~trace 详情页尚未完成~~
- ~~Knowledge Base 页面只是最小占位摘要~~
- ~~ask 失败时只有原始异常信息~~

如果旧文档中仍出现这些表述，应以本文档当前内容为准。

---

## 7. 当前已知限制

- 当前向量存储仍是本地轻量 file-backed 实现
- ask 结果质量仍较依赖 chunk 切分质量
- embedding 模型选择和维度管理仍未完全配置化
- 未配置可用 embedding 模型时会退回 fallback embedding，语义召回上限有限
- 当前更适合本地开发和单用户验证
- 当前 worker 与 API 仍在同一进程模型下运行，后续可再拆分
- Web 构建目前有 bundle size warning，但不阻塞开发

---

## 8. 当前优先级

### 8.1 已完成优先级项

- ✅ 接入真实 embedding
- ✅ 落地第一版 vector store
- ✅ 打通 indexing -> retrieval 的真实向量链路
- ✅ RetrievalProfile metadata filter 第一版

### 8.2 当前推荐下一步

- [x] `PC Web` chat experience polish
  - chat streaming transport and native answer-generation streaming: done
  - workspace UI / UX polish and final收口: done
- [x] external knowledge source expansion
  - source stabilization phase 1: done
  - source run history / execution observability minimum increment: done
  - sitemap / sitemap-index partial-failure tolerance + structured partial diagnostics: done
  - feed partial invalid-entry tolerance + structured partial diagnostics: done
  - backend consistency / recovery / direct-failure coverage for the current source family: done
  - current completed backend consistency scope includes:
    - direct failed-document persistence for invalid `web page` / `feed` / `sitemap` inputs
    - same-URL recovery cleanup for retryable and non-retryable external-source failures
    - same-URL recovery cleanup for partial-ready diagnostics
    - latest-activity document ordering
    - run-history retention after recovery
    - run-summary cleanup after recovery
    - latest partial-failure summary selection for a document with older failed history
    - source-level partial diagnostics normalization for repeated `feed` / `sitemap` syncs
  - recommended next increment:
    - choose a new backend-first direction
    - do not reopen UI refactor
    - do not expand into a generic connector / source-center platform rewrite
- 后续自动推进时，默认继续保持严格串行执行，避免本地机器在验证阶段卡死

### 8.3 后续再往后

- ✅ 前后端联调级自动化验证
- ✅ 更完整的文档链 E2E
- ✅ 更完整的 ask 链路 E2E
- ✅ retrieval / answering 更系统化演进
- [ ] 外部知识源扩展
- [ ] 更细的移动端适配
- [ ] auth / 多租户 / ACL
- [ ] 企业能力

---

## 9. 最近完成的关键增量

### 2026-03-23

- ✅ no-hit one-shot deterministic bypass
  - `POST /assistants/:id/ask` 在 `no hits + say_insufficient_context` 时，现在也会直接跳过 answer generation
  - backend 会直接返回 deterministic insufficient-context answer，而不是先调用 provider / fallback answer generation 再在末尾覆盖文本
  - 这样 one-shot 和 stream 两条 deterministic no-answer 路径的执行语义已经对齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/ask-success.test.js`
    - `node --test apps/api/test/ask-stream-service.test.js apps/api/test/answering.test.js`

- ✅ no-hit ask-stream deterministic bypass
  - `POST /assistants/:id/ask/stream` 在 `no hits + say_insufficient_context` 时，现在会直接跳过 provider streaming
  - backend 会直接发出 deterministic insufficient-context delta，并让最终 `final.answer` 复用同一文本
  - 这样 no-hit deterministic policy 不再先流出 provider / fallback 自由文本，再在 final payload 改写成另一版答案
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/ask-stream-service.test.js`
    - `node --test apps/api/test/ask-success.test.js apps/api/test/llm-answer-stream.test.js`

- ✅ quality-summary localization alignment
  - backend 生成的 deterministic `qualityEvaluation.summary` 现在也会按问题语言和 policy 做最小 `en` / `zh` 分流
  - 当前至少已对齐：
    - strong cited / retrieved summary
    - partial missing-information / low-retrieval-score / fallback-generation summary
    - weak no-hit / hit-but-insufficient summary
  - 这样中文场景下，`answer`、`missingInformation`、`qualityEvaluation.summary` 不再出现中英混杂
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`
    - `node --test apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ no-hit stream fallback answer alignment
  - native stream path 在 `no hits + say_insufficient_context` 时，fallback delta 文本现在和最终 `final.answer` 使用同一 deterministic insufficient-context reply
  - 这样流式渲染不再先显示一版 “couldn't find relevant information” 再在最终 payload 里切成另一版 backend fallback answer
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/llm-answer-stream.test.js`
    - `node --test apps/api/test/ask-stream-service.test.js apps/api/test/ask-success.test.js`

- ✅ heuristic-citation strong-summary alignment
  - 当 `citationMode=required` 且 backend 因模型未显式给 citation 而回填 heuristic citations 时，`qualityEvaluation.summary` 不再误称答案“grounded in cited sources”
  - 当前只有模型显式提供的 structured citations 或 inline markers 才会触发 cited-sources 强文案
  - 如果 citation 只是 backend 为兼容 required-citation 路径补出来的，strong summary 会回到 grounded in retrieved sources 的表述
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`
    - `node --test apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ insufficient-context missing-information localization alignment
  - `insufficient_context` 场景下，backend 补的 deterministic `missingInformation` reason 不再固定为英文
  - 当前无论是：
    - `AnsweringService` 在模型省略 `missingInformation` 时补值
    - `LlmService` zero-hit local fallback 直接产出的 `missingInformation`
  - 都会按问题语言和 policy 走同一套最小 `en` / `zh` 分流
  - 这样 answer 文本与结构化 `missingInformation` 字段在中文场景下不再语言错位
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js apps/api/test/llm.test.js`
    - `node --test apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ grounded fallback quality-evaluation alignment
  - 当回答仍然是 `grounded`，但 answer generation 实际走了本地 fallback 路径时，`qualityEvaluation` 不再继续给出 `strong`
  - 当前会降级为 `partial`，并暴露：
    - `primaryIssue: fallback_generation`
    - `flags: ["fallback_generation"]`
    - fallback-specific summary
  - 这样 `qualityEvaluation` 与既有的 `answeringMetadata.usedFallback` 语义保持一致，上层不必自行把执行路径再解释一遍
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`
    - `node --test apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ partial dual-cause quality summary alignment
  - 当 `missing_information` 和 `low_retrieval_score` 同时出现时，`qualityEvaluation.summary` 现在会合并表达两个风险点
  - 这样 partial 场景不再只暴露“信息缺失”而丢掉 retrieval confidence 偏低这一层信号
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ quality-evaluation primary-issue exposure
  - `qualityEvaluation` 现已新增 `primaryIssue`，用于给上层稳定表达当前质量评估的主因，而不必自行解释 `flags` 优先级
  - 当前已覆盖的主因包括：`none`、`no_retrieval_hits`、`insufficient_context`、`missing_information`、`low_retrieval_score`、`other`
  - one-shot answering、ask orchestration、stream final payload / trace 相关断言现已对齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ weak insufficient-context summary alignment
  - `qualityEvaluation.summary` 现在会区分两类 weak answering 场景：
    - 完全没有 retrieval hits
    - 已有 retrieval context，但证据仍不足以支持回答
  - 这让 `insufficient_context` 的弱场景文案与实际 retrieval 执行结果保持一致
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ low-retrieval-score quality downgrade alignment
  - grounded answers 在 supporting context 的 top retrieval score 偏低时，`qualityEvaluation.overall` 现在会从 `strong` 降为 `partial`
  - 同时 summary 会明确指出是 retrieval confidence 偏低，而不是沿用泛化的缺失信息文案
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ optional-citation strong-summary wording alignment
  - optional-citation 下的 `strong` quality summary 现在不会再错误声称回答“grounded in cited sources”
  - 当回答没有 citation 但仍然 grounded / strong 时，summary 现会改为基于 retrieved sources 的表述
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ optional-citation quality evaluation alignment
  - `citationMode=optional` 的 grounded answers 现在不会再因为缺少 citation 被自动打上 `no_citations`
  - 当没有其他 gap 或 retrieval-risk 信号时，这类回答的 `qualityEvaluation` 现在可以保持 `strong`
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ answering metadata fallback-path exposure
  - `answeringMetadata` 现已显式返回 `usedFallback`，用于区分 provider-backed answer generation 和本地 fallback 路径
  - one-shot ask、native stream final payload，以及持久化 trace 中的 `answeringMetadataJson` 语义现已对齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`
    - `node --test apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ answering metadata prompt-context count exposure
  - `answeringMetadata` 现在也会显式返回 `promptContextCount`，用于表示实际送进 answer generation 的上下文单元数
  - 该字段与 `contextMode` 对齐：
    - `chunks` 模式下等于 raw `inputChunkCount`
    - `context_groups` 模式下等于 merged context group 数，而不再需要上层自己从 `contextMode` 和 `contextGroupCount` 推断
  - one-shot、native stream final payload、以及持久化 trace 中的 `answeringMetadataJson` 语义现已一起补齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ answering citation-attribution metadata exposure
  - `answeringMetadata` 现在也会显式返回 `citationAttribution`，用于区分最终 citation 是 `explicit`、`heuristic` 还是 `none`
  - 这样上层不再需要从 `qualityEvaluation.summary` 或 grounded wording 间接反推 citation 来源
  - one-shot、native stream final payload、以及持久化 trace 中的 `answeringMetadataJson` 语义现已对齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ answering missing-information count exposure
  - `answeringMetadata` 现在也会显式返回 `missingInformationCount`，用于表达最终响应里保留了多少条缺失信息项
  - 这样上层不再需要从 `missingInformation.length` 自己推导 metadata 统计，也能更直接地读 trace persistence
  - one-shot、native stream final payload、以及持久化 trace 中的 `answeringMetadataJson` 语义现已对齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ answering resolved-language exposure
  - `answeringMetadata` 现在也会显式返回 `resolvedLanguage`，用于表达 backend 最终把 `auto` / `same_as_question` 解析成了哪种实际语言
  - 这样上层不再需要结合 policy 与问题文本自己推断当前回答链路到底按 `en` 还是 `zh` 落地
  - one-shot、native stream final payload、以及持久化 trace 中的 `answeringMetadataJson` 语义现已对齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

  - ✅ answering generation-mode exposure
  - `answeringMetadata` 现在也会显式返回 `generationMode`，用于区分当前回答是正常走了 answer generation，还是在 no-hit `say_insufficient_context` 路径上直接走了 deterministic bypass
  - 当前值收口为 `generated` / `deterministic_bypass`，对应 one-shot 与 native stream 的最终 payload，以及 trace 持久化里的 `answeringMetadataJson`
    - 这样上层不再需要结合 `noAnswerBehavior`、retrieval hit 情况和 orchestration 逻辑，自己反推这一轮是否实际绕过了 provider generation
    - focused validation rerun:
      - `pnpm --filter @rag-system/api build`
      - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`
  - ✅ answering citation-truncation and gap-provenance exposure
    - `answeringMetadata` 现在也会显式返回 `citationCountBeforeLimit` 与 `citationLimitHit`，用于区分最终 citation 数量到底是天然较少，还是被 `maxCitations` 截断过
    - `answeringMetadata` 同时显式返回 `missingInformationSource`，当前值收口为 `none` / `model` / `deterministic_default` / `suppressed_by_policy`
    - 这样上层不再需要从 `maxCitations`、最终 citation 数量和 `missingInformation` 本体去反推 citation 截断或 advisory gap 的来源
    - one-shot、native stream final payload、以及 trace 持久化里的 `answeringMetadataJson` 语义现已对齐
    - focused validation rerun:
      - `pnpm --filter @rag-system/api build`
      - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`
  - ✅ answering answer-text-source and insufficient-context-reason exposure
    - `answeringMetadata` 现在也会显式返回 `answerTextSource`，当前值收口为 `model` / `deterministic_policy`
    - `answeringMetadata` 同时显式返回 `insufficientContextReason`，当前值收口为 `no_retrieval_hits` / `retrieved_context_insufficient` / `null`
    - 这样上层不再需要结合 `noAnswerBehavior`、最终 answer text、以及 retrieval hit 情况，自己反推这轮回答是否被 deterministic policy 覆盖，以及 `insufficient_context` 到底来自 no-hit 还是 hit-aware 证据不足
    - one-shot、native stream final payload、以及 trace 持久化里的 `answeringMetadataJson` 语义现已对齐
  - ✅ answering citation-source and status-source provenance
    - `answeringMetadata` 现在也会显式返回 `citationSelectionSource`，当前值收口为 `structured` / `inline_markers` / `heuristic` / `none`
    - `answeringMetadata` 同时显式返回 `answerStatusSource`，当前值收口为 `model` / `inferred_from_retrieval` / `deterministic_policy`
    - 这样上层不再需要自己判断 citation 是来自 structured output、plain-text marker 解析还是 heuristic backfill，也不需要再从结果形态反推 `answerStatus` 是模型明确给出的还是 backend 推断出来的
    - one-shot、native stream final payload、以及 trace 持久化里的 `answeringMetadataJson` 语义现已对齐
    - focused validation rerun:
      - `pnpm --filter @rag-system/api build`
      - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`
    - focused validation rerun:
      - `pnpm --filter @rag-system/api build`
      - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ local grounded fallback answer language alignment
  - 当没有可用模型 provider、但 retrieval 已命中内容时，`LlmService` 本地 grounded fallback answer 不再固定使用英文前缀
  - 当前会按 `answerPolicy.language` 和问题文本做最小 `en` / `zh` 分流，让 hitful local fallback 与 no-hit local fallback 的语言策略保持一致
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/llm.test.js`

- ✅ local no-hit fallback answer language alignment
  - 当没有可用模型 provider 且 retrieval 命中为空时，`LlmService` 本地 fallback answer 不再固定返回英文
  - 当前会按 `answerPolicy.language` 和问题文本做最小 `en` / `zh` 分流，和已有 insufficient-context backend fallback 语言策略保持一致
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/llm.test.js`

- ✅ plain-text citation-marker dedup in answering fallback path
  - 当模型没有返回 structured citations、backend 退回到解析答案内联 marker（如 `[1][1][2]`）时，当前会按首次出现顺序去重同一 source
  - 这样最终 citation 列表和 `answeringMetadata.citationCount` 不再因为重复 marker 被虚增
  - 当前改动只收在 answering backend fallback normalization，不改 API shape
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ retrieval execution metadata actual-path exposure
  - `ask` / trace retrieval metadata `execution` 现在除了 query、threshold 和 chunk counts 之外，也会显式暴露：
      - `actualMode`: `vector` / `hybrid` / `lexical`
      - `usedFallback`: 当前结果是否是从请求的向量路径回退得到
      - `fallbackReason`: 当前 lexical fallback 是由向量错误触发，还是因为没有留下可排序候选
      - `rerankApplied`: 当前结果是否按 rerank 路径完成最终排序
      - `chunkWindowApplied`: 当前结果是否实际走过 chunk-window 扩展
      - `vectorCandidateLimitHit` / `lexicalCandidateLimitHit`: 当前向量/词法候选是否打满了 candidate budget
      - `rankingTopKHit`: 当前 ranking 结果是否打满了最终 `topK` 上限
      - `candidateLimit`: 当前 candidate-selection 策略最终解析出的候选预算
      - `vectorCandidateCount` / `lexicalCandidateCount`: merge 之前各自拿到了多少候选
      - `mergedCandidateCount`: hybrid merge 或 lexical fallback 之后还保留了多少候选
    - `rankedCandidateCount`: threshold + ranking 之后、chunk-window 扩展之前剩余多少候选
    - `neighborChunkCount`: 最终返回 chunk 里，有多少是 chunk-window 扩展出来的邻接块，而不是 direct primary hit
  - 这样当前 retrieval metadata 不再只表达“想要的策略”，也能表达“最终实际走到的检索路径”
  - 当前改动保持 API 向后兼容，只是在既有 `retrievalMetadata.execution` 里增加字段
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/retrieval.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ retrieval rewrite-source and search-attempt diagnostics
  - `retrievalMetadata.queryRewrite` 现在也会显式返回 `finalQuerySource`，当前值收口为 `rewritten` / `original_disabled` / `original_unchanged`
  - `retrievalMetadata.execution` 现在也会显式返回 `vectorSearchAttempted` / `lexicalSearchAttempted`
  - 这样上层不再需要从最终 query、strategy mode 和 fallback 状态自己反推“原问题为什么被保留”以及“这一轮实际尝试过哪些检索路径”
  - one-shot ask、native stream final payload、以及 trace persistence 里的 retrieval metadata 语义现已对齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/retrieval.test.js apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ structured missing-information normalization dedup
  - LLM structured-answer schema 现在会对 `missingInformation` 做和 `citations` / `citationEvidence` 一致的收口：trim、去空、按首次出现顺序去重
  - 这避免模型输出重复 gap item 时把同一缺失原因在最终响应里重复展开
  - 当前变更只在 backend structured-answer normalization 层收口，不改 API shape
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/llm.test.js`

- ✅ answering missing-information normalization for insufficient-context
  - `includeMissingInformation=false` 当前只对 grounded 回答继续生效，不再把 `insufficient_context` 场景的缺失原因一并清空
  - 当最终回答是 `insufficient_context` 时，backend 现在会优先保留模型返回的 `missingInformation`
  - 如果模型没有提供缺失原因，backend 会补一个稳定默认值：`No relevant supporting sources were retrieved.`
  - 这样当前响应里的 `missingInformation`、`qualityEvaluation.flags` 与 `answerStatus=insufficient_context` 语义保持一致
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ retrieval no-hit fallback tightening
  - retrieval 在 vector 不可用时仍会回退 lexical scoring，但当前不会再在“所有候选都低于阈值”时额外塞入 knowledge base 的前几个任意 chunk
  - backend 现在会在这种 no-hit 情况下直接返回空 retrieval result，让 answering 走既有 `insufficient_context` 语义，而不是基于无关 chunk 做低质量 best-effort 猜测
  - 这一轮保持在 retrieval backend 内部收口，没有改 API shape、前端承载或 retrieval profile 配置结构
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/retrieval.test.js`

- ✅ answering no-answer policy backend enforcement
  - `answerPolicyJson.noAnswerBehavior` 不再只是 prompt-level 软约束，当前 backend 已在 `AnsweringService` 收口成确定性语义
  - 当最终 `answerStatus=insufficient_context` 且策略为 `say_insufficient_context` 时，backend 会用统一兜底文案替换模型自由文本，避免不足上下文时把猜测性回答直接透出
  - 当前兜底文案已支持最小语言分流：
    - `language=en` -> 英文固定回复
    - `language=zh` -> 中文固定回复
    - `language=auto` / `same_as_question` -> 按问题文本做最小中英文检测
  - 当策略为 `best_effort` 时，backend 继续保留模型返回的原始回答文本，仅通过现有 `answerStatus` / `missingInformation` / `qualityEvaluation` 表达不确定性
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ external knowledge source expansion backend / API consistency closeout
  - current scoped source family:
    - `web page`
    - `feed`
    - `sitemap`
    - `sitemap index`
  - this closeout round stayed strictly inside backend / API validation and did not reopen:
    - UI refactor
    - mobile work
    - source center / connector platformization
  - newly locked focused gaps in this round:
    - unsupported `web page` failure now has explicit same-URL recovery coverage
    - all-invalid `feed` failure now has explicit same-URL recovery coverage
    - all-unsupported `sitemap` failure now has both direct-failure and same-URL recovery coverage
    - run-summary selection now explicitly prefers a newer partial-ready run over the same document's older terminal failure
    - repeated `feed` / `sitemap` sync unit tests now explicitly assert normalized `EXTERNAL_SOURCE_PARTIAL_SUCCESS` diagnostics with the new reserved version
  - focused validation rerun during this round:
    - `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`
    - `node --test --test-concurrency=1 apps/api/test/feed-source-e2e.test.js`
    - `node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js`
    - `node --test apps/api/test/document-runs-summary.test.js`
    - `node --test apps/api/test/external-source-sync.test.js`
  - full API regression rerun after closeout:
    - `pnpm test:api`
  - current result:
    - `116 / 116` API tests passed
    - the current external knowledge source expansion round can now be treated as backend / API complete within the present scope

### 2026-03-22

- ✅ external source reindex / resync chunk-count consistency follow-up
  - when an existing `web page` / `feed` / `sitemap` document is reused for a new `external_resync` version, the document now clears `chunkCount` immediately on the pending transition instead of temporarily exposing the previous ready-version count
  - this keeps document-level reindex state consistent with the existing upload-document `reindex` path without adding new API fields or opening a new source-management surface
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/external-source-sync.test.js`
    - `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`

- ✅ external source reindex invalid-config failure normalization
  - when a persisted external source document no longer has a valid `sourceConfigJson`, `POST /documents/:id/reindex` no longer fails before run creation
  - the backend now queues a new `external_resync` version first, then records a structured non-retryable failure on both the document and run using the existing diagnostics path
  - this keeps document/run history consistent for corrupted or legacy external-source records without adding new API fields or expanding source-platform scope
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/external-source-sync.test.js`

- ✅ document-run summary latest-anchor ordering normalization
  - `latestFailure`, `latestRetryableFailure`, and `latestSkipped` are now selected by the latest matching completed run timestamp instead of the latest started run order
  - this closes an overlap edge case where a later-started but earlier-finished run could incorrectly replace the actual latest completed failure/skip anchor in summary
  - the change stays inside `DocumentRunsService` summary selection logic and does not alter list ordering, counters, or API shape
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/document-runs-summary.test.js`
    - `node --test --test-concurrency=1 apps/api/test/feed-source-e2e.test.js`

- ✅ document-run list ordering alignment
  - `GET /documents/:id/runs` now uses the same primary ordering contract as `GET /knowledge-bases/:id/document-runs`: newest `startedAt` first, then higher `version` only as a tie-breaker
  - this removes a small inconsistency where document-level run history previously prioritized `version` ahead of actual run recency
  - the change stays inside `DocumentRunsService` query ordering and does not alter payload shape, filtering, or summary semantics
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/document-runs-summary.test.js`
    - `node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js`

- ✅ external source title preservation on title-less resync
  - when a repeated external-source `reindex` does not return a new source-level title, the backend now keeps the current document `title` instead of replacing it with the normalized URL fallback
  - this is especially relevant for `sitemap` sources, whose re-sync path may not have a source title to refresh from
  - the change stays inside `DocumentsService` title fallback logic and does not add new fields or expand API shape
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/external-source-sync.test.js`
    - `node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js`

- ✅ run-summary recovery semantics for external sources
  - when the same external-source document first fails and then later finishes a clean resync, `GET /knowledge-bases/:id/document-runs/summary` no longer keeps counting or anchoring that older failure for the recovered document
  - `GET /knowledge-bases/:id/documents`, `GET /documents/:id`, and `GET /documents/:id/runs` remain unchanged, so history is still available while the aggregate summary now aligns with the recovered current state
  - the change stays inside `DocumentRunsService` summary selection logic and does not add fields or alter run list/detail payloads
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/document-runs-summary.test.js`
    - `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`

- ✅ latest-skipped summary anchor preservation
  - summary recovery cleanup now applies only to failure-style anchors and counters; `latestSkipped` still reports the most recent skipped run event from matching history even if the same document later completes successfully
  - this keeps skipped-run observability aligned with run-history semantics while preserving the new recovered-failure cleanup behavior
  - focused validation rerun:
    - `node --test apps/api/test/document-runs-summary.test.js`

- ✅ external source title preservation on repeated same-URL reuse
  - when posting the same `web page` / `feed` / `sitemap` URL again and the backend reuses the existing document record, the existing document `title` is now preserved whenever the refreshed source still does not provide a new source-level title
  - this keeps same-URL create/reuse behavior aligned with the new title-less `reindex` / `external_resync` semantics and avoids replacing curated titles with normalized URL fallbacks during pending-state reuse
  - the change stays inside `DocumentsService` reserve/finalize title fallback logic and does not add new fields or expand API shape
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/external-source-sync.test.js`
    - `node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js`

- ✅ PC Web source run observability consumption minimum increment
  - current implementation stays inside the existing `Knowledge Base` and `Document Detail` pages instead of opening a new source center or a broader UI refactor
  - `Knowledge Base` now minimally consumes:
    - `GET /knowledge-bases/:id/document-runs`
    - `GET /knowledge-bases/:id/document-runs/summary`
  - it currently surfaces:
    - recent source/document runs
    - a compact recent-run summary
    - latest failure context
  - `Document Detail` now minimally consumes:
    - `GET /documents/:id/runs`
  - it currently surfaces:
    - document-level run history
    - status / trigger / startedAt / finishedAt / failedStage
    - latest failure message and minimal diagnostics expansion
  - this increment deliberately avoids:
    - new backend fields
    - a new mobile path
    - broader UI restructuring
    - platform-style source center abstraction
  - shared web path additions for this round:
    - typed run observability API models
    - shared run observability hooks
    - shared run list / diagnostics helper component
  - focused validation rerun:
    - `node --experimental-strip-types --test apps/web/test/document-run-observability.test.js`
    - `node --test apps/web/test/ui-review-regressions.test.js`
    - `pnpm --filter @rag-system/web typecheck`
    - `pnpm --filter @rag-system/web build`

- ✅ PC Web source run observability actionability follow-up
  - `Knowledge Base` recent runs now add a minimal status filter with the existing list endpoint instead of introducing a new source console
  - latest failure context now deep-links directly to the related document detail page
  - recent run cards now also deep-link to the corresponding document when a document summary is present
  - failed / skipped recent runs now expose a one-item `Reindex` action that reuses the existing `POST /documents/:id/reindex` path
  - this follow-up remains inside the current web consumer layer and does not add new backend fields, batch controls, or broader platform workflows
  - focused validation rerun:
    - `node --experimental-strip-types --test apps/web/test/document-run-observability.test.js`
    - `node --test apps/web/test/ui-review-regressions.test.js`
    - `pnpm --filter @rag-system/web typecheck`
    - `pnpm --filter @rag-system/web build`

- ✅ feed source stabilization phase 2 minimum increment
  - feed extraction now tolerates bounded partial invalid-entry failures instead of always including every selected entry verbatim
  - success rule for this round:
    - at least one selected entry is usable -> generated text artifact is still produced and ingestion continues
    - all selected entries are invalid -> source remains failed at `source_fetch`
  - current invalid-entry rule is intentionally minimal:
    - entry missing both `summary` and `link` is skipped as invalid
  - partial success now persists structured diagnostics in the existing shared external-source path instead of opening a feed-specific platform branch
  - current feed partial diagnostics payload includes:
    - `attemptedEntryCount`
    - `succeededEntryCount`
    - `failedEntryCount`
    - capped `failedEntryRefs`
    - capped `failedEntries` reason summaries (`ref` + `code` + `message` + `retryable`)
    - truncation metadata:
      - `failedEntriesTruncated`
      - `failedEntriesOmittedCount`
    - `partial: true`
  - document `diagnosticsJson` and final ready run diagnostics now preserve the same feed partial context through ingestion completion
  - this increment stayed inside `FeedSourceService` plus the existing shared `DocumentsService` / `IngestionService` persistence path and did not expand into broader source platformization
  - focused validation rerun:
    - `apps/api/node_modules/.bin/tsc.CMD -p apps/api/tsconfig.json`
    - `node --test apps/api/test/parsing.test.js apps/api/test/feed-source-e2e.test.js`
    - `node --test apps/api/test/sitemap-source-e2e.test.js apps/api/test/external-source-sync.test.js apps/api/test/ingestion.orchestrator.test.js`

- ✅ sitemap / sitemap-index source stabilization phase 2 minimum increment
  - sitemap page aggregation no longer fails the whole source on the first single page fetch error
  - current behavior now tolerates bounded partial page failures for both direct sitemap `urlset` and one-level `sitemapindex`
  - success rule for this round:
    - at least one page fetch succeeds -> generated text artifact is still produced and ingestion continues
    - all page fetches fail -> source remains failed at `source_fetch`
    - for `sitemapindex`, at least one child sitemap fetch succeeds -> expansion can still continue
    - for `sitemapindex`, all child sitemap fetches fail -> source remains failed at `source_fetch`
  - partial success now persists structured diagnostics in the existing shared paths instead of opening a new source platform abstraction
  - current partial diagnostics payload includes:
    - `attemptedPageCount`
    - `succeededPageCount`
    - `failedPageCount`
    - capped `failedPageUrls`
    - capped `failedPages` reason summaries (`url` + `code` + `message` + `retryable`)
    - truncation metadata for page summaries:
      - `failedPagesTruncated`
      - `failedPagesOmittedCount`
    - `partial: true`
    - and for partial child sitemap expansion:
      - `attemptedChildSitemapCount`
      - `succeededChildSitemapCount`
      - `failedChildSitemapCount`
      - capped `failedChildSitemapUrls`
      - capped `failedChildSitemaps` reason summaries (`url` + `code` + `message` + `retryable`)
      - truncation metadata for child sitemap summaries:
        - `failedChildSitemapsTruncated`
        - `failedChildSitemapsOmittedCount`
  - document `diagnosticsJson` now preserves this partial source-fetch context through ingestion completion, so `GET /documents/:id` can still expose it after the document reaches `ready`
  - document run history now also preserves the same partial diagnostics on the final `ready` run, so `GET /documents/:id/runs` and `GET /knowledge-bases/:id/document-runs?includeDiagnostics=true` can surface it without adding new list/summary fields
  - this increment stayed inside the existing shared `SitemapSourceService` + `DocumentsService` + `IngestionService` path and did not expand into connector/source platformization
  - focused validation rerun:
    - `apps/api/node_modules/.bin/tsc.CMD -p apps/api/tsconfig.json`
    - `docker compose up -d`
    - `node --test apps/api/test/parsing.test.js apps/api/test/sitemap-source-e2e.test.js`
    - `node --test apps/api/test/external-source-sync.test.js apps/api/test/ingestion.orchestrator.test.js`

- ✅ document ingestion / external source run-level persistence 第一轮
  - 新增 `DocumentRun` 持久化模型，用于记录每次 `upload` / `reindex` / `external_resync`
  - 当前每条 run 至少记录：
    - `documentId`
    - `version`
    - `trigger`
    - `status`
    - `failedStage`
    - `diagnosticsJson`
    - `startedAt`
    - `finishedAt`
  - `GET /documents/:id/runs` 已可读取某个 document 的 run history，按最新 `version` 优先返回
  - external source create / repeat-run / reindex 现在都会先建立对应 run，再进入 remote fetch 或 ingestion
  - source fetch 失败不再只停留在 document failure；对应 run 也会落为 `failed` 并保留 `source_fetch` diagnostics
  - ingestion worker 进入 `processing` 后会同步更新 run 状态；成功会落为 `ready`
  - stale ingestion guard 现在不只跳过旧 job，也会把被新版本覆盖的旧 run 明确标成 `skipped`
  - 这次改动继续收口在 `DocumentsService` + `IngestionService` 的共享路径，没有扩成更大的 source / connector 平台重构
  - 新增/补强的 focused 测试：
    - `apps/api/test/document-chain-e2e.test.js`
    - `apps/api/test/external-source-sync.test.js`
    - `apps/api/test/ingestion.orchestrator.test.js`
  - focused validation rerun:
    - `pnpm --filter @rag-system/api exec prisma generate`
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/external-source-sync.test.js apps/api/test/ingestion.orchestrator.test.js`
    - `pnpm --filter @rag-system/api exec prisma migrate deploy`
    - `node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js`
    - `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`

- ✅ knowledge-base scoped document run observability 第一轮
  - 新增 `GET /knowledge-bases/:id/document-runs`，用于直接查看某个 knowledge base 最近的 document / source 执行历史
  - 当前返回 run 基本字段外，还会附带一个最小 `document` 摘要，便于在不额外查 document 列表的情况下定位来源和当前状态
  - 当前已支持最小查询过滤：
    - `documentId`
    - `sourceType`
    - `status`
    - `trigger`
    - `sinceHours`
    - `includeDiagnostics`
    - `limit`
  - `document-runs` list 当前默认不返回 `diagnosticsJson`，仅在 `includeDiagnostics=true` 时带回完整诊断 JSON，以降低列表载荷
  - 这个接口当前优先服务 backend/API 级诊断与后续 UI 承载，但本轮没有继续开启新的 UI 重构
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js apps/api/test/web-page-source-e2e.test.js`

- ✅ knowledge-base scoped document run summary 第一轮
  - 新增 `GET /knowledge-bases/:id/document-runs/summary`
  - 当前 summary 聚合输出：
    - `totalRuns`
    - `latestRunAt`
    - `latestFinishedAt`
    - `byStatus`
    - `byTrigger`
    - `bySourceType`
    - `retryableFailures`
    - `nonRetryableFailures`
    - `failureByStage`
    - `latestRetryableFailure`
    - `latestSkipped`
    - `latestFailure`
  - `document-runs` list 现在默认也会给出轻量 `failureSummary`，不必强制打开 `includeDiagnostics=true` 才能消费最小失败上下文
  - `latestRetryableFailure` / `latestSkipped` / `latestFailure` 现在复用同一套 `failureSummary` 归一形状：
    - `code`
    - `failedStage`
    - `retryable`
    - `message`
  - `document-runs` list 和 `document-runs/summary` 现在都支持 `sinceHours`，便于聚焦最近一段时间的运行情况
  - 目标是先为后续 diagnostics 承载和潜在 UI 概览提供轻量后端聚合面，而不是继续扩 source platform 抽象
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js apps/api/test/web-page-source-e2e.test.js`

### 2026-03-22

- ✅ document run failure summary consistency minimum increment
  - 当前收口范围保持在 backend / API first，没有开启新一轮 UI 扩展，也没有引入新的 source platform 抽象
  - `GET /knowledge-bases/:id/document-runs` 现在默认返回轻量 `failureSummary`，用于 failed / skipped / partial-ready run 的最小失败上下文消费
  - `GET /documents/:id/runs` 也同步暴露同一 `failureSummary` 归一结果，避免 document-detail 与 knowledge-base recent-runs 走两套提取规则
  - `GET /knowledge-bases/:id/document-runs/summary` 的 `latestFailure` / `latestRetryableFailure` / `latestSkipped` 现在复用同一 failure summary builder，而不是各自单独抽 message
  - 对 partial-ready run，顶层 `failedStage` 现在也统一回落到 `failureSummary.failedStage`，避免 API 消费端看到 `failedStage: null` 与 summary diagnostics 同时存在的双重语义
  - summary failure stats 现在也会把 `ready + partial failureSummary` 的 run 纳入统计，而不是只看 terminal `failed`
  - `latestFailure` 现在语义上表示“最近一个 counted failure summary run”，因此可以正确指向更近的 partial-ready external source run
  - `latestSkipped` 仍保持独立语义，不混入 failure counters
  - 后续又补了一个 processing-state 语义修正：
    - `pending` / `processing` run 即使暂时携带 preserved partial diagnostics，也不会计入 summary failure counters
    - 此类 in-flight run 的顶层 `failedStage` 继续保持 `null`
  - 这一轮保持最小字段增量：
    - 不改既有路由
    - 不改既有过滤参数
    - 不把完整 `diagnosticsJson` 改成默认大 payload
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/document-runs-summary.test.js`
    - `node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js`
    - `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`
    - `node --test --test-concurrency=1 apps/api/test/feed-source-e2e.test.js`

- ✅ external source repeat-run dedup / re-sync 第一轮
  - `web page` / `feed` / `sitemap` 入口现在会先对 remote URL 做归一化（去掉 hash，并使用标准化 URL 字符串）
  - 同一 `knowledge base + sourceType + normalized URL` 再次 ingestion 时，不再创建重复 `Document`
  - 当前改为复用原有 document 记录，更新生成的 source artifact，重置状态并递增 `version` 后重新进入 ingestion
  - 这次改动优先收口在 `DocumentsService` 的 external source 共用边界，避免只对单一 source 类型打补丁
  - ingestion queue 现在会携带期望的 document `version`；当旧 job 落后于当前 document version 时，worker 会在解析前直接跳过，避免旧运行覆盖新一轮 `reindex` / `re-sync`
  - document 失败态现在会额外持久化结构化 `diagnosticsJson`，当前包含：
    - `code`
    - `failedStage`
    - `retryable`
    - `documentVersion`
    - `message`
  - ingestion worker 现在会真实经过 `parsing -> chunking -> indexing -> completed`，失败时会把失败边界落到 `diagnosticsJson.failedStage`
  - external source 抓取边界现在增加共享 HTTP retry guard；当上游首次返回 `429` 或 `5xx` 时，会自动再试一次，再决定是否失败
  - external source 创建现在会先保留一个 document 记录；如果远端 source fetch 自身失败，document 也会落为 `failed` 并保留 source-fetch diagnostics，而不是这次失败完全无记录
  - document 现在会持久化 `sourceConfigJson`；对 `web_page` / `feed` / `sitemap` 执行 `reindex` 时，后端会按原始 source config 重新抓取远端内容，再进入 ingestion，而不再只是重跑旧的 generated artifact
  - 新增共用回归测试：
    - `apps/api/test/external-source-sync.test.js`
    - `apps/api/test/fetch-with-retry.test.js`
  - 新增 focused HTTP E2E：
    - `apps/api/test/web-page-source-e2e.test.js`
    - `apps/api/test/document-chain-e2e.test.js`
    - `apps/api/test/ingestion.orchestrator.test.js`
    - `apps/api/test/feed-source-e2e.test.js`
    - `apps/api/test/sitemap-source-e2e.test.js`
  - focused validation rerun:
    - `pnpm --filter @rag-system/api exec prisma migrate deploy`
    - `pnpm --filter @rag-system/api exec prisma generate`
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/external-source-sync.test.js`
    - `node --test apps/api/test/fetch-with-retry.test.js`
    - `node --test apps/api/test/ingestion.orchestrator.test.js`
    - `node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js`
    - `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`

- ✅ external source fetch retryability diagnostics correction
  - external source `source_fetch` diagnostics no longer overstate retryability
  - current behavior now distinguishes:
    - upstream / transient fetch failures -> `retryable: true`
    - invalid payload / unsupported content-type style failures -> `retryable: false`
  - this keeps source run summary and failure diagnostics aligned with the real execution boundary instead of treating all source-fetch errors as retryable
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/external-source-sync.test.js`
    - `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`

- ✅ UI 审查问题第一轮收口
  - 基于 `ui/审查报告.md` 对当前 `PC Web` 做第一轮 focused cleanup
  - `AppShell` 顶栏中的搜索 / 通知 / 当前知识库展示降级为非误导性的展示控件，减少假交互
  - `Chat` 去掉右栏伪 tab，补充输入区真实说明，并把附件入口明确降级为 `coming soon`
  - `Knowledge Base` 改为更紧凑的指标网格，避免右侧长指标列导致主区空洞
  - `Assistant` 清理开发态说明文案，继续保持现有表单字段和提交逻辑不变
  - `Trace Detail` 将 `raw payload` 降级为折叠式次级诊断区
  - `index.html` 补充 favicon，消除本地巡检时的 404 噪音
  - 新增 focused source-level 回归测试：
    - `apps/web/test/ui-review-regressions.test.js`
  - focused validation rerun:
    - `node --test apps/web/test/ui-review-regressions.test.js`
    - `node --experimental-strip-types --test apps/web/test/chat-layout-source.test.js`
    - `node --test apps/web/test/desktop-shell-consistency.test.js`
    - `node --experimental-strip-types --test apps/web/test/knowledge-base-page-helpers.test.js`
    - `node --experimental-strip-types --test apps/web/test/assistant-config.test.js`
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题 Documents / Knowledge Base / Assistant / Trace 第四轮骨架收口
  - `Documents` hero 改成更接近参考稿的左右分区式工作台头部，loading/empty panel 密度继续压缩
  - `Document Detail` 改成更稳定的工作台双栏骨架，左侧状态区 sticky，chunk focus banner 和列表间距继续统一
  - `Knowledge Base` 和 `Assistant` 都改为更一致的 hero + 主副栏布局，输入控件 hover/focus 继续收口到统一 B 主题语言
  - `Trace List` / `Trace Detail` 的 hero、列表卡片、metadata 和 empty/loading 状态继续向 `ui/version-b-creative.html` 收口
  - 仅调整前端 UI 结构和样式，不改接口、字段、路由和现有功能逻辑
  - 本轮新增 Playwright 截图留档：
    - `output/playwright/ui-audit-pass-6/`
  - focused validation rerun:
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题主副栏比例 + 本地巡检兼容继续收口
  - `Knowledge Base` / `Assistant` 主工作区改回更合理的宽主栏 + 窄侧栏比例，避免关键内容被压窄
  - `Trace List` 在仅一条会话记录时改为单列铺满，避免左窄右空的骨架浪费
  - 前端 API base url 增加本地 hostname 归一逻辑，便于本地巡检时在 `localhost` / `127.0.0.1` 之间切换
  - 新增基于 Playwright 路由拦截的真实数据快照巡检，便于继续比对 detail 页实际信息密度
  - 本轮新增 Playwright 截图留档：
    - `output/playwright/ui-audit-pass-7d/`
    - `output/playwright/ui-audit-pass-8/`
  - focused validation rerun:
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题前端巡检稳定性补丁
  - 修复 `apps/web/index.html` 首屏主题脚本在 `body` 尚未可用时访问 `style` 导致的浏览器运行时异常
  - `Trace List` 单条记录时继续收紧最大宽度，避免单卡片模式下占满整行后过于松散
  - 本轮新增 Playwright 截图留档：
    - `output/playwright/ui-audit-pass-8b/`
  - focused validation rerun:
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题 Documents + Trace 第三轮细节收口
  - `Documents` hero 改为更接近 `ui/version-b-creative.html` 的深色发光工作台头部
  - `Documents` 表格外层、badge、行 hover、storage 文本截断和操作区层级继续收口
  - `Document Detail` 左侧状态面板改为更稳定的 metadata list，chunk 卡片改为更清晰的内容块 + focused 态
  - `Trace List` 改为更适合工作台的双列卡片流，保留原有 conversation -> latest trace 聚合逻辑
  - `Trace Detail` 的 hero、metadata、retrieved chunks、citations、raw payload 面板继续统一到 B 主题 surface
  - 保持现有接口、数据字段、路由和列表 -> 详情流转不变
  - focused validation rerun:
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题壳层偏移 + Chat 骨架第三轮收口
  - 修复 `AppShell.Main` 未正确避开 header / sidebar 的壳层偏移问题，主内容不再钻到壳层下方
  - `Chat` 主区从 Mantine `Grid` 改为显式 CSS grid，稳定为更接近参考稿的三栏工作台骨架
  - 收紧聊天页 hero、会话栏、主工作区、引用栏、输入区的宽度关系与面板高度
  - 补充聊天布局和通用空状态的 source-level 回归测试，避免后续再次偏离参考稿或回到浅色空状态
  - 使用 Playwright 对 `Chat` 以及其他核心路由重新截图复查
  - focused validation rerun:
    - `node --test apps/web/test/chat-layout-source.test.js apps/web/test/state-panel-theme.test.js`
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题 Chat 收尾第二轮
  - `AppShell` 左侧品牌区与导航项的内边距、字号、hover 强度继续向 `ui/version-b-creative.html` 收口
  - `Chat` 页消息气泡、底部输入栏、右侧引用栏的圆角、边框、层级与 spacing 继续向 B 主题 token 收口
  - 保持既有 API、流式逻辑、数据结构与 badge 数据来源不变
  - focused validation rerun:
    - `pnpm --filter @rag-system/web build`

- ✅ Trace 路由恢复为列表 -> 详情
  - `Trace 日志` 左侧导航不再落到 404
  - Web 端新增 `/traces` 列表页，复用现有 conversations + conversation traces 接口做前端聚合
  - `/traces/:traceId` 继续保留详情页
  - focused validation rerun:
    - `node --test apps/web/test/trace-router.test.js`
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题工作台跨页面第二轮统一
  - `Documents` / `Document Detail` / `Knowledge Base` / `Assistant` / `Trace` 页面头部 hero 与 panel surface 继续向 `ui/version-b-creative.html` 收口
  - 统一深色表面层级、hover、focus 高亮与工作台质感
  - 通过 Playwright 对主要页面路由做浏览器巡检与截图留档
  - focused validation rerun:
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题 Knowledge Base + Assistant 第一阶段迁移
  - `Knowledge Base` 已切到 B 风格工作台概览布局
  - `Assistant` 已切到 B 风格分区式配置工作台
  - 保持原有查询、表单、payload、提交逻辑不变
  - 新增 `Knowledge Base` workspace summary helper 测试
  - 补充共享 workspace panel / metric / input hover 样式
  - focused validation rerun:
    - `node --experimental-strip-types --test apps/web/test/knowledge-base-page-helpers.test.js`
    - `node --experimental-strip-types --test apps/web/test/assistant-config.test.js`
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题 Chat + AppShell 第一阶段落地
  - `AppShell` 已切到 B 风格工作台壳层
  - `Chat` 已切到 B 风格深色工作区主方向
  - 已新增本地可切换主题基础：
    - `themeColor`: `creative-dark` / `constrained-light`
    - `themeLayout`: `workspace-app` / `default-app`
  - 当前默认主题：
    - `creative-dark + workspace-app`
  - 当前只改：
    - `AppShell`
    - `Chat`
    - 主题令牌与切换基础
  - 当前未改：
    - `Documents`
    - `Knowledge Base`
    - `Assistant`
  - focused validation rerun:
    - `node --experimental-strip-types --test apps/web/test/theme-preferences.test.js`
    - `node --experimental-strip-types --test apps/web/test/chat-stream-state.test.js`
    - `node --experimental-strip-types --test apps/web/test/chat-page-helpers.test.js`
    - `pnpm --filter @rag-system/web build`

- ✅ Chat page visual refinement follow-up
  - keep the light teal constrained direction as the primary visual language
  - absorb only local chat-workspace strengths from the more creative concept
  - reduce the top chat hero weight
  - strengthen the conversation rail active state and scan efficiency
  - make the transcript workspace more dominant
  - tighten citation inspector information density
  - keep streaming behavior and API contract unchanged
  - focused validation rerun:
    - `node --experimental-strip-types --test apps/web/test/chat-stream-state.test.js`
    - `node --experimental-strip-types --test apps/web/test/chat-page-helpers.test.js`
    - `pnpm --filter @rag-system/web build`

### 2026-03-21

- ✅ 主链路测试补强
- ✅ DOCX 支持
- ✅ Answering 结构化与 assistant 配置增强
- ✅ metadata filter 更完整的策略化能力
- ✅ chunk window 扩展后的更强拼接 / 组织策略
- ✅ retrieval 策略配置与演进能力
- ✅ 更系统的 prompt 管理
- ✅ 输出结构约束
- ✅ trace / detail / document 跳转与诊断增强
- ✅ web i18n（`zh` / `en`）
- ✅ Knowledge Base 页面运营概览增强
- ✅ ask 失败诊断增强
- ✅ RetrievalProfile metadata filter
- ✅ 引用片段与答案的严格结构化对齐
- ✅ 回答质量评估
- ✅ 更完整的 assistant / answer policy 配置能力
- ✅ 更完整的 assistant / config 管理
- ✅ API integration test queue isolation
- ✅ PC Web Knowledge Base -> Assistant browser smoke automation
- ✅ PC Web Chat progressive streamed experience polish
- ✅ Ask stream native answer-generation upgrade
- ✅ Chat conversation rail / citation context polish
- ✅ Chat high-fidelity visual refinement
- ✅ Document chain API E2E
- ✅ Ask chain API E2E
- ✅ Ask stream API E2E
- ✅ Web page source ingestion API E2E
- ✅ External feed source ingestion API E2E
- ✅ Sitemap source ingestion API E2E
- ✅ Sitemap index source ingestion API E2E
- ✅ retrieval / answering execution metadata

关键文件：

- [apps/api/src/modules/assistants/ask-assistant.service.ts](../apps/api/src/modules/assistants/ask-assistant.service.ts)
- [apps/api/src/modules/answering/answering.service.ts](../apps/api/src/modules/answering/answering.service.ts)
- [apps/api/src/modules/retrieval/retrieval.service.ts](../apps/api/src/modules/retrieval/retrieval.service.ts)
- [apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts](../apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts)
- [apps/api/src/modules/traces/traces.service.ts](../apps/api/src/modules/traces/traces.service.ts)
- [apps/api/src/infra/llm/prompt-manager.service.ts](../apps/api/src/infra/llm/prompt-manager.service.ts)
- [apps/api/src/infra/llm/llm.types.ts](../apps/api/src/infra/llm/llm.types.ts)
- [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma)
- [apps/api/prisma/migrations/20260321193000_add_answer_trace_execution_metadata/migration.sql](../apps/api/prisma/migrations/20260321193000_add_answer_trace_execution_metadata/migration.sql)
- [apps/api/test/document-chain-e2e.test.js](../apps/api/test/document-chain-e2e.test.js)
- [apps/api/test/ask-chain-e2e.test.js](../apps/api/test/ask-chain-e2e.test.js)
- [apps/api/test/web-page-source-e2e.test.js](../apps/api/test/web-page-source-e2e.test.js)
- [apps/api/test/feed-source-e2e.test.js](../apps/api/test/feed-source-e2e.test.js)
- [apps/api/test/sitemap-source-e2e.test.js](../apps/api/test/sitemap-source-e2e.test.js)
- [apps/api/test/ask-success.test.js](../apps/api/test/ask-success.test.js)
- [apps/api/test/answering.test.js](../apps/api/test/answering.test.js)
- [apps/web/src/pages/assistant/AssistantPage.tsx](../apps/web/src/pages/assistant/AssistantPage.tsx)
- [apps/web/src/pages/chat/ChatPage.tsx](../apps/web/src/pages/chat/ChatPage.tsx)
- [apps/web/src/pages/chat/chat-page-helpers.ts](../apps/web/src/pages/chat/chat-page-helpers.ts)
- [apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx](../apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx)
- [apps/web/test/chat-page-helpers.test.js](../apps/web/test/chat-page-helpers.test.js)
- [docs/superpowers/specs/2026-03-21-web-page-source-ingestion-design.md](superpowers/specs/2026-03-21-web-page-source-ingestion-design.md)
- [docs/superpowers/plans/2026-03-21-web-page-source-ingestion-plan.md](superpowers/plans/2026-03-21-web-page-source-ingestion-plan.md)
- [docs/superpowers/specs/2026-03-21-external-feed-source-ingestion-design.md](superpowers/specs/2026-03-21-external-feed-source-ingestion-design.md)
- [docs/superpowers/plans/2026-03-21-external-feed-source-ingestion-plan.md](superpowers/plans/2026-03-21-external-feed-source-ingestion-plan.md)
- [docs/superpowers/specs/2026-03-21-sitemap-source-ingestion-design.md](superpowers/specs/2026-03-21-sitemap-source-ingestion-design.md)
- [docs/superpowers/plans/2026-03-21-sitemap-source-ingestion-plan.md](superpowers/plans/2026-03-21-sitemap-source-ingestion-plan.md)
- [docs/superpowers/specs/2026-03-21-external-knowledge-source-expansion-design.md](superpowers/specs/2026-03-21-external-knowledge-source-expansion-design.md)
- [docs/superpowers/plans/2026-03-21-external-knowledge-source-expansion-plan.md](superpowers/plans/2026-03-21-external-knowledge-source-expansion-plan.md)
- [docs/superpowers/specs/2026-03-21-pc-web-chat-experience-polish-design.md](superpowers/specs/2026-03-21-pc-web-chat-experience-polish-design.md)
- [docs/superpowers/plans/2026-03-21-pc-web-chat-experience-polish-plan.md](superpowers/plans/2026-03-21-pc-web-chat-experience-polish-plan.md)
- [docs/superpowers/specs/2026-03-21-retrieval-answering-execution-metadata-design.md](superpowers/specs/2026-03-21-retrieval-answering-execution-metadata-design.md)
- [docs/superpowers/plans/2026-03-21-retrieval-answering-execution-metadata-plan.md](superpowers/plans/2026-03-21-retrieval-answering-execution-metadata-plan.md)

---

## 10.1 Web B 主题迁移补充记录

- 已继续收口 `creative-dark + workspace-app` 的 B 主题工作台壳层，当前 `Chat / Documents / Document Detail / Knowledge Base / Assistant / Traces / Trace Detail / AppShell / StatePanel` 都已统一到同一套深色 panel 语言、hero 骨架和输入控件风格。
- 本轮重点清理了前端页面遗留的中文乱码文案，未改动接口、路由、字段和页面功能逻辑。
- 基于 [ui/审查报告.md](../ui/审查报告.md) 的剩余项已完成第二轮收口：
  - `Documents` 首屏补成工作台摘要区，新增紧凑指标网格和操作提示侧栏，弱化“空首屏”观感。
  - `Trace List` 改为先展示问题、结果状态和时间，再进入 trace 详情，降低过强的诊断台账感。
  - `Document Detail` 将存储键和错误信息明确下沉为次级诊断区，并统一详情页文案层级。
  - B 主题次级文字对比度进一步抬高，减少深色主题下的小字发灰问题。
- 继续完成下一轮高优先级 PC Web 收口：
  - `Chat` 增加顶部工作区摘要卡、输入区状态说明和更明确的引用摘要，主工作区完成度进一步提高。
  - `Documents` 表格把低价值的 `storage key` 首屏列替换为 `updated` 时间，提升高频扫描效率。
  - `Trace Detail` 增加 `Execution summary` 摘要层，先看结果、命中规模、引用数量和耗时，再进入评分与原始载荷。
  - `StatePanel + i18n` 统一了 loading / empty / error 的状态骨架与相关中文产品文案。
- 本轮新增/补齐的主要文件：
  - [apps/web/src/app/AppShell.tsx](../apps/web/src/app/AppShell.tsx)
  - [apps/web/src/pages/chat/ChatPage.tsx](../apps/web/src/pages/chat/ChatPage.tsx)
  - [apps/web/src/pages/documents/DocumentsPage.tsx](../apps/web/src/pages/documents/DocumentsPage.tsx)
  - [apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx](../apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx)
  - [apps/web/src/pages/assistant/AssistantPage.tsx](../apps/web/src/pages/assistant/AssistantPage.tsx)
  - [apps/web/src/pages/documents/DocumentDetailPage.tsx](../apps/web/src/pages/documents/DocumentDetailPage.tsx)
  - [apps/web/src/pages/traces/TraceListPage.tsx](../apps/web/src/pages/traces/TraceListPage.tsx)
  - [apps/web/src/pages/traces/TraceDetailPage.tsx](../apps/web/src/pages/traces/TraceDetailPage.tsx)
  - [apps/web/src/components/StatePanel.tsx](../apps/web/src/components/StatePanel.tsx)
  - [apps/web/src/i18n/messages.ts](../apps/web/src/i18n/messages.ts)
  - [apps/web/src/styles/global.css](../apps/web/src/styles/global.css)
  - [apps/web/test/ui-review-regressions.test.js](../apps/web/test/ui-review-regressions.test.js)
- 本轮 Playwright 巡检截图目录：
  - 历史本地输出目录：`output/playwright/ui-audit-pass-9`（当前仓库未保留该目录）
- 本轮最小验证：
  - `node --test apps/web/test/ui-review-regressions.test.js`
  - `pnpm --filter @rag-system/web build`

---

## 10. 最近一次已记录的验证快照

最近一次已记录通过的命令：

### API

- `pnpm test:api`
- `pnpm --filter @rag-system/api build`
- `node --test apps/api/test/retrieval.test.js apps/api/test/ask-success.test.js apps/api/test/answering.test.js`
- `node --test --test-concurrency=1 apps/api/test/api-flow.test.js`
- `node --test --test-concurrency=1 apps/api/test/retrieval-profile-filters.test.js`
- `node --test --test-concurrency=1 apps/api/test/retrieval-profile-strategy.test.js`
- `node --test apps/api/test/prompt-manager.test.js apps/api/test/llm.test.js`
- `node --test apps/api/test/ask-failures.test.js apps/api/test/http-exception-filter.test.js`
- `node --test --test-concurrency=1 apps/api/test/ask-chain-e2e.test.js`
- `node --test --test-concurrency=1 apps/api/test/ask-stream-e2e.test.js`
- `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`
- `node --test --test-concurrency=1 apps/api/test/feed-source-e2e.test.js`
- `node --test apps/api/test/parsing.test.js`
- `node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js`
- `pnpm test:api`

### Web

- `pnpm --filter @rag-system/web typecheck`
- `pnpm --filter @rag-system/web build`
- `node --experimental-strip-types --test apps/web/test/chat-stream-state.test.js`
- `node --experimental-strip-types --test apps/web/test/chat-page-helpers.test.js`
- `node --experimental-strip-types --test apps/web/test/assistant-config.test.js`
- `node --test apps/web/test/pc-web-smoke.test.js`

说明：

- 这里记录的是最近一次已落盘验证快照
- 不代表每次编辑本文档时都重新执行了这些命令
- 当前 ask stream 保留 `NDJSON` 传输，但 answer generation 阶段已经升级为 provider-native text streaming
- citations、trace ids、answering / retrieval metadata 仍然在最终 `final` 事件补齐，因此它仍不等同于“全结构化全链路原生实时流式”
- 截至 `2026-03-23`，`pnpm test:api` 已 fresh rerun through `116 / 116` passing tests，当前 external-source backend closeout 已纳入这一整套 API 回归基线

---

## 11. 关键文档入口

- [README.md](../README.md)
- [docs/current-dev-setup.md](current-dev-setup.md)
- [docs/local-dev-infra.md](local-dev-infra.md)
- [docs/phase-1-rag-blueprint.md](phase-1-rag-blueprint.md)
- [docs/retrieval-trace.md](retrieval-trace.md)
- [docs/web-i18n.md](web-i18n.md)

### 12. Ingestion reliability hardening（2026-03-27）

- ✅ BullMQ worker final-failure reconciliation now closes the last retry-exhausted ingestion gap
  - `IngestionService` 现在会在 worker `failed` 事件里只对“重试已耗尽”的 job 做兜底收口：如果当前文档版本仍是本次 job 对应版本，且文档还停留在 `pending` / `processing`，就补写 `failed` 文档态与 `document_run` 失败记录
  - 文档失败回写现在使用 version+status guard 的 `updateMany`，避免在极窄并发窗口里把已 supersede 的新版本误写回 `failed`
  - 失败阶段会从当前 `processingStage` 反推：`parsing` / `chunking` / `indexing`
  - 这一轮保持为最小 ingestion reliability 收口：不改队列拓扑、不改 ingest 主链路，只补 worker 最终失败时的状态一致性兜底
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/ingestion.service.test.js`
    - `pnpm test:api:focus:documents`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm test:api:file -- test/document-chain-e2e.test.js`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm test:api:integration`
  - 实测结果：
    - focused ingestion service tests 3/3 通过，可覆盖“重试耗尽后补写 failed”“重试未耗尽时不提前收口”以及“guard update 命中 0 行时不写 run failed”三条路径
    - focused document/ingestion 快速套件通过（`71 + 9` tests）
    - real document-chain E2E 在补齐 `DATABASE_URL` 后 2/2 通过
    - API integration suite 在补齐 `DATABASE_URL` 后 7/7 通过
