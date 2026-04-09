# Supabase / Prisma 延迟排查清单

## 适用场景

- RAG / 搜索 / 聊天系统首字节慢
- `retrievalMs` 很高
- Prisma 查询看起来很慢
- Supabase 项目怀疑数据库慢，但不确定是 SQL 还是连接路径

## 排查顺序

### 1. 先看应用侧时序

优先收集：

- `firstTokenMs`
- `preGenerationMs`
- `retrievalMs`
- `vectorSearchMs`
- `vectorCandidateFetchMs`
- `chunkWindowMs`
- `conversationLoadMs`
- `userMessagePersistMs`

### 2. 再看真实数据规模

至少确认：

- 表有多少行
- 表大小
- 当前索引是否真的存在

如果只有百级、千级数据，但应用侧查一次要 1s 左右，优先怀疑连接路径。

### 3. 跑 `EXPLAIN ANALYZE`

重点查：

- 向量检索 SQL
- 主块回表 SQL
- chunk-window 扩窗 SQL

先回答这个问题：

- 数据库内部执行到底慢不慢

### 4. 对比 wall-time

分别测：

- 当前应用 datasource 路径
- direct 直连路径

如果 direct 明显更快，优先处理：

- `DIRECT_URL`
- region
- network RTT
- pooler 路径

## 常见误区

- 不要看到 `vectorSearchMs` 高，就直接判定是向量算法慢
- 不要在没有 `EXPLAIN ANALYZE` 对照前，就直接缩 retrieval 语义
- 不要默认 pooler 比 direct 更适合低延迟链路

## 优先级建议

如果质量敏感，优化顺序建议是：

1. 连接路径
2. 实现层开销
3. SQL / 索引
4. retrieval 语义

## 一句话结论

如果 Supabase + Prisma 项目里“表不大但查询很慢”，先查连接路径和 wall-time，再决定要不要动 SQL 或 retrieval 语义。
