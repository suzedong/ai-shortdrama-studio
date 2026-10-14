# feature-804 Windows 窗口标题栏 · 设计说明

> 本包是**应用外壳缺陷修复包**：主进程窗口选项按平台分支，renderer 在既有自绘顶栏最右侧补一组窗口控制按钮。
>
> 视觉总原则（D-003）：**不动顶栏既有形态**（44px 高、白底、下边框、八步 STAGE 进度轨、右侧业务控件组），仅在右侧追加三按钮并收敛 Windows/Linux 左侧留白；macOS 零视觉变化。

## 1. UI 改动面

| 位置 | 改动 | 视觉验收 |
|---|---|---|
| [StudioApp.tsx](../../../src/studio/StudioApp.tsx) 顶栏 `<header>`（L297-367） | ① 左侧留白平台条件化：darwin 维持 `pl-20`，win32/linux 改 `pl-3`；② header 末位（现有右侧业务控件组之后）挂 `<WindowControls/>`（仅 win32/linux）；③ 顶栏 `h-11 / border-b border-line / bg-white / WebkitAppRegion:'drag'` 一律不动 | Windows 顶栏仅多右侧三按钮、左缘留白由 80px 收敛为 12px；logo、标题、进度轨、业务控件组（谱系入口/模型芯片/使用指南/导出/头像）位置与样式零变化；macOS 截图级零变化（红绿灯、80px 留白、无自绘按钮） |
| [WindowControls.tsx](../../../src/studio/WindowControls.tsx)（新增） | 右上角三按钮：最小化 / 最大化·还原 / 关闭；内联 SVG 图标；容器 no-drag | 见 §3 视觉规格；不引入任何图片/图标字体/外链资源 |
| 顶栏高度/配色/分隔线 | **不改**：维持 44px（`h-11`）、`bg-white`、`border-b border-line`（#E8E9F0） | 不做截图中的深色 32px 薄栏（裁决见 §2） |

除顶栏外，renderer 其余界面（左栏、画布、各阶段面板、弹窗）**零改动**。

## 2. 视觉方案裁决：沿用浅色 44px 顶栏，不做深色 32px 薄栏（D-003）

用户提供的 MiniMax Design Windows 截图是「与内容同色、约 32px 高、无分隔线」的深色薄栏。本包**不照搬**该薄栏，理由：

1. **设计书对本仓顶栏另有规定**：[短剧Agent平台设计.md](../../../短剧Agent平台设计.md) L289-298 与 L383 明确 titlebar 承载全局八步 STAGE 0→7 进度轨。32px 薄栏放不下现有进度轨（当前轨道含 8 个带文字/环的阶段按钮，实测适配 44px 栏高）。
2. **缺陷修复不夹带改版**：本包解决的是「Windows 无窗口控制按钮」真机缺陷（B-10）。顶栏换深色、减高度属于全应用视觉改版，会连带进度轨、业务控件组全部重排，超出缺陷修复边界，应另立包。
3. **形态对齐的是窗口控制机制，不是整栏皮肤**：[改编] 标签覆盖的是三按钮的位置/尺寸/hover 语言（46×32、浅灰圆角、关闭红）；这些按钮挂在白底栏上同样成立，Windows 用户的肌肉记忆不依赖栏底色。

结论：三按钮按 §3 规格落地；薄栏/深色方案如未来要做，另开任务包并先评估进度轨迁移。

## 3. 三按钮视觉规格

### 3.1 容器

- 位于 header 末位，与左邻业务控件组同基线；容器 `flex items-center`，`style={{ WebkitAppRegion: 'no-drag' }}`，`aria-label="窗口控制"`。
- 与右缘：按钮组最右一个（关闭）贴 header 右缘（Windows 惯例关闭按钮就在屏幕右上角 0 边距）；header 原 `pr-4` 在 Windows 分支由按钮组自身命中区吸收——实现时将 Windows 分支 header 右内边距收敛为 0（darwin 维持 `pr-4`），保证关闭按钮右缘贴边、命中区 46×32 完整。
- 三按钮间无间距（连排，与 Windows 原生一致）。

### 3.2 按钮

| 项 | 规格 |
|---|---|
| 命中区 | 宽 46px、高 32px（`w-[46px] h-8`），与截图及 Windows 11 规范一致；顶栏 44px 高内上下各余 6px |
| 默认态 | 透明底、无边线、无圆角底色；图标 `currentColor`，色值取 `text-ink`（#1A1A2E），居中 |
| 最小化 / 最大化 hover | 浅灰圆角块：`hover:bg-[#E6E6E9]`（中性浅灰，不用带紫调的 line 色）、圆角 6px；图标色不变 |
| 关闭 hover | 实心红 `#C42B1C`、圆角 6px；图标转白色（`hover:bg-[#C42B1C] hover:text-white`，组内选择器或按钮级条件类） |
| active/pressed | 沿用 hover 底色，透明度不另设（最小实现，不引入新态） |
| focus | 浏览器默认 focus 环保留（可访问性，键盘可达）；不自定义 focus 样式 |
| 禁用态 | 无（窗口存在期间三按钮始终可用；窗口销毁时组件已不存在） |

### 3.3 图标（全部内联 SVG，无资源文件）

- 统一：`width/height` 10–12px、`fill="none"`、`stroke="currentColor"`、`strokeWidth={1.2}`、`strokeLinecap="square"`；线性风，与 Windows 11 原生图标同族。
- 最小化：一条 10px 横线，居中偏下（y 居中即可）。
- 最大化：10×10 方框（直角矩形）。
- 还原：两个叠加方框——后方 10×10 方框向右上偏移 2px 描边，前方 8×8 方框向左下偏移、`fill="#FFFFFF"`（顶栏底色为 `bg-white`，白填充遮挡后框穿过来的重叠边）再描边。中间钮（非关闭钮）hover 永不变红，仅浅灰底，白色补底在浅灰圆角块内可能有极轻微色差，接受；视觉验收标准为「后框被压边不可见、整体是 Windows 还原图标」。
- 关闭：X，两条 10px 对角线。
- 图标随 `maximized` 在「最大化方框 / 还原双方框」间切换（状态权威在主进程，契约 §6.2）。

## 4. 平台留白与拖拽

| 平台 | 外壳（契约 §1） | header 左内边距 | header 右内边距 | 三按钮 |
|---|---|---|---|---|
| darwin | `titleBarStyle:'hiddenInset'` | `pl-20`（80px，红绿灯留白，不变） | `pr-4`（不变） | 不渲染 |
| win32 | `frame:false` | `pl-3`（12px） | 0（关闭钮贴边） | 渲染 |
| linux | `frame:false` | `pl-3`（12px） | 0 | 渲染（同 win32，不做发行版精修） |

- 拖拽：header 整栏 `WebkitAppRegion:'drag'` 维持；WindowControls 容器与既有 stage-track、业务控件组同为 no-drag。三按钮不启动拖拽、不吞点击（AC4）。
- 双击拖拽区最大化/还原由 Electron 在 `frame:false` 下原生提供，本包不写双击处理；状态经 `window:maximize-changed` 回流保证图标同步。

## 5. 不新增视觉资产

- 零图片、零图标字体、零 lottie、零 emoji 承担功能语义：三图标全部内联 SVG 写在 [WindowControls.tsx](../../../src/studio/WindowControls.tsx) 单文件内。
- 不新增 Tailwind 色板令牌：仅使用既有 `ink` 与两个 arbitrary value（`#E6E6E9`、`#C42B1C`，截图实测值），不进 [tailwind.config.js](../../../tailwind.config.js)（一次性外壳用色，不上升为体系色；如后续设计系统收录再迁令牌）。
- 不新增弹窗/tooltip 气泡：仅原生 `title` 属性（最小化/最大化/还原/关闭）。

## 6. IPC 视觉相关行为说明

- 本包新增 4 invoke + 1 推送（契约 §2），全部服务于三按钮与图标态，不驱动任何其他界面元素；不归口 MCP、Agent 不可见、与生产链无关。
- 调用失败静默（窗口销毁竞态），按钮不报错、不变形。

## 7. 视觉回归基线

- 新增组件测试（window-controls.test.tsx）断言：三按钮 aria/data 契约、46×32 命中区 class、关闭按钮红色 hover class 存在、最大化/还原图标随状态切换。
- 全量 `npm run test:run` 不扩大 HEAD 基线 **249 passed / 7 skipped / 12 failed**（12 失败均基线既有：studio-flow 10、architecture 1、fs-sandbox 1、runtime-integration 套件 1，见需求 AC7）。
- macOS 零变化以 AC5 + 纯函数测试（darwin 分支不含 `frame`）保证；无 macOS 真机条件时不测像素，只断言外壳选项与渲染分支。
- 真机人工验收（Windows）：三按钮点击、hover 配色、双击标题栏、Win+↑、拖边吸附，在 T6 后由用户执行（测试不替代真机）。
