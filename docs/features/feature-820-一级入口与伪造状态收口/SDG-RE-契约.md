# SDG-RE-契约 · feature-820 一级入口与伪造状态收口

> 卡口：**K1 零触发**（`shared/types.ts` 无 diff）、**K8 零触发**（零新增/变更 IPC，只消费既有 `settings:ai:get` / `runtime:status` / `settings:comfy:list`）、**K9 零触发**（`package.json` 无 diff）。
> 本契约的「必须」项实现不得偏离；未列项按现有实现保持不变。

## 1. 底栏状态条

### 1.1 渲染条件

```
hasProject = canvasLoaded && canvas.projectId !== ''   // feature-812 既有权口径
底栏仅在 hasProject === true 时渲染；无项目 / 首拉未回 → 整块不渲染
```

### 1.2 数据源与展示映射

| 槽位 | 数据源 | 正常展示 | 未知/失败展示 | 色点 |
| --- | --- | --- | --- | --- |
| 文本服务 | `window.api.settings.ai.get()` → `summarizeActiveProvider()` | `文本 · {label}` + `{model}`；未配置追加 `未配置 Key` / `未配置地址` | `文本服务未读取` | 已配置 `bg-violet`；未配置 `bg-warn`；未知 `bg-line`（**不得**用 `bg-ok`） |
| 运行时 | `window.api.runtime.status()` + `runtime.onStatusChange`（可选调用） | `running`/`healthy` → `运行时 · 运行中`（`bg-ok`）；`running`/`!healthy` → `运行时 · 未就绪`（`bg-warn`）；`starting` → `运行时 · 启动中`（`bg-warn animate-pulse`）；`error` → `运行时 · 异常`（`bg-bad`）；`stopped` → `运行时 · 未启动`（`bg-line`） | `运行时未读取`（`bg-line`） | 同左 |
| ComfyUI | `window.api.settings.comfy.list()` | 仅陈述配置数量：`ComfyUI 已配置 {enabled}/{total} 启用` | `ComfyUI 未读取` / `ComfyUI 未配置` | 有配置 `bg-violet`，否则 `bg-line`；**不得**声明在线 / 绿点 |
| 更新时间 | `canvas.updatedAt` | `画布更新于 HH:MM`（`toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})`）；非法时间不渲染 | 不渲染 | — |

**禁止项**：固定端口、批量进度、Harness 计数、相对时间自动保存等任何无数据源的值。

### 1.3 读取与订阅语义

- 每个槽位独立 `try/catch`：任一失败只影响该槽位（置 `null`），不得阻断其他槽位。
- 依赖项：`hasProject`、`canvas.projectId`；项目切换时重读全部槽位。
- `runtime.onStatusChange` 可选调用（测试桩可能不提供该桥）：存在则订阅并只更新运行时槽位，卸载/切项目时必须退订。
- 异步回写前检查 `alive`，防止切项目后旧结果覆盖新状态。

## 2. 左栏面板

### 2.1 Skill 广场

- 面板顶部固定说明：`Skill 市场尚未接入，以下为内置示例目录，暂不可执行。`
- 类目按钮由卡片 `cat` 去重生成：`['全部', ...Set(cat)]`；点击后按 `cat === '全部' || s.cat === cat` 与搜索词**同时**过滤。
- 卡片**必须**带 `未开放` 标识；**禁止**保留无 `onClick` 的「在对话中试用 →」。

### 2.2 专业插件

- 删除开关（`role="switch"` 在本应用内应为 0 处）；每条插件固定 `未开放` 标识。
- 面板顶部说明：`插件能力未开放：以下为规划中的插件，当前不可启用。`
- 数据模型中不得保留 `defaultOn` 等伪开关字段。

### 2.3 本地模型（一级入口）

- 资源库图标轨新增 `local` 页签，标题 `本地模型`。
- 面板内容只陈述未开放范围与现有替代路径，不提供可执行操作按钮，唯一动作是 `打开 AI 服务设置`（复用既有 `AiServicePanel`，`onOpenAiSettings` 由 `StudioApp` 注入 `setAiPanelOpen(true)`）。
- 文案必须点明：文本服务走 AI 服务设置（火山方舟 / LM Studio），图像 / 视频 / 音乐走本地 / 局域网 ComfyUI。

## 3. 架构约束（C7）

`src/studio/architecture.test.ts` C7 断言禁止除 `shell/AiServicePanel.tsx` 外的 `shell` 文件出现服务商字面量（`ark` / `opencode` / `ComfyUI` 等）。因此：

- 服务商差异（label / model / keyConfigured / 未配置文案）**必须**由 `AiServicePanel.tsx` 导出的 `summarizeActiveProvider(view)` 提供；
- 其他 shell 文件只能消费该结果，不得出现服务商字面量。

## 4. 不变项

- `shared/types.ts`、`electron/preload.ts`、`src/global.d.ts`、`package.json` 零 diff。
- ChatComposer 的 dev-mock 演示消息注入逻辑不变。
- 无项目态整块不渲染底栏、无 IPC 副作用（沿用 feature-812）。
