# SDG-RE · 契约 · feature-011 立项补齐

> 版本：v1.0（待用户签字）
> 日期：2026-10-05
> 卡口：本契约含 **K1**（修改 `shared/types.ts`：GateId / RevisionSource / harness.critical）、**K3**（背景档案 handleArchiveSave 旁路删除）、**K6**（新增 renderer 纯函数/组件模块）、**K8**（gate action 加 partial、可能新增只读 IPC / 模板写入 IPC）。用户签字即视为对上述卡口决策的授权，实施时仍须在变更记录追加永久决策条目。
> 兼容：不新增 npm 依赖（K9）；旧会话 0-d 缺失只提示不强制迁移。

---

## 1. 共享层 K1 变更（唯一允许修改 shared 的范围）

文件：[shared/types.ts](../../../shared/types.ts)。仅以下三处加性变更，禁止任何其他改动：

```ts
// 1) GateId 增加 '0-d'
export type GateId =
  | '0-a' | '0-b' | '0-c' | '0-d'
  | '1-a' | '1-b' | '2-a' | '2-b' | '2-c'

// 2) RevisionSource 增加 '0-d'
export type RevisionSource =
  | 'idea' | 'background'
  | '0-c' | '0-d'
  | '1-a' | '1-b' | '2-a' | '2-b' | '2-c'

// 3) GateCard.harness 项增加可选 critical
harness: { label: string; pass: boolean; critical?: boolean }[]
```

既有事实（无需新增，仅启用）：

```ts
export interface PreflightCheck { id: number; name: string; value: string; locked: boolean }
export interface ProjectBrief {
  version: number
  fiveElements: FiveElements
  visualStyle: VisualStyle
  preflight: PreflightCheck[]
  benchmarkSummary: string
  conclusion: string
}
```

> 加性变更不破坏既有消费方；`critical` 缺省视为 false（非关键项）。

---

## 2. 门禁 harness 契约（真实判据，逐门固化）

### 2.1 buildGate0b 签名变更

```ts
buildGate0b(fe: FiveElements, d?: TopicDiagnosis): GateBundle
```

| 项 | 判据 | critical |
| :-- | :-- | :-- |
| 六要素完整 | `fe` 六字段 trim 非空且 `platforms.length ≥ 1` | true |
| 平台定位清晰 | `platforms.length ≥ 1` 且每项非空串 | false |
| 题材有对标验证 | `d && d.benchmarkCases.length ≥ 3`；无 d → false | false |

actions `['confirm','reject']`。调用方（App 0-a confirm）须把当前 diagnosis 传入。

### 2.2 buildGate0c

| 项 | 判据 | critical |
| :-- | :-- | :-- |
| 形态与题材匹配 | `['仿真人','动漫','写实','其他'].includes(vs.form.trim())` | true |
| 锚词表完整（≥8词） | 既有：`vs.l2Anchor.split(/[,，、]/).filter(Boolean).length ≥ 8` | false |
| 推荐理由充分 | 既有：rationale.length > 10 | false |

actions `['confirm','partial','reject']`。

### 2.3 buildGate0d（新增）

```ts
buildGate0d(list: PreflightCheck[], fe: FiveElements): GateBundle
```

gate.id `'0-d'`、stage `'brief'`、title `'立项确认门 0-d：生产预检'`。

| 项 | 判据 | critical |
| :-- | :-- | :-- |
| 预检 6 项无缺项 | `evaluatePreflight(list, fe).complete` | true |
| 画幅口径与六要素一致 | `evaluatePreflight(list, fe).aspectAligned` | true |
| 质感配方双档完整 | `evaluatePreflight(list, fe).dualRecipe` | false |

actions `['confirm','partial','reject']`；details 渲染 6 项 name/value（锁定项标🔒）。

### 2.4 buildGate1a / buildGate1b（消除硬编码）

- 1-a「事实与背景档案一致」：入参增加 `background: string`（空串 → false）。取大纲主要角色名（profiles 关联或从主线文本提取人名较复杂——采用：将既有 profiles 名称集合与背景档案做命中），命中率 ≥ 主要角色的 60% → pass。
  > 实施简化（防止过度复杂）：1-a 在 profiles 尚未生成时，校验 `background` 非空且大纲 logline 长度 > 10 即 pass；有 profiles 时按角色名命中率。判据在 OD 细化，契约只要求「数据不可得 = false」。
- 1-b「与大纲一致」：入参增加 `outline: StoryOutline`；小传中标记为主角的角色名至少 1 个出现在 `outline.logline + outline.mainPlot` 文本中，否则 false。

### 2.5 其余门（0-a / 2-a / 2-b / 2-c）

判据保持现状（已基本真实），不新增 critical。

---

## 3. Preflight 纯函数契约

新建 [src/lib/preflight.ts](../../../src/lib/preflight.ts)：

```ts
import type { FiveElements, VisualStyle, PreflightCheck } from '@shared/types'

export const PREFLIGHT_MIN_FIELDS = 6

export function buildInitialPreflight(fe: FiveElements, vs: VisualStyle): PreflightCheck[]
export interface PreflightGuard {
  complete: boolean
  aspectAligned: boolean
  dualRecipe: boolean
}
export function evaluatePreflight(list: PreflightCheck[], fe: FiveElements): PreflightGuard
```

判据：

- `complete`：list 长度 = 6 且每项 `value.trim()` 非空。
- `aspectAligned`：id=4 的 value 中包含画幅关键口径——以 `fe.aspectRatio` 中的核心 token 为准（`9:16` 或 `16:9`；从 aspectRatio 提取 `/\d{1,2}:\d{1,2}/`，要求第 4 项 value 含同一 token；提取不到 token → false）。
- `dualRecipe`：id=6 的 value 同时含「标准」与「预览」两关键词（或「standard/preview」）。

buildInitialPreflight 的 id=4 value 形态：

```
`成片画幅 ${fe.aspectRatio}；定妆人像竖版 / 全身横版按画幅裁切`
```

id=3、id=5 使用 §需求 F1-1 表中的固定常量文案；其余取 vs 字段。所有项 `locked:false`。

---

## 4. App 编排契约（0-d 插入后的状态流）

### 4.1 0-c confirm 改造（handleConfirm）

现状（0-c：saveProject version:1、brief done、background active）改为：

```
saveProjectSnapshot()            // 先落 manifest + brief（version 按 §8 规则；preflight 可为初始值/已有）
if (非 unlock 链) {
  setNodeStatus('brief','active')     // 不置 done
  const list = buildInitialPreflight(effectiveFe, visualStyle)
  setPreflight(list)
  pushMessage(makePreflight(list))    // 对话区预检卡（kind:'preflight'）
  openGate(buildGate0d(list, effectiveFe))
}
链上（activeUnlock 同源）：applyUnlock('0-d' 不走此分支，保持 applyUnlock('0-c') 既有语义，
                          但 brief 节点在 0-d 通过前不得 done)
```

> makePreflight 为新增消息工厂：`role:'agent'、kind:'preflight'、content:'生产预检清单（6 项）'、data: list`。

### 4.2 0-d confirm（handleConfirm 新增分支）

```
saveProject({ version: 自增/首版, fiveElements, visualStyle, preflight, ... })
pushMessage(makeGateAction('0-d','confirm'))
关闭门
if (非链) { setNodeStatus('brief','done'); setNodeStatus('background','active') }
链上：applyUnlock('0-d')
```

### 4.3 0-d reject

重开 buildGate0d（同 0-b reject 模式），保留已编辑 list；不回退 0-c。

### 4.4 0-d partial

不关门：`pushMessage(makeGateAction('0-d','partial'))` + 聚焦输入，进入预检项修改流（下一轮用户自然语言或直接编辑 PreflightCard 后重新 buildGate0d）。

### 4.5 revision / replay 联动

- [revision.ts](../../../src/lib/revision.ts)：DOWNSTREAM 增加 `'0-d'`（downstream `['background']`、phase `'idea'`、label `'生产预检'`、productKind `'preflight'`）；NODE_REVISION / STAGE_GATE 中 brief 的映射：立项主门在 0-d 通过前为 `'0-d'`（原 `'0-c'` 保留用于视觉风格单独重做）；STAGE_PRODUCT_KINDS 加 `preflight`。
- [replay.ts](../../../src/lib/replay.ts)：SOURCES 加 `'0-d'`；pendingGate / 消息 replay 映射加 0-d；恢复 `preflight`（从 brief 消息 data 或 brief.json）。
- [candidates.ts](../../../src/lib/candidates.ts)：KIND_SOURCE 视需要加 `'preflight' → '0-d'`。
- workflow 快照：[session.ts](../../../electron/session.ts) WORKFLOW_FIELDS 增加 `preflight`（平铺）；save/load 同步。App WorkflowState 增 `preflight?: PreflightCheck[] | null`。

### 4.6 isRunnable

0-d 未通过时 background 的直接前驱（brief）非 done，既有 isRunnable 自然阻断，不新增旁路。

---

## 5. 持久化契约

### 5.1 brief.json

`ProjectBrief` 全字段；新项目 `preflight.length = 6`。0-c 后、0-d 前的中间态允许落盘（preflight 为初始 6 项，locked 均 false）。

### 5.2 manifest.json

WORKFLOW 平铺字段新增 `preflight`（与 fiveElements/visualStyle 同级快照）；既有字段不动。

### 5.3 readFinalized

brief 纳入条件维持（fiveElements/visualStyle + conclusion）；**不**因 preflight 缺失排除旧 brief。返回快照中携带 `preflight?: PreflightCheck[]`（缺失即 undefined），供 viewer 提示。

### 5.4 版本归档

brief 定稿版本变化时，旧文件归档到 `版本/立项单.<YYYYMMDD-HHmmss>.json`（复用既有归档命名与单写队列，不新增机制）。

---

## 6. 视觉参考图契约

- URL：`https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt={prompt}&image_size={size}`
  - prompt 由 vs 字段组装（形态 + 主画风 + L2 锚词 + 锚点词的中文描述，加「短剧视觉风格参考图」意图），经 `encodeURIComponent`。
  - size：aspectRatio 含 `9:16` → `portrait_4_3`；`16:9` → `landscape_4_3`；无法判定 → `square`。
- 数量：生成 3 个不同构图 prompt（如「人物半身氛围」「场景氛围」「双人关系」），允许加载失败，实际成功 ≥2 即可；`<img loading="lazy">`，失败显示「参考图加载失败」占位。
- 参考图仅在 0-c 门 details 与视觉风格 tab 展示；不落盘到项目目录（仅缓存 URL 于消息/不持久化亦可），不写入 manifest。

---

## 7. IPC / preload 变更（K8，受控）

### 7.1 项目库（F13）

新增只读 IPC（命名）：

| channel | 入参 | 出参 |
| :-- | :-- | :-- |
| `project:list` | 无 | `{ dir: string; name: string; createdAt?: string; updatedAt: string }[]`（扫描 `~/Documents/ai-shortdrama-studio/` 下 `project-*`，读 manifest；损坏跳过） |
| `project:create` | `{ name?: string }` | `{ dir: string }`（初始化会话目录 + 空 manifest 骨架） |

preload 增加 `listProjects()` / `createProject(name?)`；global.d.ts 同步。

### 7.2 模板沉淀（F15）

| channel | 入参 | 出参 |
| :-- | :-- | :-- |
| `template:save` | `{ name: string; brief: ProjectBrief }` | `{ file: string }`（写入用户目录 `~/Documents/ai-shortdrama-studio/templates/<slug>.json`，纯 JSON） |
| `template:list` | 无 | `{ name: string; file: string; brief: ProjectBrief }[]` |

preload 增加 `saveTemplate / listTemplates`。模板目录不存在时创建；不写入应用安装目录。

> 若实施时发现已有等价目录能力 IPC 可复用，则不新增、以复用为准（须在变更记录说明）。

### 7.3 gate action

makeGateAction / gate-action 消息 data.action 联合扩为 `'confirm'|'partial'|'reject'`（renderer 内部消息契约，K8 登记）；preload 不涉及。

### 7.4 不改动

runtime IPC、既有持久化 / workflow / clear IPC 签名不变。

---

## 8. 版本号契约（F10）

```ts
function nextBriefVersion(prev: ProjectBrief | null, gate: GateId): number
```

- 磁盘无 brief.json → 1。
- 同一项目 0-b / 0-c / 0-d 的**再次** confirm（重做/反补后）→ prev.version + 1；首次顺序通过（v1 流程内 0→0-d）不重复自增：即首个完整立项版本为 1，之后任一上游门重拍板定稿才 +1。
- 归档发生在覆盖写之前。

---

## 9. GateCard 交互契约（F3/F9/F16）

Props：

```ts
interface Props {
  gate: GateCard
  onConfirm: () => void
  onPartial?: () => void   // gate.actions 含 'partial' 时必传
  onReject: () => void
  onRejectFeedback?: (text: string) => void   // 结构化否决意见
  details?: React.ReactNode
}
```

- 三按钮按 gate.actions 渲染：confirm「确认拍板（放行）」、partial「改部分」、reject「否决 / 重做」。
- critical 拦截：维护 `forceArmed` state；存在 critical✗ 时首次 confirm：`setForceArmed(true)` + 红字提示，不调 onConfirm；二次点击调 onConfirm。切换 gate.id（key）或关闭门时复位（组件以 gate.id 作 key）。
- 否决：点击后内联展开四要素输入区（保留/修改/为什么/期望结果，四个单行或一个 textarea 带占位模板），提交时把拼接文本经 onRejectFeedback 送出并 onReject；直接再点「直接否决」可跳过。

---

## 10. 异常规则汇总

1. 0-d 未通过：brief 不 done，background 不可进入（isRunnable 阻断）。
2. 预检编辑后须重新 evaluate 并刷新门 harness（编辑 PreflightCard → setPreflight → 重开/更新当前 0-d 门数据，消息中的 gate 快照以最新为准）。
3. 参考图 / 模板网络或磁盘失败：不阻断主流程，诚实显示失败态。
4. 项目目录损坏：project:list 跳过该项，不使整列表失败。
5. 重启恢复：按 workflow + 消息 replay 恢复到 0-d 中间态（门重开、预检值恢复），不重复保存。
6. 任何契约字段实现不得增删 / 改名（除 §1 明示 K1）；冲突按 L1/L2/L3 处理。

---

## 11. 验收映射

见任务清单 AC 表（AC-1 ~ AC-19 与需求规格 §5 对齐）。
