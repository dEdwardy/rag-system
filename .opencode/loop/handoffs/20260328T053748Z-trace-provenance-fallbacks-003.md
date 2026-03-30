# trace-provenance-fallbacks-003

- 标题: Lock legacy provenance fallback paths
- 状态: completed
- 代理: rag-build
- 会话: ses_2cd0f13efffet19mpVYStjPG3x
- 消息: msg_d32f2a152001QwmCwYUPCjHTXa
- 开始: 2026-03-28 13:35:43
- 收到: 2026-03-28 13:37:48
- 完成: 2026-03-28 13:37:48

## 结果
已按要求执行：先读了 `AGENTS.md` 与相关 trace 文档，再做最小改动并跑了单项快验证。

### 本次改动（最小增量）
只新增回归测试，**不改运行时代码语义**，用于锁定 legacy 回填路径对两个字段的行为：

- `answerProvenanceSentence`
- `missingInformationProvenanceSentence`

#### 修改文件
- `apps/api/test/traces.service.test.js`

#### 新增测试点
1. `TracesService keeps answerProvenanceSentence legacy fallback wording when attribution source metadata is missing`  
   - 场景：仅有 `answeringMetadataJson.citationAttribution`（缺少 source / textSource / statusSource）  
   - 断言：`answerProvenanceSentence` 仍走 legacy fallback 文案（`unknown ... explicit attribution via unknown source`）

2. `TracesService keeps missingInformationProvenanceSentence legacy fallback wording when source metadata is missing`  
   - 场景：仅有 `insufficientContextReason + missingInformationCount`（缺少 `missingInformationSource`）  
   - 断言：`missingInformationProvenanceSentence` 仍走 legacy fallback 文案（`source is unknown ...`）

---

### 聚焦验证（1 条）
执行命令：

```bash
pnpm --filter @rag-system/api test:file -- test/traces.service.test.js
```

结果：
- `test/traces.service.test.js` 通过
- `23/23` tests passed

---

说明：仓库当前有其他未提交改动（与你这次任务无关）；我本次仅对 `apps/api/test/traces.service.test.js` 做了增量测试覆盖。

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read AGENTS.md and the relevant trace docs first.

Target:
- apps/api/test/traces.service.test.js
- the nearest ask/assistant test file if needed

Goal:
Add regression coverage for legacy fallback metadata paths that affect answerProvenanceSentence and missingInformationProvenanceSentence. Lock the read-model backfill behavior without changing runtime semantics.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

