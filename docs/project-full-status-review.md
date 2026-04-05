# 项目全面进度梳理报告

> 文档角色：`full-status-review`
> 当前使用方式：项目全面进度梳理、风险识别、优先级制定、推进计划

**更新时间：2026-04-01**

---

## 一、已完成任务详细状态

### 1.1 MVP 主链路与核心功能（已完成）

| 任务项 | 完成时间 | 状态 | 验证基准 |
|--------|---------|------|---------|
| 本地优先 RAG MVP 主链路 | 2026-03 前期 | ✅ 完成 | 文档上传、摄入、分块、嵌入、检索、回答、引用、追踪持久化 |
| ask / stream 渐进式聊天体验 | 2026-03 前期 | ✅ 完成 | 流式回答、对话管理、消息历史 |
| PC Web chat 流式处理 | 2026-03 前期 | ✅ 完成 | 原生答案流式生成、实时交互 |

### 1.2 P0: read-model / metadata convergence（已完成）

**完成时间：2026-03-28**

已完成项：
- ask response / trace summary 标签映射逻辑统一
- web contract 对最新 TraceSummary 可读字段的守卫
- legacy fallback 路径回归测试
- unknown / fallback 文案风格统一
- trace-summary 文档同步
- eval / regression 基线建立
- opencode 模型分工复核

验证基准：
```bash
pnpm test:api:file -- test/traces.service.test.js
pnpm test:api:file -- test/ask-success.test.js
node --test apps/web/test/trace-summary-contract.test.js
```

### 1.3 P1: 鉴权 / 用户登录（已完成）

**完成时间：2026-03-29**

已完成项：
- auth identity contract 定义
- session persistence 最小模型
- auth provider boundary 建立（GitHub / Google / OIDC）
- request auth context 注入
- auth API 最小闭环（login/logout/me）
- 硬编码 identity 的业务写入路径替换
- conversation identity scoping
- owner / tenant 写入路径对齐
- route policy baseline 建立
- web auth bootstrap
- web login / logout flow
- auth 文档与验证口径

验证基准：
```bash
pnpm test:api:file -- test/auth-provider-boundary.test.js
pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/conversations.service.test.js test/ask-success.test.js test/ask-stream-service.test.js
pnpm test:api:file -- test/knowledge-bases-auth-write-path.test.js
pnpm --filter @rag-system/web build
```

### 1.4 P2: ACL / 文档权限（已完成）

**完成时间：2026-03-29**

已完成项：
- 核心资源权限边界盘点（knowledge base / document / assistant / conversation / trace）
- resource access policy contract 定义
- knowledge base / document ownership checks 收口
- assistant / conversation / trace access checks 收口
- 默认策略口径定义（owner_only_v1 + deny_by_default）
- ACL 基线文档与回归验证

验证基准：
- 未认证 → 401
- owner 不匹配 → 403
- 五类核心资源维持 owner-scoped private baseline

### 1.5 P3: external knowledge source（已完成）

**完成时间：2026-03-31**

已完成第一轮最小增量：
- web page source
- feed (RSS/Atom) source
- sitemap / urlset source
- sitemapindex (一层) source

已完成 guardrails 收口：
- 合法性基线：public/no-login/no-paywall only
- 不做访问控制绕过
- sitemap/sitemapindex 仅作为 URL 索引
- rights-to-use 用户侧责任
- robots/domain guard
- crawl budget pacing
- source throttle/breaker
- incremental-first resync

验证基准：
```bash
pnpm test:api:file -- test/external-source-sync.test.js
pnpm test:api:file -- test/fetch-with-retry.test.js
pnpm test:api:file -- test/parsing.test.js
```

### 1.6 P5: RAG 质量证明（已完成）

**完成时间：2026-03-30**

已完成项：
- 固定题集 P5 v1 eval runner 落地
- regression report 汇总链路落地
- quality gate 固定阈值合同落地
- approved baseline 文档同步（3 题 question set）
- baseline annotations 批准
- baseline dataset version pin 批准
- demo shortlist 批准（4+1）

验证基准：`apps/api/scripts/p5-baseline-manifest.v1.json` 作为工程 baseline v1 单一来源

### 1.7 P6: 运行观测 / 审计补强（已完成）

**完成时间：2026-03-31**

已完成项：
- Usage / Report center / Trace Detail scan-first readability
- docs sync
- document run observability

验证基准：
```bash
pnpm test:api:file -- test/traces.service.test.js
pnpm test:api:file -- test/ask-success.test.js
node --test apps/web/test/trace-summary-contract.test.js
node --test --test-name-pattern "document run" apps/web/test/document-run-observability.test.js
```

---

## 二、进行中任务详细状态

### 2.1 关于 Queue 的说明

**重要：** queue 仅是 vibe coding 自动化开发辅助工具，与 RAG 系统核心功能无关，仅用于辅助开发流程。

### 2.2 P3 follow-up micro-wave（待启动）

**边界：现有 source family 内稳定性补强**

待完成项：
1. `source retry/timeout diagnostics consistency`
2. `web page body-quality diagnostics`
3. `external resync diagnostics/error-code consistency`
4. `source follow-up docs sync`

---

## 三、未开始任务详细状态

### 3.1 P4: PC Web 后续局部收口

**触发条件：backend 已支持 external source API，但 web 缺少录入入口**

待完成项：
- 补 web page 单 URL 入口
- 补 feed URL 入口
- 补 sitemap URL 入口

范围：仅 DocumentsPage 与其现有 API hooks

### 3.2 P5 剩余人工判断项

**不在自动 queue 内**

待完成项：
- baseline 题集的人工选择与取舍（真实问题覆盖范围）
- baseline 标注（期望答案要点 / 引用期望）
- baseline 文档集版本选择与冻结
- demo case 取舍与 replay 验收结论

### 3.3 长期规划项（后置）

- member/viewer 放权
- share/public 业务资源可见性扩展
- RBAC/ABAC 角色矩阵
- 跨 tenant 协作
- 新 source family 扩展
- web page JS 渲染抓取能力
- 企业能力
- 多租户隔离

---

## 四、当前存在的问题与风险

### 4.1 问题识别

| 问题 | 严重程度 | 影响范围 | 说明 |
|------|---------|---------|------|
| queue 已耗尽 | 中 | 执行流 | 没有明确的下一个自动执行增量 |
| P4 external source 录入入口缺失 | 中 | 用户体验 | backend 已支持，但 web 无法录入 |
| P5 人工判断项积压 | 低 | 质量证明 | 需要人工介入才能继续 |
| 缺少长期总进度台账 | 低 | 项目管理 | current-progress 偏近况，next_steps 偏下一步 |

### 4.2 风险识别

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| 方向漂移 | 中 | 高 | 保持单线推进、小步增量、每轮收口 |
| queue 空转 | 中 | 中 | 识别明确的下一个最小增量 |
| P4 能力承载滞后 | 低 | 中 | 优先补上 external source 录入入口 |
| 人工判断项阻塞 | 低 | 低 | 保持自动 loop 与人工决策分离 |

---

## 五、后续工作优先级排序方案

### 5.1 优先级定义

| 优先级 | 定义 | 决策标准 |
|--------|------|---------|
| **高 (High)** | 阻塞用户使用、核心功能缺失、高风险修复 | 用户价值高、技术风险高、依赖关系强 |
| **中 (Medium)** | 体验优化、功能补强、稳定性提升 | 用户价值中等、技术风险可控、无强依赖 |
| **低 (Low)** | 文档完善、代码优化、长期规划 | 用户价值较低、技术风险低、可延后 |

### 5.2 优先级排序（高 → 中 → 低）

**原则：单线推进、小步增量、每轮收口**

推荐顺序：
1. **高优先级**：P4 external source 录入入口（能力承载）
2. **高优先级**：P3 follow-up micro-wave（稳定性补强）
3. **中优先级**：P5 人工判断项推进（质量证明）
4. **中优先级**：文档与进度同步完善
5. **低优先级**：长期规划项预研

---

## 六、可执行的项目推进计划

### 6.1 高优先级任务

#### 任务 1：P4 external source 录入入口

| 属性 | 内容 |
|------|------|
| **目标** | 补齐 PC Web 对 external source API 的能力承载 |
| **预期成果** | DocumentsPage 支持 web page / feed / sitemap URL 录入 |
| **负责人** | 开发团队 |
| **计划完成时间** | 2026-04-05 |
| **验证方式** | 手动测试录入流程 + focused UI 测试 |

**任务拆解（推荐顺序）：**
1. 补 web page 单 URL 入口
2. 补 feed URL 入口
3. 补 sitemap URL 入口

**边界：**
- 仅 DocumentsPage 与其现有 API hooks
- 不扩成新的 source 管理后台
- 不引入移动端适配
- 不改 backend source contract

---

#### 任务 2：P3 follow-up micro-wave

| 属性 | 内容 |
|------|------|
| **目标** | 现有 source family 内稳定性补强 |
| **预期成果** | retry/timeout 诊断一致、正文质量信号、重同步错误码一致 |
| **负责人** | 开发团队 |
| **计划完成时间** | 2026-04-10 |
| **验证方式** | P3 follow-up 验证基准 |

**任务拆解（推荐顺序）：**
1. `source retry/timeout diagnostics consistency`
2. `web page body-quality diagnostics`
3. `external resync diagnostics/error-code consistency`
4. `source follow-up docs sync`

**边界：**
- 不新增 source family
- 不引入 JS 渲染抓取
- 不重开 source 平台化

**验证基准：**
```bash
pnpm test:api:file -- test/external-source-sync.test.js
pnpm test:api:file -- test/fetch-with-retry.test.js
pnpm test:api:file -- test/parsing.test.js
```

---

### 6.2 中优先级任务

#### 任务 3：P5 人工判断项推进

| 属性 | 内容 |
|------|------|
| **目标** | 推进质量证明的人工决策项 |
| **预期成果** | baseline 题集、标注、文档集、demo case 确定 |
| **负责人** | 产品 / 测试团队 |
| **计划完成时间** | 2026-04-15 |
| **验证方式** | 人工验收 + replay 测试 |

**待决策项：**
1. baseline 题集的人工选择与取舍
2. baseline 标注（期望答案要点 / 引用期望）
3. baseline 文档集版本选择与冻结
4. demo case 取舍与 replay 验收结论

---

#### 任务 4：文档与进度同步完善

| 属性 | 内容 |
|------|------|
| **目标** | 完善项目文档与进度管理 |
| **预期成果** | 长期总进度台账、文档对齐 |
| **负责人** | 开发团队 |
| **计划完成时间** | 2026-04-20 |
| **验证方式** | 文档 review |

**任务项：**
1. 建立长期总进度台账
2. 同步 current-progress 与 next_steps

---

### 6.3 低优先级任务

#### 任务 5：长期规划项预研

| 属性 | 内容 |
|------|------|
| **目标** | 为长期规划做技术预研 |
| **预期成果** | 技术方案草案、风险评估 |
| **负责人** | 架构师 / 高级开发 |
| **计划完成时间** | 2026-04-30 |
| **验证方式** | 技术方案 review |

**预研方向（可选）：**
1. member/viewer 放权方案
2. share/public 可见性扩展
3. RBAC/ABAC 角色矩阵
4. 跨 tenant 协作
5. 新 source family 评估

---

## 七、总结与下一步行动

### 7.1 一句话总结

RAG 主链路、PC Web chat、external source 第一轮最小增量和主要阶段收口都已完成；当前最明确的下一个增量是补上 P4 external source 录入入口，随后推进 P3 follow-up micro-wave 稳定性补强。

### 7.2 立即行动建议

1. **第一周（04-01 ~ 04-05）**：启动 P4 external source 录入入口
2. **第二周（04-06 ~ 04-10）**：推进 P3 follow-up micro-wave
3. **第三周（04-11 ~ 04-15）**：推进 P5 人工判断项
4. **第四周（04-16 ~ 04-20）**：完善文档与进度同步

### 7.3 关键约束

- 保持单线推进，不并行开多个主方向
- 优先严格串行执行
- 每一轮先写清楚"做什么 / 不做什么"
- 优先做最小可验证增量
- 跑最小必要验证
- 更新 docs/current-progress.md

---

**文档结束**
