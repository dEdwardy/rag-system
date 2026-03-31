# RAG 系统高中优先级任务 - 实现计划

## [x] Task 1: P3 - 盘点当前 source family 的后续缺口
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 盘点当前 source family（web page / feed / sitemap / sitemapindex）的后续缺口
  - 区分"稳定性补强"与"新增 source 类型"
  - 生成最小 follow-up gap list
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: 生成的 gap list 应包含所有稳定性补强项
  - `human-judgement` TR-1.2: gap list 应清晰区分稳定性补强和新增 source 类型
- **Notes**: 参考文档中已有的 gap 分析，确保覆盖所有关键问题

## [x] Task 2: P3 - 补 source retry / timeout / diagnostics 一致性
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 补 source retry / timeout / diagnostics 一致性
  - 确保所有 source family 的诊断信息格式一致
  - 提升错误处理的可读性和一致性
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-2.1: 运行 `pnpm test:api:file -- test/fetch-with-retry.test.js` 测试通过
  - `programmatic` TR-2.2: 运行 `pnpm test:api:file -- test/external-source-sync.test.js` 测试通过
- **Notes**: 重点关注 retry/timeout 逻辑的一致性和错误信息的可读性

## [x] Task 3: P3 - 补 web page 最小正文质量/正文缺失可读信号
- **Priority**: P0
- **Depends On**: Task 2
- **Description**: 
  - 补 web page 最小正文质量/正文缺失可读信号
  - 不引入 JS 渲染抓取，仅基于静态 HTML 提取
  - 提供正文质量评估和缺失检测
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-3.1: 运行 `pnpm test:api:file -- test/external-source-sync.test.js` 测试通过
  - `programmatic` TR-3.2: 运行 `pnpm test:api:file -- test/parsing.test.js` 测试通过
- **Notes**: 重点关注正文提取质量和缺失情况的诊断信号

## [x] Task 4: P3 - 收口跨 family 的 diagnostics / error-code 可读性一致性
- **Priority**: P0
- **Depends On**: Task 3
- **Description**: 
  - 收口跨 family 的 diagnostics / error-code 可读性一致性
  - 确保所有 source family 的错误代码和诊断信息格式一致
  - 提升错误信息的可读性和可理解性
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-4.1: 运行 `pnpm test:api:file -- test/external-source-sync.test.js` 测试通过
  - `programmatic` TR-4.2: 运行 `pnpm test:api:file -- test/parsing.test.js` 测试通过
- **Notes**: 重点关注跨 family 的错误代码一致性和诊断信息的可读性

## [/] Task 5: P3 - 同步 external source follow-up 文档与验证基线
- **Priority**: P0
- **Depends On**: Task 4
- **Description**: 
  - 同步 external source follow-up 文档与验证基线
  - 更新 `docs/current-progress.md` 和相关文档
  - 提供最小复用验证清单
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-5.1: 运行 `git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md docs/current-dev-setup.md` 无错误
  - `human-judgement` TR-5.2: 文档内容应与实现一致，清晰描述完成的工作和验证方法
- **Notes**: 确保文档与实现保持一致，便于后续维护和验证

## [ ] Task 6: P3 - 刷新 queue 状态
- **Priority**: P0
- **Depends On**: Task 5
- **Description**: 
  - 刷新 queue 状态，为下一波次做准备
  - 更新 `.opencode/loop/queue.json` 和相关配置
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-6.1: 运行 `node .opencode/loop/cli.mjs --self-test` 测试通过
  - `programmatic` TR-6.2: 运行 `node .opencode/loop/cli.mjs --materialize-wave p3-external-source-guardrail-wave` 测试通过
- **Notes**: 确保 queue 状态正确更新，为下一波次的任务做好准备

## [ ] Task 7: P5 - baseline 题集的人工选择与取舍
- **Priority**: P1
- **Depends On**: Task 6
- **Description**: 
  - baseline 题集的人工选择与取舍（真实问题覆盖范围）
  - 选择 20–50 条真实问题作为后续所有质量对比的固定输入
  - 去重、按主题覆盖、确定问题表达方式
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgement` TR-7.1: 题集应包含足够的真实问题，覆盖不同主题和场景
  - `human-judgement` TR-7.2: 题集应去重，问题表达方式应清晰明确
- **Notes**: 需要人工完成，确保题集质量和覆盖范围

## [ ] Task 8: P5 - baseline 标注
- **Priority**: P1
- **Depends On**: Task 7
- **Description**: 
  - 为 eval baseline 补标注
  - 给每个问题补上期望答案要点、期望引用、期望命中内容
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgement` TR-8.1: 标注应包含期望答案要点、期望引用和期望命中内容
  - `human-judgement` TR-8.2: 标注应清晰明确，便于后续评估
- **Notes**: 需要人工完成，确保标注质量和准确性

## [ ] Task 9: P5 - baseline 文档集版本选择与冻结
- **Priority**: P1
- **Depends On**: Task 8
- **Description**: 
  - 固定 baseline 文档集版本
  - 把评测输入的文档 / 知识库版本固定下来，避免每次跑出来的对比不稳定
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgement` TR-9.1: 文档集版本应固定，有明确的版本标识
  - `human-judgement` TR-9.2: 文档集应包含足够的内容，覆盖不同类型和场景
- **Notes**: 需要人工完成，确保文档集版本的稳定性和代表性

## [ ] Task 10: P5 - demo case 取舍与 replay 验收结论
- **Priority**: P1
- **Depends On**: Task 9
- **Description**: 
  - 做 3–5 个端到端 demo case
  - 把"系统好用"做成可展示、可复跑的固定案例
  - 覆盖本地 PDF 问答、混合 web/feed/sitemap 问答、no-hit / insufficient-context 受控行为、trace detail 排障
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgement` TR-10.1: demo case 应覆盖不同场景和功能
  - `human-judgement` TR-10.2: demo case 应可复跑，展示系统的核心功能和优势
- **Notes**: 需要人工完成，确保 demo case 的质量和代表性

## [ ] Task 11: P6 - 提升 Usage 页面的可读性和功能
- **Priority**: P1
- **Depends On**: Task 10
- **Description**: 
  - 提升 Usage 页面的可读性和功能
  - 确保 Usage 页面能够清晰展示系统的使用情况和统计信息
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-11.1: 运行 `node --test --test-name-pattern "usage page" apps/web/test/ui-review-regressions.test.js` 测试通过
  - `human-judgement` TR-11.2: Usage 页面应清晰可读，功能完整
- **Notes**: 重点关注页面的可读性和功能完整性

## [ ] Task 12: P6 - 提升 Report center 的可读性和功能
- **Priority**: P1
- **Depends On**: Task 11
- **Description**: 
  - 提升 Report center 的可读性和功能
  - 确保 Report center 能够清晰展示系统的质量报告和统计信息
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-12.1: 运行 `node --test --test-name-pattern "report center" apps/web/test/ui-review-regressions.test.js` 测试通过
  - `human-judgement` TR-12.2: Report center 应清晰可读，功能完整
- **Notes**: 重点关注页面的可读性和功能完整性

## [x] Task 13: P6 - 提升 Trace Detail 的可读性和功能
- **Priority**: P1
- **Depends On**: Task 12
- **Description**: 
  - 提升 Trace Detail 的可读性和功能
  - 确保 Trace Detail 能够清晰展示系统的执行 trace 和诊断信息
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-13.1: 运行 `node --test --test-name-pattern "trace detail" apps/web/test/ui-review-regressions.test.js` 测试通过
  - `human-judgement` TR-13.2: Trace Detail 应清晰可读，功能完整
- **Notes**: 重点关注页面的可读性和功能完整性

## [x] Task 14: P6 - 同步观测性相关文档
- **Priority**: P1
- **Depends On**: Task 13
- **Description**: 
  - 同步观测性相关文档
  - 更新 `docs/current-progress.md` 和相关文档
  - 提供最小复用验证清单
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-14.1: 运行 `git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md docs/current-dev-setup.md` 无错误
  - `human-judgement` TR-14.2: 文档内容应与实现一致，清晰描述完成的工作和验证方法
- **Notes**: 确保文档与实现保持一致，便于后续维护和验证