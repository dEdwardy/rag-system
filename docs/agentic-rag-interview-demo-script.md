# Agentic RAG Interview Demo Script

> 目的：给当前项目提供一份可直接照着讲的 agentic RAG 演示脚本。
> 建议时长：8 到 15 分钟。
> 适用场景：AI 全栈开发面试、项目 walkthrough、技术交流演示。

## Demo Goal

这次演示要讲清楚 4 件事：

- 这是一个真实可用的 RAG 应用，不只是 demo 页面
- 它已经在 ask 主路径上做了最小 agent 化
- 它的 route / execution 行为是可观测的
- 默认用户路径是完整且可维护的

## One-Sentence Project Summary

可以先用一句话介绍：

> 这是一个以单主知识库为默认产品路径的 RAG 系统，我在现有问答主链路上补了一个最小 agent 化入口，让系统先判断问题类型，再走知识库问答、外部 source 路径或确定性策略回复，同时把 route 和 execution 信息完整写进 trace，方便排查和演示。

## Demo Structure

建议按下面顺序演示：

1. 先展示默认 assistant 主路径
2. 再展示三类 ask route
3. 再展示 trace / metadata
4. 最后总结系统设计取舍

如果你希望演示素材尽量复用仓库里已经固定的 demo/eval 口径，而不是单独维护一套面试话术，优先参考：

- `apps/api/scripts/p5-baseline-manifest.v1.json`：固定了当前可复用的问题基线，尤其适合复用 capability summary、supported source families、no-hit guardrail 这几类问法
- `apps/api/scripts/p5-demo-shortlist.json`：固定了当前认可的 demo surface short list，便于把现场演示控制在 `ask-happy-path`、`no-hit-guardrail`、`source-backed-answer`、`eval-report-replay`

这样面试脚本、click walkthrough、手工验证口径会更容易保持一致。

## Part 1: Default Assistant Main Path

页面：`AssistantPage`、`ChatPage`

你可以这样讲：

> 这个系统当前仍然以默认 assistant 和默认知识库为主路径。新用户进入后会得到 bootstrap 或 repair 之后的默认 assistant，页面会引导先上传资料，再开始提问。这样主路径比较简单，不会一上来就把用户暴露给多知识库、多 agent 配置。

现场动作：

- 打开 assistant 页面
- 展示空态或 ready 状态
- 上传一份小文档
- 切到 chat 页面

你要强调：

- 默认路径是产品主线
- agent 化不是另起炉灶，而是叠在已有主路径上

## Part 2: Knowledge-Base Ask

你可以这样讲：

> 第一类问题是最常见的 knowledge-base ask。系统会优先按知识库问答路径处理，回答会保留 citations，并且能通过 trace 回看。

现场动作：

- 问一个明确来自上传文档的问题
- 展示回答结果

优先可复用问法：

- “Summarize one key capability of this knowledge base and cite evidence.”
- 如果你的上传文档不是能力说明文档，再退回到更贴近内容本身的问题

你要强调：

- 这是主路径，不是被 agent 化破坏掉的旧路径
- citations 和 trace 能说明这不是纯聊天机器人瞎答

## Part 3: Deterministic Policy Ask

你可以这样讲：

> 第二类问题不是知识库事实问答，而是能力边界或策略问题。这里我没有让系统强行检索，而是让 ask 入口先做轻量 route decision，走一个更稳定的 deterministic reply path。

现场动作：

- 问一个能力边界问题
- 展示系统返回策略型回答

优先可复用问法：

- “你能访问我没有上传的私有文件吗？”
- “如果当前资料里没有证据，你会怎么回答？”

你要强调：

- 并不是所有问题都应该走 retrieval
- 这是最小 agent 化里很有价值的一步

## Part 4: External-Source Ask

你可以这样讲：

> 第三类问题是显式 external-source ask。用户给出明确 source 时，系统会走 external-source route，而不是混进默认知识库问答。

现场动作：

- 输入一个网页 URL 或 markdown 链接形式的 explicit source
- 再基于它提问

你要强调：

- route behavior 是明确区分的
- source route 不会和默认 KB ask 混淆

## Part 5: Trace and Metadata

页面：`TraceListPage`、trace detail 页面

你可以这样讲：

> 这个项目里我很强调 observability。因为 agentic 系统如果只有结果、没有过程，是很难维护的。所以 ask route、route reason、execution mode、tool names、execution plan 这些信息都会进入 trace summary 或 detail。

现场动作：

- 打开 trace list
- 选一条 knowledge-base ask
- 再选一条 policy 或 external-source ask
- 打开 detail

你要强调：

- route type
- route reason
- execution mode
- execution tool names
- source 支撑信息

一句常用总结：

> 这让系统从“看起来会回答”提升到“能解释为什么这么回答”。

## Part 6: Design Tradeoffs

你可以主动讲你的取舍：

> 我没有直接做 planner 或 multi-agent，而是先在现有 RAG 主链路上补一个最小 route decision 层。因为在这个项目阶段，更重要的是默认路径稳定、trace 可观测、行为可解释，而不是一次性引入复杂自治架构。

可以再补一句：

> 这样做的好处是主路径不被打散，用户体验稳定，后面如果还要继续补 agent 能力，也有清晰的演进起点。

## Part 7: Engineering Depth Talking Points

如果面试官继续追问，可以讲：

- 我如何把 route decision 和 route-specific execution 解耦
- 我如何把 route / execution metadata canonical 化
- 我为什么保留单主知识库语义，不急着做多 agent / planner
- 我如何通过 trace 提升排障效率
- 我如何通过 loop-runtime / queue 自动收敛伪失败，提高自动化迭代稳定性

## Suggested Short Demo Flow

如果只有 5 到 8 分钟，可以用这条短路径：

1. 打开 assistant 页面，讲默认主路径
2. 问一个知识库问题
3. 问一个 policy 问题
4. 展示 trace summary / detail
5. 用一句话总结最小 agent 化设计

## Suggested Long Demo Flow

如果有 10 到 15 分钟，可以用这条长路径：

1. 默认 assistant / upload-first 路径
2. knowledge-base ask
3. policy ask
4. external-source ask
5. trace summary / detail
6. route / execution metadata
7. 设计取舍与后续演进方向

## Closing Summary

最后可以用这段话收尾：

> 这个项目不是把 RAG 和 agent 分成两套系统，而是在现有可用的 RAG 主路径上补了一个最小 agent 化入口，再通过 trace 把 route 和 execution 过程做可观测。这样既保住了默认产品路径，也让系统具备了继续演进成更强 agent 能力的基础。
