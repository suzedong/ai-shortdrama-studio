# feature-804 Windows 窗口标题栏 · 变更记录

> 三分类：决策记录（永久）/ 实施记录（落地后清理）/ 修订记录（决策稳定后清理）。

## 一、决策记录（K 卡口，永久保留）

### D-001 · 批准建立 feature-804 任务包（2026-10-13）

- **触发**：真机盘点发现 [electron/main.ts](../../../electron/main.ts) `BrowserWindow` 使用 macOS 专用 `titleBarStyle:'hiddenInset'`，Windows 下退化为无最小化/最大化/关闭按钮的无边框窗口（偏差 B-10，真机缺陷）；用户提供 MiniMax Design Windows 版截图并指示「学习一下 windows 版本的标题栏」，随后拍板「先建 feature-804 任务包」。
- **定性**：缺陷修复 + **[改编]** 形态对齐（三按钮位置/尺寸/hover 语言对齐 MiniMax Design，以 Electron 原生窗口能力与平台既有自绘顶栏自行实现，不复用闭源代码）。
- **批准方式**：本记录 D-001 登记建包批准；任务包 5 文件建齐后在 **K8 卡口**（见 D-005）呈报 D-002 外壳选型与 D-003 视觉方案，用户显式批准后方可执行 T1→T6 编码。

### D-002 · 窗口外壳选型：`frame:false` 全自绘，不取 titleBarOverlay 混合方案（2026-10-13，**K8 已批准**）

- **候选**：
  1. **`frame:false` 全自绘**（拟定）：win32/linux 无原生边框与按钮，三按钮由 renderer [WindowControls.tsx](../../../src/studio/WindowControls.tsx) 提供，视觉可 1:1 贴截图（46×32、浅灰圆角、关闭红 `#C42B1C`），跨平台（含 Linux）一套实现。
  2. **`titleBarStyle:'hidden' + titleBarOverlay` 混合**：Electron 提供原生 Windows 控制按钮并可配色，自动保留 Win11 Snap Layouts（最大化钮悬停布局菜单）、系统级高对比度/ RTL 适配；但按钮为系统绘制，hover 圆角块、关闭红的形态只能近似，且不覆盖 Linux。
- **选定 ①**，理由：① 用户明确要求学习截图形态，自绘可控度最高；② 本仓顶栏本就是自绘拖拽栏（`-webkit-app-region` 已在用），补三按钮是同一机制的自然延伸；③ 平台三分支收敛为「darwin 原生 / 其余自绘」两套，主进程纯函数（契约 §1.1）可穷尽测试。
- **已知代价（用户知情项）**：`frame:false` 下失去**最大化按钮悬停 Snap Layouts 菜单**（Win11）；Win+方向键、拖屏边 Aero Snap、双击标题栏最大化、边缘缩放（约 6px）仍由系统/Electron 保留（需求 R5）。未来若要求 Snap Layouts，可另包切到方案 ②，届时自绘按钮随 overlay 共存规则调整。
- **平台分支**（AC9）：`darwin → {titleBarStyle:'hiddenInset'}`；`win32/linux → {frame:false}`；由新增 `electron/window/chrome.ts` 纯函数产出，main.ts 不再硬编码。

### D-003 · 视觉方案：沿用浅色 44px 顶栏仅补三按钮，不做深色 32px 薄栏（2026-10-13，**K8 已批准**）

- 截图为深色、约 32px、无分隔线薄栏；本包不照搬。设计书 L289-298/L383 规定 titlebar 承载全局八步 STAGE 进度轨，32px 放不下；且缺陷修复包不夹带全顶栏改版。
- 落地：顶栏高度（`h-11`）、白底、下边框、进度轨、右侧业务控件组全部不动；win32/linux 仅左侧留白 `pl-20 → pl-3`、右侧收敛 `pr-4 → 0`（关闭钮贴右上角）、末位挂三按钮。三按钮规格见 [设计说明](./SDG-OD-设计说明.md) §3（46×32、`#E6E6E9` 浅灰圆角 hover、关闭 `#C42B1C` 白图标、内联 SVG）。
- 深色薄栏若未来要做，另立任务包并先评估进度轨迁移。

### D-004 · macOS 零变化与平台类型归属（2026-10-13）

- darwin 外壳保留 `hiddenInset`、红绿灯与 `pl-20` 留白保留、不渲染自绘按钮（R6/AC5）。
- 平台三字符串字面量两端各自声明：renderer 侧 `StudioPlatform` 在 [src/global.d.ts](../../../src/global.d.ts)，主进程侧 `WindowPlatform` 在 `electron/window/chrome.ts`，**不跨层 import、不进 shared/types.ts → 无 K1**。renderer 经 preload 同步常量 `api.window.platform` 首次渲染即定形态，无 loading 闪烁。

### D-005 · K8 卡口登记：新增 4 invoke + 1 推送 IPC（2026-10-13，**已批准**）

- 新增通道（契约 §2）：`window:minimize`、`window:toggle-maximize`、`window:is-maximized`、`window:close`（invoke）+ `window:maximize-changed`（主→渲 send，绑 maximize/unmaximize 事件，覆盖双击标题栏/Win+↑/Snap 多入口状态同步）。
- 错误形状：窗口销毁竞态返回 `{ok:false,error:{code:'WINDOW_UNAVAILABLE'}}`，不抛未捕获异常；renderer 侧调用失败静默。
- 边界：只操作单例 `mainWindow`、不做窗口 id/订阅集合；不经 MCP、Agent 不可见；不改退出链（`window:close` 走既有 `closed`/`window-all-closed`/`before-quit` runtime 清理）。
- 同步面：preload 暴露面、global.d.ts 类型、dev-mock-api 桩（mock `platform:'win32'`）三处同形（AC8）。
- 卡口动作：D-002/D-003/D-005 随建包一并呈报，用户批准即视为本包 K8 登记确认与 T1→T6 编码授权；批准留痕回填本记录实施区。

### D-006 · 编号让位：804 = Windows 窗口标题栏，原规划 Harness 包顺延 806（2026-10-13）

- **冲突**：盘点发现 804 在 D-013 十五包方案（[features/README.md](../../README.md) L83、[偏差清单](../../设计现状与偏差清单.md) §3 路线）中已规划为「Harness 基础校验与确认门全链路」（P2、未建包）。
- **用户拍板**（AskUserQuestion）：**804 让给窗口标题栏**（真机缺陷优先），Harness 包顺延编号 **806**。
- T6 治理收尾动作：README 8xx 表 804 行改窗口标题栏 + 新增 806 Harness 行 + §4 P2 顺序改号；偏差清单 §3 路线 804→806；决策台账新增 **D-014** 记录本让位与「十五包方案外新增窗口外壳包」。本 D-006 与台账 D-014 互为交叉指针。

## 二、实施记录（过渡）

- 2026-10-13：任务包 5 文件建立（需求规格 / 契约 / 任务清单 / 设计说明 / 本记录）。**K8 未批准前不触碰任何代码**（铁律 1：No Spec, No Code）。
- 2026-10-13：K8 卡口经 AskUserQuestion 通过——用户对三项逐字选定「frame:false 全自绘」（D-002）、「沿用浅色 44px 仅补按钮」（D-003）、「批准，开始编码」（D-005 K8 登记确认 + T1→T6 一次授权）。批准留痕即本条，随后按 T1→T6 执行。
- 2026-10-13 T1（主进程外壳与 IPC）：新建 [chrome.ts](../../../electron/window/chrome.ts)——`WindowPlatform`/`WindowChromeOptions` 类型 + `windowChromeOptions(platform)` 纯函数（darwin→`{titleBarStyle:'hiddenInset'}`，win32/linux→`{frame:false}`）；[main.ts](../../../electron/main.ts) 顶层 `windowPlatform` 收窄常量经 spread 注入 `BrowserWindow`（替换原硬编码 hiddenInset），注册 maximize/unmaximize 监听推送 `window:maximize-changed`，新增 4 个 `window:` invoke（空值守卫返 `WINDOW_UNAVAILABLE` 信封，toggle-maximize 返操作后状态，close 走既有退出链）。
- 2026-10-13 T2（契约三处同步）：[preload.ts](../../../electron/preload.ts) 新增顶层 `window` 段（platform 同步常量 + 4 invoke 包装 + onMaximizeChange 解包 payload 并返退订函数）；[global.d.ts](../../../src/global.d.ts) `declare global` 内新增 `StudioPlatform` 与 `window` API 段；[dev-mock-api.ts](../../../src/dev-mock-api.ts) 补同形桩（mock 固定 `platform:'win32'`，复用既有 noop/resolve 辅助）。
- 2026-10-13 T3/T4（renderer）：新建 [WindowControls.tsx](../../../src/studio/WindowControls.tsx)（三按钮 + 4 个内联 SVG，最大化/还原图标随状态切换，46×32、hover 浅灰圆角、关闭红 `#C42B1C`）；[StudioApp.tsx](../../../src/studio/StudioApp.tsx) 防御式取 `window.api.window?.platform ?? 'win32'`，header 留白条件化（darwin 保留 `pl-20 pr-4`，其余 `pl-3 pr-0`），非 darwin 末位挂载 `<WindowControls />`，其余顶栏零改动。
- 2026-10-13 T5（测试）：新增 3 个测试文件共 15 例——window-chrome.test.ts（纯函数三平台穷尽，4 例）、window-controls.test.tsx（按钮渲染/转发/推送同步/退订/防御，8 例）、window-titlebar-integration.test.tsx（StudioApp 三平台集成门禁，3 例），全绿；全量回归 **264 passed / 7 skipped / 12 failed**，与 feature-801 基线（249/7/12）同分布，净 +15 全过、零扩大；12 个既有失败逐一核对均与本包无关。typecheck 既有 7 错误全部落在未触碰文件（stash 基线证实）。
- 2026-10-13 可测性处理：jsdom 丢弃未知 CSS 属性 `-webkit-app-region`（连内联 style 字符串都不保留），组件容器在保留 `WebkitAppRegion:'no-drag'`（Electron 实际生效项）之外，另加 `data-app-region="no-drag"` 数据属性承担测试断言，Electron 行为不受影响。
- 2026-10-13 T6（治理收尾）：任务清单 T1–T6 与产出物全部回填闭环；本记录决策状态更新；features/README.md 804 行、偏差清单 B-10 状态同步为已落地（待真机验收）。**遗留**：Windows 真机人工验收（三按钮/hover/多入口最大化同步/Aero Snap）与 macOS 零变化回归由用户执行，结果回填需求规格验收记录。
- 2026-10-29 ENV-02 Windows 真机验收通过（用例 ENV-02，证据回填 [立项阶段整体真机测试用例.md](../../立项阶段整体真机测试用例.md) §6）：hover/命中区/点击三按钮/双击标题栏/Win+↑↓←→/关闭退出全绿；吸附→反向键=还原经验证与本机原生有框窗口一致（平台奇偶，非缺陷）。macOS 零变化回归（AC5）维持挂起。L56 遗留项中 Windows 半边就此闭环。
- 2026-10-14 构建链路修复（macOS 真机发现）：用户在 macOS 真机 Electron 窗口看到原生红绿灯与 win32 自绘三按钮同时出现、顶栏走 win32 布局（logo 被红绿灯压住）。排查定位——[main.ts](../../../electron/main.ts) 按 `preload.cjs` 加载（契约 §2，preload 须 CommonJS），但 `tsc -p tsconfig.preload.json` 在 `"type":"module"` 仓里只产出 `preload.js`，**preload 从未被加载**；renderer `window.api` 缺失，[main.tsx](../../../src/main.tsx) 遂在真实桌面窗口安装 dev-mock，而 mock 固定 `platform:'win32'`（截图中演示项目「安妮的夏天」/底部状态栏 mock 数据佐证）。修复：新增 [scripts/rename-preload.cjs](../../../scripts/rename-preload.cjs)，在 `dev` 与 `build:electron` 的 preload 编译后将 `preload.js` 重命名为 `preload.cjs`（preload 仅依赖 electron 运行时，无本地 CJS 依赖，重命名安全）；`build:electron` 验证产出 preload.cjs。此为构建配置遗漏的缺陷修复，不改 D-002/D-004 平台分支设计；真机 macOS 形态以重启 `npm run dev` 后实测为准。

## 三、修订记录

- （暂无）
