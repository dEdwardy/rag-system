# Supabase / Prisma 低延迟排查备忘录

> 文档角色：`reference`
> 适用场景：使用 Supabase + Prisma + RAG/检索链路时，应用日志显示数据库查询很慢，但又不确定慢点到底在 SQL、索引、网络、pooler 还是连接路径。
> 更新时间：2026-04-10

## 1. 这篇文档解决什么问题

这篇文档主要总结一类很容易误判的性能问题：

- 应用侧日志看起来是数据库检索很慢
- 业务方第一反应通常是：
  - SQL 写差了
  - 缺索引
  - pgvector 太慢
  - retrieval 逻辑太重
- 但实际根因可能不是数据库内部执行慢，而是：
  - API 到数据库的远程往返延迟高
  - Supabase pooler 路径延迟比 direct 路径高
  - 应用部署 region 和数据库 region 距离太远

对低延迟场景，特别是聊天首字节、检索首字节、搜索建议、实时筛选这类路径，这个区别非常关键。

## 2. 先记住一个判断原则

如果你看到：

- 应用日志里的查询耗时是几百毫秒到几秒
- 但表数据量并不大
- 业务 SQL 也不复杂

不要先默认是 SQL 慢。

先区分两件事：

1. 数据库内部执行时间慢不慢
2. 应用发起查询到拿回结果的 wall-time 慢不慢

只有这两件事分开看，才能避免误判。

## 3. 推荐排查顺序

### 第一步：先在应用侧把慢链路拆细

先不要直接改 SQL，也不要一上来就调索引。

先补业务时序日志，至少把链路拆到：

- `firstTokenMs`
- `preGenerationMs`
- `retrievalMs`
- `vectorSearchMs`
- `vectorCandidateFetchMs`
- `chunkWindowMs`
- `conversationLoadMs`
- `userMessagePersistMs`

如果是 RAG/检索系统，建议像这次一样补两层：

1. 总体请求 timing
2. retrieval 子阶段 timing

这样可以先判断：

- 慢在模型前
- 慢在 retrieval
- 慢在落库
- 还是慢在 trace/后处理

### 第二步：核对真实数据规模

很多“看起来很慢”的问题，根本不符合“因为表太大所以慢”的前提。

至少要先知道：

- `ChunkEmbedding` 有多少行
- `DocumentChunk` 有多少行
- 表大小多少
- 索引是否真的存在

如果只有百级、千级数据，但应用日志里的查询要 1s 以上，就要高度怀疑不是 SQL 本身。

### 第三步：对关键 SQL 跑 `EXPLAIN ANALYZE`

对下面几类查询做只读分析：

1. 向量检索
2. 主块回表
3. chunk-window 扩窗查询

重点不是看“计划漂不漂亮”，而是先确认：

- 数据库内部执行时间到底是多少
- 是毫秒级、几十毫秒，还是几百毫秒

如果数据库内部执行只有几毫秒，而应用日志记录是 500ms、1000ms、2000ms，那问题就已经不是 SQL 了。

### 第四步：测应用侧 wall-time

不要只看 DB 计划，还要测：

- 通过应用当前连接串跑简单查询的 wall-time
- 通过直连数据库跑同样查询的 wall-time

例如：

- `DATABASE_URL` 走 Supabase pooler
- `DIRECT_URL` 走 direct 5432

把同一条简单查询在两条路径上分别跑几次，对比差异。

如果 direct 稳定明显更快，那就已经足够说明主瓶颈在连接路径，而不是 SQL 本身。

## 4. 这次项目里的真实结论

本仓库这次排查得到的结论是：

- 数据库表规模很小，只有百级记录
- `EXPLAIN ANALYZE` 显示关键 SQL 执行只有毫秒级
- 但应用侧 wall-time 很高
- 走 Supabase pooler 的延迟明显高于 direct 连接

也就是说，这次慢的主因不是：

- 表太大
- SQL 太差
- pgvector 算法慢
- 缺 ANN 索引导致全表扫太重

而是：

- API 到数据库的远程往返延迟
- Supabase pooler 连接路径额外增加了延迟

在这个数据规模下，真正的高收益优化不是继续改 retrieval 语义，而是切换低延迟连接路径。

## 5. 常见误区

### 误区 1：看到 `vectorSearchMs` 高，就认定是向量检索慢

不一定。

应用日志里的 `vectorSearchMs` 很可能包含：

- 连接建立/复用等待
- 网络往返
- pooler 延迟
- Prisma/driver 往返开销

如果没有和数据库内部执行时间对照，这个字段不能直接等价为“数据库内部向量搜索用了这么久”。

### 误区 2：先改 retrieval 语义来救性能

这次就踩过这个坑。

比如：

- 想跳过 hybrid
- 想缩小召回面
- 想直接走 vector-only

这些策略可能能让数值下降，但也更容易伤回答质量。  
如果真正慢点其实在连接路径，那这种优化既冒质量风险，也没打中根因。

### 误区 3：pooler 一定更适合所有生产场景

也不对。

pooler 更偏向：

- 控制连接数
- 降低数据库连接管理压力
- 适合高并发连接治理

但对低延迟、频繁小查询、首字节极敏感的链路，pooler 未必是最优路径。

## 6. 给 Supabase / Prisma 项目的通用建议

### 建议 1：预留 `DIRECT_URL`

如果项目对延迟敏感，建议一开始就把 Prisma datasource 设计成：

- 优先 `DIRECT_URL`
- 回退 `DATABASE_URL`

这样：

- 平时仍可保留 pooler 配置
- 但关键 API 路径可以快速切到直连
- 出现类似问题时，不需要再做架构级改造

### 建议 2：把“连接路径是否正确”写进启动日志

很容易发生这种问题：

- 你以为已经走 direct 了
- 实际运行时还是在走 pooler

建议启动时打印一条不泄露密钥的摘要，例如：

- `direct`
- `pooler`
- `custom`

再带上 host/port 即可。

### 建议 3：先查 region，再查 SQL

如果：

- API 在 A 地区
- 数据库在 B 地区
- 首字节目标又是 2s 以内

那很多毫秒级优化都会被跨区 RTT 抵消。

所以对低延迟项目，部署 region 和数据库 region 是否接近，优先级非常高。

### 建议 4：小数据时别过早把 ANN 索引当主救星

像 pgvector 的：

- `ivfflat`
- `hnsw`

对中大规模数据非常重要。  
但当数据只有百级、千级时，它未必是当前最主要的收益来源。

这时更值得优先查：

- 连接路径
- 网络往返
- pooler
- ORM 查询 wall-time

### 建议 5：回答质量敏感场景下，优先做“连接/实现层优化”

比如：

- 优先切直连
- 优先压连接延迟
- 优先减少无意义往返
- 优先把非首字节关键路径后移

而不是直接：

- 缩召回
- 关 hybrid
- 减 chunkWindow
- 简化 retrieval 语义

因为前者更安全，后者更容易伤质量。

## 7. 建议保留的观测项

后续类似项目里，建议保留这些字段：

- `firstTokenMs`
- `preGenerationMs`
- `retrievalMs`
- `vectorSearchMs`
- `vectorCandidateFetchMs`
- `chunkWindowMs`
- `conversationLoadMs`
- `userMessagePersistMs`
- 当前 datasource 模式：`direct/pooler/custom`

有了这些字段，后面无论是性能回归还是环境切换，都更容易快速定位。

## 8. 一句话结论

如果 Supabase + Prisma 项目里出现“表不大，但 retrieval/查询就是很慢”的情况，先不要急着改 SQL 或改检索语义。  
先确认数据库内部执行时间和应用侧 wall-time 是否一致。  
如果两者不一致，优先怀疑连接路径、pooler、network RTT 和 region，而不是先怀疑数据库本身。
