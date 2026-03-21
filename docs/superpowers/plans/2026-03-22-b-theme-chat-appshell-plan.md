# B 主题 Chat + AppShell 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 以 B 方案为主视觉方向，重建 Web 壳层和聊天页，并补齐可切换的颜色主题与布局主题基础设施。

**架构：** 保持当前聊天数据流和流式行为不变。新增一层轻量主题状态，统一主题令牌，在此基础上重写 `AppShell` 与 `ChatPage` 的视觉和布局。应用默认采用 `creative-dark + workspace-app`，同时保留本地切换能力。

**技术栈：** React 19、Mantine、React Router、Vite、CSS Variables、Node Test Runner

---

## 文件结构

- 修改：`apps/web/src/app/AppShell.tsx`
  - 将壳层改为 B 风格工作台结构，并暴露主题切换入口
- 修改：`apps/web/src/pages/chat/ChatPage.tsx`
  - 让聊天页与新壳层统一到 B 风格
- 修改：`apps/web/src/styles/theme.ts`
  - 定义与颜色主题、布局主题配合的 Mantine 基础 token
- 修改：`apps/web/src/styles/global.css`
  - 定义全局 CSS 变量和主题模式选择器
- 新增：`apps/web/src/app/theme-preferences.ts` 或同类文件
  - 负责主题颜色和布局模式的本地状态与持久化
- 测试：`apps/web/test/chat-stream-state.test.js`
- 测试：`apps/web/test/chat-page-helpers.test.js`
- 可选测试：`apps/web/test/theme-preferences.test.js`
- 修改：`docs/current-progress.md`

## 任务 1：增加主题模式状态与失败测试

**文件：**
- 新增：`apps/web/src/app/theme-preferences.ts`
- 新增或修改：`apps/web/test/theme-preferences.test.js`

- [ ] **步骤 1：先写主题默认值的失败测试**

锁定以下行为：

- 默认颜色主题为 `creative-dark`
- 默认布局主题为 `workspace-app`
- 非法存储值会安全回退

- [ ] **步骤 2：运行 focused test，确认它先失败**

运行：

```bash
node --experimental-strip-types --test apps/web/test/theme-preferences.test.js
```

预期：因为 helper 还不存在而失败。

- [ ] **步骤 3：实现最小主题偏好 helper**

只实现最小必要功能：

- 安全读取 `localStorage`
- 归一化允许值
- 返回默认值

- [ ] **步骤 4：重新运行 focused test**

运行：

```bash
node --experimental-strip-types --test apps/web/test/theme-preferences.test.js
```

预期：通过。

## 任务 2：引入共享主题令牌

**文件：**
- 修改：`apps/web/src/styles/theme.ts`
- 修改：`apps/web/src/styles/global.css`

- [ ] **步骤 1：定义颜色主题与布局主题变量组**

至少抽出这些 CSS 变量：

- app 背景
- panel 背景
- 文本层级
- 边框
- accent / glow
- 圆角
- 壳层宽度

- [ ] **步骤 2：让 Mantine 基础主题对接新的 token 方向**

保持 Mantine 集成最小化，只覆盖：

- 字体
- 主色
- 圆角
- 深色主题下的基础假设

- [ ] **步骤 3：运行 web build，确认 token 变更可编译**

运行：

```bash
pnpm --filter @rag-system/web build
```

预期：构建成功。

## 任务 3：把 AppShell 改成 B 风格工作台

**文件：**
- 修改：`apps/web/src/app/AppShell.tsx`
- 修改：`apps/web/src/app/theme-preferences.ts`

- [ ] **步骤 1：把主题模式属性挂到壳层根节点**

暴露：

- `data-theme-color`
- `data-theme-layout`

- [ ] **步骤 2：把壳层重构为工作台导航框架**

实现：

- 深色左侧导航栏
- 更强的品牌区
- 更清晰的导航分组感
- 语言切换和主题切换入口

- [ ] **步骤 3：保持路由行为不变**

不要修改：

- 路由结构
- 导航目标

- [ ] **步骤 4：再次运行 web build**

运行：

```bash
pnpm --filter @rag-system/web build
```

预期：壳层改动后仍可构建成功。

## 任务 4：让 ChatPage 对齐新的 B 主题

**文件：**
- 修改：`apps/web/src/pages/chat/ChatPage.tsx`
- 测试：`apps/web/test/chat-stream-state.test.js`
- 测试：`apps/web/test/chat-page-helpers.test.js`

- [ ] **步骤 1：改动前先重新跑现有 focused chat tests**

运行：

```bash
node --experimental-strip-types --test apps/web/test/chat-stream-state.test.js
node --experimental-strip-types --test apps/web/test/chat-page-helpers.test.js
```

预期：通过，并确认当前行为基线。

- [ ] **步骤 2：按工作台壳层重做聊天页构图**

调整方向：

- 去掉或极度收缩当前浅色 hero 感
- 让 transcript 成为最强主工作面
- 让侧栏 panel 与壳层语言统一

- [ ] **步骤 3：只改视觉，不改聊天行为**

这些逻辑不应变化：

- 流式协议处理
- 引用展示行为
- query invalidation 行为

- [ ] **步骤 4：重新运行 focused chat tests**

运行：

```bash
node --experimental-strip-types --test apps/web/test/chat-stream-state.test.js
node --experimental-strip-types --test apps/web/test/chat-page-helpers.test.js
```

预期：通过。

## 任务 5：最终验证与文档更新

**文件：**
- 修改：`docs/current-progress.md`

- [ ] **步骤 1：更新进度快照**

记录当前前端正在转向 B 风格主题，且第一阶段范围为：

- `Chat`
- `AppShell`
- 可切换主题基础

- [ ] **步骤 2：运行最终 web build**

运行：

```bash
pnpm --filter @rag-system/web build
```

预期：构建成功。

- [ ] **步骤 3：确认范围边界**

确认：

- `Documents / Knowledge Base / Assistant` 功能层面保持不动
- 默认主题为 `creative-dark + workspace-app`
- 本地存在主题切换能力
- 聊天行为与当前实现保持一致
