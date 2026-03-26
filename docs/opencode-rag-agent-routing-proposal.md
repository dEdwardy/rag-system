# OpenCode RAG 代理路由建议（草案）

状态：仅记录方案，不落地、不生效。

## 1. 标题与状态

本文是面向本仓库的 OpenCode 路由配置建议稿，用于后续评审与渐进采纳。
当前仅作为参考文档，不代表仓库已启用任何新配置。

## 2. 目标 / 非目标

### 目标

- 让默认执行路径保持 `plan -> build`，并与仓库“主控直做”策略一致。
- 保留有限委派能力，但只用于边界清晰的辅助子任务。
- 明确 `rag-build` 与 `rag-review` 的触发条件，避免每次改动都走重流程。

### 非目标

- 不在本次文档中直接创建或修改 `opencode.jsonc`。
- 不在本次文档中创建 `.opencode/agents/*.md`。
- 不引入“默认多代理并行主流程”或与 `AGENTS.md` 冲突的工作流。

## 3. 为什么要优化原方案

用户原方案方向正确（有分工、有路由、有审查），但为适配本仓库需要做三点收敛：

1. 本仓库默认是“单主控代理 + 窄辅助委派”，不是“广义 OMO 常开”。
2. `docs/opencode-workflow.md` 已将默认路径定为 `plan -> build`，应避免引入并行主路径。
3. 若把 `build` 与 `review` 设为每次必经，会增加小改动成本，不利于快速小步迭代。

因此本建议保留原方案的结构化优点，同时降低默认复杂度、提高可执行性。

## 4. 推荐路由原则

- 默认路径：`rag-plan` 产出最小增量，`rag-build` 实施与收口。
- 默认主控：由 `rag-orchestrator` 统一判定是否需要辅助代理。
- 委派边界：`rag-explore` 仅做检索/梳理/定位，不直接接管完整功能实现。
- 构建触发：`rag-build` 在“已有明确计划或用户直接要求实现”时触发；简单查询、状态核对不强制走 build。
- 审查触发：`rag-review` 仅用于高风险变更（检索、回答编排、摄入、流式、持久化/Schema、跨包契约）或合并前关键检查。
- 最终结论：最终验证结论与收口由主控代理串行完成。

### 开发分级规则（建议追加到 prompt）

为进一步降流程重量，建议在不违背仓库主控偏好的前提下，增加分级触发：

- **Level 1 — Direct Build（默认快车道）**：小 API 改动、元数据/trace 字段补充、小 bugfix、后端增量小步。
  - 流程：`build -> fast verify -> done`
  - 限制：不写长计划，不默认 review，不顺手重构无关代码。
- **Level 2 — Short Plan Then Build**：检索参数、rerank、query rewrite、中等契约对齐、实现路径不清晰。
  - 流程：`short plan -> build -> fast verify`
  - 计划最多 5 点：意图、影响文件、主要风险、最小安全改动、验证方式。
- **Level 3 — Plan, Build, Review**：fallback 语义、insufficient-context 行为、回答/引用策略、多模块行为定义变更。
  - 流程：`short plan -> build -> review -> targeted verify`

说明：仓库文档默认是 `plan -> build`。以上分级可由 `rag-orchestrator` 执行为“显式 plan”或“隐式短计划后直入 build”，用于小改动提速，不改变主控串行收口原则。

## 5. 推荐 `opencode.jsonc` 示例

> 说明：以下仅为建议样例，字段名需按你本地 OpenCode 版本校准。

```jsonc
{
  "$schema": "https://opencode.ai/config.schema.json",
  "model": "openai/gpt-5.3-codex",
  "default_agent": "rag-orchestrator",
  "agents_dir": ".opencode/agents",

  "commands": {
    "plan": {
      "agent": "rag-plan",
      "description": "产出下一个最小可执行增量"
    },
    "build": {
      "agent": "rag-build",
      "description": "按已确定计划实施并完成最小验证"
    },
    "explore": {
      "agent": "rag-explore",
      "description": "窄范围代码/文档检索与证据整理"
    },
    "review-risk": {
      "agent": "rag-review",
      "description": "仅用于高风险或合并前关键审查"
    }
  },

  "routing": {
    "default_flow": "plan_then_build",
    "enable_broad_multi_agent_by_default": false,
    "helper_delegation_requires_explicit_scope": true,
    "review_for_every_change": false
  }
}
```

## 6. 推荐 agent 文件示例（5 个）

> 说明：以下内容是建议模板，用于未来创建 `.opencode/agents/*.md` 时参考。

### `rag-orchestrator.md`

```markdown
# rag-orchestrator

你是本仓库的主控代理。

## 职责
- 先判断是否走默认 `plan -> build`。
- 只有在辅助任务边界清晰时，才委派给 `rag-explore` 或 `rag-review`。
- 最终结论、风险说明、收口验证由你负责。

## 分级执行
- Level 1（低风险）：直接 `build -> fast verify`。
- Level 2（中风险）：`short plan -> build -> fast verify`。
- Level 3（高风险）：`short plan -> build -> review -> targeted verify`。

## 何时升级流程
- retrieval / fallback / answering / citation
- shared contracts
- 明显不确定的多文件改动

## 禁止
- 不默认开启广义多代理并行主流程。
- 不把完整功能波次整体外包给辅助代理。
```

### `rag-plan.md`

```markdown
# rag-plan

你负责把需求收敛成“下一个最小增量”。

## 输出固定项
1. 当前代码路径
2. 最小实现增量
3. 预计修改文件
4. 最小验证命令
5. 主要风险

## 约束
- 保持小步，不混入无关重构。
- 与仓库主控偏好一致：可执行、可验证、可回退。
```

### `rag-explore.md`

```markdown
# rag-explore

你是窄范围辅助代理，只做检索与证据整理。

## 允许任务
- 定位函数/调用链
- 汇总配置来源
- 对比文档与实现差异

## 禁止
- 不直接实施完整功能改动
- 不做最终“可以合并”的结论
```

### `rag-build.md`

```markdown
# rag-build

你负责按既定计划实施改动。

## 职责
- 严格按计划做最小改动
- 执行最小相关验证
- 必要时更新对应文档

## 约束
- 不是所有会话都必须进入 build
- 若当前只是信息查询/方案讨论，可不触发 build
- 默认走快验证，不默认重验证
- 不把 feature + refactor + optimization 混在一个任务
- 不扩展到无关 UI 重构或平台化范围
```

### `rag-review.md`

```markdown
# rag-review

你负责风险导向审查，不做“全量默认审查”。

## 重点场景
- 检索、回答编排、摄入、流式、持久化/Schema、跨包共享契约
- 合并前关键回归检查

## 输出
- 风险清单（按严重度）
- 必改项 / 可后续项
- 建议补充验证
```

## 7. 使用示例

```bash
# 示例 1：Level 1（默认快车道）
opencode build "为 trace 增加 sourceLatencyMs 字段并补最小验证"

# 示例 2：Level 2（短计划后实现）
opencode plan "为 ingestion 增加失败重试的最小增量"
opencode build "执行上一步计划并做最小验证"

# 示例 3：仅需要检索，不进入实现
opencode explore "定位 retrieval trace 的生成路径与调用点"

# 示例 4：Level 3（高风险改动前审查）
opencode review-risk "审查 schema 变更对 API 与测试的影响"
```

实践建议：默认优先 `build -> fast verify`；涉及 retrieval/fallback/answer/citation/shared contract 或明显多文件不确定时，再升级为 `short plan` 或 `review-risk`。

## 8. 与原方案的差异

- 从“多代理默认可开”调整为“主控默认直做，辅助按需启用”。
- 从“所有改动都 build/review”调整为“按场景触发，避免流程过重”。
- 从“并行推进优先”调整为“串行收口优先，确保最终验证责任明确”。
- 新增分级触发：低风险直接 build，中风险短计划，高风险再 review。
- 保留原方案的结构化路由思路，但强化与本仓库现有规则的一致性。

## 9. 采纳建议：先记录，后应用

建议采用两阶段落地：

1. 先以本文作为评审基线，确认字段、命令命名、触发条件。
2. 再单独提交配置落地变更（`opencode.jsonc` + `.opencode/agents/*.md`），并做一次小范围试运行验证。

结论：当前状态仅为“可评审提案”，尚未进入仓库生效配置。
