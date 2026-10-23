# SDG-RE-契约 — feature-007 产物重开对齐二次确认

> **卡口声明（建包登记）**：本包 **K1 / K8 / K9 全零触发**——
> - **K1 零**：不改 `shared/types.ts`（`CanvasDirty` 五字段 / `CanvasNode` 纯消费）、不改 `src/global.d.ts`、不改 `electron/preload.ts`；不新增任何跨进程类型。
> - **K8 零**：重对齐消息经 StudioApp 既有 `handleSend`（L314）→ feature-808 既有 `promptAsync` 链路注入；清脏经 Agent 侧 feature-002 既有 `shortdrama_canvas.align`——零新 IPC / 零新 MCP / 零新推送 / 零白名单变更；主进程 / preload 零 diff。
> - **K9 零**：零新依赖、零配置变更、零 data-testid 新增（断言走 role / 按钮与黄条文本 / 既有结构钩子）、tailwind / 构建脚本零 diff。
>
> 实施中一旦触碰上述任一项 → **立即停手**，按对应卡口流程呈报用户裁决（§6 处置表）。

## 1. 数据面契约

### 1.1 新建组件（`src/studio/RealignConfirm.tsx`）

```ts
import type { CanvasNode } from '@shared/types'

/** 模板消息入参：fields 为原始点路径，函数内经 dirtyFieldLabel 中文化 */
export interface RealignPromptInput {
  nodeId: string
  title: string
  sinceBriefVersion: number
  latestBriefVersion: number
  fields: string[]
}

/** 固定模板（测试断言基准，逐字） */
export function buildRealignPrompt(input: RealignPromptInput): string

export interface RealignConfirmProps {
  node: CanvasNode          // 调用方（StudioApp 拦截点）保证 node.dirty 非空
  onRealign: () => void     // 「按 vM 重新对齐」
  onKeepView: () => void    // 「保持现状查看」
  onCancel: () => void      // 「取消」
}
```

**buildRealignPrompt 固定模板文本**（单行；`{...}` 为插值位；行首前缀为协议标记）：

```
【产物重新对齐】产物「{title}」（节点 {nodeId}）当前基于立项 v{sinceBriefVersion}，与最新立项 v{latestBriefVersion} 不一致，命中字段：{fields 逐项经 dirtyFieldLabel 中文化、顿号「、」分隔}。请按最新立项单 v{latestBriefVersion} 重新生成该产物：按再版剧本第 6 步纪律串行委派专职 agent（交接物写明旧产物基于 v{sinceBriefVersion}、命中字段），重生成定稿后调 shortdrama_canvas.align({ nodeId: '{nodeId}' }) 清脏并推进血缘。
```

| 规则 | 约定 |
| :-- | :-- |
| 前缀协议 | 行首 `【产物重新对齐】` 为 showrunner 纪律识别标记（R-008）；user 气泡固定落「用户」标签、前缀不经 B-34 标签解析剥离，上屏留痕供用户与 Agent 双读 |
| 中文化唯一口径 | 字段名转换仅经 CanvasBoard 既有 export `dirtyFieldLabel`（L225-227，17 键 `DIRTY_FIELD_LABELS`，未收录点路径回退原文）——与画布角标 hover、BriefHistoryView 差异摘要同源；组件内不另建映射 |
| 文案同源 | 确认内「基于 vN / 最新 vM / 命中字段」段与 CanvasBoard `dirtyTitle`（L229-231）同一拼法；查看器黄条前缀「当前基于 vN 立项」按 §2.6.7 L359 原文 |
| 纯函数 | `buildRealignPrompt` 零副作用、零 store / IPC 依赖（jsdom 安全）；组件受控三回调，自身不触 handleSend / setConfirmNode 以外任何通道 |
| dirty 非空前提 | `RealignConfirmProps.node` 由 StudioApp 拦截点保证 dirty 非空；组件内不再判空兜底（防御性判空属未要求复杂度） |

### 1.2 数据来源映射

确认与黄条全部字段 ← `node.dirty`（`CanvasDirty` 五字段，shared/types.ts L358-364）+ `node.title` / `node.id` / `node.kind`；版本号不读 brief、不读 manifest——以 dirty 记录值为准（feature-002 挂脏时已快照 since/latest）。

## 2. 通道契约

| 通道 | 方向 | 本包动作 |
| :-- | :-- | :-- |
| `handleSend` → 808 `promptAsync` 链路 | renderer → Agent | **纯消费**：「重新对齐」动作 = `handleSend(buildRealignPrompt(...))`，与用户在输入框键入完全同路径 |
| `shortdrama_canvas.align`（002 既有） | Agent → 主进程 | **仅 Agent 侧调用**（showrunner R-008 纪律）；renderer 不直连、不新增 IPC 包装——UI 直调 align = K8 越界 |
| `shortdrama_canvas.get`（002 既有） | Agent → 主进程 | 零 diff（R-008 核实脏态用，Agent 侧既有工具） |
| 新推送 / 新监听 / 新 IPC / preload 白名单 | — | **零新增** |

## 3. renderer 契约

### 3.1 字段映射（确认与黄条唯一口径）

| UI 元素 | 取值 | 来源键 |
| :-- | :-- | :-- |
| 确认标题 | 固定「产物重新对齐」 | — |
| 产物行 | `{kindLabel(node.kind)} · {node.title}`（kindLabel = CanvasBoard L201 既有 export） | `node.kind` / `node.title` |
| 版本对 | 「当前基于立项 v{since} · 最新立项 v{latest}」 | `dirty.sinceBriefVersion` / `dirty.latestBriefVersion` |
| 命中字段 | fields 逐项 `dirtyFieldLabel` 中文化、顿号「、」分隔 | `dirty.fields` |
| 分级提示 | high →「影响等级：高 · 建议重新生成」；medium →「影响等级：中 · 可按需对齐」 | `dirty.severity`（值域仅 high/medium，shared/types.ts L362） |
| 影响清单 | 「影响清单：{impactReport}」纯文本（无按钮、无链接） | `dirty.impactReport` |
| 主钮文本 | `按 v{latest} 重新对齐` | `dirty.latestBriefVersion` |
| 次钮 / 取消 | 固定「保持现状查看」/「取消」 | — |
| 查看器黄条 | `当前基于 v{since} 立项，与最新 v{latest} 不一致：{中文字段段}`（§2.6.7 L359 简版，**无 [查看影响评估] 钮**）+ `[一键对齐]` 钮 | 同上 |
| 注入消息文本 | §1.1 固定模板逐字 | `buildRealignPrompt` |

### 3.2 组件改造点

| 组件 | 改造点 |
| :-- | :-- |
| RealignConfirm.tsx（新建） | §1.1 全量：`buildRealignPrompt` 纯函数 export + 三选一确认组件（`role="dialog"` 居中确认卡片 + 遮罩层，样式口径对齐既有对话选项卡 / 确认类卡片；三按钮 → 三回调；无 Esc / 背景点击关闭） |
| StudioApp.tsx | 新增 `confirmNode` state（L105 viewerNode 旁）；handleOpenNode（L377）拦截：`node.dirty` 非空 → `setConfirmNode(node)`（不开查看器），否则 `setViewerNode(node)` 直通；三 handler——onRealign = `setConfirmNode(null)` + `setViewerNode(null)` + `handleSend(buildRealignPrompt(...))`；onKeepView = `setViewerNode(confirmNode)` + `setConfirmNode(null)`；onCancel = `setConfirmNode(null)`；项目切换复位点（L274）同点 `setConfirmNode(null)`；StudioViewer 接线处（L700-705）下传 `onRequestAlign = () => setConfirmNode(viewerNode)`；confirmNode 非空时挂载 RealignConfirm |
| StudioViewer.tsx | Props 加可选 `onRequestAlign?: () => void`；refPath 行（L613）之后、body（L614）之前插黄条：`node.dirty` 非空 → §3.1 黄条文案 + 「一键对齐」钮 → `onRequestAlign`（未传 → 黄条无钮）；`import { dirtyFieldLabel }`（CanvasBoard 既有 export，与 BriefHistoryView 同路径，无循环依赖） |
| showrunner.md | L168-171 脏读纪律段追加第三条（内容见需求规格 §3.5） |

### 3.3 data-testid 零新增凭据

断言全部走 role（dialog / button）/ 按钮与黄条文本 / 既有结构钩子；`brief-history-entry`（StudioViewer L585）等既有 testid 零改名、零新增。

## 4. 最小 diff

| 类别 | 文件 |
| :-- | :-- |
| 新增（2） | `src/studio/RealignConfirm.tsx`；`src/studio/realign-confirm.test.tsx` |
| 修改（3） | `src/studio/StudioApp.tsx`；`src/studio/StudioViewer.tsx`；`resources/opencode/agents/showrunner.md` |
| 文档（4） | 偏差清单 B-42 行（建包 🟡 → 收尾翻 ✅）；README 总表增 007 行；feature-001 变更记录 R-008 节；本包变更记录 T/X 节回填 |
| **零 diff 红线** | `shared/types.ts`；`electron/**` 全部；`src/global.d.ts`；preload；`src/dev-mock-api.ts`；`src/studio/CanvasBoard.tsx`（dirty 三件套纯 export 消费，本体零 diff）；Stage0View / BriefHistoryView / ChatComposer / VisualCatalog；既有 57 个测试文件；`tailwind.config.*`；`package.json`；`vite.config.*` |

## 5. 测试契约

| 测试 | 断言点 |
| :-- | :-- |
| realign-confirm.test.tsx（新，四组） | ① buildRealignPrompt：输出 = §1.1 固定模板逐字（nodeId / title / vN→vM 插值；字段中文化；未收录点路径回退原文；align 指令字面值 `shortdrama_canvas.align({ nodeId: '<id>' })`）；② RealignConfirm：产物行 / 版本对 / 中文字段 / severity 两态提示 / impactReport 文件名上屏；三按钮分触三回调各一次；③ StudioViewer 黄条：dirty 节点显黄条（文案 = §3.1 口径）；一键对齐钮调 onRequestAlign；无 dirty 无黄条；无 onRequestAlign 黄条无钮；④ StudioApp 集成七例：dirty 打开 → 确认出现且查看器未开 / 保持现状 → 查看器开 + 黄条显 / 查看器一键对齐 → 确认再现 / 重新对齐 → onSend 收到模板消息（文本断言）且确认与查看器均关 / 取消 → 确认关、查看器未开、零消息 / 无脏节点 → 直通零确认 / 切项目 → 确认与查看器同复位 |
| 静态验证 | Grep showrunner.md 含 R-008 新增条（【产物重新对齐】前缀 + 核实脏态 + 串行委派 + align + 保持现状不动作）；feature-001 变更记录含 R-008 节 |
| 回归 | 既有 57 测试文件零 diff；测试文件净增恰 1（57→58）；typecheck 恰 3 条历史基线零新增 |

## 6. 卡口与越界处置表

| 情形 | 处置 |
| :-- | :-- |
| 想在黄条加「查看影响评估」按钮 / 在确认内做勾选列表、批量对齐 | **越界**：feature-002 §4.2 L82 面板排除不翻案；impactReport 仅文件名纯文本 |
| 想让 UI 直接调 `canvas.align` 或新增 IPC 包装 | **K8 停手**：align 仅 Agent 侧经 R-008 纪律调用；renderer 任何新通道即越界 |
| 想改 `CanvasDirty` 字段 / 让 confirmNode 进共享类型 | **K1 停手**：本包预设零共享层变更，触发即越界 |
| 想动画布黄条 / Stage0View 黄条 / ⚠️ 角标 / StageNavPanel 徽标 | **停手**：feature-002 既有交付面零 diff 是既定口径 |
| 想加 Esc / 背景点击关闭确认 | **越界**：需求规格 §4.2 明示不做（取消钮等价防误触） |
| 需要新依赖 / 新 testid / 配置变更 | **K9 停手** |
