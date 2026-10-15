# feature-807 确认门口头拍板约束与门态防护 · 接口与数据契约

> 事实源：[需求规格](./SDG-RE-需求规格.md)、[shared/types.ts](../../../shared/types.ts)、[tools.ts brief.publish](../../../electron/mcp/tools.ts#L362-L417)、[gate/bridge.ts](../../../electron/gate/bridge.ts)。
>
> **卡口判定**：本包**不新增 / 不删除 MCP 工具**（工具总数保持 22），**不改 shared/types.ts（无 K1）**。变更性质＝给既有 `brief.publish` 增加拒绝分支（既有工具契约收紧）+ 新增错误码。按《AI-SDG-AI工具执行指令.md》§4，此为既有工具行为契约变更，须在本契约报批、用户批准后方可编码。

## 1. 门态数据来源（只读，零结构改动）

- 经既有 `canvasStore.get(): Promise<Canvas>` 读取当前项目画布；门在 `Canvas.gates: CanvasGate[]`（[types.ts L364-382](../../../shared/types.ts#L364-L382)）。
- `CanvasGate`：

```ts
interface CanvasGate {
  gateId: string            // STAGE 0 固定 '0-final'
  status: 'pending' | 'approved' | 'rejected'
  question: string
  options: string[]
  payload?: unknown         // 发门时写入 { version, pendingMarks, changesFromPrevious }
}
```

- 门绑定版本＝`(gate.payload as { version?: number } | undefined)?.version`。showrunner 发门已写 `payload.version=plan.nextVersion`（[showrunner.md L100](../../../resources/opencode/agents/showrunner.md#L100)）。
- 门只按 `gateId==='0-final'` 过滤；一个项目同一 gateId 经 bridge 重开会覆盖（gates 中通常至多一条 0-final；防护取「最后一条匹配」作为当前门，历史多条时取 updatedAt 最新——若结构无时间字段则取数组末位，编码时按 CanvasGate 实况确认并在设计说明注明）。

## 2. 纯函数契约（electron/gate/guard.ts，新建）

> 文件名 / 放置模块为设计说明可调项；函数签名以本契约为准。全部同步纯函数，不碰文件系统。

```ts
import type { CanvasGate } from '../../shared/types.js'

export type GateGuardCode =
  | 'BRIEF_GATE_PENDING'
  | 'BRIEF_GATE_REJECTED'
  | 'BRIEF_GATE_VERSION_MISMATCH'
  | 'BRIEF_GATE_APPROVED_USE_GATE'

export interface GateGuardViolation {
  code: GateGuardCode
  message: string
}

/** 取当前生效的 0-final 门；无则 null。多条时取最新一条 */
export function findBriefGate(gates: CanvasGate[]): CanvasGate | null

/** 读门绑定版本；历史门无 payload.version 返回 null */
export function gateVersion(gate: CanvasGate): number | null

/**
 * 立项发布门态判定。
 * @param gate  findBriefGate 结果
 * @param approve  brief.publish 入参的 approve（by / verbal / note）
 * @param publishVersion  本次将发布的版本号（= listBriefVersions().latestVersion + 1）
 * @returns null 表示放行；否则返回违例（工具层据此 fail，零写盘）
 */
export function assertBriefPublishable(
  gate: CanvasGate | null,
  approve: { by: 'gate' | 'verbal'; verbal?: { quote: string } },
  publishVersion: number,
): GateGuardViolation | null
```

### 2.1 判定真值表（以 gateVersion 是否可解析分两表）

门可解析版本（gv === number）：

| 门状态 | gv vs publishVersion | approve.by | 结果 code |
|---|---|---|---|
| null（无门） | — | verbal | null（放行；quote 非空由既有校验负责） |
| null（无门） | — | gate | null（放行，维持现状） |
| pending | 任意 | verbal | BRIEF_GATE_PENDING |
| pending | == pv | gate | BRIEF_GATE_PENDING |
| pending | != pv | gate | BRIEF_GATE_VERSION_MISMATCH（版本不一致优先报版本） |
| rejected | == pv | 任意 | BRIEF_GATE_REJECTED |
| rejected | != pv | 任意 | BRIEF_GATE_VERSION_MISMATCH |
| approved | == pv | gate | null（放行） |
| approved | == pv | verbal | BRIEF_GATE_APPROVED_USE_GATE |
| approved | != pv | 任意 | BRIEF_GATE_VERSION_MISMATCH |

门版本不可解析（gv === null，历史门）：

| 门状态 | approve.by | 结果 | 说明 |
|---|---|---|---|
| pending | 任意 | BRIEF_GATE_PENDING | 保守拦截，指引同 gateId 重挂 |
| rejected | 任意 | BRIEF_GATE_REJECTED | 保守拦截，指引改稿重发 |
| approved | gate | null（放行） | 不锁死存量正常续跑 |
| approved | verbal | BRIEF_GATE_APPROVED_USE_GATE | 有门裁决须走 by:gate |

> 错误码粒度卡口项：上表为默认方案（4 码）。备选收敛为单码 `BRIEF_GATE_BLOCKED` + `reason: 'pending'|'rejected'|'version-mismatch'|'approved-use-gate'`。在 [设计说明](./SDG-OD-设计说明.md) §2 给选型，默认 4 码（Agent 与日志可直接据 code 决策，message 可中文）。

### 2.2 message 文案（中文，指引正确动作）

- `BRIEF_GATE_PENDING`：「定案门 0-final 仍在等待用户裁决（v{version}）。禁止用口头拍板绕过：请用同一 gateId 重新调 gate.request 等待按钮结果；若工具调用超时，下回合 canvas_get 后重挂同一门。」
- `BRIEF_GATE_REJECTED`：「定案门 0-final（v{version}）已被用户打回。请按打回意见修改草案、重跑 brief.plan 后用同一 gateId 重发门，不得用旧口头语发布。」
- `BRIEF_GATE_VERSION_MISMATCH`：「存在绑定 v{gateVersion} 的 0-final 门，与本次将发布的 v{publishVersion} 不一致；一张门只授权一版内容，请针对当前版本重新发门。」
- `BRIEF_GATE_APPROVED_USE_GATE`：「v{version} 的 0-final 门已 approved，请以 approve.by='gate' 发布（带门 note），不要对已批准的门再用 verbal 凭证。」

## 3. brief.publish 工具行为变更（既有工具，编号 13）

zod 入参 shape **不变**（不改参数＝前端 / Agent 调用方式零改动）。handler 在既有两道校验之后插入一道：

```
1) loadStyleCatalog + evaluateDraft  → BRIEF_NOT_READY（现状）
2) verbal quote 非空                  → INVALID_ARGUMENT（现状）
3)【新增】门态防护：
     const listing = await listBriefVersions(projectDir)
     const publishVersion = (listing.latestVersion ?? 0) + 1
     const canvas = await canvasStore.get()
     const v = assertBriefPublishable(findBriefGate(canvas.gates), args.approve, publishVersion)
     if (v) return respond(fail(v.code, v.message))   // 必须在任何写动作之前
4) publishV1InQueue(...)               → 写盘（现状）
5) canvasStore.update(...)             → upsert 节点（现状）
```

- 硬性顺序：门态检查必须发生在 `publishV1InQueue` 与任何 `canvasStore.update` **之前**，保证违例零写盘（AC1/AC2/AC5）。
- `listBriefVersions` 与 `canvasStore.get` 均为只读，不引入新写队列动作。
- 返回体成功形状不变（`version/jsonPath/mdPath/changesFromPrevious/canvas`）；失败沿用 `{ ok:false, error:{ code, message } }` 信封。

## 4. 错误码登记

- 新码属 MCP 工具业务错误信封（非 [runtime/types.ts](../../../electron/runtime/types.ts) 的 14 个 runtime 通道错误码）：runtime 通道与纯工具错误信封是两套，本包只在工具信封层加码，不改 runtime 枚举。
- 在设计说明列明是否有「错误码静态清单 / 测试」需要同步（grep `BRIEF_NOT_READY` 的登记点，编码时同步新增码）。

## 5. 再版工具 brief.impact.commit（编号 21）——默认不加门态硬拦截

- 现状：commit 走 feature-002 独立流程（plan→assess→用户三选一→commit），三选一是用户裁决点；本次 v2 即经该流程合法完成。
- 本包**默认不改 commit handler 的门态逻辑**；仅在 showrunner.md 提示词层要求：再版 verbal 须针对「再版定案卡」且经三选一，禁止拿首版 / 旧门口头语直接 commit。
- 卡口备选（设计说明 §3 呈报，默认不采纳）：给 commit 加「存在同版本 pending/rejected 门时拦截」。不采纳理由：再版可不发门（对话三选一），门态与 commit 版本无强制对应，硬拦截会误伤合法无门再版；如需拦截应先定义再版门协议，超出本包。

## 6. showrunner.md 提示词变更点（非接口，但作为验收契约锁定）

| 位置 | 现状 | 改后要点 |
|---|---|---|
| L103 口头条款 | 「门已发亦可直接 publish」 | verbal 两前提（该版完整定案卡已在对话展示；用户原话针对该版内容同意）；明示门 pending 时 verbal 会被工具以 BRIEF_GATE_PENDING 拒绝，正确动作＝同 gateId 重挂；rejected 必须改稿重发门 |
| L80/L91 门恢复 + 超时 | 只说 pending 重挂 | 增补：区分工具调用层超时（门仍 pending→重挂）与 settleAll GATE_TIMEOUT（项目切换/关闭→向用户说明再决定）；**任何超时禁止回溯超时前的用户话语当拍板凭证** |
| L115 再版第 3 步 | 「口头拍板规则同首版」 | 明确再版 verbal 针对的是**再版定案卡**、且须经第 5 步三选一；旧版 / 旧门口头语不得复用 |
| 新增（L100 发门前后） | 无字段来源纪律 | 上卡前每个字段回溯用户原话或已确认产物（故事背景档案等）；platforms 等开放字段无来源不补、拿不准回对话确认（B-15） |

## 7. 不产生的契约变更（显式）

- 工具总数 22 不变；工具物理 ID、zod 入参、成功返回形状不变。
- `shared/types.ts` 零改动（CanvasGate/Canvas/Manifest 形状不动）。
- bridge.ts 零改动（request / decide / initializeEntry / settleAll 语义不动）。
- 无新 IPC、无 renderer 改动、无新文件落盘格式。
