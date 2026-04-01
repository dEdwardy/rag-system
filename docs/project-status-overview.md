# Project Status Overview

> 文档角色：`current-status`
> 当前使用方式：日常问答 / 快速判断时优先看的项目总览入口。先看这一页，再决定是否下钻长文档。
更新时间：2026-04-01

## One-Line Status

RAG 主链路、PC Web chat、external source 第一轮、auth/ACL 最小闭环、P5 eval baseline 工程化能力都已落地；当前更像是进入稳定维护和下一波产品增量选择期，而不是继续补基础能力。

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
- P5 approved baseline / replay / quality gate / regression report 已完成主开发并进入使用态
- P6 observability readability 已做过一轮 bounded closeout

## Phase Snapshot

| Phase | Status | Short note |
| --- | --- | --- |
| P0 | done | read-model / metadata convergence 已收口 |
| P1 | done | 鉴权 / 用户登录最小闭环已收口 |
| P2 | done | owner-only ACL baseline 已落地 |
| P3 | done / maintenance only | external-source family + guardrails 开发完成，后续只做小型回归维护 |
| P4 | partially done / next likely product path | 更适合承接现有 backend 能力到 web，而不是重开 backend 波次 |
| P5 | done / usage and governance only | eval runner / baseline / replay / report / quality gate 已落地 |
| P6 | done / bounded follow-up only | observability readability 已完成，不扩成平台化改造 |

## Current State

- 当前默认方式仍是：单线推进、小步增量、每轮收口。
- `P3` 和 `P5` 不应再被视为“当前主开发主线”，代码已经比旧文档口径更靠前。
- 当前更合理的工作是：
  - 先保证阶段判断、docs、queue 口径和代码现实一致
  - 再选择一个新的最小产品增量继续推进

## Current Risks / Gaps

- 文档阶段判断曾落后于代码现实，容易误导下一步优先级。
- `P5` 的工程能力已落地，但长期 baseline 治理仍依赖人来使用和维护。
- `P4` 还没有被重新明确成一个新的、窄范围的产品承接波次。

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
