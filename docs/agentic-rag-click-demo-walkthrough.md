# Agentic RAG Click Demo Walkthrough

> 目的：提供一份可以直接照着点击、照着讲的 agentic RAG 演示脚本。
> 适用场景：项目演示、面试 walkthrough、录屏说明。
> 设计原则：少切页面、少讲抽象概念、每一步都能解释“为什么这样设计”。

## Demo Length Options

- 5 分钟版本：只走默认路径 + 一次 KB ask + 一次 policy ask + trace
- 10 分钟版本：再加 external-source ask
- 15 分钟版本：再加默认路径 coherence 和设计取舍总结

## Before You Start

开始前确保：

- API 和 Web 都已启动
- 你能正常登录
- 你有一份小文档可以上传
- 你准备了一个稳定网页 URL 作为 external source

建议素材：

- 一个内容明确的 markdown / txt
- 一个公开可访问网页

如果你想尽量复用仓库里已经固定下来的演示问题口径，而不是临场现编，优先对齐这两份仓库内资产：

- `apps/api/scripts/p5-baseline-manifest.v1.json`：当前仓库里已固定的 demo/eval 问题基线，适合复用其中的 capability summary、supported source families、no-hit guardrail 这类问法
- `apps/api/scripts/p5-demo-shortlist.json`：当前仓库里已固定的 demo surface short list，适合把现场演示收敛到 `ask-happy-path`、`no-hit-guardrail`、`source-backed-answer`、`eval-report-replay`

这次 click demo 不需要直接运行 eval replay，但讲解口径最好和这两份资产保持一致，这样 walkthrough、trace 展示和后续手工验证不会各说各话。

## Demo Route Overview

建议你按这条路径演示：

1. `AssistantPage`：展示默认主路径
2. 上传文档：建立知识库问答上下文
3. `ChatPage`：演示 KB ask
4. 在 `ChatPage`：演示 policy ask
5. 继续在 `ChatPage` 或当前 external-source 入口：演示 external-source ask
6. `TraceListPage`：展示 route / execution 可观测性
7. trace detail：解释 why/how
8. 回到结论：说明这是最小 agent 化，而不是多 agent 平台

## Part 1: Open the Assistant Page

页面：`AssistantPage`

点击顺序：

1. 打开 assistant 页面
2. 停 3 到 5 秒，不要马上切走
3. 指给对方看空态、按钮、next action

你可以说：

> 这个系统的默认产品路径仍然是默认 assistant 加默认知识库。用户进入后会被引导先上传资料，再开始提问。我没有一上来做多 agent 配置页，而是先把默认路径做稳。

你要确认现场能看到：

- 默认 assistant 正常存在
- 如果没有资料，页面会引导上传
- 没有误导成“现在就能稳定回答任何问题”

## Part 2: Upload a Small Document

页面：仍在 `AssistantPage` 或当前上传入口

点击顺序：

1. 点击上传相关入口
2. 选择你准备好的小文档
3. 等待处理完成
4. 不要急着提问，先停一下展示状态变化

你可以说：

> 这条路径还是标准 RAG 主路径。资料上传后会被处理进默认知识库，用户接下来就能直接进入问答。agent 化不是替代这条主路径，而是叠在这条主路径上面做更轻量的决策。

你要确认现场能看到：

- 状态从空态进入 ready
- 没有明显报错
- 页面引导从“上传资料”变成“可以继续提问”

## Part 3: Switch to Chat and Ask a Knowledge-Base Question

页面：`ChatPage`

点击顺序：

1. 切到 chat 页面
2. 输入一个明确来自文档的问题
3. 提交问题
4. 等待回答出现

推荐问题：

- “Summarize one key capability of this knowledge base and cite evidence.”
- “文档里列了哪几个步骤？”

你可以说：

> 第一类问题是最常见的 knowledge-base ask。这里系统会走知识库问答主路径，回答会保留 citations，后面我会去 trace 里解释它为什么这么回答。

你要确认现场能看到：

- 回答明显基于文档
- 没有明显胡编
- 如果 UI 显示 citations，可以顺手指出

## Part 4: Ask a Policy-Type Question

页面：仍在 `ChatPage`

点击顺序：

1. 在同一 chat 里继续提问
2. 问一个能力边界 / policy 型问题
3. 等待回答

推荐问题：

- “你能访问我没有上传的私有文件吗？”
- “如果当前资料里没有证据，你会怎么回答？”

你可以说：

> 第二类问题不适合硬走知识库检索。我在 ask 入口加的是一个最小 route decision 层，这类问题会优先走更稳定的 deterministic reply，而不是伪装成检索结果。

你要确认现场能看到：

- 回答更像稳定策略说明
- 不是“像 KB 检索那样”的回答风格
- 没有胡乱 citations

## Part 5: Ask an External-Source Question

页面：`ChatPage` 或当前支持的 explicit source 入口

点击顺序：

1. 准备一个稳定网页 URL
2. 通过当前支持的方式输入 explicit source（优先用裸 URL 或 markdown 链接）
3. 再基于这个 source 提问
4. 等待回答

你可以说：

> 第三类问题是 explicit external-source ask。用户显式给出 source 时，系统会走 external-source branch，而不是和默认知识库问答混在一起。

你要确认现场能看到：

- 回答与网页内容相关
- 如果页面有 source 提示或 trace 链接，可以指出

如果现场 external-source 入口不够直观，你可以补一句：

> 这个项目当前主线重点仍然是最小 agent 化和默认路径收口，所以 external-source branch 是明确存在的，但没有扩成一个复杂 agent workflow 平台。

## Part 6: Open Trace List

页面：`TraceListPage`

点击顺序：

1. 打开 trace list
2. 找到刚才的 KB ask 记录
3. 找到 policy ask 或 external-source ask 记录
4. 如果有筛选器，适当演示 route 过滤

你可以说：

> 这个项目里我很强调 observability，因为 agentic 系统如果不能解释 route 和 execution，就很难维护。这里我把 route type、route reason、execution mode、tool names 都做进了 trace summary。

你要确认现场能看到：

- route type
- route reason
- execution mode
- tool names 或相关摘要

## Part 7: Open Trace Detail

页面：trace detail 页面

点击顺序：

1. 打开一条 KB ask trace
2. 再打开一条 policy 或 external-source trace
3. 展示 detail 中的 metadata / support panels

你可以说：

> 这里的目标不是只看“结果对不对”，而是能解释“为什么走了这条路”。所以我会把 route reason、execution mode、tool names 以及 external-source 支撑信息都放到 trace detail 里。

你要确认现场能看到：

- summary / detail 信息一致
- external-source 情况下 source 信息可见
- route / execution 解释链是连贯的

## Part 8: Return to the Product Narrative

不用再切很多页面，直接收尾。

你可以说：

> 这个项目不是把 RAG 和 agent 分成两套系统，而是在现有可用的 RAG 主路径上补了一个最小 agent 化入口，让系统先判断问题类型，再决定走哪条现有链路。同时我把 route 和 execution 信息都写进 trace，所以它不仅能工作，还能解释自己为什么这么工作。

## Suggested 5-Minute Version

只做这些：

1. `AssistantPage` 展示默认路径
2. 上传文档
3. `ChatPage` 做一次 KB ask
4. `ChatPage` 做一次 policy ask
5. `TraceListPage` + detail 展示 route / execution

## Suggested 10-Minute Version

在 5 分钟版基础上增加：

1. external-source ask
2. trace detail 对比 KB / policy / external-source 三类路径

## Suggested 15-Minute Version

在 10 分钟版基础上增加：

1. 刷新页面验证默认路径 coherence
2. 解释 default assistant / default KB 设计
3. 解释为什么没有直接做 planner / multi-agent

## Common Demo Mistakes to Avoid

- 不要一开始就讲很多架构抽象，先让页面和行为说话
- 不要只展示“它能回答”，要展示“它为什么这么回答”
- 不要跳太多页面，尽量围绕 assistant -> chat -> traces 这条路径
- 不要把项目讲成 multi-agent 平台，这不是当前主线
- 如果 external-source 现场不稳定，不要硬撑，可以重点讲 KB + policy + trace

## One-Sentence Closing

如果最后只留一句话，可以说：

> 这个项目的核心不是把 agent 做得很复杂，而是把一个真实可用的 RAG 主路径，升级成一个可决策、可观测、可解释的最小 agentic 系统。
