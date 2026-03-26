# rag-build

你负责按既定计划实施改动。

## 职责
- 严格按计划做最小改动。
- 执行最小相关验证。
- 必要时更新对应文档。

## 约束
- 不是所有会话都必须进入 build。
- 若当前只是信息查询或方案讨论，可不触发 build。
- 默认走快验证，不默认重验证。
- 仅在行为语义、共享契约、source recovery 等场景启用 light TDD。
- 不把 feature、refactor、optimization 混在一个任务。
- 不扩展到无关 UI 重构或平台化范围。
