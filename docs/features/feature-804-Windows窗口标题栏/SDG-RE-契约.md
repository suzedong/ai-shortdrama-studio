# feature-804 Windows 窗口标题栏 · 接口与数据契约

> 配套文件：[SDG-RE-需求规格.md](./SDG-RE-需求规格.md)（场景 / 范围 / 验收）。本文件固化**窗口外壳选项、IPC 通道、preload 暴露面、renderer 类型与组件契约**，是主进程与渲染端实现的直接依据。
>
> K 卡口：**本包不修改 `shared/types.ts`（无 K1）**；新增 IPC 通道属 **K8 登记类**（renderer↔main 契约扩展），通道形状在本文件固化后于包内变更记录 D-005 登记，K8 卡口随建包报批一并确认。

## 1. 窗口外壳选项（[main.ts](../../../electron/main.ts) `createWindow`）

### 1.1 平台分支纯函数（新增，可单测）

新增 `electron/window/chrome.ts`：

```ts
// 平台标识：沿用 Node process.platform 三取值
export type WindowPlatform = 'darwin' | 'win32' | 'linux'

// BrowserWindow 构造参数中与外壳相关的子集（其余宽高/背景色/webPreferences 不动）
export type WindowChromeOptions =
  | { titleBarStyle: 'hiddenInset' }                 // darwin
  | { frame: false }                                // win32 / linux

export function windowChromeOptions(platform: WindowPlatform): WindowChromeOptions
```

规则（唯一事实，main 与测试共用）：

| platform | 返回 | 语义 |
|---|---|---|
| `darwin` | `{ titleBarStyle: 'hiddenInset' }` | macOS 现状零变化：原生红绿灯、内容延伸到标题栏 |
| `win32` | `{ frame: false }` | 全自绘无边框，三按钮由 renderer 提供（选型见变更记录 D-002） |
| `linux` | `{ frame: false }` | 同 win32；能用到即可，不做发行版级精修 |

显式不取 `titleBarStyle:'hidden' + titleBarOverlay` 混合方案（理由见 D-002）。

### 1.2 createWindow 接线

```ts
mainWindow = new BrowserWindow({
  width: 1440, height: 900, minWidth: 1100, minHeight: 700,
  backgroundColor: '#FAFAFE',
  ...windowChromeOptions(process.platform),
  webPreferences: {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
  },
})
```

其余逻辑（dev URL / openDevTools / loadFile / `closed` 置空）不动。

## 2. IPC 通道契约（main.ts 新增，命名空间 `window:*`）

通道命名用 `window:` 前缀（冒号族，与 `project:` / `runtime:` / `canvas:` 同风格），与现有全部通道零冲突（已核对 main.ts handle 清单）。renderer 不持有 Node/Electron，一律经 invoke/on。

| 通道 | 方向 | 入参 | 返回 | 行为 |
|---|---|---|---|---|
| `window:minimize` | invoke | 无 | `{ ok: true }` | `mainWindow?.minimize()`；窗口已销毁时返回 `{ ok:false, error:{code:'WINDOW_UNAVAILABLE'} }`（不抛未捕获异常） |
| `window:toggle-maximize` | invoke | 无 | `{ ok: true; maximized: boolean }` | `isMaximized()` 真则 `unmaximize()` 假则 `maximize()`；返回操作后状态 |
| `window:is-maximized` | invoke | 无 | `{ ok: true; maximized: boolean }` | renderer 挂载时取初态；窗口不存在时 `maximized:false` |
| `window:close` | invoke | 无 | `{ ok: true }` | `mainWindow?.close()`；触发既有 `closed`/`window-all-closed`/`before-quit` 链，退出与 runtime 清理逻辑零改动 |
| `window:maximize-changed` | send（主→渲） | — | payload `{ maximized: boolean }` | 监听 `mainWindow.on('maximize')` 与 `on('unmaximize')` 各推一次；供多入口（双击标题栏、Win+↑、Aero Snap）状态同步 |

约束：

1. 四个 invoke handle 只操作模块内既有 `mainWindow` 单例，不新增第二窗口、不接受窗口 id 入参（单窗口应用，保持最小面）。
2. `window:maximize-changed` 推送目标固定为 `mainWindow.webContents`（不做订阅集合，单窗口）；窗口销毁后监听器随 `closed` 置空自然失效（在 createWindow 内随窗口绑定）。
3. 不拦截/不改写系统菜单与默认行为：`frame:false` 下双击拖拽区最大化、Win+方向键、边缘 Snap 缩放由系统/Electron 保留；自绘按钮只是额外入口。
4. 不新增错误码枚举文件——窗口控制仅一个 `WINDOW_UNAVAILABLE`（窗口不存在），以信封 inline 返回，与 `file:read` 的 `NO_PROJECT` 同款轻量处理。

## 3. preload 暴露面（[preload.ts](../../../electron/preload.ts) 新增 `window` 段）

挂在既有 `contextBridge.exposeInMainWorld('api', { ... })` 内，新增顶层命名空间 `window`（不与 runtime/canvas 等嵌套段冲突）：

```ts
// preload 内可直接取 process.platform（preload 运行在 Node 上下文）
window: {
  platform: process.platform as 'darwin' | 'win32' | 'linux',
  minimize: (): Promise<{ ok: true }> => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: (): Promise<{ ok: true; maximized: boolean }> =>
    ipcRenderer.invoke('window:toggle-maximize'),
  isMaximized: (): Promise<{ ok: true; maximized: boolean }> =>
    ipcRenderer.invoke('window:is-maximized'),
  close: (): Promise<{ ok: true }> => ipcRenderer.invoke('window:close'),
  onMaximizeChange: (cb: (maximized: boolean) => void): (() => void) => {
    const listener = (_e: unknown, payload: { maximized: boolean }) => cb(payload.maximized)
    ipcRenderer.on('window:maximize-changed', listener)
    return () => ipcRenderer.removeListener('window:maximize-changed', listener)
  },
},
```

`platform` 是**同步常量**（非 invoke），renderer 首次渲染即可决定是否挂按钮，无 loading 闪烁；返回结构统一，便于 mock 对齐。

## 4. renderer 类型契约（[src/global.d.ts](../../../src/global.d.ts)，非 shared 层）

`Window.api` 类型新增：

```ts
type StudioPlatform = 'darwin' | 'win32' | 'linux'

// Window.api 内新增段
window: {
  readonly platform: StudioPlatform
  minimize(): Promise<{ ok: true }>
  toggleMaximize(): Promise<{ ok: true; maximized: boolean }>
  isMaximized(): Promise<{ ok: true; maximized: boolean }>
  close(): Promise<{ ok: true }>
  onMaximizeChange(cb: (maximized: boolean) => void): () => void
}
```

平台/外壳类型 `StudioPlatform` 定义在 `src/global.d.ts`（renderer 外壳契约），**不进** `shared/types.ts`；`electron/window/chrome.ts` 的 `WindowPlatform` 为同形三字符串字面量，两端各自声明、不跨层 import（renderer 铁律禁 import electron 侧）。`CSSProperties.WebkitAppRegion` 模块声明已存在（L77-81），不重复添加。

## 5. dev mock 契约（[src/dev-mock-api.ts](../../../src/dev-mock-api.ts)）

`api` 对象新增同形 `window` 段：

```ts
window: {
  platform: 'win32' as const,   // 浏览器预览默认展示三按钮（本包的新增能力面）
  minimize: () => resolve({ ok: true as const }),
  toggleMaximize: () => resolve({ ok: true as const, maximized: false }),
  close: () => resolve({ ok: true as const }),
  isMaximized: () => resolve({ ok: true as const, maximized: false }),
  onMaximizeChange: () => noop,
},
```

mock 全部 no-op、不维护本地态（浏览器无真实窗口）；`platform:'win32'` 使纯浏览器态可直接看到三按钮。

## 6. renderer 组件契约（新增 `src/studio/WindowControls.tsx`）

### 6.1 职责与边界

- 单一职责：渲染最小化 / 最大化(还原) / 关闭三按钮并转发到 `window.api.window`；内部维护 `maximized` 图标态。
- 平台门禁在调用方（StudioApp）：组件自身只在「非 darwin」时被挂载；组件内不再判平台（保持纯渲染）。
- 合规（[architecture.test.ts](../../../src/studio/architecture.test.ts) 扫描面）：只 import react；图标全部**内联 SVG**（无外链 URL、无图片资源、无 emoji 承担功能语义）；不 import `electron`、不含任何 URL/Key/口令字符串；只经 `window.api.window.*` 触达主进程。

### 6.2 状态与交互

```ts
// 挂载：取初态（防御式：api.window 缺失时不崩溃，按非最大化渲染）
// 订阅：onMaximizeChange(maximized => setMaximized(maximized))，卸载时退订
// 点击：
//   最小化 → api.window.minimize()
//   最大化/还原 → const { maximized } = await api.window.toggleMaximize(); setMaximized(maximized)
//   关闭 → api.window.close()
```

- 最大化图标态以**主进程为权威**：初态来自 `is-maximized`，变化来自推送，toggle 返回值即时校正；不只依赖本地点击翻转（双击标题栏/Win+↑ 也会改态）。
- 调用失败（`WINDOW_UNAVAILABLE` / reject）静默忽略（窗口可能正销毁），不弹错、不崩 UI。

### 6.3 可测/可达性契约

| 项 | 值 |
|---|---|
| 容器 `aria-label` | `窗口控制` |
| 最小化按钮 | `aria-label="最小化"`、`title="最小化"`、`data-win="minimize"` |
| 最大化/还原按钮 | 最大化态 `aria-label="最大化"` / 已最大化态 `aria-label="还原"`；`data-win="maximize"`；`data-maximized={maximized}` |
| 关闭按钮 | `aria-label="关闭"`、`title="关闭"`、`data-win="close"` |
| 容器区域 | `style={{ WebkitAppRegion: 'no-drag' }}`，整组不参与窗口拖拽 |
| 按钮命中区 | 高 32px、宽 46px（设计说明 §3），无边框、透明底，图标居中 |

## 7. StudioApp 集成契约（[StudioApp.tsx](../../../src/studio/StudioApp.tsx) 顶栏）

1. 取平台：`const platform = window.api.window?.platform ?? 'win32'`（防御式，测试部分桩下不崩）。
2. 顶栏左侧留白按平台：
   - `darwin` → 维持 `pl-20`（80px 红绿灯留白）；
   - `win32`/`linux` → 改为 `pl-3`（12px，logo 与左缘留正常间距即可）。
   - 通过条件 className 拼接实现，其余 `h-11 / border-b / bg-white / drag` 不变。
3. 三按钮挂载点：`<header>` 内**最右侧**，位于现有右侧业务控件组（`data-cat-entry` 谱系入口 / 模型芯片 / 使用指南 / 导出 / 头像所在的 `flex items-center gap-3` 容器）**之后**，作为 header 的末位元素；该业务控件组维持原样。
4. `darwin` 不渲染 `<WindowControls/>`；`win32`/`linux` 渲染。
5. 顶栏整体 `WebkitAppRegion:'drag'` 不变；三按钮组自带 no-drag，现有业务控件组的 no-drag 不变。

## 8. 测试契约

### 8.1 主进程纯函数（新增 `src/test/window-chrome.test.ts`，参照 src/test 既有纯函数测试布局）

- `windowChromeOptions('darwin')` 深等 `{ titleBarStyle:'hiddenInset' }` 且对象不含 `frame` 键。
- `windowChromeOptions('win32')` / `('linux')` 深等 `{ frame:false }` 且不含 `titleBarStyle` 键。
- 三平台穷尽（无第四分支；可加类型级 never 断言，非必须）。

### 8.2 组件（新增 `src/studio/window-controls.test.tsx`，参照 canvas-board.test.tsx 渲染测试写法）

- 三按钮渲染且 aria-label 正确；初始 `isMaximized` 为真时中间按钮为「还原」语义、`data-maximized="true"`。
- 点击最小化→调 `window.api.window.minimize`；点击关闭→调 `close`；点击最大化→调 `toggleMaximize` 且按返回 `maximized` 切图标。
- 收到 `onMaximizeChange(true/false)` 推送后图标态跟随（模拟双击标题栏路径）。
- 卸载后退订函数被调用。
- 容器/按钮带 no-drag（断言 style 或属性）。
- mock 缺省（未给 window 段时的防御渲染）不抛错（如选择实现防御分支，则补一例；否则与 StudioApp 集成门禁合并测）。

### 8.3 集成与回归

- StudioApp 顶栏在 mock `platform:'darwin'` 时不出现窗口控制按钮、header 仍为 `pl-20`；`platform:'win32'` 时出现三按钮、header 为 `pl-3`（以现有 dev mock 默认 win32 即可见，darwin 用例在组件测试内构造）。
- 架构铁律扫描自动覆盖新文件（architecture.test.ts 遍历 studio 目录，无需改测试清单）。
- 全量 `npm run test:run` 不扩大 HEAD 基线（249 passed / 7 skipped / 12 failed，12 失败均为基线既有，见需求 AC7）。

## 9. 命名与边界约定

| 项 | 约定 |
|---|---|
| IPC 前缀 | `window:`（invoke）/ `window:maximize-changed`（send） |
| preload 段 | 顶层 `api.window`（与浏览器全局 `window` 同名但位于 api 命名空间下，调用形如 `window.api.window.close()`，无歧义） |
| 主进程模块 | `electron/window/chrome.ts`（仅纯函数；IPC handle 仍注册在 main.ts，不另起注册文件） |
| renderer 组件 | `src/studio/WindowControls.tsx`（同目录测试 `window-controls.test.tsx`） |
| 类型归属 | renderer 侧 `StudioPlatform` 在 `src/global.d.ts`；主进程侧 `WindowPlatform` 在 `electron/window/chrome.ts`；**均不进 shared/types.ts** |
| 不做 | 无新依赖、无 MCP 工具、无菜单栏、无多窗口、无自定义缩放边框、不改退出链 |
