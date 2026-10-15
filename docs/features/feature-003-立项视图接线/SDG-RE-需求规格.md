# feature-003 立项视图接线（Stage0View 真实化）· 需求规格

> 任务包性质：**设计书机制已由 feature-001/002 落地、但 STAGE 0 专属视图仍是 feature-025 静态原型壳的接线包**（纯 renderer，零卡口：无 K1 / K8 / K9）。
>
> 事实源：[短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §2.6（L116–357，立项对话模型）、§2.6.1（L120–143，随时呈现已捕获内容、「已捕获口径」常驻区）、§2.6.8（L359–383，立项画布线性收敛链与界面对应）、§2.6.6（L249–299，STAGE 0 视觉与再版脏态）。
>
> 前置已闭环：[feature-001 立项模型重建](../feature-001-立项模型重建)（B-01/B-02：0-final 单门、立项单版本化双写）、[feature-002 立项后变更与影响评估](../feature-002-立项后变更与影响评估)（B-03：briefVersion/parentReference/dirty）、feature-801（B-04 manifest 七态）、feature-807（B-14/B-15 门防护，T6 真机回归已过）。
>
> 溯源标签：**[改编]**（Design 原型已有立项页形态，本包把假数据原型接线到既有真实数据面，交互/视觉对齐原型，数据来自自有 MCP/IPC 链路）。

## 1. 背景

feature-001 明确「不做 Stage0View 接 IPC」，立项交互全部由右栏对话流 + 门卡承载。业务主链因此已完整可跑（新建项目 → 立项对话 → 0-final 定案 → manifest 推进 story-outline），但**点顶栏/左栏 STAGE 0 进入的中栏视图仍是原型页**：

- [Stage0View.tsx](../../../src/studio/Stage0View.tsx) 是 feature-025 的静态演示壳：项目名、双卡内容、版本徽标全部写死为「安妮的夏天」假数据，底部还有「随机假数据 / 模拟定案 / 强制门 / 模拟推进」**演示控制条**（本地 React state，无任何写盘）。
- [StudioApp.tsx](../../../src/studio/StudioApp.tsx) L510 传入的版本号在画布中找的是节点 `id === 'n-brief'`；真实发布链写出的节点 id 是 [`step-0-brief`](../../../electron/brief/publish.ts)（`n-brief` 仅存于 [dev-mock-api.ts](../../../src/dev-mock-api.ts) 演示夹具）。故真机该 props 恒走 fallback `'v1'`。
- renderer 侧数据面其实已齐备：`canvas.get` / `canvas.onChange` 推全量 `Canvas`（含 `step-0-brief` 节点的 `ref.path`、`meta.version`、`dirty`）；`file:read` 可在项目沙箱内只读 `.json/.md`（≤1MB）；`gate.decide` / `gate.onChanged` 已驱动右栏定案门卡。**立项单 JSON 内容从未在中栏被真实渲染过。**

本包把静态壳替换为**真实立项单的只读视图**，并修复版本号节点 id 错配；不新增任何写通道（再版、定案、改口径仍只走对话）。

## 2. 谁在什么场景下要做什么

| # | 角色 | 场景 | 要做什么 | 达成效果 |
|---|---|---|---|---|
| R1 | 创作者 | 新建项目后点 STAGE 0（尚未立项） | 看到空态引导：立项是一段对话，在右栏回答 Agent 的反问；视图不展示任何假项目名/假双卡 | 空态诚实、无演示控件；不会误以为项目已被预填 |
| R2 | 创作者 | 立项对话进行中、尚未定案（无 done 节点） | 视图呈现「立项中」态与当前流程提示；右栏对话与门卡仍是唯一交互面 | 中栏不与对话抢交互；不展示未落盘的草案/候选态 |
| R3 | 创作者 | 定案发布 v1 后停留在 / 进入 STAGE 0 | 看到真实项目名、真实版本徽标 vN、定案态；双卡区域展示立项单真实内容（六要素 / 故事前提 5 项 / 风格引用 / 项目性质 / 拍板方式与时间） | 视图与 `立项单.vN.json` 逐字段一致，无「安妮的夏天」残留 |
| R4 | 创作者 | 已发布立项，STAGE 1+ 再版后回到 STAGE 0 | 徽标显示新版本；若画布存在 dirty 节点，视图顶部出现与 DAG 同源的脏读黄条（只读，无按钮） | 与 feature-002 的 `✓ vN` / `vN ⚠️k` 语义一致 |
| R5 | 创作者 | 0-final 门 pending 时查看 STAGE 0 | 视图门区显示「待你定案」状态提示；批准/驳回操作仍在右栏 GateCardView 完成（stage0 布局下右栏仍在） | 审批入口唯一，不出现两处可点的定案按钮 |
| R6 | 创作者 | 想回到创作画布 | 点左上「← 返回画布」恢复 DAG 中栏（既有 onBackToDag 行为保留，真实化后仍可用） | STAGE 0 视图与 DAG 双向可达 |

## 3. 核心机制（对齐设计书的实现口径）

### 3.1 视图状态机（以画布事实驱动，四态）

事实全部来自 `Canvas`（订阅流，无新 IPC）：

1. **空态 `empty`**：`canvas.nodes` 中不存在 `id==='step-0-brief'` 且 `status==='done'` 的节点。展示空态引导卡（对话立项说明 + 右栏提示），不读任何立项单文件。
2. **定案态 `published`**：存在该 done 节点且 `ref.path` 形如 `立项单.vN.json`。经 `file:read` 读 JSON，解析为 `ProjectBrief`，渲染真实内容；读失败见 §3.4。
3. **门待决定态叠加**：`canvas.gates` 中存在 `gateId==='0-final' && status==='pending'` 时，无论节点是否已存在，门区显示待决提示；裁决按钮仍在右栏。`rejected` 显示最近驳回事实（若 gate 对象仍在），提示在对话中继续。
4. **脏读态叠加**（不改变主态）：`canvas.nodes.some(n => n.dirty)` 时顶部黄条，计数与字段取自 dirty 节点（复用 feature-002 既有展示口径），**纯文本、无按钮**（对齐 feature-002 刻意不做一键对齐 UI 的边界）。

### 3.2 真实数据到原型双卡的映射（只投影已落盘事实）

设计书 §2.6.8 线性链「① 选题诊断 → ② 故事前提 → 🚪 定案卡」。立项单 `ProjectBrief`（[shared/types.ts](../../../shared/types.ts) L110–122）落盘字段与原型双卡的映射：

- **项目名 / 标题**：来自 `canvas.title`（项目库事实），不再使用 `projectTitle` props 兜底假值；缺失时显示真实项目目录名（StudioApp 侧既有 projectTitle 已来自真实项目，接线以画布/项目真实值为准）。
- **选题诊断卡（卡①）**：渲染 `kind`（商业短剧/个人纪念）+ `fiveElements` 六字段（作品名/类型/平台/集数/单集时长/画幅）+ `diagnosisSummary`（有则展示，无则收起该小节）。对标/洞察/钩子/合规明细按设计本就「留在对话流」，**不伪造**。
- **故事前提卡（卡②）**：渲染 `premise` 五项（leads/time/place/coreEvent/seasonBoundary）+ `故事背景档案.md` 原文折叠区（见 §3.3）。
- **风格引用**：渲染 `style.mainStyleId` + `style.catalogVersion`（成对）+ 可选 `auxiliaryStyleId`。
- **定案卡/版本区**：`version`（与 `meta.version` 一致时以文件内 `version` 为准展示 `vN`）、`approve.by`（gate=门批 / verbal=口头拍板，口头附 `verbal.quote` 原话）、`approve.at`、`changesFromPrevious.length`（v1 为 0，展示「首版」；vN 展示「相对 v(N-1) 的 N 处变更」条数，**不做字段 diff 展开**——diff 视图属另一遗留项）。
- 值为「待定」的字段：按 BriefPlan 语义以中性「待定」徽标原样展示（立项单允许显式待定），不补白、不猜。

### 3.3 故事背景档案.md 的读取与降级

showrunner 第 0 步在拍板前写项目根 `故事背景档案.md`（人确认的原始事实，设计书 §2.6.8 数据模型点名）。视图在 published 态下**尝试** `file:read({ path: '故事背景档案.md' })`：

- 成功：卡②内折叠展示原文（md 以等宽/预格式化只读文本呈现，**不引入 markdown 渲染依赖**；K9 不触发）。
- `NOT_FOUND`：静默隐藏该折叠区（旧项目/Agent 未写属正常），不报错、不占位。
- 其他错误（越界/超限/格式）：折叠区内一行弱化错误文案，不影响立项单主体渲染。

### 3.4 立项单读取失败语义

- 节点存在但 `ref.path` 缺失/非 `.json`：视图主区显示「立项产物引用缺失」错误态（附节点 id），不回退假数据。
- `file:read` 返回 `NOT_FOUND`：错误态「立项单文件缺失：<path>」（文件被外部移动的可见失败，宁可失败可见）。
- JSON 解析失败 / schemaVersion 非 2：错误态「立项单格式不受支持」+ 原始路径；不做字段级迁移（读通道无迁移职责）。
- 读取期间：骨架/加载态，不闪假数据。

### 3.5 交互边界（只读视图）

- 中栏视图内**不可编辑任何字段**：设计书要求口径「随时可改」，但改动通道是对话（showrunner 再版六步 + brief.impact 三工具）；feature-002 已明确弹窗/直接改字段 UI 不做。卡上字段以只读样式呈现，可附一句「在对话中提出修改即可再版」。
- 定案/驳回按钮不进中栏：stage0 布局下右栏 `<ChatComposer>` 仍挂载（StudioApp L556–567，与 centerView 无关），GateCardView 是唯一裁决控件。中栏门区只做状态镜像。
- 「推进 STAGE 1」动作：manifest 推进由发布链自动完成，无按钮；定案后用户点顶栏 STAGE 1 或返回画布即可。删除原型「模拟推进 / 强制门 / 随机假数据」全部演示控件。
- 返回画布：保留左上返回按钮，行为不变。

## 4. 范围

### 4.1 本包做

- 重写 [Stage0View.tsx](../../../src/studio/Stage0View.tsx)：删除全部假数据常量与演示控制条；实现 §3.1 四态 + §3.2 字段映射 + §3.3/3.4 读取与降级；props 改为接收 `Canvas`（及必要的 projectTitle），内部经 `window.api.fileRead` 读两份产物；样式沿用原型双栏/定案卡视觉骨架与既有 Tailwind 色值。
- [StudioApp.tsx](../../../src/studio/StudioApp.tsx)：
  - L507–512 `<Stage0View>` 调用点改为传真实 `canvas`（+ 既有 projectTitle/onBackToDag），**删除 `n-brief` 错配表达式**；版本徽标由 Stage0View 内部从节点/文件自取。
  - 核实顶栏 STAGE 0 pill、StageNavPanel onSelect 进入 `centerView='stage0'` 的既有链路无需改动（只改视图内容）。
- 新建 `src/studio/stage0/`（或同目录单文件辅助，编码时取最简）：
  - 纯函数 `selectStage0State(canvas)`：输出 `{ phase, briefNode, gate0, dirtyCount, dirtyFields }`，**不碰 fs/不碰 window.api**，可单测；
  - `parseBriefJson(content): { ok: true; brief: ProjectBrief } | { ok: false; reason }` 纯解析/形状校验（仅校验本视图所需字段，不做全量 schema 迁移）。
- 测试：
  - `src/studio/stage0-view.test.tsx`（新）：四态渲染（empty/published/门 pending 叠加/脏读叠加）、真实字段映射（含待定/无 diagnosisSummary/口头拍板原话/v1 首版文案）、n-brief 缺失时不显示假数据、读失败三分支、背景档案 NOT_FOUND 静默与错误降级、返回按钮回调。
  - `selectStage0State` 纯函数用例（无节点/有 done/有 rejected gate/脏计数）可并入同套件。
- 治理收尾：features/README 增 003 行；偏差清单登记「Stage0View 静态壳已接线（feature-003）」并更新对应遗留描述；版本记录留痕。

### 4.2 本包不做（显式排除）

- **不做「已捕获口径」常驻区**（§2.6.1 点名、对话期间的实时候选态面板）：候选态只存在于 Agent 会话内存，renderer 无对应通道；它与本包「已落盘立项单只读投影」是两件事，另立包。
- **不做历史版本列表 / 两栏 diff 视图 / 一键回滚 UI**（§2.6.5）：`brief.list` 是 Agent 侧 MCP 工具，renderer 无列举通道；本包只展示最新版。
- **不做影响评估弹窗 / 勾选重生成 / 一键对齐按钮**（feature-002 §4.2 已划线；renderer↔主进程写通道包未建）。
- **不做中栏内嵌定案门按钮**：审批仍在右栏 GateCardView 单点；不接 `gate.decide` 到 Stage0View。
- **不做字段直接编辑 / 表单回填**：再版只走对话。
- **不新增 IPC / preload / MCP 工具**：不加新错误码、不动主进程、不新增 npm 依赖（md 原文不渲染只预格式化）。
- **不改 shared/types.ts、不改 manifest/canvas/brief 任何主进程逻辑、不改 showrunner.md 纪律**。
- **不做风格名称解析**（VisualCatalog 的 18 条是硬编码原型数据、非谱系事实源）：风格区显示 ID + catalogVersion 文本；名称映射待谱系运行时数据包（B-05 运行时核对已在 Agent 侧，renderer 侧无通道）。
- **不做选题诊断明细（对标/洞察/钩子/合规）回填**：明细设计上留在对话流；只展示 `diagnosisSummary`。
- **不删除 dev-mock-api.ts 的 `n-brief` 夹具**（feature-801 演示/其他测试可能引用；编码时 grep 确认引用面，仅在确属死数据时另议，不在本包顺手扩大）。
- 不碰打包（B-11）、不替 B-10 做 Windows 真机验收。

## 5. 验收（业务层）

- AC1：新建（initiating，画布无 step-0-brief 节点）项目点 STAGE 0：中栏为空态引导，无「安妮的夏天」、无演示控制条、无版本徽标；右栏对话正常可用。
- AC2：经对话完成立项（0-final 批准，写出 `立项单.v1.json/.md`）后，中栏展示真实项目名、徽标 v1、定案方式=门批、六要素/前提五项/风格 ID+谱系版本与 JSON 逐字段一致；卡②背景档案折叠区可读（文件存在时）。
- AC3：口头拍板路径发布的立项单，定案区显示「口头拍板」与用户原话 quote；v1 显示「首版」，changesFromPrevious 不展开。
- AC4：v2+ 再版（feature-002 链路）后进入 STAGE 0：徽标为最新 vN；画布有 dirty 节点时顶部黄条显示计数，文案与 DAG 黄条同源；黄条无任何按钮。
- AC5：0-final pending 时中栏门区显示待决提示但**无批准/驳回按钮**；右栏 GateCardView 批准后，中栏不经刷新自动转为定案态（canvas 订阅推送驱动）。
- AC6：立项单 JSON 被外部移走 / 内容损坏 / ref.path 缺失，三种情况分别显示诚实错误态，不出现任何假数据回退；背景档案缺失时该折叠区静默消失、无错误打扰。
- AC7：StudioApp 中不再出现 `n-brief` 字面量；顶栏 STAGE 0 与左栏导航进入该视图、左上返回画布均正常。
- AC8：`npm run typecheck` 不新增错误（基线以开工时实测为准记录于任务清单）；新测试套件全绿；全量回归 passed 不减少、skipped/failed 不扩大。
- AC9：K1/K8/K9 零触发：shared/types.ts、preload.ts、主进程 IPC 注册、package.json 依赖均无 diff（测试夹具类型复用除外，须在变更记录中说明）。
