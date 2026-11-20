# SDG-RE-契约 · feature-013 立项视图直改与导航增强

> **卡口声明**：本包 **K1 条件触发**——仅当决策点 1 拍板「入立项单 v2 模型」时，`shared/types.ts` `ProjectBrief`/`BriefDraft` 增 L0 可选字段（§1.1 字段方案，随包呈报，用户批准后方可动 shared）；**K8 触发**——`brief:update` 白名单扩键（§2.1，循 feature-810 `catalogVersion` 扩键先例），preload/global.d.ts/dev-mock 三端镜像同步属本次登记范围；**零新 IPC、零新推送、零新 MCP 工具（恰 28）、四 Agent 白名单零 diff（恰 23）、零新依赖（K9 零触发）为零 diff 红线**。**实施中一旦触碰未登记卡口（新增 IPC/推送/工具、动其他共享类型、引依赖、动 Agent 白名单）→ 立即停手呈报，不得自行扩面。**

## 1. 数据面契约

### 1.1 L0 字段方案（决策点 1 拍板 A 时生效；K1 字段方案）

```ts
// shared/types.ts —— ProjectBrief / BriefDraft 既有字段不动，追加同一可选分组
export interface BriefL0 {
  tags?: string[]    // 项目标签；空数组等价未设置；仅元数据（002 分级表低级）
  notes?: string     // 项目备注；自由文本；仅元数据（002 分级表低级）
}
export interface ProjectBrief {
  // ……schemaVersion/version/kind/fiveElements/premise/style/diagnosisSummary/diagnosisDetail/approve/changesFromPrevious/publishedAt 原样保留
  /** L0 元数据（feature-013，决策点 1 拍板 A 落地）；低级字段：不入影响清单、直接随再版落盘 */
  l0?: BriefL0
}
export interface BriefDraft {
  // ……既有字段原样保留
  l0?: BriefL0       // 参与字段级 diff（diffBrief 命名空间扩 'l0.tags' / 'l0.notes'）
}
```

| 规则 | 口径 |
|---|---|
| 项目名 | **不入模**：维持 `.session.json`（`ProjectSession.title`）+ `project:rename` 既有通道（B-19 已批），本包零数据面迁移 |
| 写入点 | 立项视图 L0 区编辑随面板一次提交 → `brief:update` patch 携 `l0` 键组 → `updateBriefFields` 同一骨架再版落盘 |
| 影响分级 | `l0.tags` / `l0.notes` 归**低**级：不入影响清单、不挂脏（002 L48 分级表预留落地的正式启用）；同批含 L1/L2 改动时照常入清单，低级字段不单独触发任何下游动作 |
| 兼容 | 可选字段；存量立项单（无 `l0`）读取不破坏、diff 不误报、历史回滚不受阻 |
| 回滚 | 回滚 = 旧版内容再发一版（004 既有），`l0` 随旧版内容自然回滚，零额外机制 |
| 备选（拍板 C 时） | 不动 shared；新建项目根 `立项元数据.json` sidecar（tags/notes 直写覆盖、不版本化、不入 diffBrief/影响清单）；读写落点与文件形状在 T2 实施前按拍板结论补入本节，不脑补 |

### 1.2 diffBrief 命名空间扩键（K1 连带，拍板 A 时生效）

- `electron/brief/diff.ts` Δ 字段路径命名空间（002 L42：`kind` / `fiveElements.*` / `premise.*` / `style.*` / `diagnosisSummary` / `diagnosisDetail`）追加 `l0.tags` / `l0.notes` 两条；数组按整体值比对（from/to 序列化口径与既有字段一致）；
- `electron/brief/impact.ts` 分级表低级区启用：`l0.*` 命中即低级——**过滤不入清单**（002 L48「不在清单中（直接落盘）」）；`assessImpact` 返回形状零变化。

## 2. 通道契约

### 2.1 brief:update 白名单扩键（K8 登记）

现有白名单（main.ts L218-266）：`kind`（枚举 commercial/memorial）+ `fiveElements{episodeDuration, episodeCount, aspectRatio}` + `style{mainStyleId, auxiliaryStyleId, catalogVersion}`。本次扩键后受理全集：

| 键组 | 扩键 | 校验口径 |
|---|---|---|
| `kind` | （既有，不动） | 枚举校验不变 |
| `fiveElements` | + `genre`、`tone`；+ `platforms` | genre/tone 为 string（trim 后非空由就绪闸把守）；platforms 为 string[]、逐元素非空 string；**不新增枚举闭集表**（规格校验由 806 harness `SPEC_FIELD_ENUM` 兜底） |
| `premise`（新键组） | `leads` / `time` / `place` / `coreEvent` / `seasonBoundary` | 逐键 typeof string；空串由就绪闸 `PREMISE_MISSING` 拦截 |
| `style` | （既有，不动） | 不变 |
| `diagnosisSummary` | 新增顶层键 | string；可选字段，不参与就绪闸 |
| `l0`（拍板 A 时新增键组） | `tags` / `notes` | tags 为 string[]（逐元素 string）；notes 为 string |
| `diagnosisDetail` | 视决策点 2 拍板：直改则同上受理；保持只读则**不受理**（恒只读语义不变） | 同上 |

- patch 为空判定扩展为全部键组（现状 L262-264 仅判三组）；
- `electron/brief/update.ts` `BriefUpdatePatch`（L19-32）与 draft 合并段（L69-95）同步扩键；流程骨架（就绪闸 → 复算 → 双写 → 影响清单 → manifest → 挂脏单次队列写）**逐字不动**；approve.by 恒 'ui'、decisions 恒 'mark' 语义不变；
- preload `updateBrief` 桥类型（preload.ts L21-25）、`src/global.d.ts` DTO 镜像（L76 起）、`src/dev-mock-api.ts` 演示桩（L573）三端同步，属本次 K8 登记范围；
- **扩键后 IPC 总数不变**（仍恰 1 个 `brief:update`）；不新增任何 `ipcMain.handle`。

### 2.2 版本历史通道（复用，零扩面）

- 左栏 hover 历史 = 既有 `brief:history`（main.ts L270 → history.ts `readBriefHistory`），返回 `BriefHistoryItem[]`（version/path/publishedAt/kind/approveBy/changeCount/note）+ latestVersion + warnings；renderer 懒加载 + 会话内缓存，重复 hover 不重复拉取；
- `brief:version-read` / `brief:rollback` 本包**不消费**（历史 diff 视图与回滚 UI 不属本包）。

## 3. renderer 契约

### 3.1 立项视图全字段直改（Stage0View.tsx）

| 项 | 口径 |
|---|---|
| 控件分层 | 逐字段控件形态冻结于设计说明 §2 D2 字段分层表；全部可改字段无 disabled、无锁形 icon（§2.6.6 红线） |
| 提交语义 | 面板批量 diff 一次提交（决策点 3 拍板 A）：`共 N 处变更` 清单逐条列字段路径 + 新旧值（沿用现状 diffs 形态），一次 `brief:update` 完成再版 |
| 文案清理 | L588「故事前提为开放式文本，修改请在右侧对话中提出」与 L453「题材、故事前提等开放式修改在右侧对话中提出」按全字段可改后事实改写（对话兜底入口保留说明）；诊断明细若保持只读，其只读提示保留 |
| premise 衔接 | 卡② premise 五子项直改控件嵌入既有分色体系；009 human/ai 确认色与「不可篡改」徽标数据流零 diff——人经面板直改即 human 语义（设计说明 §2 D5） |
| 就绪红线 | 主风格非空 + 时长/集数/画幅非空串等 evaluateDraft 既有判定不变；直改致草案不就绪 → 同码 `BRIEF_NOT_READY` 拦截、零写盘 |

### 3.2 导航增强（StageNavPanel.tsx + StudioApp.tsx）

- **hover 历史卡**：StageNavPanel STAGE 0 徽标（L120-123 现状 `✓ vN` / `vN ⚠k` 不动）hover 时渲染历史卡——列表项 = version + publishedAt（本地化短格式）+ `+N 改动`（changeCount）+ 拍板方式中文标签（gate→门拍板 / verbal→口头拍板 / ui→面板直改）；`briefVersion === null`（未发布）不渲染卡；拉取失败降级为现状 title 文案，不报错不阻塞；
- **titlebar tooltip 统计口径**（决策点 4 拍板 a）：StudioApp stage-track STAGE 0 步骤（L529）title 改为——已发布时 `立项 v{N} · {X} 产物已对齐 · {Y} 待处理`；其中 **vN = 与左栏徽标同源派生**（canvas brief 节点 meta.version 与 dirty latestBriefVersion 取大，StageNavPanel L45-49 同算法，抽同一纯函数防两套口径）；**Y = dirty 节点数**（与左栏 ⚠k 同数）；**X = status==='done' 且带 parentReference 且非 dirty 的下游产物节点数**（brief 节点自身不计入）；Y=0 时按设计书 L306 显示 `立项 v{N} · 全对齐` 变体；未发布立项保持现状 `STAGE 0 · 立项` 文案；
- 两处均消费 canvas 既有订阅全量（`canvas:changed` 已达 renderer），**零新 IPC、零新推送**。

## 4. 最小 diff

| 类别 | 文件 |
|---|---|
| 新增 | 对应新测试文件（test/ 或同目录 *.test.ts(x)，T1 登记净增数）；拍板 C 时新增 `electron/brief/l0-meta.ts` sidecar 读写模块（拍板 A 时无） |
| 修改 | `shared/types.ts`（仅拍板 A：`ProjectBrief`/`BriefDraft` + `BriefL0`，K1 批准后）；`electron/brief/diff.ts`（命名空间 +2，拍板 A）；`electron/brief/impact.ts`（低级命中启用，拍板 A）；`electron/brief/update.ts`（`BriefUpdatePatch` + 合并段扩键）；`electron/main.ts`（仅 `brief:update` 白名单与空判段，L218-266 内）；`electron/preload.ts`（updateBrief 桥类型）；`src/global.d.ts`（DTO 镜像）；`src/dev-mock-api.ts`（演示桩同步）；`src/studio/stage0/Stage0View.tsx`（BriefEditPanel 全字段 + L0 区 + premise 卡直改 + 文案清理）；`src/studio/canvas/StageNavPanel.tsx`（hover 历史卡）；`src/studio/shell/StudioApp.tsx`（STAGE 0 tooltip）；新纯函数文件（如 `src/studio/canvas/brief-version.ts` 派生口径同源抽取 + 对齐统计纯函数，落点以 T 实施为准、不越本白名单） |
| 文档 | 本包五文件；features/README 增 013 行；版本记录（收尾增行） |
| 零 diff 红线 | 既有 28 个 MCP 工具实现与注册数；四 Agent 白名单（showrunner 23 / writer 5 / media-director 9 / comfyui-operator 9）；主进程其余 IPC 与全部 preload 桥（除 updateBrief 类型同步）；`package.json` 零依赖变更；009 premise 分色/徽标数据流；002 追溯算法与三选一语义；004 三 IPC 实现；806 harness 校验规则；画布/门/manifest 状态机；`ProjectBrief` 既有十字段（拍板 A 时亦只增不改） |

## 5. 测试契约

1. `brief:update` 扩键单测：各新键组合法/非法入参（genre 空串、platforms 非数组、premise 缺键、非 string 值）→ 同码 `INVALID_ARGUMENT`；合法 patch 全链路再版（json+md 双写、approve.by='ui'、影响清单落盘、命中节点恒 mark 含 markedAt）；空 patch 判定覆盖新键组；
2. K1 字段单测（拍板 A）：`l0` diffBrief 命名空间两条命中；`assessImpact` 低级过滤不入清单；存量无 `l0` 立项单读取/diff/回滚兼容；回滚带 `l0` 内容回滚；
3. 直改面板组件单测：全字段控件渲染无 disabled；批量 diff 清单字段路径文案；提交后版本 +1 与错误上屏（`data-stage0-edit-error` 既有凭据）；premise 控件嵌入分色体系且 009 徽标断言不破坏；
4. hover 历史卡组件单测：已发布渲染列表（版本/时间/改动数/拍板方式四要素）；未发布不渲染；拉取失败降级 title；
5. tooltip 统计单测：X/Y 口径（Y=dirty 数与左栏同数；X=done+parentReference+非 dirty+非 brief 节点）；全对齐变体文案；未发布降级现状文案；vN 派生与左栏同源（同一纯函数）；
6. 全量回归：T1 冻结基线（承 806 T7：66 文件 761 passed / 0 failed / 1 skipped；tsc 恰 3 条）不恶化——passed 不减少、skip 不增、failed=0；测试文件净增数 T1 后登记；
7. 静态验证：Grep 复核工具恰 28、四白名单恰 23/5/9/9、IPC 数不变（`ipcMain.handle` 计数零增）、`package.json` 零 diff；
8. T8 真机目验：需求规格 AC9 三腿（三类字段直改再版实证 / L0 落盘读回 / hover 历史卡 + tooltip 统计上屏），截图留证。

## 6. 卡口与越界处置

| 情形 | 处置 |
|---|---|
| 决策点 1 未拍板或拍板后方案需加必填字段/改既有十字段 | 停手呈报 K1 复议（拍板 C 则不触 shared） |
| 需新增 IPC/推送/MCP 工具、或工具数 ≠28、或要动任一 Agent 白名单 | 停手呈报 K8 复议 |
| 需要日期/校验等第三方库 | 停手呈报 K9（预期为零） |
| premise 直改需动 009 分色/徽标数据面 | 越界：停手呈报，本包只加面板控件 |
| 发现 L0 需入影响清单（低级升级） | 违反 002 L48 分级表与本包拍板，停手呈报 |
| 「反补到立项」按钮 / 历史 diff 视图 / 三选一全量面板需求浮现 | 不纳入本包，登记转后续包 |

---

## 7. D-037 归并契约（文档）

> 沿用现有契约，无新增接口。本轮只登记 feature-003 / 007 / 008 / 009 / 010 / 011 / 012 的现行 renderer 行为，不改变 shared 类型、IPC / MCP、Agent 工具面或落盘格式；其中“无全量面板”的历史排除已由 011 翻案。

### 7.1 视图与链态数据契约

| 对象 | 不变契约 |
| :-- | :-- |
| `Stage0View / useStage0Data` | brief、captures、stages / logline、loading / error 同源消费；不因链态、留存卡或 DAG 另开重复订阅。 |
| `Stage0BriefFull / 门镜像` | 全字段正文 / 直改视图与 logline 分区共用同源数据；门镜像保持只读，confirmed / rejected / 待拍板派生自既有 stages，不触发布闸。 |
| `ChainNode / Stage0Chain` | 五节点 id 保持 style / six / premise / gate / all；label / count / state 为展示派生，数据事实源不回写。 |
| `GateSummary / FloatingSummary` | 固定四门键序与状态色；hover / 点击只控制浮层，原文截取与零门空态沿用既有纯函数。 |
| captures 分组卡 | 只消费 005 的 matchChainTopic / selectChainProgress / selectCaptureGroups；词表、去重和 unmatched 顺序不在 013 复制。 |
| premise 分色 / 徽标 | `selectPremiseConfirmation` 复用 005 的 `matchChainTopic`：命中且存在 confirmed → 绿色「不可篡改」；命中但仅 AI 推断待确认 → 琥珀「AI 拟稿」；未命中 → 原色无徽标。背景档案标题行独立保留绿色「不可篡改」徽标；无新字段、无第三种 confirm_pending 色。 |

### 7.2 单产物重对齐契约

- `RealignConfirmProps.node` 由调用方保证 dirty 非空，`onRealign / onKeepView / onCancel` 三回调不变；`RealignPromptInput { nodeId, title, sinceBriefVersion, latestBriefVersion, fields }` 不变。
- 固定单行模板仍为：`【产物重新对齐】产物「{title}」（节点 {nodeId}）当前基于立项 v{sinceBriefVersion}，与最新立项 v{latestBriefVersion} 不一致，命中字段：{中文字段、顿号分隔}。请按最新立项单 v{latestBriefVersion} 重新生成该产物：按再版剧本第 6 步纪律串行委派专职 agent（交接物写明旧产物基于 v{sinceBriefVersion}、命中字段），重生成定稿后调 shortdrama_canvas.align({ nodeId: '{nodeId}' }) 清脏并推进血缘。`
- 仅经 handleSend 注入；renderer 不新增 canvas.align IPC。字段中文化只复用 dirtyFieldLabel。

### 7.3 影响面板契约

| 项 | 不变契约 |
| :-- | :-- |
| 输入归一 | BriefUpdateResult 与 ImpactReportFile 均归一为 `{ changes, items }`；ImpactItem / CanvasDirty 形状不变，items[].decision 只读。 |
| 入口 | updateBrief 成功且 items>0 自动弹；dirty.impactReport 非空显示黄条按钮并以 fileRead 回读；空清单 / 读取失败按需求 §6.5 降级。 |
| 勾选与动作 | high / medium 分组，defaultAction 映射初值，N=0 禁用；一键重生成选中与仅标记脏两业务动作，Esc / 显式关闭不撤销、不回写。 |
| 批量消息 | 同源扩展 buildRealignPrompt，保留 `【产物重新对齐】` 前缀与勾选产物清单，一次 handleSend；Agent 逐项串行执行，不新增编排工具。 |
| 非阻断与共存 | 面板挂 StudioApp 既有弹层层级，背景点击不关闭；画布 banner、RealignConfirm、806 漂移提醒保持独立。 |

### 7.4 追问 chips、GateHint 与门卡阅读（来自 010）

| 项 | renderer 契约 |
|---|---|
| `parseChatOptions` | 纯函数输出纯文本 chips，完整块至少两条非空选项；流式未闭合时展示原文等待。非锚定闭合块取代末尾锚定，块前后正文均保留；段级剥离防止重复，同一 text 只处理首个闭合块。 |
| ChipRow | 单击复用既有 `onSend` 代发原文；下一条用户消息 trim 后匹配 chip 即 picked，同组 consumed 禁用，流式态不可点。不得直接写 capture 或新建发送通道。 |
| GateHint | 两个既有 GateCardView 挂载点仅在 pending `0-final` 显示固定拍板提示；不自动批准、发布或发消息。 |
| `splitGateQuestion` | 多行 question 去首行 `#` 作短标题，其余为可滚动 Markdown；旧单行密文按首个句读或 24 字兜底。只拆分既有内容，不补齐业务字段。 |

### 7.5 再版影响摘要与 approved 留存（来自 012）

1. GateCardView 只读 `payload.impactSummary`，按改动区 → 影响摘要区 → findings 区组合；缺键、非法形状或空数组不渲染影响区，不伪造空摘要。逐项显示 `label / severity / path / reason / defaultAction`，high / medium 分组保持原序。
2. EmptyStage0 / PublishedBody 从既有 `canvas.project.gates` 选最新 approved `0-final`，复用 GateCardView 显示拍板卡、改动、影响摘要与 findings；不显示批准 / 驳回按钮。pending / rejected 维持镜像条，画布聊天 GateCardView 仍是唯一 pending 裁决入口。
3. 展示失败只降级对应区域，不写回 payload、不重算影响、不重建 findings。impactSummary 归 001，assess 归 002，findings 归 806，门态 / execution 归 801。

### 7.6 编号冲突与通道边界

- 010 AC4「编号混入整块不识别」与 R3「编号字样仍按原文收录」尚未裁决。X-002 只解决块位置；本契约不新增编号清洗、第二解析器或统一 AC，也不改变历史测试结论。
- 继续消费既有 updateBrief、fileRead、canvas.get / canvas.onChange、handleSend 与 capture 数据通道；chips 同样只经 handleSend / showrunner。零新 IPC、零新推送、零新 MCP 工具、零 shared 类型变更。
- 历史最小 diff 白名单与测试计数只用于追溯，不构成本轮写权。013 不定义 runId、changelogDecision、draft 或 execution 字段，所有视觉降级不得反向补写数据。
