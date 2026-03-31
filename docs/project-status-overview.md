# Project Status Overview

> 文档角色：`current-status`
> 当前使用方式：日常问答 / 轻分析 / 快速解释的项目总览入口。先看这一页，不默认进入完整实施流。

更新时间：2026-03-31

## One-Line Status

RAG 主链路、PC Web chat、external source 第一轮最小增量和主要阶段收口都已完成；当前以小步收口和文档/队列同步为主。

## Completed

- 本地优先 RAG MVP 主链路已完成
- ask / stream 的渐进式聊天体验已完成
- PC Web chat 的流式处理与原生答案流式生成已完成
- external knowledge source 第一轮最小增量已完成
  - web page
  - feed
  - sitemap
  - sitemap index
- P0 read-model / metadata convergence 已收口
- P1 鉴权 / 用户登录阶段已收口
- P3 external-source guardrails 已完成主要闭环
- P5 approved baseline closeout 已完成 docs / replay / queue 收口
- P6 observability readability pass 已做过 bounded 收口

## Phase Snapshot

| Phase | Status | Short note |
| --- | --- | --- |
| P0 | done | read-model / metadata convergence 已收口 |
| P1 | done | 鉴权 / 用户登录阶段已收口 |
| P2 | done | 主链路与 chat 体验基础已完成 |
| P3 | done | external-source 第一轮与 guardrails 已完成 |
| P4 | partially done / closed for now | source-entry 与部分 PC Web follow-up 已消费完历史波次 |
| P5 | done / not foreground | approved baseline closeout 已完成 |
| P6 | done | observability readability pass 已做过 bounded 收口 |

## Current State

- 当前默认方式：单线推进、小步增量、每轮收口
- 当前 queue 已耗尽，不默认重开历史 wave
- 现在更像是：收口、同步、等待新的明确增量

## Current Risks / Gaps

- 没有单独的长期总进度台账
- `current-progress.md` 偏近况，`next_steps...` 偏下一步
- queue/backlog 里的很多项已是历史闭合项

## Where to Look

1. `docs/current-progress.md`
   - 最近完成了什么
   - 当前活跃边界
   - validation baseline
2. `docs/next_steps_rag_project_plan.md`
   - 下一步优先级
   - 当前阶段不做什么
   - queue-ready 方向
3. `docs/current-context.md`
   - 最短主线摘要
   - 直接给 agent 用的当前边界

## Practical Reading Order

- 先读本页
- 再读 `docs/current-progress.md`
- 再读 `docs/next_steps_rag_project_plan.md`
- 最后按需下钻具体实现或历史文档
