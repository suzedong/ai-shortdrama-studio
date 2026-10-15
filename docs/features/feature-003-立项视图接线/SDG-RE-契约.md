# feature-003 立项视图接线（Stage0View 真实化）· 接口与数据契约

> 事实源：[需求规格](./SDG-RE-需求规格.md)、设计书 §2.6.1/§2.6.8/§2.6.6。
>
> **卡口声明：本包 K1 / K8 / K9 全部不触发**——不改 [shared/types.ts](../../../shared/types.ts)、不新增 MCP/IPC 通道、不新增 npm 依赖。所有数据来自既有 renderer API（`canvas.get/onChange`、`fileRead`、`gate.onChanged` 间接经 canvas 订阅）。若编码中发现必须突破任一边界，立即停手回本文件走变更评审，不得自行扩面。

## 1. 既有数据面（零改动，只消费）

### 1.1 画布订阅（唯一结构化数据源）

- `window.api.canvas.get(): Promise<Canvas>` 与 `window.api.canvas.onChange(cb): () => void`，类型见 [global.d.ts](../../../src/global.d.ts) L46–51 / [shared/types.ts](../../../shared/types.ts) `Canvas`（L374–382）。
- StudioApp 已持有全量 `canvas` state（订阅/取消订阅在既有 effect 中），本包**以 props 把 `canvas: Canvas` 传入 Stage0View**，不在视图内另开订阅（避免双订阅与竞态）。
- 门事件：StudioApp 已维护 `pendingGate`（`gate.onChanged`），右栏 GateCardView 消费。Stage0View **不接 gate IPC**；0-final 状态从 `canvas.gates` 镜像即可（门提交/裁决都会推 canvas）。

### 1.2 产物只读通道

- `window.api.fileRead({ path })`（[preload.ts](../../../electron/preload.ts) L75 → main.ts `file:read` → [fs/read.ts](../../../electron/fs/read.ts)）：
  - 沙箱根 = 当前激活项目目录；`path` 为相对路径，仅 `.json/.md`、≤1MB、越界拒绝；
  - 成功 `{ ok:true, content:string, format:'json'|'md' }`；失败 `{ ok:false, error:{ code, message } }`；
  - code 集：`NO_PROJECT` / `INVALID_ARGUMENT` / `FORBIDDEN_FORMAT` / `PATH_ESCAPE` / `NOT_FOUND` / `TOO_LARGE`（ENOENT 归一为 `NOT_FOUND`）。
- 本包读取两个相对路径：
  1. 立项单：**一律取 brief 节点 `ref.path`**（真实值为 `立项单.vN.json`），不硬编码文件名、不自行拼版本号；
  2. 背景档案：固定 `故事背景档案.md`（showrunner 第 0 步写项目根）。

### 1.3 不使用的通道（防越界）

- 不调用 `brief.plan/publish/list`、`brief.impact.*`、`canvas.align`（均为 Agent 侧 MCP，不经 preload）；
- 不调用 `gate.decide`（裁决留右栏）；不新增任何 invoke 频道；preload.ts/global.d.ts **零 diff**。

## 2. 视图模型：selectStage0State（纯函数，契约核心）

新建 `src/studio/stage0/select.ts`（文件名编码时可调整，形状以本契约为准）：

```ts
import type { Canvas, CanvasGate, CanvasNode } from '../../../shared/types'

export type Stage0Phase = 'empty' | 'published'

export interface Stage0State {
  /** 主态：无 done 的 brief 节点 = empty；有 = published */
  phase: Stage0Phase
  /** phase==='published' 时为 step-0-brief 节点（status 必为 done）；否则 null */
  briefNode: CanvasNode | null
  /** 0-final 门当前对象（gates 中 gateId==='0-final' 最后一个）；无则 null */
  gate0: CanvasGate | null
  /** 门是否待决（gate0?.status === 'pending'） */
  gatePending: boolean
  /** 全画布脏节点数（feature-002 口径：node.dirty 存在即计） */
  dirtyCount: number
  /** 黄条文案用：去重后的命中字段并集（按首次出现序） */
  dirtyFields: string[]
  /** 最新立项版本号：briefNode.meta.version 字符串解析（'v3'→3）；无法解析为 null */
  version: number | null
}

export function selectStage0State(canvas: Canvas): Stage0State
```

规则（逐条可单测）：

1. `briefNode`：`canvas.nodes.find(n => n.id === 'step-0-brief' && n.status === 'done') ?? null`。**不认 `n-brief`**（dev 夹具 id，不进真实判定）。
2. `phase`：briefNode 非空 → `'published'`；否则 `'empty'`。
3. `gate0`：`[...canvas.gates].reverse().find(g => g.gateId === '0-final') ?? null`（取最后一个，兼容重发门）；`gatePending = gate0?.status === 'pending'`。
4. `dirtyCount = canvas.nodes.filter(n => n.dirty).length`；`dirtyFields` = 各 `dirty.fields` 并集去重保序。
5. `version`：`typeof briefNode?.meta?.version === 'string'` 时解析 `/^v(\d+)$/i`；不匹配为 null（徽标降级不显示数字，不回退 v1）。
6. 纯函数：禁止 fs / window.api / Date / 随机；入参不变则出参引用稳定要求不做（不强制 memo，由 React 侧按需 useMemo）。

## 3. 立项单解析：parseBriefJson（纯函数）

```ts
import type { ProjectBrief } from '../../../shared/types'

export type BriefParseResult =
  | { ok: true; brief: ProjectBrief }
  | { ok: false; reason: 'NOT_JSON' | 'UNSUPPORTED_SHAPE' }

export function parseBriefJson(content: string): BriefParseResult
```

- `JSON.parse` 抛错 → `NOT_JSON`。
- 形状判定（最小必要，不引 zod、不做迁移）：`parsed && typeof parsed === 'object'`、`parsed.schemaVersion === 2`、`Number.isInteger(parsed.version) && parsed.version >= 1`、`parsed.fiveElements`、`parsed.premise`、`parsed.style`、`parsed.approve` 均为对象；任一缺失 → `UNSUPPORTED_SHAPE`。
- 通过后 `as ProjectBrief` 返回；渲染层对叶子字段再做展示兜底（非字符串按「待定/缺失」处理，避免外部坏文件崩渲染）。
- 不比对 `briefNode.meta.version` 与 `brief.version` 是否一致：**以文件内 `brief.version` 为展示事实**，不一致时不报错（文件是事实源）；如编码时认为需要提示，仅允许弱化文案，须在变更记录登记。

## 4. 视图 Props 与渲染契约

### 4.1 Stage0View 新签名

```ts
interface Stage0ViewProps {
  canvas: Canvas
  projectTitle: string              // 来自 StudioApp 既有 state（真实项目名）
  onBackToDag: () => void
}
```

- 删除旧 props 中的 `briefVer: string`（含 `n-brief` 查找与 `'v1'` fallback 的整段表达式在 StudioApp 调用点删除）。
- 组件内部：`useMemo(() => selectStage0State(canvas), [canvas])`；published 态下 `useEffect` 按 `briefNode.ref.path` 读立项单、按固定名读背景档案；路径变化才重读（严格依赖，canvas 高频推送不重复 IO：用 ref 记录上次读取路径 + AbortController/序号防陈旧覆盖，取最简实现）。

### 4.2 各态必须出现/禁止出现的元素（测试凭据）

| 态 | 必须出现（建议 data-testid / 文案凭据） | 禁止出现 |
|---|---|---|
| empty | `data-stage0-empty`、「在右侧对话回答…」类引导、返回画布按钮 | 双卡卡面、版本徽标、任何演示按钮、六要素假值 |
| published（读取中） | `data-stage0-loading`（骨架/加载文案） | 假数据闪烁 |
| published（成功） | `data-stage0-brief`、`data-stage0-version`（文本 `vN`）、`data-stage0-card-diagnosis`、`data-stage0-card-premise`、风格 ID + 谱系版本、拍板方式与时间、首版/变更条数文案 | 「安妮的夏天」、演示控制条（随机假数据/模拟定案/强制门/模拟推进） |
| 门 pending 叠加 | `data-stage0-gate-pending`（「待你在右栏定案」提示） | 批准/驳回按钮（中栏内） |
| 脏读叠加 | `data-stage0-dirty-bar`（计数与字段，纯文本） | 任何按钮/可点击对齐入口 |
| 立项单读取失败 | `data-stage0-brief-error` + 中文原因（缺失路径/格式不受支持） | 假数据回退、空白屏 |
| 背景档案 | 成功：`data-stage0-background`（折叠，默认收起或展开由实现定，默认**收起**）；NOT_FOUND：整块不渲染 | NOT_FOUND 时的错误文案/红条 |

### 4.3 字段展示对照（published）

- 卡①：项目性质（`kind==='commercial' ? '商业短剧' : '个人纪念'`）；六要素按 FiveElements 实际字段名逐字段中文标签（标签表放 select.ts 或视图内常量，不新建 i18n）；`diagnosisSummary` 非空字符串才渲染小节标题与正文。
- 卡②：premise 五行（人物/时间/地点/核心事件/本季边界）；值为 `'待定'` 显示中性待定徽标；空串显示「—」（坏数据兜底，正常链路就绪校验不允许空串发布）。
- 风格行：`主风格 {mainStyleId} · 谱系 {catalogVersion}`；`auxiliaryStyleId` 非空追加 `辅助 {id}`；**不查谱系名称**。
- 定案区：`approve.by==='gate'` → 「门批准入」；`'verbal'` → 「口头拍板」+ `approve.verbal.quote` 原文引用块；`approve.note` 有则附；时间 `new Date(approve.at)` 本地格式（无效字符串原样显示）。
- 版本区：`v{brief.version}`；version===1 → 「首版立项」；否则 → 「相对 v{n-1} 共 {changesFromPrevious.length} 处变更」（仅条数，不展开）。
- 黄条：`有 {dirtyCount} 个产物基于旧版立项` + 字段中文列表；无 dirty 不渲染（与 CanvasBoard 黄条语义一致，样式复用既有黄条色值）。

### 4.4 背景档案 md 展示

- 以 `<pre>`（或等宽保留换行容器）只读渲染原文；**不引入 react-markdown / 任何 md 解析器**（react-markdown 已在 ChatComposer 经 K9 批准，但本视图刻意不扩用，避免为折叠区付出渲染差异成本；如评审认为应复用，须走 K9 知情登记并改本契约）。

## 5. StudioApp 改动面（最小 diff）

- L507–512 调用点：

```tsx
{centerView === 'stage0' ? (
  <Stage0View
    canvas={canvas}
    projectTitle={projectTitle}
    onBackToDag={() => setCenterView('dag')}
  />
) : ( … )}
```

- 全仓 grep `n-brief`：本包只要求 StudioApp 该表达式消失；`dev-mock-api.ts` 中的夹具**保留不动**（需求 §4.2），若测试因此需区分，测试内自建 Canvas 夹具，不依赖 dev mock。
- 不改进入/退出 stage0 的路由逻辑（顶栏 pill L313–344、StageNavPanel onSelect L475–487）。

## 6. 测试契约

### 6.1 纯函数（可并入 stage0 套件或独立 select 用例）

- select：无节点→empty/null；仅 active（非 done）brief 节点→empty；done 节点→published + 版本解析；meta.version 非法→version:null；gates 多个 0-final 取最后；pending/approved/rejected 三态；dirtyCount/并集去重保序；`n-brief` 节点存在也不被认作 briefNode。
- parseBriefJson：合法 v1/v2 文本；非法 JSON；schemaVersion≠2；缺 premise；缺 approve。

### 6.2 组件（TestingLibrary，mock window.api.fileRead）

- empty：凭据齐全 + 假数据/演示条零出现。
- published v1 门批：字段逐值；背景档案成功→折叠区；NOT_FOUND→无折叠区无报错；TOO_LARGE/PATH_ESCAPE→折叠区内错误文案。
- 口头拍板：quote 出现。
- v2：变更条数文案；dirty 黄条；门 pending 叠加且中栏无按钮；gate 经 canvas prop 变化由 pending→approved（rerender）自动转定案态。
- 读失败：NOT_FOUND（立项单）与坏 JSON 两态错误凭据；期间 loading 态。
- 返回按钮点击触发 onBackToDag 一次。

### 6.3 回归红线

- `npm run typecheck`：开工前实测记录基线（需求 AC8），零新增。
- `npm run test:run`：全量 passed 不减少、skipped/failed 不扩大；当前唯一 skip 基线为需 ARK Key 的 T8-4（2026-10-15：39 文件 405 passed / 1 skipped，开工前复测确认）。
- 不改任何静态契约计数（agent-profiles / mcp-pure-tools 等与本包无关，必须零 diff 风险）。

## 7. 卡口与越界处置

| 卡口 | 本包 | 证据要求 |
|---|---|---|
| K1 shared/types.ts | 不触发 | 收尾 git diff shared/types.ts 必须为空 |
| K8 MCP 工具 | 不触发 | electron/ 全目录零 diff（允许的例外：无） |
| K9 依赖 | 不触发 | package.json/package-lock 零 diff |
| IPC/preload | 不新增 | electron/preload.ts、src/global.d.ts 零 diff |
| Agent 纪律 | 不动 | resources/opencode/ 零 diff |

编码中若发现「不新增 IPC 就无法满足某 AC」：**停止并回本契约评审**，该需求移出本包，不得临场加通道。
