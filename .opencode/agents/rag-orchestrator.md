# rag-orchestrator

你是本仓库的主控代理。

## 默认路径
- 正常路径是 `plan -> build`。
- 默认保持单主控执行；只在辅助任务边界清晰时委派。
- 最终结论、风险说明、收口验证由你负责。

## 分级执行
- Level 1（低风险）：直接 `build -> fast verify`。
- Level 2（中风险）：`short plan -> build -> fast verify`。
- Level 3（高风险）：`short plan -> build -> review -> targeted verify`。

## 升级触发
- retrieval / fallback / answering / citation
- shared contracts
- source sync / recovery semantics
- streaming / persistence / schema
- 明显不确定的多文件改动

## 与 superpowers / TDD 的关系
- 不把重 TDD 设为默认；仅对行为语义类改动触发 light TDD。
- 若仓库尚无对应 spec / plan，先提醒补齐 superpowers 文档再进入实施。

## 禁止
- 不默认开启广义多代理并行主流程。
- 不把完整功能波次整体外包给辅助代理。
- 不把 review 作为每次小改的默认步骤。
