# SDG-RE-需求规格 · feature-007 产物重开对齐二次确认

> **包号**：feature-007（0xx STAGE 0 立项段，承接 feature-002「留待通道包」切片）
> **业务名**：产物重开对齐二次确认（打开 dirty 产物节点 →「是否按 v(N+1) 重新对齐」三选一确认 + 只读查看器脏读黄条 + showrunner 单产物重对齐纪律）
> **性质**：纯 renderer 拦截呈现 + 指令层小补；**K1 零触发**（`CanvasDirty` 五字段纯消费，`shared/types.ts` / `src/global.d.ts` / `electron/preload.ts` 零 diff，不新增任何跨进程类型）；**K8 零触发**（重对齐消息经 StudioApp 既有 `handleSend` → feature-808 既有 `promptAsync` 链路注入，清脏经 Agent 侧 feature-002 既有 `shortdrama_canvas.align`——零新 IPC / 零新 MCP / 零新推送 / 零白名单变更）；**K9 零触发**（零新依赖、零新 data-testid、零配置变更）
> **事实源**：《短剧Agent平台设计.md》§2.6.6 L291（「一次重新打开产物编辑 = 触发"是否按 v(N+1) 重新对齐"二次确认」）、§2.6.7 L354（仅标记脏 → 下次手动打开该产物编辑时触发二次确认）与 L357-361（脏读运行时黄条 + Agent 提示词 ⚠️ 标记 + 不阻断创作）
> **前置**：feature-002（`CanvasNode.dirty` 数据模型 + `canvas.align` 工具 + 脏读角标/黄条/徽标；其 §4.2 L82 将弹窗面板与「一键对齐」按钮明示排除「留待 renderer↔主进程通道包」——本包承接其中「重开二次确认」切片，影响评估面板全量 UI 不翻案）
> **溯源标签**：[Design 原有·形态对齐]（§2.6.6/§2.6.7 既定交互，底层以既有 handleSend 对话通道自研实现）
> **偏差登记**：B-42（本包登记并实施收尾关闭）
> **日期**：2026-10-21

## 1. 背景

「新建→立项」链路盘点缺口 #3：设计书 §2.6.6 L291 与 §2.6.7 L354 均规定——脏产物被重新打开编辑时应触发「是否按 v(N+1) 重新对齐」二次确认；§2.6.7 L357-361 规定脏读运行时黄条含「[一键对齐]」入口。feature-002 落地脏读数据模型与对话态三选一时，在 §4.2 L82 将「影响评估弹窗面板 UI（弹窗 / 勾选列表 /『一键对齐』按钮）」整体排除、留待通道包；此后 feature-808（会话绑定）与 B-34/B-35（对话标签 / 选项卡）已使对话通道完全承载三选一交互，但「重开脏产物」这一触发点至今零拦截——用户打开脏产物直接进只读查看器，无任何重新对齐提示与入口。

代码实证（2026-10-21 侦察）：

- **打开链路直通无拦截**：[CanvasBoard.tsx](../../../src/studio/CanvasBoard.tsx) L722 `openable = Boolean(node.ref?.path) && Boolean(onOpenNode)`，四处打开调用——L750 节点点击 / L752 Enter 键 / L799 行内 'view' 动作 / L876 右键菜单 'view' 动作——全部经 `onOpenNode` 汇聚 [StudioApp.tsx](../../../src/studio/StudioApp.tsx) L377 `handleOpenNode = useCallback((node) => setViewerNode(node), [])` 单点（L695 下传）；**拦截 handleOpenNode 一处即全覆盖，无旁路**（`handleNodeAction` 的 'view' 只 toast 不开查看器）；
- **查看器零 dirty 呈现**：[StudioViewer.tsx](../../../src/studio/StudioViewer.tsx) L576-635——头部（kindLabel+title+版本徽章+brief 专属「查看历史」L585-594+关闭钮）→ refPath 行（L604-613）→ body 三态（L614-630）→ BriefHistoryView（L631-633），全文无 dirty 引用；脏读黄条仅存在于画布（CanvasBoard 顶部纯文本无按钮，002 §4.1）与 Stage0View；
- **dirty 文案三件套现成可复用**：CanvasBoard L204-222 `DIRTY_FIELD_LABELS`（17 键点路径→中文名）+ L225-227 `export function dirtyFieldLabel`（feature-004 已 export 供 BriefHistoryView 复用）+ L229-231 `dirtyTitle`（`基于 vN，与最新 vM 不一致：<字段>`）——确认与黄条文案同源复用，CanvasBoard 本体零 diff；
- **消息注入通道现成**：StudioApp L314 `handleSend`（useCallback async）为用户消息唯一入口（L760 `onSend={handleSend}`），模板消息经此注入上屏并走 feature-808 既有 `promptAsync` 链路——零新 IPC；
- **复位点现成**：StudioApp L274 项目切换 `setViewerNode(null)`——新增确认态同点复位；
- **showrunner 无单产物重对齐专条**：[showrunner.md](../../../resources/opencode/agents/showrunner.md) L168-171 脏读纪律两条（L170 复读警告、L171 委派交接物写明脏态），再版六步 L140-149 的 step 6（串行委派 + align 清脏）为「commit 后批量队列」语境，无「用户经界面点名重对齐单个脏产物」入口条——指令层须小补一条（归 feature-001 变更记录 R-008）；
- **目验素材现成**：[dev-mock-api.ts](../../../src/dev-mock-api.ts) L15-17 预置脏节点 `n-outline`（基于 v2、最新 v3、命中季边界+集数、severity high、impactReport `影响清单.v2-v3.json`，feature-004 AC9 目验夹具）——dev-mock 零 diff 即可真机目验。

**原则对齐（D-016 系统优先）**：dirty 判定、确认触发、文案生成、黄条呈现均为规则可枚举的确定性操作——系统直做不经 AI；「重新对齐」的内容重生成是 AI 文本生成——经既有对话通道交由 Agent 按 showrunner 纪律执行。双通道落同一数据模型（`CanvasDirty`）与同一追溯机制（align 清脏推进 parentReference 血缘）。

## 2. 角色与场景

| # | 角色 | 场景 | 期望表现 |
|---|---|---|---|
| R1 | 创作者 | 点击 / Enter / 行内查看 / 右键查看打开**带脏**产物节点 | 弹出「产物重新对齐」三选一确认（产物名 / 基于 vN / 最新 vM / 命中字段中文名 / 分级提示 / 影响清单文件名），查看器暂不打开 |
| R2 | 创作者 | 确认中选「按 vM 重新对齐」 | 对话区注入一条用户消息（模板载明节点 / 版本对 / 命中字段 / 串行委派与 align 指令），Agent 按 showrunner 纪律核实脏态 → 串行委派重生成 → align 清脏；确认关闭，查看器不打开 |
| R3 | 创作者 | 确认中选「保持现状查看」 | 确认关闭，只读查看器打开，头部下方显脏读黄条「当前基于 vN 立项，与最新 vM 不一致：<字段>」+「一键对齐」钮；不阻断创作（§2.6.7 L361） |
| R4 | 创作者 | 查看器内点「一键对齐」 | 同一三选一确认再次唤起（查看器保持在背景）；选重新对齐 → 消息注入且查看器关闭；选保持现状 / 取消 → 仅关确认 |
| R5 | 创作者 | 打开**无脏**节点（含 brief 节点）/ 切换项目 | 无脏 → 直通查看器零回归（与现状逐字一致）；切项目 → 确认与查看器同点复位 |

## 3. 核心机制

### 3.1 触发点映射（设计语 → 现状对应物）

设计原文「重新打开产物编辑」在现状唯一对应物 = **打开 dirty 节点的只读查看器**（平台无产物编辑器，查看器只读语义不变）。映射在设计说明 D1 留痕；后续若建产物编辑器，同一确认组件复用。

### 3.2 单点拦截（StudioApp handleOpenNode）

新增 `confirmNode` state（L105 viewerNode 旁）；handleOpenNode 改判：`node.dirty` 非空 → `setConfirmNode(node)`（不开查看器），否则 `setViewerNode(node)` 直通；项目切换 L274 同点 `setConfirmNode(null)`。

### 3.3 RealignConfirm 三选一确认（新建组件）

新建 `src/studio/RealignConfirm.tsx`：

- `buildRealignPrompt(...)` 纯函数：模板用户消息（契约 §1.1 固定文本，测试断言基准）；
- 三选一确认组件：产物名 / 版本对（基于 vN、最新 vM）/ 命中字段中文名（复用 `dirtyFieldLabel`，与 CanvasBoard 角标 hover、BriefHistoryView 差异摘要同源）/ severity 分级提示 / 影响清单文件名（纯文本提示，**不含「查看影响评估」入口**）；
- 三动作：`[按 vM 重新对齐]`（主钮）→ onRealign；`[保持现状查看]` → onKeepView；`[取消]` → onCancel；不做 Esc / 背景点击关闭（取消钮等价，防误触）。

### 3.4 查看器脏读黄条 + onRequestAlign

StudioViewer refPath 行（L613）之后、body（L614）之前插黄条：`node.dirty` 非空 → 「当前基于 v{since} 立项，与最新 v{latest} 不一致：{字段中文、顿号分隔}」（§2.6.7 L359 简版，**无 [查看影响评估] 钮**）+ `[一键对齐]` 钮 → Props 新增可选 `onRequestAlign`；StudioApp L700-705 渲染接线处下传（dirty 节点 → `() => setConfirmNode(viewerNode)` 再唤起同一确认，查看器保持打开在背景）。

### 3.5 指令层小补（showrunner 脏读纪律第三条，归 feature-001 R-008）

showrunner.md L168-171 脏读纪律段追加：用户经界面确认发来【产物重新对齐】前缀消息时——先 `shortdrama_canvas_get` 核实该节点脏态（无脏 → 告知已对齐，不动作）；核实后按再版剧本第 6 步同款纪律串行委派专职 agent 重生成（提示词 base 用最新立项单 vM，交接物写明旧产物基于 vN 与命中字段）；重生成定稿后调 `shortdrama_canvas.align({ nodeId })` 清脏并推进血缘；用户选「保持现状」时不做任何动作。

## 4. 范围

### 4.1 做

1. 新建 `src/studio/RealignConfirm.tsx`（§3.3 全量：buildRealignPrompt 纯函数 + 三选一确认组件）；
2. `src/studio/StudioApp.tsx`：confirmNode state + handleOpenNode 拦截 + 三动作 handler（onRealign = 关确认与查看器 + `handleSend(buildRealignPrompt(...))`；onKeepView = 关确认 + setViewerNode；onCancel = 仅关确认）+ 项目切换复位 + StudioViewer `onRequestAlign` 下传 + 确认渲染挂载；
3. `src/studio/StudioViewer.tsx`：脏读黄条（§3.4）+ Props 加可选 `onRequestAlign`；
4. `resources/opencode/agents/showrunner.md`：脏读纪律段追加一条（§3.5）+ feature-001 变更记录登记 R-008；
5. 测试：`src/studio/realign-confirm.test.tsx` 新建（**净增恰 1**；既有测试文件全零 diff）；
6. 治理收尾：README 总表增 007 行、偏差清单 B-42 翻态关闭、版本记录增行。

### 4.2 不做（显式排除）

- **影响评估弹窗面板全量 UI 不翻案**：feature-002 §4.2 L82 排除的勾选列表 / 批量三选一 /「查看影响评估」入口维持排除；本包确认是单产物三选一确认（§2.6.6 L291 独立语义），impactReport 仅文件名提示；
- 画布脏读黄条 / Stage0View 黄条 / 节点 ⚠️ 角标 / StageNavPanel 徽标零 diff（feature-002 既有交付面不动）；
- brief 节点天然不触发（立项节点不挂脏）；「查看历史」diff UI 零 diff（feature-004 已落地）；
- 产物编辑器建设不做（查看器只读语义不变；「重开编辑」→「重开查看」映射已在 §3.1 留痕）；
- STAGE 3-7 产物实际重生成能力不做（B-06；重生成由 Agent 按当时已存在能力执行，平台不假装）；
- 产物文件内部 parentReference 强制、RevisionSource 扩展、Harness 30 天漂移（feature-806）、STAGE 1-2 自动一键重生成编排器，均维持 feature-002 §4.2 排除；
- dev-mock 零 diff（n-outline 脏节点已预置）；确认不做 Esc / 背景点击关闭；
- `shared/types.ts` / `electron/**` / preload / `global.d.ts` / `package.json` / tailwind / vite 配置零 diff；既有 57 个测试文件零 diff。

## 5. 验收标准（AC）

| # | 验收 | 判定方式 |
|---|---|---|
| AC1 | buildRealignPrompt：输出 = 契约 §1.1 固定模板，节点 id / title / vN→vM / 命中字段中文名（dirtyFieldLabel 同源，未收录点路径回退原文）/ 串行委派与 `shortdrama_canvas.align({ nodeId })` 指令逐字在文 | 单测 |
| AC2 | RealignConfirm：渲染产物名 / 版本对 / 中文字段 / severity 两态提示 / impactReport 文件名；三按钮分别触发 onRealign / onKeepView / onCancel 各一次 | 组件单测 |
| AC3 | StudioViewer：dirty 节点显黄条（文案 =「当前基于 vN 立项，与最新 vM 不一致：<中文字段>」）；「一键对齐」钮调 onRequestAlign；无 dirty 无黄条；无 onRequestAlign 黄条无钮 | 组件单测 |
| AC4 | StudioApp 集成：dirty 节点打开 → 确认出现且查看器未开；保持现状 → 查看器开 + 黄条显；查看器一键对齐 → 确认再现；重新对齐 → onSend 收到模板消息（文本断言）且确认与查看器均关；取消 → 确认关、查看器未开、零消息；无脏节点 → 直通零确认（回归）；切项目 → 确认与查看器同复位 | 组件单测 |
| AC5 | 指令层静态验证：showrunner.md 脏读纪律段含新增条（【产物重新对齐】前缀核实 + 串行委派 + align + 保持现状不动作）；feature-001 变更记录 R-008 已登记 | 静态验证 |
| AC6 | 回归红线：`npx tsc --noEmit` 仅 3 条历史基线零新增；全量以 T1 实测基线（上包收尾 57 文件 648 passed / 0 failed / 1 skipped）为准——passed 不减少、skip 不增、failed=0、测试文件净增恰 1（57→58）、既有测试文件零 diff | 全量回归 |
| AC7 | 真机（dev-mock 浏览器预览）：点 n-outline（脏）→ 确认弹（基于 v2 / 最新 v3 / 季边界、集数 / high / 影响清单.v2-v3.json）；三路径逐一目验；保持现状 → 查看器 + 黄条 + 一键对齐再唤起；点 n-scenes（无脏）→ 直通查看器无确认 | 真机 |
