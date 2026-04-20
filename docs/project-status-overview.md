# Project Status Overview

> 文档角色：`current-status`
> 当前使用方式：日常问答 / 快速判断时优先看的项目总览入口。先看这一页，再决定是否下钻长文档。
> 更新时间：2026-04-20

## One-Line Status

RAG 主链路、PC Web chat、external source 第一轮、auth/ACL 最小闭环、当前这轮 P4 web 收口、P5 eval baseline 工程化能力都已落地；默认助手 / 默认知识库 / 默认 retrieval profile 的 bootstrap 与 repair 也已经就位，当前更像是进入稳定维护和默认主路径收口期，而不是继续补基础能力。

## Completed

- 本地优先 RAG MVP 主链路已完成
- ask / stream 的渐进式聊天体验已完成
- PC Web chat 的主要交互和承载已完成
- external knowledge source 第一轮最小增量已完成
  - web page
  - feed
  - sitemap
  - sitemap index
- P0 read-model / metadata convergence 已完成
- P1 鉴权 / 用户登录最小闭环已完成
- P2 owner-only ACL baseline 已完成
- P3 external-source guardrails 已完成主开发并进入维护态
- P4 当前这一轮 web capability carry-through 已完成收口
- P5 approved baseline / replay / quality gate / regression report 已完成主开发并进入使用态
- P6 observability readability 已做过一轮 bounded closeout
- 默认助手 / 默认知识库 / 默认 retrieval profile 的 bootstrap 与 repair 已完成并进入维护态

## Phase Snapshot

| Phase | Status                           | Short note                                                         |
| ----- | -------------------------------- | ------------------------------------------------------------------ |
| P0    | done                             | read-model / metadata convergence 已收口                           |
| P1    | done                             | 鉴权 / 用户登录最小闭环已收口                                      |
| P2    | done                             | owner-only ACL baseline 已落地                                     |
| P3    | done / maintenance only          | external-source family + guardrails 开发完成，后续只做小型回归维护 |
| P4    | done / bounded follow-up only    | 当前这轮 web capability carry-through 收口已完成，后续只做小型维护 |
| P5    | done / usage and governance only | eval runner / baseline / replay / report / quality gate 已落地     |
| P6    | done / bounded follow-up only    | observability readability 已完成，不扩成平台化改造                 |

## Current State

- 当前默认方式仍是：单线推进、小步增量、每轮收口。
- `P3`、当前这轮 `P4` 和 `P5` 不应再被视为“当前主开发主线”，代码已经比旧文档口径更靠前。
- 默认路径性能优化的当前重点已切到 request orchestration；`default-path first-token orchestration thin pass` 及其 final follow-up 已完成（retrieval 与 early stream status 并行化 + generating status eager non-blocking），阶段判断保持不变。
- 当前更合理的工作是：
  - 保持阶段判断、docs、queue 口径和代码现实一致
  - 在 `P3/P4/P5/P6` 已完成区域内做 bounded maintenance，继续收紧 canonical default assistant 行为（含 repair fallback 的 canonical 优先级）
  - `DocumentsPage` 当前应按“文件上传 + 文档状态管理”理解；仓库里虽保留 `web/feed/sitemap` source-entry 相关代码，但它们当前不是该页面默认对用户开放的主路径
- 当前 RAG 质量基线可作为稳定工作基线：
  - Fact：稳定可用
  - 2 步以内轻多跳：稳定可用
  - Summary / List：多数可用，但仍存在少量并列主项漏项或误归类边界
- 当前版本定义：稳定可用，适合作为后续产品化、评测和监控的基线版本。
- 明确决策：
  - `summaryMainItems` 两步实验保持关闭，不默认上线
  - `coverageSummary` 仅用于诊断和分析，不直接驱动回答生成或主流程决策

## Recommended Order

1. bounded maintenance in completed areas
2. keep docs and stage judgment fresh
3. maintain canonical default assistant / primary KB behavior

## Current Risks / Gaps

- 文档阶段判断如果再次落后于代码现实，仍然容易误导下一步优先级。
- `P5` 的工程能力已落地，但长期 baseline 治理仍依赖人来使用和维护。
- 当前这轮 `P4` 收口虽已完成，默认助手路径也已落地，但后续如果继续开新产品波次，仍需要先明确主线，避免再次扩散为并行波次。
- retrieval/answering 质量已经进入“可用但仍需维护”的阶段；当前更值得做的是 request orchestration 侧的首字节前链路瘦身与可重放 smoke 基线，而不是直接把默认 `topK` / `chunkWindow` 全局拉大。

## Current Retrieval Baseline

- Current local default retrieval profile:
  - `topK = 3`
  - `chunkWindow = 0`
  - `hybrid = OFF`
  - `rerank = OFF`
- Recent local smoke run result:
  - `37/40` grounded against `D:\\FeProjects\\rag-test\\question.md`
  - the remaining refusals currently look closer to source coverage limits than clear main-path regressions
- Recommended next retrieval maintenance:
  - replayable smoke tooling
  - lightweight dynamic retrieval expansion only if it preserves the current default-path quality baseline
  - further structured-document context assembly

## Where to Look

1. [docs/current-progress.md](D:\FeProjects\rag-system\docs\current-progress.md)
   - 最近完成了什么
   - 当前活跃边界
   - focused validation baseline
2. [docs/next_steps_rag_project_plan.md](D:\FeProjects\rag-system\docs\next_steps_rag_project_plan.md)
   - 下一步优先级
   - 当前阶段不做什么
   - 候选主线
3. [docs/current-context.md](D:\FeProjects\rag-system\docs\current-context.md)
   - 最短主线摘要
   - 当前边界和默认工作方式

## Practical Reading Order

- 先读本页
- 再读 [docs/current-progress.md](D:\FeProjects\rag-system\docs\current-progress.md)
- 再读 [docs/next_steps_rag_project_plan.md](D:\FeProjects\rag-system\docs\next_steps_rag_project_plan.md)
- 最后按需下钻实现或历史文档
