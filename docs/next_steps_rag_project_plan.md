# RAG 项目下一步计划

> 文档角色：`current-primary`
> 当前使用方式：当前阶段任务方向、优先级、superpowers 使用方式、AI review 策略，以本文档为主。

更新时间：2026-03-21

> 说明：
> 本文档已根据 `README.md`、`docs/current-dev-setup.md`、`docs/current-progress.md` 以及当前已落盘的 design/plan 重新校准。
> <span style="background:#d1ecf1;color:#0c5460;font-weight:700;padding:0 6px;">现阶段主文档</span> 当前阶段的任务方向、优先级判断、superpowers 使用方式、AI review 策略，均以本文档为主；`docs/current-progress.md` 主要承担进度记录和完成状态同步。
> 文中带有 <span style="background:#fff3cd;color:#b00020;font-weight:700;padding:0 6px;">相对原文件已改</span> 标记的内容，表示这是相对原版本的明确调整点。

## 1. 当前判断

当前项目已经完成：

- 本地优先 RAG MVP 主链路
- ask/stream 的第一轮渐进式聊天体验
- `PC Web` chat 的流处理与原生答案流式生成能力
- external knowledge source 的第一轮最小增量：
  - web page
  - feed
  - sitemap
  - sitemap index

这意味着项目接下来不应继续同时开很多大方向，而应进入：

**单线程推进 + 小步增量 + 每轮收口**

<span style="background:#fff3cd;color:#b00020;font-weight:700;padding:0 6px;">相对原文件已改</span> 当前最合理的顺序是：

1. 先完成当前这轮 `PC Web chat experience polish` 的剩余 UI / UX 收口
2. 再继续推进 `external knowledge source expansion`
3. 保持 `backend / API first`
4. 暂不扩移动端
5. retrieval / answering 以收敛和系统化为主，不再作为当前第一优先级
6. AI review 仅用于高风险改动

<span style="background:#fff3cd;color:#b00020;font-weight:700;padding:0 6px;">相对原文件已改</span> 当前应区分两件事：`chat` 流处理已经完成，但 `PC Web chat experience polish` 作为更大的体验收口任务还未完全结束，因此它仍可作为当前优先事项，随后再回到 `external knowledge source expansion`。

---

## 2. 接下来的主优先级

### P0：PC Web chat experience polish（当前下一步）

<span style="background:#fff3cd;color:#b00020;font-weight:700;padding:0 6px;">相对原文件已改</span> 当前并不是“chat 流处理还没做”，而是“chat 流处理已完成，但完整的 `PC Web chat experience polish` 还没收口”。

目标：

在已完成 chat 流处理的基础上，把当前 `PC Web chat` 的 workspace UI / UX、状态承载、信息层级和最终收口做完。

当前已完成：

- NDJSON transport and progressive answer rendering
- native answer-generation text streaming
- chat stream state
- streamed answer rendering 基础接线

当前待完成：

- chat workspace UI / UX polish 收口
- streamed state 下的信息层级与状态表达收口
- citations / trace / document 跳转入口的最终体验收口
- 与当前聊天工作区直接相关的视觉统一与交互细节修正

这一轮建议优先关注：

- 不重做已完成的流处理链路
- 围绕当前 chat workspace 做最小必要的 UI / UX 收口
- 继续保持 `PC Web` 优先
- 不把这轮 polish 扩展成移动端或整站重设计

这一轮明确不做：

- 移动端适配
- 大规模组件库替换
- 前端状态管理重构
- 通用 connector / source 抽象重构
- 调度系统、定时同步、鉴权、租户能力

完成标准：

- 不影响当前流式 ask 主链路
- chat 页面状态承载、信息层级、视觉一致性达到“可收口”状态
- 文档里清楚区分“流处理已完成”和“polish 整体已完成”

---

### P1：external knowledge source expansion

<span style="background:#fff3cd;color:#b00020;font-weight:700;padding:0 6px;">相对原文件已改</span> `external knowledge source expansion` 仍是当前阶段的下一整个大方向，但顺位放在当前 chat polish 收口之后。

目标：

在不跳出当前主线的前提下，继续把外部知识源能力做成一类稳定、可扩展、可诊断的后端能力。

当前已完成的最小增量：

- one direct `http` / `https` web page source
- one direct RSS / Atom feed source
- one direct sitemap `urlset` source
- one root sitemap `sitemapindex` source that expands child direct sitemaps

这一轮建议优先关注：

- 保持 `backend / API first`
- 在现有 source family 上继续做最小而连续的增量
- 强化 source 级别的可诊断性、失败原因表达和运行边界
- 明确哪些能力已经是稳定基线，哪些仍是进行中的扩展
- 继续复用现有 document creation / ingestion / indexing 链路，而不是新开一套 connector framework

这一轮明确不做：

- 前端大改版
- 移动端适配
- 通用 connector 大重构
- 调度系统、定时同步、鉴权、租户能力
- 一口气并行扩很多完全不相干的新 source 类型

完成标准：

- `external knowledge source expansion` 继续前进，但仍保持小步增量
- 每一轮 source 增量都能复用既有 ingestion 主链路
- 文档能清楚区分“已完成最小能力”和“尚未完成的整体方向”
- 不影响当前 `PC Web` 与 ask 主链路稳定性

---

### P2：retrieval / answering 收敛

<span style="background:#fff3cd;color:#b00020;font-weight:700;padding:0 6px;">相对原文件已改</span> 优先级顺位后移。不是当前第一步，但仍然是后续重要方向。

目标：

当前 retrieval / answering 已具备较多能力，后续更适合做“系统化收敛”和“默认策略清晰化”，而不是继续快速堆功能。

建议做法：

- 固定更清晰的默认推荐策略
- 降低配置项理解成本
- 提升 trace 与执行 metadata 的可读性
- 让调参和策略选择更可解释

暂时不建议：

- 再继续堆更多 retrieval 策略开关
- 再继续扩很多高级回答模式

---

### P3：PC Web 后续体验收口

<span style="background:#fff3cd;color:#b00020;font-weight:700;padding:0 6px;">相对原文件已改</span> 当当前这轮 `PC Web chat experience polish` 完成后，后续仍可能因为新能力接入继续产生局部体验收口需求。

判断依据：

- 当前这轮 `PC Web chat experience polish` 收口完成后
- 流式 ask/rendering 已经落地
- 但后续仍可能因为新能力接入继续产生局部 UI/UX 收口需求

建议范围：

- 只做与当前新增能力直接相关的界面承载优化
- 不做新一轮大范围视觉翻修
- 继续坚持 `PC Web` 优先，移动端后置

---

## 3. 为什么前端已经做了流处理，后面还会继续改 UI

<span style="background:#fff3cd;color:#b00020;font-weight:700;padding:0 6px;">相对原文件已改</span> 新增本节，用来解释最近文档顺序变化背后的原因。

前一轮前端工作的重点，是把 chat 的“流式能力”接通和稳定下来，例如：

- NDJSON progressive answer rendering
- chat stream state 管理
- loading / streaming / completed / error 状态切换
- citation / trace / 文档跳转在流式场景中的基本可用性

这类工作首先解决的是：

- 能不能流起来
- 状态是否正确
- 主链路会不会坏

但它并不自动等于：

- 页面已经足够顺眼
- 信息层级已经清楚
- 新增状态在视觉上已经被良好承载

所以文档里会出现这样一个自然顺序：

1. 先把流处理与渐进展示做出来
2. 再把当前这轮 `PC Web chat experience polish` 收口做完
3. 然后把该轮 polish 标记为完成
4. 再把项目主线切回 `external knowledge source expansion`

这不是互相冲突，而是：

**先补功能承载能力，再补界面收口；收口完成后，再回到主线增量。**

---

## 4. 工作方式建议

<span style="background:#fff3cd;color:#b00020;font-weight:700;padding:0 6px;">相对原文件已改</span> 这里去掉了原文里较重的“先 UI、再 source stabilization”的节奏判断，改为与当前仓库状态一致的执行建议。

建议工作方式：

1. 每一轮只推进一个主题
2. 每一轮先写清楚“做什么 / 不做什么”
3. 优先做最小可验证增量
4. 跑最小必要验证
5. 更新 `docs/current-progress.md`

关键原则：

- 不并行开多个主方向
- 优先严格串行执行
- 不并行跑重型测试或 build
- 不把 AI review 和重型验证叠在一起

---

## 5. AI review 怎么放

这一节保留原有判断，且与当前仓库文档一致：

- 不默认自动 review
- 只在高风险改动时手动 review diff
- review 重点放在逻辑 bug、状态一致性、错误处理缺口、是否破坏现有主链路

适合启用 AI review 的情况：

- 改 ask 主链路
- 改 stream
- 改 retrieval
- 改 ingestion
- 改接口协议
- 改数据库相关行为
- 改 orchestrator

不适合启用 AI review 的情况：

- UI 美化
- 文案调整
- 样式修改
- 小重构
- 一般配置项修改

建议 review 提示词：

```text
Review this diff only.

Focus on:
- logic bugs
- state consistency
- error handling gaps
- breaking behavior in the existing pipeline

Ignore style and minor refactors.
Return at most 3 issues.
If no major issue, say "looks safe".
```

---

## 6. 建议的最近两轮安排

### Round A：完成当前这轮 PC Web chat experience polish

<span style="background:#fff3cd;color:#b00020;font-weight:700;padding:0 6px;">相对原文件已改</span> 当前 round A 不是重做流处理，而是完成这轮 chat polish 的剩余 UI / UX 收口。

建议目标：

- 明确 `chat` 流处理已完成
- 完成当前 chat workspace 的剩余 UI / UX polish
- 不重开流式传输或模型流式实现
- 收口后再切回下一整个大方向

建议产出：

- 一个新的 design
- 一个新的 implementation plan
- 一次最小必要验证
- 对 `docs/current-progress.md` 的同步更新

### Round B：继续 external knowledge source expansion

<span style="background:#fff3cd;color:#b00020;font-weight:700;padding:0 6px;">相对原文件已改</span> 当前 chat polish 收口完成后，再继续回到 external source 主线。

建议目标：

- 在现有 external source family 上继续推进下一步最小增量
- 后续再进入 stabilization / management enhancement

---

## 7. 一句话结论

<span style="background:#fff3cd;color:#b00020;font-weight:700;padding:0 6px;">相对原文件已改</span> 当前项目接下来最重要的是：

**明确 `chat` 流处理已完成，但当前这轮 `PC Web chat experience polish` 仍待收尾；收尾完成后，再继续沿 `external knowledge source expansion` 这条主线做后端优先的小步增量。**

如果需要继续改 UI，也应理解为：

**先完成当前这轮 chat polish，再把后续 UI 改动控制为围绕新增能力的局部收口。**
