# feature-804 Windows 窗口标题栏 · 任务清单

> 执行依据：[需求规格](./SDG-RE-需求规格.md) + [契约](./SDG-RE-契约.md)。任务按顺序执行；每项给出改动面与自验方式。
>
> 卡口：本包**不修改 `shared/types.ts`（无 K1）**。新增 4 invoke + 1 推送 IPC 属 **K8 登记类**，窗口外壳方案（`frame:false` 全自绘 vs `titleBarOverlay` 混合）属包级选型——均在 [SDG-AI-变更记录.md](./SDG-AI-变更记录.md) D-002/D-005 固化，**须用户在 K8 卡口显式批准后方可执行 T1 及任何代码改动；批准留痕填入变更记录实施区**。

## 0. 上下文加载清单（工作围栏）

- [x] `AGENTS.md` + `docs/governance/AI-SDG-AI工具执行指令.md`
- [x] 本包 `SDG-RE-需求规格.md` / `SDG-RE-契约.md` / `SDG-OD-设计说明.md`
- [x] `短剧Agent平台设计.md` §3.x（L289-298、L383：titlebar 承载八步 STAGE 进度轨）
- [x] [electron/main.ts](../../../electron/main.ts)（`createWindow` L24-50；既有 IPC 命名与 `window-all-closed`/`before-quit` 退出链）
- [x] [electron/preload.ts](../../../electron/preload.ts)（`contextBridge` 暴露面全量；无任何窗口控制 API）
- [x] [src/global.d.ts](../../../src/global.d.ts)（`Window.api` 契约；L76-81 已有 `WebkitAppRegion` 声明）
- [x] [src/studio/StudioApp.tsx](../../../src/studio/StudioApp.tsx)（顶栏 L294-367：`h-11`/`bg-white`/`pl-20`/drag、stage-track、右侧业务控件组）
- [x] [src/dev-mock-api.ts](../../../src/dev-mock-api.ts)（`installDevMockApi`，api 对象 L278-347、挂窗 L349-350）
- [x] [src/studio/architecture.test.ts](../../../src/studio/architecture.test.ts)（禁 import/禁内容两张正则清单、遍历 studio 全部非测试 ts/tsx）
- [x] [src/studio/studio-flow.test.tsx](../../../src/studio/studio-flow.test.tsx)（window.api 部分桩 + `as unknown as Window['api']` 强转，新增必填段不破坏其编译；运行时防御在组件侧）
- [x] [src/studio/canvas-board.test.tsx](../../../src/studio/canvas-board.test.tsx)（组件测试写法参照）
- [x] [src/test/](../../../src/test/) 纯函数测试布局（manifest-state / comfy-settings 等）
- [x] `package.json`（electron ^33；`dev` 构建链含 tsc node + preload；无需新依赖）
- [x] feature-801 五文件（任务包格式模板）

围栏外文件不动：shared/types.ts、runtime/*、mcp/*、gate/*、canvas/*、project/*、fs/*、comfy/*、asset/*、Agent profiles、设计书正文（除标题栏形态对齐外均零改动）。

## 1. 原子任务

### T1 · 主进程：外壳选项纯函数 + 窗口 IPC（✅ 2026-10-13 完成）

- 新增 `electron/window/chrome.ts`：`WindowPlatform` 类型、`WindowChromeOptions`、`windowChromeOptions(platform)`（契约 §1.1 三平台分支）。
- 改 [main.ts](../../../electron/main.ts)：
  - `createWindow` 的 BrowserWindow 选项改为 `...windowChromeOptions(process.platform)`，删除硬编码 `titleBarStyle:'hiddenInset'`；宽高/min/backgroundColor/webPreferences 不变。
  - 注册 4 个 invoke handle：`window:minimize` / `window:toggle-maximize` / `window:is-maximized` / `window:close`（契约 §2）；`mainWindow` 空值守卫，不可用时返回 `WINDOW_UNAVAILABLE` 信封。
  - 在 `createWindow` 内对新建窗口绑定 `maximize`/`unmaximize` 监听，向 `mainWindow.webContents` 推 `window:maximize-changed` `{maximized}`；窗口 `closed` 置空逻辑保持现状（监听随窗口 GC）。
- 自验：`npx tsc -b tsconfig.node.json` 零新增错误；不碰退出链（`window-all-closed` / `before-quit` 行为不变）。
- AC：AC1、AC5、AC9。

### T2 · preload / 类型 / mock 三处契约同步（✅ 2026-10-13 完成）

- 改 [preload.ts](../../../electron/preload.ts)：`api` 内新增顶层 `window` 段（契约 §3：`platform: process.platform` + 4 方法 + `onMaximizeChange` 退订）。
- 改 [src/global.d.ts](../../../src/global.d.ts)：定义 `StudioPlatform`，`Window.api` 新增 `window` 段（契约 §4）；不重复声明 WebkitAppRegion。
- 改 [src/dev-mock-api.ts](../../../src/dev-mock-api.ts)：api 对象新增 `window` 段（契约 §5：`platform:'win32'` + resolve no-op 桩 + `onMaximizeChange: () => noop`）。
- 自验：`tsc -p tsconfig.preload.json` 与 `npm run typecheck` 全绿；浏览器预览（vite，无 preload）顶栏不崩。三处形状逐一对照契约 §3-5。
- AC：AC6、AC8。

### T3 · WindowControls 组件（✅ 2026-10-13 完成）

- 新增 [src/studio/WindowControls.tsx](../../../src/studio/WindowControls.tsx)：三按钮（最小化/最大化·还原/关闭）+ 内联 SVG 图标（设计说明 §3 尺寸/配色/hover）；`maximized` 初态取 `isMaximized()`、订阅 `onMaximizeChange`、toggle 返回校正（契约 §6.2）；容器 `aria-label="窗口控制"` + `WebkitAppRegion:'no-drag'`；按钮 aria-label/title/data-win/data-maximized 按契约 §6.3；调用失败静默。
- 合规自验：文件只 import react；无 `electron`、无 `http(s)://`、无 Key/口令（手工对一遍 architecture.test.ts 两张正则）。
- AC：AC1、AC2、AC3、AC4、AC7。

### T4 · StudioApp 顶栏集成（✅ 2026-10-13 完成）

- 改 [StudioApp.tsx](../../../src/studio/StudioApp.tsx)：
  - 取 `const platform = window.api.window?.platform ?? 'win32'`（防御式，部分桩测试不崩）。
  - `<header>` className 左侧留白条件化：darwin 维持 `pl-20`，否则 `pl-3`（契约 §7.2）。
  - header 末位（现有右侧业务控件组之后）按 `platform !== 'darwin'` 挂载 `<WindowControls/>`。
  - 顶栏 drag、stage-track、业务控件组 no-drag 一律不动。
- 自验：macOS 形态（darwin 分支）零视觉变化；Windows 分支仅多三按钮与左侧留白收敛。
- AC：AC4、AC5、AC6。

### T5 · 测试（✅ 2026-10-13 完成）

- 新增 `src/test/window-chrome.test.ts`：`windowChromeOptions` 三平台断言（契约 §8.1：darwin 仅 titleBarStyle、win32/linux 仅 frame:false）。
- 新增 `src/studio/window-controls.test.tsx`：渲染/aria、三按钮点击调用、toggle 返回切图标、推送跟随、卸载退订、no-drag（契约 §8.2）。
- 集成断言：win32 桩下 StudioApp 出现三按钮、header 为 `pl-3`；darwin 桩下无按钮、`pl-20`（可放组件测试或扩 studio-flow，二选一，不重复）。
- 全量 `npm run test:run`：与基线 **249 passed / 7 skipped / 12 failed** 对比，12 个既有失败（studio-flow 10、architecture 1、fs-sandbox 1，及 runtime-integration 套件 1）不扩大；本包净新增用例全绿。
- AC：AC1-AC9 中可自动化部分全部有断言；AC7 全量回归。

### T6 · 治理文档收尾（✅ 2026-10-13 完成，真机人工验收待用户执行）

- [x] [features/README.md](../../README.md)：8xx 段——804 行由「Harness基础校验与确认门全链路」改为本包（窗口标题栏）；原 Harness 包顺延编号 **806**（P2），新增一行；§4 建设顺序 P2 同步改号；§1 表头/§3 无冲突项核对。
- [x] [设计现状与偏差清单.md](../../设计现状与偏差清单.md)：偏差表新增 **B-10**（hiddenInset 在 Windows 无窗口控制），解决包指 feature-804；§3 路线表中 804 Harness 行改 806。
- [x] [SDG-AI-决策台账.md](../../governance/SDG-AI-决策台账.md)：新增 **D-014**（K8：编号让位 + 十五包方案外新增窗口外壳包；用户 2026-10-13 拍板 804→窗口标题栏、Harness 顺延 806；含 frame:false 选型登记）。
- [x] 本包 [SDG-AI-变更记录.md](./SDG-AI-变更记录.md)：回填 K8 批准方式与 T1→T6 实施记录闭环。
- AC：导航/台账与磁盘实况一致。
- **遗留（不阻塞编码闭环）**：Windows 真机人工验收（三按钮可见/hover/点击、双击标题栏、Win+↑、拖边 Snap）由用户执行，结果回填需求规格验收记录。

## 2. 产出物清单

| 产出 | 位置 | 状态 |
|---|---|---|
| 窗口外壳纯函数 | `electron/window/chrome.ts`（新增） | ✅ |
| 主进程窗口选项 + IPC | `electron/main.ts`（4 invoke + 1 推送） | ✅ |
| preload `window` 段 | `electron/preload.ts` | ✅ |
| renderer 契约类型 | `src/global.d.ts`（StudioPlatform + api.window） | ✅ |
| dev mock 桩 | `src/dev-mock-api.ts` | ✅ |
| 窗口控制组件 | `src/studio/WindowControls.tsx`（新增） | ✅ |
| 顶栏平台分支集成 | `src/studio/StudioApp.tsx`（pl/pr 条件化 + 末位挂载） | ✅ |
| 测试 | `src/test/window-chrome.test.ts`（4）+ `src/studio/window-controls.test.tsx`（8）+ `src/studio/window-titlebar-integration.test.tsx`（3），共 15 例全绿 | ✅ |
| 治理文档 | features/README（804/806 改号）、偏差清单 B-10、决策台账 D-014、本包变更记录 | ✅ |

## 3. 不做（防止越界）

- 不碰 `shared/types.ts`（无 K1）；不新增 MCP 工具、不新增 npm 依赖（K9 不触发）。
- 不改八步进度轨与顶栏任何业务控件；不做深色/32px 薄栏改版；不改顶栏 44px 高度与白底。
- 不做菜单栏、多窗口/标签页、自定义缩放边框、自绘阴影；不做 Linux 发行版级视觉精修。
- 不改应用退出/保活链（`window-all-closed` / `before-quit` / runtime 清理钩子）。
- 不改 runtime / mcp / gate / canvas / project / fs / comfy / asset 任何模块；不改 Agent profiles。
