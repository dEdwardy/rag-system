# Web 验收清单

前端页面的可执行自检清单。每条命令都对应一类真实缺陷，改动前端后建议按需运行；发布前建议全跑。

所有命令都需要本地前后端已启动：

```bash
pnpm --filter @rag-system/api start:dev     # :3000
pnpm --filter @rag-system/web dev            # :5173
```

## 一、五条自检命令

| 命令 | 覆盖 | 耗时 | 失败含义 |
|---|---|---|---|
| `pnpm --filter @rag-system/web audit:pages` | 12 个页面的 loading / empty / error 分支，全部站内链接是否指向存在的路由 | 秒级 | 某页缺状态分支，或出现死链 |
| `pnpm --filter @rag-system/web smoke:routes` | 10 条应用路由 + 2 条公开路由的真实浏览器渲染，控制台错误与页面异常 | 约 30 秒 | 页面报 200 但渲染空白、或运行时报错 |
| `pnpm --filter @rag-system/web smoke:citation` | 提一个问题 → 答案里的 `[n]` 徽标可点 → 打开来源面板 | 约 40 秒 | 引用编号退化成纯文本，或来源面板打不开 |
| `pnpm --filter @rag-system/web smoke:locale` | 中 → 英 → 中双向切换，导航文案是否跟随、英文态是否残留中文 | 约 20 秒 | 切换失效或文案漏翻 |
| `pnpm --filter @rag-system/web smoke:reports` | 打开评测页、必要时真跑一次质量检查、六个指标卡片是否带真实数值 | 约 40 秒（含一次运行） | 指标卡片不渲染或显示占位符 |

加上静态校验：

```bash
pnpm --filter @rag-system/web typecheck      # 类型
pnpm --filter @rag-system/web test:guard     # 63 条 guard 测试（含 i18n 对齐、导航标题唯一性）
pnpm check:encoding                          # UTF-8 无 BOM、无乱码
pnpm lint                                    # oxlint
```

## 二、浏览器脚本的环境要求

脚本用 Playwright 驱动缓存里的 Chromium。若本机 Playwright 版本与缓存浏览器版本不一致，用环境变量指定可执行文件，避免重新下载：

```powershell
$env:SMOKE_CHROMIUM_PATH = "$env:LOCALAPPDATA\ms-playwright\chromium-1217\chrome-win64\chrome.exe"
```

登录信息默认 `default-user@example.com` / `local-password-1`，可用 `SMOKE_EMAIL` / `SMOKE_PASSWORD` 覆盖。评测页的题集与助手可用 `SMOKE_QUESTION_SET` / `SMOKE_ASSISTANT` 覆盖。

## 三、写断言时的两条硬规则

这两条都是实际踩过的坑，不是理论建议。

1. **先打印实际文案，再写断言。** 已经两次因为猜文案而误报："资料库"的英文是 `Library` 而不是 `Documents`，评测页按钮是「开始质量检查」而不是"运行质量检查"。做法：`page.locator('button').evaluateAll(...)` 打印一遍，再写选择器。
2. **测试报错时先怀疑测试。** 上述两次都是断言写错、产品是对的。先确认产品行为，再判定缺陷。

## 四、已修问题与对应验证

| 问题 | 验证方式 |
|---|---|
| 拒答时把原始模型 JSON 当答案返回 | `apps/api/test/llm.test.js` 回归用例 |
| 会话复用返回存档里的原始 JSON | `apps/api/test/reused-answer-content.test.js` |
| 消息接口不返回 citations，引用徽标无法解析 | `apps/api/test/messages.service.test.js` + `smoke:citation` |
| `reportResultsTable` 38 个中文 key 全被写成 `?` | `smoke:reports` 断言无 `??` 占位符 |
| 6 个英文 key 在中文目录缺失 | `apps/web/test/i18n-copy.test.js` 对齐用例 |
| 中文侧边栏分组标题与导航项同名 | `apps/web/test/i18n-copy.test.js` 标题唯一性用例 |
| 4 个源文件带 BOM | `pnpm check:encoding` + `pnpm lint` |

## 五、尚未覆盖的部分

- **键盘可达与焦点顺序**：需要人工用 Tab 走查
- **颜色对比度**：需要工具或人工判断
- **移动端布局**：脚本只跑桌面视口
- **空库 / 超长标题等边界数据**：需要构造专用数据集

## 六、维护约定

- 新增页面时，同步更新 `audit-page-states.mjs` 里的豁免名单（若有合理的缺态）
- 新增 smoke 脚本后，在 `apps/web/package.json` 里加同名命令，并在此表登记
- 修复问题时优先把「能复现该问题的最小断言」加进对应脚本或测试，而不是只改代码
