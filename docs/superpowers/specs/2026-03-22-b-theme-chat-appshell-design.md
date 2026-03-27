# B 主题 Chat + AppShell 设计稿

> 文档角色：`task-spec`
> 当前使用方式：用于记录以历史概念稿 `ui/version-b-creative.html` 为母版的第一阶段前端改造设计，范围限定为 `Chat + AppShell + 主题切换基础`。

## 任务识别

当前仓库的 `PC Web` 已经具备基础可用的聊天体验，但整体视觉仍停留在 MVP 阶段。用户明确希望将历史概念稿 `ui/version-b-creative.html` 作为新的主视觉方向，并逐步推广到其他页面。

第一阶段不做全站重画，而是先完成：

- `AppShell` 切换到 B 风格的工作台壳层
- `Chat` 页面切换到 B 风格主工作区
- 主题系统支持“颜色主题 + 布局主题”的动态切换基础

## 目标

把当前前端从“浅色产品页 + 页面内聊天区域”升级为“深色工作台 + 中央对话操作面”的产品形态，同时避免直接把概念稿硬搬成难维护代码。

第一阶段完成后应具备：

- `creative-dark` 颜色主题
- `workspace-app` 布局主题
- `Chat` 页面完整采用 B 的主视觉气质
- `AppShell` 与 `Chat` 不再割裂
- 后续 `Documents / Knowledge Base / Assistant` 页面可以基于相同主题令牌继续迁移

## 非目标

- 第一阶段不重画 `Documents / Knowledge Base / Assistant`
- 不做完整用户设置页
- 不做主题持久化到后端
- 不做所有概念稿动画效果的 1:1 复刻
- 不把 B 中所有装饰性视觉效果无筛选搬进真实产品

## 当前状态

当前前端的壳层和聊天页存在几个约束：

- [AppShell.tsx](../../../apps/web/src/app/AppShell.tsx) 仍是轻量浅色壳层
- [theme.ts](../../../apps/web/src/styles/theme.ts) 只有非常基础的 Mantine 主题配置
- [global.css](../../../apps/web/src/styles/global.css) 仅有全局背景和链接样式
- [ChatPage.tsx](../../../apps/web/src/pages/chat/ChatPage.tsx) 已经具备聊天主链路，但视觉仍是当前浅色方向

这意味着如果只改 `Chat`，页面和壳层会明显割裂；如果直接全站同步重画，范围又过大。

## 选定方案

采用“B 作为设计母版，但做工程化抽象”的实现方式。

### 核心原则

- B 的深色工作台方向是第一阶段默认主题
- 不直接照搬 HTML，而是拆成主题令牌和布局模式
- 把颜色与布局拆成两套可切换维度，而不是单一 dark/light 开关

### 主题模型

第一阶段建立两层主题状态：

1. `themeColor`
   - `constrained-light`
   - `creative-dark`

2. `themeLayout`
   - `default-app`
   - `workspace-app`

这允许后续组合出：

- 浅色 + 默认壳层
- 深色 + 默认壳层
- 浅色 + 工作台壳层
- 深色 + 工作台壳层

第一阶段默认采用：

- `themeColor = creative-dark`
- `themeLayout = workspace-app`

## 视觉主张

第一阶段的产品视觉应呈现为：

- 深色、沉浸、连续的工作台
- 中央聊天区是绝对主工作面
- 左右面板承担导航和证据检查职责
- 品牌色从当前 teal 过渡到 B 中的 indigo 主调
- 光效、网格、玻璃态只保留到“增强氛围”的程度，不做过量炫技

## 内容结构

### AppShell

壳层承担这些角色：

- 品牌区
- 主导航区
- 次级导航或状态区的承载位
- 用户状态和语言/主题切换入口

### Chat

聊天页继续承担四个职责：

- 会话上下文
- 主对话区
- 输入操作区
- 引用与 trace 侧边检查区

但整体应该更像一个一体化工作面，而不是若干独立卡片。

## 布局策略

### 1. AppShell

`AppShell` 从“顶部 header + 左侧 navbar”切换为更贴近 B 的结构：

- 左侧固定深色导航栏
- 头部与主体更弱化边界，减少浅色产品后台感
- 保留语言切换，同时加入基础主题切换入口

### 2. Chat

`Chat` 页面需要和新壳层统一：

- 页面顶部大 hero 消失或极度收缩
- 中央消息区更接近全高工作面
- 输入区成为显著的主操作区
- 引用侧栏与会话侧栏采用统一深色 panel 语言

### 3. Theme Tokens

主题令牌需要抽到集中位置，而不是散落在行内样式里。

第一阶段至少抽出：

- 背景色
- 面板色
- 文本层级色
- 边框色
- 主 accent 色
- 阴影 / 发光
- 圆角
- 面板宽度

## 交互主张

保留少量有价值的动态反馈：

- 当前导航和会话选中态
- 输入区 focus glow
- 流式消息中的轻微动态状态提示
- hover 与 panel 过渡

不在第一阶段引入复杂动效框架或大规模滚动叙事效果。

## 工程策略

### 1. 主题状态来源

第一阶段主题切换可以先放在前端本地状态和 `localStorage` 中，不需要后端配置支持。

### 2. Mantine 集成方式

Mantine 主题只负责基础 token 和组件默认值；更具体的布局视觉通过：

- `data-theme-color`
- `data-theme-layout`
- 全局 CSS 变量

来驱动。

这样后续页面迁移时，不需要每个页面都手写一套完全独立样式。

### 3. 范围控制

第一阶段主要修改：

- [AppShell.tsx](../../../apps/web/src/app/AppShell.tsx)
- [ChatPage.tsx](../../../apps/web/src/pages/chat/ChatPage.tsx)
- [theme.ts](../../../apps/web/src/styles/theme.ts)
- [global.css](../../../apps/web/src/styles/global.css)

如果需要，可以新增一个专门管理主题状态的小文件，但不应扩散成大范围重构。

## 备选方案

### 1. 只改 Chat，不改 AppShell

优点：

- 改动最小

缺点：

- 页面和壳层割裂明显
- 无法把 B 作为后续设计母版

未采用。

### 2. 先做完整全站主题系统，再做页面替换

优点：

- 架构最完整

缺点：

- 第一阶段反馈慢
- 范围过大

未采用。

### 3. 先改 Chat + AppShell，并抽出基础主题令牌

优点：

- 视觉结果立即可见
- 为后续页面铺路
- 范围可控

缺点：

- 第一阶段和其他页面仍会暂时不一致

采用。

## 测试

第一阶段验证以最小有效集为主：

- `pnpm --filter @rag-system/web build`
- 现有 chat focused tests 不回归
- 如果新增主题切换辅助函数，则补 focused test

## 文档

如果实现落地，需要更新：

- `docs/current-progress.md`
- 如有必要，补充 `docs/current-dev-setup.md` 中对当前主题方向的说明

## 验收标准

- `AppShell` 和 `Chat` 同时切到 B 风格主方向
- 前端具备基础的颜色主题和布局主题切换能力
- 当前默认主题是 `creative-dark + workspace-app`
- 主题令牌集中管理，而不是大量散落硬编码
- `Chat` 仍保持现有流式问答与引用行为不变
- 其他页面暂不重画，但后续迁移路径清晰
