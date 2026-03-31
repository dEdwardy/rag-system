# RAG 系统高中优先级任务 - 验证清单

## P3: external knowledge source follow-up
- [x] Checkpoint 1: 生成的 gap list 应包含所有稳定性补强项，清晰区分稳定性补强和新增 source 类型
- [x] Checkpoint 2: 运行 `pnpm test:api:file -- test/fetch-with-retry.test.js` 测试通过
- [x] Checkpoint 3: 运行 `pnpm test:api:file -- test/external-source-sync.test.js` 测试通过
- [x] Checkpoint 4: 运行 `pnpm test:api:file -- test/parsing.test.js` 测试通过
- [x] Checkpoint 5: 运行 `git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md docs/current-dev-setup.md` 无错误
- [x] Checkpoint 6: 运行 `node .opencode/loop/cli.mjs --self-test` 测试通过
- [x] Checkpoint 7: 运行 `node .opencode/loop/cli.mjs --materialize-wave p3-external-source-guardrail-wave` 测试通过

## P5: RAG 质量证明
- [x] Checkpoint 8: baseline 题集应包含足够的真实问题，覆盖不同主题和场景
- [x] Checkpoint 9: 题集应去重，问题表达方式应清晰明确
- [x] Checkpoint 10: 标注应包含期望答案要点、期望引用和期望命中内容
- [x] Checkpoint 11: 标注应清晰明确，便于后续评估
- [x] Checkpoint 12: 文档集版本应固定，有明确的版本标识
- [x] Checkpoint 13: 文档集应包含足够的内容，覆盖不同类型和场景
- [x] Checkpoint 14: demo case 应覆盖不同场景和功能
- [x] Checkpoint 15: demo case 应可复跑，展示系统的核心功能和优势

## P6: 运行观测 / 审计补强
- [x] Checkpoint 16: 运行 `node --test --test-name-pattern "usage page" apps/web/test/ui-review-regressions.test.js` 测试通过
- [x] Checkpoint 17: Usage 页面应清晰可读，功能完整
- [x] Checkpoint 18: 运行 `node --test --test-name-pattern "report center" apps/web/test/ui-review-regressions.test.js` 测试通过
- [x] Checkpoint 19: Report center 应清晰可读，功能完整
- [x] Checkpoint 20: 运行 `node --test --test-name-pattern "trace detail" apps/web/test/ui-review-regressions.test.js` 测试通过
- [x] Checkpoint 21: Trace Detail 应清晰可读，功能完整
- [x] Checkpoint 22: 运行 `git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md docs/current-dev-setup.md` 无错误

## 总体验证
- [x] Checkpoint 23: 所有任务的测试用例都应通过
- [x] Checkpoint 24: 代码质量符合 TypeScript 严格编码规则，无 TypeScript 错误
- [x] Checkpoint 25: 遵循项目的架构设计规范和质量控制流程
- [x] Checkpoint 26: 每个任务的实现符合项目整体技术框架
- [x] Checkpoint 27: 完成全面测试，包括单元测试、集成测试和功能验证
- [x] Checkpoint 28: 提交完整的开发文档和测试报告