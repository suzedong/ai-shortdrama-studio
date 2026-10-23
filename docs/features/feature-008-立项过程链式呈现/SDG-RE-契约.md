# SDG-RE-契约 · feature-008 立项过程链式呈现

> **卡口声明（置顶）**：**K1 零触发**——纯消费 `CapturedFact` / `CanvasGate` / `CanvasNode` / `Stage0State` 既有类型；`shared/types.ts` / `src/global.d.ts` / `electron/preload.ts` 零 diff。**K8 零触发**——`captureList` / `onCaptureChanged` 为 feature-005 既有桥（签名零变更）；零新 IPC / 零新 MCP / 零新推送 / 零白名单变更；链态条纯订阅零写入。**K9 零触发**——零新依赖、零配置变更、`package.json` 零 diff；`data-stage0-chain-*` 为 feature-003 既定组件凭据族（stage0-view.test.tsx L3 明示「组件凭据为 data-stage0-*（非 data-testid）」），非 K9 口径的依赖 / 版本变更。

## 1. 词表契约（进度匹配基准，逐字）

**匹配规则**：topic 先 `trim()`、再英文部分小写化，与词表条目**精确相等**即命中；一条 fact 至多命中一个 canonical；同一 canonical 被多条 fact 命中时 covered 去重计 1；未命中条目计入 `unmatchedCount` / `totalFacts`，不计 covered。

### 1.1 六要素（① 选题诊断，total = 6）

| canonical | 匹配词表（trim + 英文小写化后精确匹配） |
|---|---|
| `genre` | `genre`、`题材`、`题材赛道` |
| `platforms` | `platforms`、`平台`、`目标平台` |
| `episodeDuration` | `episodeduration`、`单集时长`、`时长` |
| `episodeCount` | `episodecount`、`集数` |
| `tone` | `tone`、`风格基调`、`基调` |
| `aspectRatio` | `aspectratio`、`画幅` |

### 1.2 前提（② 故事前提，total = 5）

| canonical | 匹配词表 |
|---|---|
| `leads` | `leads`、`人物` |
| `time` | `time`、`时间` |
| `place` | `place`、`地点` |
| `coreEvent` | `coreevent`、`核心事件` |
| `seasonBoundary` | `seasonboundary`、`本季边界`、`季边界` |

词表来源：showrunner.md L101 推荐词表（英文）+ select.ts `FIVE_ELEMENT_FIELDS` / `PREMISE_FIELDS` 标签（中文）+ 常用短别名；词表为**进度显示口径**，不改 showrunner 开放词表纪律。

## 2. 纯函数契约（`src/studio/stage0/chain.ts`，新建）

禁 fs / window.api / Date / 随机（同 select.ts 契约 §2 规则 6）。

```ts
import type { CapturedFact } from '../../../shared/types'
import type { Stage0State } from './select'

export type ChainGroup = 'six' | 'premise'

export interface ChainTopicMatch {
  group: ChainGroup
  /** canonical 键（§1 表左列，如 'genre' / 'seasonBoundary'） */
  key: string
}

/** topic 词表匹配；未命中返回 null */
export function matchChainTopic(topic: string): ChainTopicMatch | null

export interface ChainProgress {
  /** ① 已覆盖 canonical 键（去重，按 §1.1 表序） */
  sixCovered: string[]
  /** ② 已覆盖 canonical 键（去重，按 §1.2 表序） */
  premiseCovered: string[]
  /** 未命中词表的条数（计总数不计进度） */
  unmatchedCount: number
  /** 输入 facts 总条数 */
  totalFacts: number
}

export function selectChainProgress(facts: CapturedFact[]): ChainProgress

export type ChainStepStatus = 'idle' | 'collecting' | 'final'
export type ChainGateStatus = 'idle' | 'pending' | 'rejected' | 'published'

export interface ChainStepNode {
  status: ChainStepStatus
  /** 已覆盖数 x（status==='final' 时仍为实计值，呈现层不显示） */
  covered: number
  total: number
}

export interface ChainGateNode {
  status: ChainGateStatus
  /** published → briefNode.meta.version 解析；pending → payload.version 守卫解析；不可得 / 其余态 → null */
  version: number | null
}

export interface ChainNodes {
  diag: ChainStepNode & { total: 6 }
  premise: ChainStepNode & { total: 5 }
  gate: ChainGateNode
}

export function selectChainNodes(state: Stage0State, facts: CapturedFact[]): ChainNodes

/** payload 最小形状守卫：isObject + Number.isInteger(version) + version>=1；否则 null */
export function gatePayloadVersion(payload: unknown): number | null
```

**状态语义**：

- ①②：`state.phase==='published'` → `final`；否则 `covered===0` → `idle`；否则 `collecting`；
- 🚪 优先级：`published`（state.phase==='published'）> `pending`（gate0?.status==='pending'）> `rejected`（gate0?.status==='rejected'）> `idle`；
- 计数口径：pending / confirmed 条目均计入；source（user / infer）不区分。

## 3. 组件契约（`src/studio/Stage0Chain.tsx`，新建）

### 3.1 Props 与数据

```ts
export interface Stage0ChainProps {
  state: Stage0State
}
export default function Stage0Chain({ state }: Stage0ChainProps): JSX.Element
```

- 内部 `useCaptureFacts(): { facts: CapturedFact[]; loadError: string | null }`——`captureList()` 首拉 + `onCaptureChanged(f => setFacts(f.facts))` 全量替换订阅（CaptureBar L33-41 同模式：alive 标志 + 卸载退订）；首拉 reject → facts 置空 + loadError 置错误消息；推送到达清 loadError；
- 组件零写入：不调 captureUpsert / captureRemove / 任何 gate 与 brief 动作。

### 3.2 凭据族（data-stage0-chain-*）

| 凭据 | 元素 |
|---|---|
| `data-stage0-chain` | 链态条容器（`absolute inset-x-0 top-[38px] h-[46px]`，白底半透明 + 底边线 +  backdrop-blur，与 Header 同族） |
| `data-stage0-chain-diag` | ① 节点 chip |
| `data-stage0-chain-premise` | ② 节点 chip |
| `data-stage0-chain-gate` | 🚪 节点 chip（pending 态为 `<button>`，其余态为非交互容器） |
| `data-stage0-chain-gate-summary` | 🚪 摘要浮层（仅 pending 展开时存在） |
| `data-stage0-chain-error` | 「口径读取失败」小字（仅 loadError 时存在） |

### 3.3 文案契约（逐字，测试断言基准）

| 元素 | 文案 |
|---|---|
| 左标 | `立项过程` |
| ① 节点名 | `选题诊断` |
| ② 节点名 | `故事前提` |
| 🚪 节点名 | `定案卡` |
| 连接符 | `→` |
| ①② idle 徽标 | `未开始` |
| ①② collecting 徽标 | `收敛中 {x}/{total}`（x 为 covered，total 为 6 / 5） |
| ①② final 徽标 | `已定稿` |
| 🚪 idle 徽标 | `未就绪` |
| 🚪 pending 徽标 | `待拍板 v{version}`（version null 时 `待拍板`） |
| 🚪 rejected 徽标 | `被驳回` |
| 🚪 published 徽标 | `已发布 v{version}`（version null 时 `已发布`） |
| 摘要标题 | `立项定案卡 · 待拍板 v{version}`（version null 时 `立项定案卡 · 待拍板`） |
| 摘要正文 | `gate0.question` 全文（whitespace-pre-wrap，限高滚动） |
| 摘要提示行 | `批准 / 驳回在右栏门卡操作` |
| 失败小字 | `口径读取失败` |

**禁用串（防既有断言碰撞）**：链态条全文不得出现 `选题诊断结论` / `立项单 v` / `待定` / `立项定案门被驳回` / `立项尚未定案` / `立项单已定稿待你批准` 逐字串。

### 3.4 交互契约

- 🚪 pending：chip 为 button，点击切换浮层显隐（无悬停触发、无外点关闭、无 Esc 关闭）；浮层内零按钮；
- 🚪 其余态：chip 非交互，无浮层、无展开 affordance（无 ▾）；
- ①② chip 恒非交互；
- 徽标色系：idle 灰 / collecting violet / rejected 红 / final 与 published 绿 / pending violet 强调（与 GatePendingStrip 同族 `#DED9FB` 边 / violet-soft 底）。

## 4. 挂载契约（Stage0View.tsx diff 边界）

仅以下两处形态、共 6 行级改动，其余零 diff：

1. 三布局 `Header` 之后各插一行 `<Stage0Chain state={state} />`（EmptyStage0 L170 后 / BriefError L658 后 / 默认导出 published 容器 L682 后；BriefError 入参 `state` 由其调用方补传）；
2. 三处滚动容器 `top-[38px]` → `top-[84px]`（EmptyStage0 L171 / BriefError L659 / published 主容器 L683）。

EntryQuoteCard / GatePendingStrip / DirtyBar / 双卡主体 / BriefEditPanel / Header 本体全零 diff。

## 5. 测试契约

- `src/studio/stage0-chain.test.tsx` 新建（**净增恰 1**）：四组——① 纯函数词表与进度（AC1）；② 纯函数节点状态与 payload 守卫（AC2）；③ Stage0Chain 组件（AC3-AC4，window.api capture 两桥内存 mock，capture-bar.test.tsx L60-63 同模式）；④ Stage0View 集成（AC5）；
- `src/studio/stage0-view.test.tsx`：`installFileRead`（L134-138）内叠加恰 2 行——`captureList: vi.fn(async () => ({ schemaVersion: 1 as const, facts: [] }))` 与 `onCaptureChanged: vi.fn(() => () => undefined)`（realign-confirm.test.tsx L203-204 同款）；其余零 diff。
