# source-feed-refresh-012

- 标题: Refresh feed source flow
- 状态: completed
- 代理: rag-build
- 会话: ses_2cc0d0c66ffee705mVOgvlnV5A
- 消息: msg_d33f4b6160017SNn5ITZbvZclW
- 开始: 2026-03-28 18:17:33
- 收到: 2026-03-28 18:19:43
- 完成: 2026-03-28 18:19:43

## 结果
已按要求完成一个**最小 backend 增量**（当前分支 `dev`），并已提交。

### 1) 先检查的相关代码路径
- `apps/api/src/infra/feed-source/feed-source.service.ts`
  - 重点看 `selectEntryBlocksByFreshness(...)`（feed 刷新窗口/截断逻辑）
- `apps/api/test/parsing.test.js`
  - 现有 feed 解析与 freshness/dedup 回归测试

### 2) 本次最小改动（1 个 focused increment）
#### 改动文件
1. `apps/api/src/infra/feed-source/feed-source.service.ts`  
   - 调整 `selectEntryBlocksByFreshness(...)`：
   - 之前：只要“有任一时间戳”就按时间排序截断。
   - 现在：当条目时间戳**混合存在/缺失**时，不做时间重排，改为保留原 feed 顺序 `slice(0, maxItems)`；仅在**全部条目都有可解析时间戳**时继续按最新时间排序。

2. `apps/api/test/parsing.test.js`  
   - 新增回归测试：  
     `FeedSourceService keeps feed order when mixed timestamp availability would make freshness sorting ambiguous`
   - 覆盖“混合时间戳”截断窗口场景，防止后续回归。

3. `docs/current-progress.md`  
   - 追加本次增量记录（范围、行为、验证命令、结果）。

---

### 3) 最小验证（1 条 focused）
执行命令：
```bash
pnpm test:api:file -- test/parsing.test.js
```
结果：
- `test/parsing.test.js` 通过（`25/25`）

---

### 4) 已提交
- 分支：`dev`
- 提交哈希：`f91cc69`
- 提交信息：`fix: preserve feed refresh window for mixed-date entries`

---

### 5) 本次具体改善的 freshness 行为
改进点是：  
当 feed 在一次轮询中同时出现“有日期”和“无日期”条目时，`maxItems` 窗口不再被“仅按有日期条目重排”主导，从而避免把顶部无日期但实际更新的条目误判为旧条目并截断掉。  
同时，**全量有日期**的 feed 仍保持“优先最新日期”的原有行为。  

（未做 push/PR，按你的 closeout 节奏保留。）

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

Implement one minimal feed refresh improvement for existing external sources.

Priority guidance:
- focus on one stale `feed` update or polling gap
- prefer refresh timing, retry, or dedup clarity
- do not add a new source family
- do not broaden into a connector platform rewrite

Choose one small focused increment, validate it minimally, and report the exact freshness behavior it improves.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

