# feature-804 Windows 窗口标题栏 · 需求规格

> 任务包性质：**缺陷修复 + 形态对齐**。修复窗口外壳在 Windows 上无最小化/最大化/关闭按钮的实际缺陷，并按 MiniMax Design Windows 版形态在自绘顶栏补齐窗口控制。
>
> 事实源：应用外壳 [electron/main.ts](../../../electron/main.ts) `createWindow`、[electron/preload.ts](../../../electron/preload.ts)、顶栏 [src/studio/StudioApp.tsx](../../../src/studio/StudioApp.tsx)；MiniMax Design Windows 版截图（用户 2026-10-13 提供）。设计书 [短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §3.x（L290/L383）规定 titlebar 承载八步 STAGE 进度轨，但未规定原生窗口外壳，本包补齐该未覆盖面。
>
> 解决偏差：[设计现状与偏差清单.md](../../设计现状与偏差清单.md) **B-10**（`titleBarStyle:'hiddenInset'` 是 macOS 专用项，Windows 退化为无任何窗口控制按钮的无边框窗口）。
>
> 溯源标签：**[改编]**（窗口控制三按钮的形态对齐 MiniMax Design；复用平台既有自绘顶栏与 `-webkit-app-region` 拖拽机制，底层以 Electron 原生窗口能力自行实现，不复用其闭源代码）。

## 1. 背景

现状（2026-10-13 盘点，均经磁盘核对）：

- [main.ts](../../../electron/main.ts) L25-37：`new BrowserWindow({ titleBarStyle: 'hiddenInset', ... })`。`hiddenInset` 是 **macOS 专用**取值（红绿灯内缩、内容延伸到标题栏）；在 Windows 上 Electron 将其退化为「无原生标题栏、无任何控制按钮」的无边框窗口——用户无法最小化、最大化/还原、关闭窗口（只能 Alt+F4 / 任务栏右键）。这是真机缺陷，不是样式偏差。
- renderer 已有自绘顶栏（[StudioApp.tsx](../../../src/studio/StudioApp.tsx) L297-367）：高 44px（`h-11`）、白底、`WebkitAppRegion:'drag'` 整栏可拖拽、左侧 `pl-20`（80px，专留给 macOS 红绿灯）、栏内承载八步 STAGE 进度轨与右侧业务控件；但**没有任何窗口控制按钮**，且 [preload.ts](../../../electron/preload.ts) **不暴露任何窗口控制 API**。
- [src/global.d.ts](../../../src/global.d.ts) L77-81 已存在 `CSSProperties.WebkitAppRegion` 模块声明，拖拽区样式无需新增类型。
- 浏览器预览（[src/dev-mock-api.ts](../../../src/dev-mock-api.ts)）在无 preload 时装空态 mock；新增窗口控制 API 必须同步补 mock 桩，否则组件在浏览器预览下读 `window.api.window` 崩溃。

MiniMax Design Windows 版实测形态（截图）：窗口无原生边框；顶部约 32px 高的标题栏与内容同色、无分隔线；右上角依次为最小化 / 最大化(还原) / 关闭三按钮，命中区约 46×32；最小化与最大化 hover 为浅灰圆角块，关闭按钮 hover 为实心红 `#C42B1C` + 白色图标；最大化后图标切换为「还原」。

## 2. 谁在什么场景下要做什么

| # | 角色 | 场景 | 要做什么 | 达成效果 |
|---|---|---|---|---|
| R1 | Windows 用户 | 工作中途临时切出应用 | 点顶栏右上角「最小化」 | 窗口最小化到任务栏，与原生 Windows 应用行为一致 |
| R2 | Windows 用户 | 需要更大画布 / 还原窗口 | 点「最大化/还原」按钮 | 在最大化与普通窗口间切换；图标随状态在「最大化 ☐ / 还原 ❐」间切换 |
| R3 | Windows 用户 | 结束使用 | 点「关闭」 | 窗口关闭；应用退出/保活行为沿用 main.ts 既有 `window-all-closed` 逻辑（非 macOS 退出），本包不改该逻辑 |
| R4 | Windows 用户 | 想移动窗口位置 | 在顶栏空白处按住拖动 | 整栏拖拽移动窗口（沿用既有 `-webkit-app-region: drag`），按钮与业务控件为 no-drag 不拦截点击 |
| R5 | Windows 用户 | 快捷键/任务栏习惯 | 双击标题栏、Win+↑、拖屏边、任务栏操作 | 双击拖拽区由 Electron 原生映射为最大化/还原；Win+方向键、Aero Snap 边缘吸附等系统行为在 `frame:false` 下仍由系统保留（本包不拦截） |
| R6 | macOS 用户 | 任意时刻 | 继续使用原生红绿灯 | macOS 形态零变化：`hiddenInset` 保留、顶栏不出现自绘按钮、`pl-20` 红绿灯留白保留 |
| R7 | 浏览器预览（开发者） | `npm run dev:web` 类纯浏览器态 | 顶栏照常渲染 | mock 桩提供 no-op 窗口控制与 `platform`，三按钮可见可点不报错（点击无真实窗口效果） |

## 3. 范围

### 3.1 本包做

- [main.ts](../../../electron/main.ts)：窗口外壳选项按平台分支（Windows/Linux 走自绘无边框，macOS 保留 `hiddenInset`）；新增 `window:minimize` / `window:toggle-maximize` / `window:is-maximized` / `window:close` 四个 IPC handle 与 `window:maximize-changed` 状态推送（最大化/还原事件）。
- [preload.ts](../../../electron/preload.ts)：新增 `window` 命名空间暴露面（含 `platform` 常量与上述控制/订阅方法）。
- [src/global.d.ts](../../../src/global.d.ts)：`Window.api` 类型契约新增 `window` 段（**非 shared 层，不触发 K1**）。
- [src/dev-mock-api.ts](../../../src/dev-mock-api.ts)：同步补 mock 桩。
- 新增 renderer 组件 `src/studio/WindowControls.tsx`（三按钮 + 内联 SVG，遵守 [architecture.test.ts](../../../src/studio/architecture.test.ts) 铁律：禁 import electron、禁外链/Key）。
- [StudioApp.tsx](../../../src/studio/StudioApp.tsx)：顶栏按平台集成——Windows/Linux 左侧留白收敛、最右侧挂三按钮；macOS 不渲染按钮、留白不变。
- 单测：窗口外壳选项纯函数（主进程侧）+ WindowControls 组件交互测试。

### 3.2 本包不做（显式排除）

- **不改 `shared/types.ts`**：窗口平台/控制类型属 renderer 外壳契约，落在 `src/global.d.ts`，不进共享层（无 K1）。
- **不改八步进度轨、不改顶栏承载的任何业务控件**（视觉风格谱系、模型芯片、使用指南、导出、头像）。
- **不做深色/32px 薄标题栏改版**：不照搬截图的深色薄栏；本包沿用现有浅色 44px 顶栏，仅补窗口控制机制与三按钮（选型见 [SDG-OD-设计说明.md](./SDG-OD-设计说明.md) §2 / 变更记录 D-003）。
- 不做自定义缩放边框（resize border）/ 自绘阴影；`frame:false` 下 Windows 原生边缘缩放（约 6px）保留即可。
- 不做菜单栏（application menu）、不做多窗口/标签页、不做 Linux 发行版级视觉精修（Linux 按 Windows 同款自绘处理，能用到即可）。
- 不改应用退出/保活逻辑（`window-all-closed` / `before-quit` / runtime 清理钩子一律不动）。
- 不新增任何 npm 依赖（K9 不触发）；不新增 MCP 工具（与 Agent 生产链无关）。

## 4. 验收（业务层）

- AC1：Windows 下窗口右上角出现最小化 / 最大化 / 关闭三按钮；点击分别触发窗口最小化、最大化↔还原切换、关闭（真机或组件测试 + IPC 契约断言）。
- AC2：最大化后中间按钮图标切换为「还原」，还原后切回「最大化」；状态来源以主进程推送/查询为准（不只靠本地点击态）。
- AC3：hover 反馈——最小化/最大化 hover 浅灰圆角块；关闭按钮 hover 实心红 `#C42B1C` + 白色图标；命中区 46×32（与 MiniMax Design Windows 形态一致）。
- AC4：顶栏空白区域可拖拽移动窗口；三按钮与现有业务控件（进度轨、谱系入口等）不启动拖拽、点击不被拖拽吞掉。
- AC5：macOS 下窗口外壳仍是 `hiddenInset`、原生红绿灯位置与外观不变、顶栏不出现自绘三按钮、左侧 80px 红绿灯留白不变。
- AC6：浏览器预览（dev mock）下顶栏正常渲染、三按钮可见，点击不报错（no-op），`platform` 由 mock 给出。
- AC7：`src/studio` 新组件通过架构铁律扫描（无 `electron` import、无外链 URL/Key）；`npm run typecheck`、`npx tsc -b tsconfig.node.json`、`tsc -p tsconfig.preload.json` 全绿，不扩大 HEAD 既有 12 失败基线（studio-flow 10 / architecture 1 / fs-sandbox 1，及 runtime-integration 套件 1）。
- AC8：preload 暴露面、`global.d.ts` 类型、dev mock 三处 `window` 段形状一致；IPC 通道名 `window:*` 与既有通道零冲突。
- AC9：窗口选项按平台分支由可单测纯函数产出——`darwin` 输出 `{ titleBarStyle:'hiddenInset' }` 且不含 `frame:false`；`win32`/`linux` 输出 `{ frame:false }` 且不含 `titleBarStyle`。
