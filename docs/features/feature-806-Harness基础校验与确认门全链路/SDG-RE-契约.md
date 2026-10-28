# SDG-RE-契约 · feature-806 Harness 基础校验与确认门全链路（批一）

> **卡口声明**：本包 **K1 触发**——`shared/types.ts` `CanvasDirty` 增 `markedAt?: string`（§1.1 字段方案，随包呈报，用户批准后方可动 shared）；**K8 触发**——新增 `harness.validate` MCP 工具（27→28）+ showrunner 白名单 22→23（§2），gate 通道如需携校验摘要字段一并在此登记（§2.3），零新 IPC 为零 diff 红线；**K9 零触发**——零新依赖（漂移天数用 `Date` 直算，不引日期库）。**实施中一旦触碰未登记卡口（新增 IPC/推送、改其他共享类型、引依赖、动其他 Agent 白名单）→ 立即停手呈报，不得自行扩面。**

## 1. 数据面契约

### 1.1 CanvasDirty.markedAt（K1 字段方案）

```ts
// shared/types.ts —— CanvasDirty 既有五字段不动，追加第 6 个可选字段
export interface CanvasDirty {
  // ……sinceBriefVersion / latestBriefVersion / fields / severity / impactReport 原样保留
  /** 「仅标记脏」动作时间（ISO 8601）；超 30 天未处理触发漂移提醒（不阻塞）。存量数据无此字段 → 不提醒 */
  markedAt?: string
}
```

| 规则 | 口径 |
|---|---|
| 写入点 | 「仅标记脏」挂脏写盘路径（brief.impact.commit 三选一 mark 分支等既有挂脏点），写 `new Date().toISOString()` |
| 刷新 | 同一节点重复仅标记脏 → 刷新为最新时间 |
| 清除 | align 清脏 / 重新对齐后 dirty 整体清除时随脏对象消失，不单独残留 |
| 兼容 | 可选字段；存量无 markedAt 的 dirty JSON 读取不破坏、不提醒、不报错 |
| 消费 | renderer 漂移纯函数直算（§3.2）；不进 parentReference 字段表、不参与 brief 字段级 diff（它是画布脏元数据，非立项字段） |

### 1.2 HarnessFinding / 校验结果结构（主进程新类型，不进 shared）

```ts
// electron/harness/types.ts（新）
export type HarnessCategory = 'structure' | 'content' | 'spec' | 'consistency'
export type HarnessSeverity = 'blocker' | 'warning'
export interface HarnessFinding {
  gateId: string            // 批一恒 '0-final'
  category: HarnessCategory
  checkId: string           // 见 §1.3 枚举
  severity: HarnessSeverity
  message: string           // 中文、可执行修复指向
}
export interface HarnessReport {
  gateId: string
  briefVersion: number
  passed: boolean           // 无 blocker 即 true（warning 不拦截）
  findings: HarnessFinding[]
  checkedAt: string         // ISO
}
```

### 1.3 批一 checkId 枚举（冻结；后续批次只增不改不删）

| category | checkId | 规则 | severity |
|---|---|---|---|
| structure | `STRUCT_REQUIRED_KEYS` | 六要素、前提五键等必填键齐全（键缺失/undefined） | blocker |
| structure | `STRUCT_VERSION_CHAIN` | 立项单 version 与 manifest.briefVersion 一致 | blocker |
| content | `CONTENT_KEY_TEXT_EMPTY` | 诊断摘要、核心事件等关键文本 trim 后为空 | blocker |
| spec | `SPEC_FIELD_ENUM` | platforms 等枚举字段取值越界、字段类型不符 | blocker |
| spec | `SPEC_STYLE_REF_UNKNOWN` | styleRef 风格 ID 不在谱系注册表（复用 802 style.validate；谱系不可装载时降级 warning 并注明） | blocker |
| consistency | `CONSIST_GATE_PAYLOAD_VERSION` | 门卡 payload 版本 ≠ 当前立项单版本 | blocker |
| consistency | `CONSIST_MANIFEST_STAGE` | manifest 当前状态与 0-final 发布动作不匹配 | blocker |

> 批一不设 warning 级固有规则；warning 通道预留给后续批次与谱系降级场景。判定全部确定性、零 LLM、零出网。

## 2. 通道契约

### 2.1 harness.validate（K8，MCP 27→28）

```ts
harness.validate({ projectPath: string; gateId: '0-final' }) → HarnessReport
```

- 主进程 `electron/harness/validate.ts` 纯函数规则集 + `electron/mcp/tools.ts` 注册；读立项单/manifest/门上下文，**只读零写盘**；
- 供 showrunner 确认门前自查与拦截后复查；同一 `runHarnessValidation` 函数被 §2.2 门联动复用，**工具与拦截共享一份规则实现**，禁止两套口径；
- 批一 gateId 仅接受 `'0-final'`，其他值返回参数错误（门序扩展属批二起）。

### 2.2 0-final 门联动（写盘前拦截，循 807 模式）

- brief.publish / 门批准写盘前调用 `runHarnessValidation`：`passed=false` → 拒绝、**零写盘**、返回结构化错误（新信封码如 `HARNESS_VALIDATION_FAILED`，携带 findings）；`passed=true` → 走既有 807 guard 与发布路径，顺序 = harness 校验前置、807 门态防护语义不变；
- 拦截拒绝不修改门态、不产生新版本；修复后重试走同一入口。

### 2.3 白名单与门卡通道（K8 登记）

- showrunner 白名单 **22→23**（仅 +`harness.validate`）；writer 5 / media-director 9 / comfyui-operator 9 零 diff；showrunner.md 增校验纪律（发卡前自查、拦截后按 findings 修复重发，不得口头绕过）；
- GateCardView 校验摘要经**既有 gate 通道**携带（payload 增校验摘要字段 + `global.d.ts` DTO 镜像同步，属本 K8 登记范围）；**零新 IPC、零新推送**；若实施发现既有通道无法携带 → 停手呈报，不得私开 IPC。

## 3. renderer 契约

### 3.1 GateCardView 校验摘要

| 项 | 口径 |
|---|---|
| 数据源 | 既有 gate 通道 payload 校验摘要（§2.3），不自拉数据 |
| 呈现 | 拦截态门卡列出 blocker findings（category 中文标签 + message）；全过时不多加 UI |
| 凭据 | 新增 `data-gate-harness-findings` testid（本包唯一新 testid） |

### 3.2 漂移提醒（B-46）

- 新纯函数 `src/studio/canvas/dirty-drift.ts`：`driftDays(markedAt?: string, now?: number): number | null`——无 markedAt / 非法时间 → null；否则返回整天数（`Math.floor((now - ts) / 86400000)`，未来时间戳按 0 计）；`driftReminderLabel(days)` 仅 `days > 30` 返回「立项基线已漂移 N 天（不阻塞）」；
- 消费点：脏读黄条（CanvasBoard / Stage0View / StudioViewer 既有黄条内追加一行）+ RealignConfirm 卡内提示；**不新增弹窗、不阻断任何既有按钮与流程**；
- 主进程如需同规则（如后续批次）复用同一纯函数实现，不另写第二份天数算法。

## 4. 最小 diff

| 类别 | 文件 |
|---|---|
| 新增 | `electron/harness/`（types.ts + validate.ts 规则集）、`src/studio/canvas/dirty-drift.ts`、对应新测试文件 |
| 修改 | `shared/types.ts`（仅 CanvasDirty +markedAt）；`electron/mcp/tools.ts`（注册 + schema）；`electron/gate/bridge.ts` / `electron/brief/publish.ts`（门联动前置校验，落点以 T 实施为准、不越本白名单）；`electron/brief/impact.ts`（mark 写盘点 markedAt）；`electron/canvas/` 清脏路径（如需）；`resources/opencode/agents/showrunner.md`（白名单 + 校验纪律）；`src/studio/chat/GateCardView.tsx`；`src/studio/canvas/CanvasBoard.tsx` / `RealignConfirm.tsx`、`src/studio/stage0/Stage0View.tsx`、`src/studio/viewer/StudioViewer.tsx`（黄条提醒）；`global.d.ts`（gate payload 镜像，如需）；`src/dev-mock-api.ts`（演示桩同步，如需） |
| 文档 | 本包五文件；features/README 806 行；偏差清单 B-46 行与 §3 路线表；决策台账 D-019；版本记录（收尾增行） |
| 零 diff 红线 | 既有 27 工具实现与其他三 Agent 白名单；主进程 IPC/preload 零新增；`package.json` 零依赖变更；ComfyUI 链；1-a/1-b、2-a~2-c、3-7 门；影响评估面板全量 UI（002 排除不翻案）；`CanvasDirty` 既有五字段与其他共享类型 |

## 5. 测试契约

1. `electron/harness` 单测：§1.3 七条 checkId 各命中/通过；findings 五字段齐全；passed 语义（blocker 才拦截）；谱系不可装载降级 warning；只读零写盘；
2. 门联动单测：blocker → 拒绝 + 零写盘 + `HARNESS_VALIDATION_FAILED` 携 findings（循 807 brief-update/brief 测试断言模式）；全过 → 既有发布路径；拦截不产生新版本、不改门态；
3. markedAt 单测：mark 写入 / 重复标记刷新 / align 清除 / 存量无字段兼容；
4. dirty-drift 单测：null 分支、29/30/31 天边界（>30 才提醒）、未来时间戳按 0；
5. 组件单测：GateCardView findings 上屏（testid 凭据）；黄条与 RealignConfirm 提醒显隐三态（超期/未超期/无 markedAt）；
6. 全量回归：T1 冻结基线（61 文件 722 passed / 0 failed / 1 skipped；tsc 恰 3 条）不恶化，passed 不减少、skip 不增、failed=0；测试文件净增数 T1 后登记；
7. T8 真机目验：AC7 三项（拦截与放行 / 沙箱构造旧 markedAt 看提醒 / capture 跨重启持久化），截图留证。

## 6. 卡口与越界处置

| 情形 | 处置 |
|---|---|
| 需改 `CanvasDirty` 以外共享类型、或 markedAt 方案要加必填字段 | 停手呈报 K1 复议 |
| 需新增 IPC/推送、或工具数 ≠28、或要动其他 Agent 白名单 | 停手呈报 K8 复议 |
| 需要日期/校验第三方库 | 停手呈报 K9（预期为零） |
| 实施中发现门序/下游产物需求（1-a 等） | 不纳入批一，登记转批二 |
| 校验规则需引入主观/LLM 判定 | 违反 D-016 与 §9 基础校验定位，停手呈报 |
