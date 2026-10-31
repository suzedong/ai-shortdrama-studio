# SDG-RE-契约 · feature-012 定案门信息完整性与门卡留存

> **卡口声明**：本包 **K1 条件触发**——仅当留存挂载裁决方案 A（gate 快照入 ChatMessage）时触 `shared/types.ts`；推荐方案 B（Stage0View 放行 approved 门卡）下 **shared 零 diff**（门 payload 增键不改 `CanvasGate` 形状，`payload?: unknown`）。**K8 目标零触发**——零新 MCP 工具（影响清单取数用 002 既有 `brief.impact.assess`）、**零新 IPC 为零 diff 红线**；**K9 零触发**——零新依赖。**实施中一旦触碰未登记卡口（新增 IPC/推送、新增工具、改 shared 其他类型、引依赖、动其他 Agent 白名单）→ 立即停手呈报，不得自行扩面。**
> **方案前提**：本契约按需求规格 §6 推荐方案（D-a=A1 / D-b=B1 / D-c=B）撰写；用户批准规格即裁决生效。若用户改裁决他案，实施前须先修订本契约与任务清单（铁律 3 反向同步），不得带旧契约动工。

## 1. 数据面契约

### 1.1 门 payload 影响摘要键（不动 shared，循 806 harnessValidation 同通道先例）

`CanvasGate.payload`（`unknown`，[types.ts](../../../shared/types.ts) L398）内增可选键，形状镜像 [src/global.d.ts](../../../src/global.d.ts)（806 HarnessGateSummary 同区）：

```ts
// 门 payload 增键（再版门携带；首版门无基线不携带）
type ImpactSummaryItemDto = {
  nodeId: string            // 受影响画布节点 id
  fields: string[]          // 命中立项字段
  severity: 'high' | 'medium'
  defaultAction: 'regenerate' | 'mark'
}
type ImpactSummaryDto = {
  assessedAt: string        // ISO，impact.assess 取数时刻（拍板时快照，此后不随改动漂移）
  counts: { high: number; medium: number }
  items: ImpactSummaryItemDto[]
}
// payload 现状三键原样保留：version / pendingMarks / changesFromPrevious；新增第 4 键 impactSummary?: ImpactSummaryDto
```

| 规则 | 口径 |
|---|---|
| 生产者 | showrunner 发再版门前调 `brief.impact.assess`（002 既有工具，零写盘）取数，摘要写入 `gate.request` payload；**Agent 是搬运工，算法全在系统侧既有工具**（D-016） |
| 快照语义 | 门卡展示 = 拍板时快照；拍板后 commit 仍由工具**复算**影响清单（`IMPACT_DECISION_MISMATCH` 兜底语义不变），门 payload 摘要不作写盘依据 |
| 兼容 | 可选键；历史门无此键 → 门卡不渲染影响区、不报错；807 guard 只读 status 与 `payload.version`（[guard.ts](../../../electron/gate/guard.ts) L35+），806 拦截只读写 `harnessValidation` 键（[tools.ts](../../../electron/mcp/tools.ts) L435-467）——增键与两链路零冲突，回归组实证 |
| 首版 | v1 无已发布基线（`BRIEF_NO_BASELINE`），首版门 payload 三键原样、**不增键**——首版流程零行为变化 |

### 1.2 留存挂载数据面（推荐方案 B）

approved 门本持久化于 canvas.json `gates[]`（[bridge.ts](../../../electron/gate/bridge.ts) 不删门），留存挂载**纯 renderer 读取既有画布订阅数据**，零数据面改动、零新 IPC。方案 A（若改裁决）另行修订本节：ChatMessage 增 gate 快照属 K1，字段方案须随修订呈报。

### 1.3 0-final approved 门的版本化重开（D-e E1，2026-10-31 补录）

| 规则 | 口径 |
|---|---|
| 适用范围 | 仅 `gateId === '0-final'`；其余门（1-a / 1-b / 2-a…）approved 一律终态禁重开 |
| 放行条件 | 旧门 `payload.version`（已批准版本）与新请求 `payload.version`（候选版本）均为有效数字，且 **新版本严格大于旧版本** |
| 放行动作 | 以同一 gateId 覆盖旧 approved 门为 `pending`，question / options / payload 全部用本次请求内容（同 rejected 重开语义），不新增门编号 |
| 拒绝条件 | 同版本 / 新版本 ≤ 旧版本 / 任一 version 不可解析 → `INVALID_ARGUMENT`（保留「一张门只授权一版」防护） |
| 解析 | 复用 [guard.ts](../../../electron/gate/guard.ts) `gateVersion`（`payload.version` 为 number 时返回，否则 null） |
| 下游兼容 | 重开后新门绑定新版本号；`assertBriefPublishable` 已有 `gv !== publishVersion → VERSION_MISMATCH`，commit 时版本一致即放行，零行为变化 |

## 2. 通道契约

- **零新 MCP 工具**：影响清单取数 = 002 既有 `brief.impact.assess`；工具总数恰 28 不动；showrunner 白名单恰 23 不动（assess 已在白名单 L30）；其余三 Agent 白名单零 diff。
- **零新 IPC / 零新推送**：门卡数据走既有 gate 通道（bridge.ts → canvas 订阅）；留存挂载走既有 canvas 订阅。若实施发现既有通道无法携带 → 停手呈报，不得私开 IPC。
- **807/806/002 信封码零回归**：BRIEF_GATE_PENDING / BRIEF_GATE_REJECTED / BRIEF_GATE_APPROVED_USE_GATE / BRIEF_GATE_VERSION_MISMATCH（807）；HARNESS_VALIDATION_FAILED（806）；IMPACT_DECISION_MISMATCH / BRIEF_NOT_READY / BRIEF_NO_BASELINE（002）——码值、触发条件、写盘语义全部不变。

## 3. renderer 契约

### 3.1 GateCardView 门卡信息架构（再版门三区）

| 区 | 数据源 | 呈现 |
|---|---|---|
| 改动区（既有） | payload.changesFromPrevious | 现状不变（首版为「首版立项」） |
| 影响清单区（新增） | payload.impactSummary（§1.1） | 仅再版门（键存在时）渲染：分级计数 + 逐项节点/命中字段/severity 中文标签/默认动作；无键零渲染零报错；新增 `data-gate-impact-summary` testid |
| findings 区（806 既有） | payload.harnessValidation blockers | 零行为变化（`data-gate-harness-findings` 既有断言不动） |

### 3.2 approved 门卡留存挂载（推荐方案 B）

- [Stage0View.tsx](../../../src/studio/stage0/Stage0View.tsx) L193 / L485 两处 `state.gate0.status !== 'approved'` 排除改为放行：pending/rejected → 既有 GatePendingStrip 行为不变；approved → 渲染 GateCardView approved 态（复用 [GateCardView.tsx](../../../src/studio/chat/GateCardView.tsx) L71-108 既有渲染，含 findings 块）；onDecide 在 approved 态无可点按钮（组件既有形态即如此），挂载侧零交互新增；
- ChatComposer 仅渲染 pendingGate（L725-728 / L743-748）现状不动——聊天区单点裁决语义不变；808 回放不渲染门卡维持现状（登记留痕）；
- 不新增弹窗、不改 GatePendingStrip、不改 handleDecide（[StudioApp.tsx](../../../src/studio/shell/StudioApp.tsx) L367-378 批准即卸卡的聊天区行为不变——留存面在 Stage0View）。

### 3.3 showrunner.md 纪律改写范围（白名单内仅此 Agent 文件）

1. 再版六步第 3/4/5 步改写为：③impact.assess 预评估取数 → ④发再版门（payload 四键：version / pendingMarks / changesFromPrevious / impactSummary）或口头拍板 → ⑤三选一 commit；「合法裁决点在三选一呈报之后」等 807 约束语义不变，仅时点表述随新顺序对齐；
2. 第 0 步 L132 payload 键说明增补 impactSummary 口径（仅再版携带）；
3. L136 口头拍板两前提①「完整立项定案卡」定义扩为：六要素 + 前提 5 项 + 风格 ID@版本 + 待定点 + 相对上版改动 + **影响产物清单**；两前提骨架、quote 逐字、版本绑定等其余约束逐字不动；
4. 白名单（23）与其他纪律段落零 diff。

## 4. 最小 diff

| 类别 | 文件 |
|---|---|
| 新增 | 对应新测试文件（门卡影响区 / Stage0View 留存挂载组件单测） |
| 修改 | `resources/opencode/agents/showrunner.md`（§3.3 三处纪律改写）；`src/studio/chat/GateCardView.tsx`（影响清单区）；`src/studio/stage0/Stage0View.tsx`（两处放行 + 挂载）；`src/global.d.ts`（ImpactSummaryDto 镜像，如需）；`src/dev-mock-api.ts`（演示桩同步，如需）；既有测试同步（Stage0View 门显隐断言、gate-card 相关断言，如需） |
| 文档 | 本包五文件；features/README 012 行；806 变更记录 X 节翻案修订注（指向本包）；版本记录（收尾增行）；决策台账登记（如用户要求建包期补登则另批，本包建包期不动） |
| 零 diff 红线 | `shared/types.ts`（推荐方案下整个 shared 零 diff；改裁决方案 A 则 K1 另行呈报）；`electron/` 全目录（工具 28 / 807 guard / 806 拦截链 / 002 impact 实现零行为变化）；主进程 IPC/preload 零新增；`package.json` 零依赖变更；其余三 Agent 白名单；ChatComposer / history-replay / 808 回放链路；GatePendingStrip；首版门流程 |

## 5. 测试契约

1. GateCardView 影响清单区组件单测（循 `src/studio/chat/gate-card-harness.test.tsx` 既有模式）：有 impactSummary → 改动区+影响区+findings 区三区并存、分级标签与默认动作上屏（`data-gate-impact-summary` 凭据）；无键 → 零渲染零报错；首版形态（无键）断言保持；
2. Stage0View 留存挂载组件单测：gate0 pending/rejected → GatePendingStrip 既有行为不变；approved → GateCardView approved 态上屏（含 findings 块）、无裁决按钮；无门 → 零渲染；
3. **回归组（写明零回归契约）**：
   - 807：`src/test/gate/gate-guard.test.ts` 23 例全绿（四信封码 + 版本绑定）；
   - 806：harness 校验 + 门联动（HARNESS_VALIDATION_FAILED 零写盘拦截）+ `gate-card-harness.test.tsx` findings 三态全绿；
   - 002：`src/test/brief/brief-impact.test.ts` 24 例全绿（assess/commit/IMPACT_DECISION_MISMATCH/BRIEF_NO_BASELINE）；
4. 静态验证：Grep 复核 `server.tool(` 恰 28、showrunner 白名单恰 23、零新 IPC/推送、`shared/types.ts` 零 diff（推荐方案下）；
5. 全量回归：T1 冻结基线（66 文件 761 passed / 0 failed / 1 skipped；tsc 恰 3 条）不恶化——passed 不减少、skip 不增、failed=0；测试文件净增数 T1 后登记；
6. T-真机目验（Electron 实机 + computer-use UIA/CDP，沙箱项目）：再版新顺序全程——assess 前置取数 → 门卡拍板前同列改动+影响清单 → 拍板 → commit 成功；拍板后 Stage0View 留存卡可见、findings 块上屏；目验毕沙箱清理、真实项目零污染，截图留证（留证归集口径循 806 X 节：截图不落仓库）。

## 6. 卡口与越界处置

| 情形 | 处置 |
|---|---|
| 需要新增 MCP 工具 / 新增 IPC / 新增推送 | 停手呈报 K8 复议（本包目标为零） |
| 需要改 `shared/types.ts`（含用户改裁决方案 A） | 停手呈报 K1 复议，字段方案随呈报 |
| 需要引第三方库 | 停手呈报 K9（预期为零） |
| 需要动 writer / media-director / comfyui-operator 白名单或 showrunner 白名单计数 | 停手呈报 K8 复议 |
| 实施中发现门序扩展（1-a 等）或影响评估面板全量 UI 需求 | 不纳入本包，登记转 806 批二 / 002 排除项另行呈报 |
| 再版新顺序与 807/806 链路出现行为冲突 | 停手呈报（L2 Spec 缺陷），不得自行圆场 |
