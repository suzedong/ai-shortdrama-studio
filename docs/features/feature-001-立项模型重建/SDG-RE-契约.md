# feature-001 立项模型重建 · 接口与数据契约

> 配套文件：[SDG-RE-需求规格.md](./SDG-RE-需求规格.md)（场景 / 范围 / 验收）。本文件只固化**字段、入参、返回、路径、类型增删改**，是 K1 共享层变更与主进程实现的直接依据。
>
> 事实源：设计书 §2.6（L116–347）、§7.1（L550–596）。字段命名沿用 [shared/types.ts](../../../shared/types.ts) 既有 camelCase 约定。

## 1. 立项单 ProjectBrief v2（`立项单.vN.json` 事实源）

旧 `ProjectBrief`（version/fiveElements/visualStyle/preflight/benchmarkSummary/conclusion）**整体替换**为 v2。新 schema：

```ts
// 立项项目性质（入口反问第一问）
export type ProjectKind = 'commercial' | 'memorial'

// 故事前提（5 项最低门槛，§2.6.3；五项均为非空字符串，'待定' 显式表达）
export interface StoryPremise {
  leads: string      // 人物：主角身份/年龄（双方）
  time: string       // 时间：故事发生时间（如「2002 年」）
  place: string      // 地点：城市/环境
  coreEvent: string  // 核心事件：相遇/缘起方式一句话
  seasonBoundary: string // 边界：本季讲到哪（如「第一季只讲相识」）
}

// 视觉风格引用：只存「风格 ID + 谱系版本」，不自存画风描述（§2.6.4；谱系实现 B-05 不在本包）
export interface BriefStyle {
  mainStyleId: string          // 主风格谱系 ID，如 'A7'；就绪判定必填非空
  catalogVersion: string       // 谱系版本，如 'v1.46'；与 mainStyleId 成对
  auxiliaryStyleId?: string    // 辅助气氛 ID（0–1 个，可选；候选域校验属 B-05）
}

// 拍板记录（一键拍板 / 口头拍板等价，§2.6.5）
export interface BriefApprove {
  at: string                   // ISO 时间戳
  by: 'gate' | 'verbal'        // gate=点定案卡按钮；verbal=对话口头确认
  verbal?: { quote: string }   // by==='verbal' 时必填：用户原话
  note?: string                // 门裁决备注（gate 路径可选）
}

// 相对上一版的字段改动（v1 时为空数组）
export interface BriefChange {
  field: string                // 点分字段路径，如 'fiveElements.episodeCount' / 'style.mainStyleId'
  from: string                 // 旧值（数组/对象序列化为字符串；v1 无旧值时为 ''）
  to: string                   // 新值
}

export interface ProjectBrief {
  schemaVersion: 2             // 固定 2；与旧 shape 切割
  version: number              // N，从 1 起单调递增
  kind: ProjectKind            // 入口反问结论
  fiveElements: FiveElements   // 复用既有类型（六要素，aspectRatio 必填）
  premise: StoryPremise
  style: BriefStyle
  diagnosisSummary?: string    // 选题诊断结论摘要（人读；诊断明细留在对话流，不建独立产物节点）
  approve: BriefApprove
  changesFromPrevious: BriefChange[]
  publishedAt: string          // ISO
}
```

约束：

1. `FiveElements`、`StoryPremise` 的「待定」一律用字符串 `待定` 表达；就绪校验不把 `待定` 视为缺失，但在就绪结果的 `pendingMarks` 中逐项回传，供定案卡明示。
2. v2 不再含 `preflight`（生产预检六项随旧 0-d 门作废）、`visualStyle` 描述体、`benchmarkSummary`、旧 `conclusion`。
3. 诊断卡 / 六要素草案是**对话中的候选态**，不落独立文件；立项单是 STAGE 0 唯一画布产物。

## 2. 就绪检查结果（brief.plan 返回，内存态不落盘）

```ts
export type BriefMissingCode =
  | 'KIND_MISSING'            // 未回答商业/纪念反问
  | 'ELEMENT_MISSING'         // 六要素存在空串（不含「待定」）
  | 'PREMISE_MISSING'         // 故事前提 5 项存在空串
  | 'MAIN_STYLE_MISSING'      // style.mainStyleId 或 catalogVersion 为空

export interface BriefMissing {
  code: BriefMissingCode
  field: string               // 点分字段路径，如 'premise.seasonBoundary'
  message: string             // 人读缺失原因（Agent 据此追问）
}

export interface BriefPlan {
  ready: boolean
  missing: BriefMissing[]
  pendingMarks: string[]      // 值为「待定」的字段路径（不阻塞就绪，定案卡须明示）
  nextVersion: number         // 若发布将分配的版本号（当前最新 + 1；无历史时为 1）
  changesFromPrevious: BriefChange[]  // 草案相对最新版的 diff；无历史时为 []
  latestVersion: number | null        // 当前已发布最新版本；无则 null
}
```

判定规则（与需求 §3 一一对应）：

- 六要素：`genre/platforms(非空数组)/episodeDuration/episodeCount/tone/aspectRatio`，空串或空数组 = `ELEMENT_MISSING`；`'待定'` 合法但进 `pendingMarks`。
- 前提：`StoryPremise` 五字段空串 = `PREMISE_MISSING`。
- 风格：`style.mainStyleId` 或 `style.catalogVersion` 为空 = `MAIN_STYLE_MISSING`；不校验 ID 是否在谱系内（B-05）。
- `kind` 缺失 = `KIND_MISSING`。
- `ready = missing.length === 0`。

## 3. MCP 工具契约（注册于 [tools.ts](../../../electron/mcp/tools.ts)，11 → 14 个）

统一信封沿用现有 `{ ok:true, ... } | { ok:false, error:{code,message} }`，`respond()` 包 `content[0].text=JSON`。三个工具均**零 LLM**、只允许操作当前激活项目（`getActiveProjectDir()`），路径经 sandbox 约束（项目根，禁止 `..`）。

### 3.1 `brief.plan`（只读）

- 入参（全部字段可选，缺省视为空串/空数组参与校验）：

```ts
{
  kind?: ProjectKind | null
  fiveElements?: Partial<FiveElements>
  premise?: Partial<StoryPremise>
  style?: Partial<BriefStyle>
}
```

- 返回：`{ ok:true, plan: BriefPlan }`。
- 行为：读项目根 `立项单.v*.json` 得最新版 → 校验草案 → 计算 diff（字段级，见 §5）→ 返回。**不写任何文件、不建画布节点、不建门。**
- 错误：`NO_ACTIVE_PROJECT`（无激活项目，沿用 current.ts 既有错误码）。

### 3.2 `brief.publish`（版本化落盘 + 挂画布节点）

- 入参：

```ts
{
  kind: ProjectKind
  fiveElements: FiveElements                 // 完整六要素
  premise: StoryPremise                      // 完整 5 项
  style: BriefStyle                          // mainStyleId + catalogVersion 必填
  diagnosisSummary?: string
  approve: { by: 'gate' | 'verbal'; verbal?: { quote: string }; note?: string }
}
```

校验与行为（全部在 `enqueue` 串行写队列内完成，保证版本号与落盘原子顺序）：

1. 复用 §2 就绪校验；不就绪 → `fail('BRIEF_NOT_READY', message)`，`message` 汇总缺失项，**不落盘**。
2. `approve.by==='verbal'` 且无 `verbal.quote`（去空白后为空）→ `fail('INVALID_ARGUMENT', '口头拍板必须记录用户原话')`。
3. 扫描项目根 `立项单.v(\d+)\.json` 得最大 N；`version = N+1`（不读取任何传入版本号，防伪造/撞号）。
4. 计算 `changesFromPrevious`（对 vN；v1 为 `[]`），`publishedAt = now ISO`，`schemaVersion: 2`。
5. 写 `立项单.v{version}.json`（UTF-8、`JSON.stringify(obj, null, 2)`）与 `立项单.v{version}.md`（镜像模板见 §4）。
   - **绝不覆盖、绝不进 `版本/` 归档区**：目标文件若已存在（理论上不可能）→ `fail('BRIEF_VERSION_EXISTS', ...)`，不调用 `archiveExisting`。
   - 两写任一失败：向上抛错（`normalize`），已写出的另一文件不回滚（版本号只增；后续按磁盘实况重新扫描）。
6. `canvas.update` upsert 单一节点（Agent 无需再手拼）：

```ts
{
  id: 'step-0-brief',
  step: '0',
  kind: 'brief',
  title: `立项单 v${version}`,
  status: 'done',
  ref: { path: `立项单.v${version}.json`, format: 'json' },
  meta: { version: `v${version}` },
  updatedAt: ISO,
  linksTo: []   // 不自动连边：STAGE 0 无其他在画布产物节点；下游边由 STAGE 1 产物侧 linksTo 建立
}
```

  重复发布 v(N+1) 时同 id upsert，`title/meta.version/ref` 更新为最新版；旧版文件与历史不进画布。

7. **不**推进 `manifest.status`（B-04 排除）；**不**经 gateBridge（门的请求/裁决由 Agent 用既有 `gate.request` + 用户在 GateCardView 操作完成，publish 只落定案事实）。

- 返回：

```ts
{ ok:true, version:number, jsonPath:string, mdPath:string,
  changesFromPrevious: BriefChange[], canvas: Canvas }
```

### 3.3 `brief.list`（只读）

- 入参：`{}`。
- 行为：扫描项目根 `立项单.v*.json`，按 N 升序解析；损坏文件跳过但在 `warnings` 注明。
- 返回：

```ts
{ ok:true,
  versions: { version:number; path:string; publishedAt:string;
              kind:ProjectKind; approveBy:'gate'|'verbal' }[];
  latestVersion: number | null;
  warnings: string[] }
```

## 4. 立项单 MD 镜像模板（人读，标题层级固定）

`立项单.vN.md` 由 publish 用以下固定区块渲染（字段缺失的「待定」照写）：

```markdown
# 立项单 vN

> 发布时间：{publishedAt}　拍板方式：{门内拍板|口头拍板（"{quote}"）}

## 项目性质
{commercial → 商业短剧；memorial → 个人纪念}

## 立项六要素
- 题材赛道：…
- 目标平台：…（数组顿号连接）
- 单集时长：…
- 集数：…
- 风格基调：…
- 画幅：…

## 故事前提
- 人物（双方身份/年龄）：…
- 时间：…
- 地点：…
- 核心事件：…
- 本季边界：…

## 视觉风格
- 主风格：{mainStyleId} @ {catalogVersion}
- 辅助气氛：{auxiliaryStyleId 或「无」}

## 选题诊断结论
{diagnosisSummary 或「（无）」}

## 相对上一版改动
{v1：「首版立项」；vN+1：from → to 逐字段列出}
```

`故事背景档案.md` 是独立产物（§7.1 目录），由 Agent 在节点②用既有 `file.write` 落项目根（保留写前归档机制），**本包不新增工具、不挂画布节点**。

## 5. diff 算法（plan 与 publish 共用）

- 比较范围：`kind`、`fiveElements.*`（platforms 按排序后顿号串比较）、`premise.*`、`style.mainStyleId/style.catalogVersion/style.auxiliaryStyleId`、`diagnosisSummary`。
- 叶子值统一转字符串比较；不同即生成 `{field, from, to}`；v1（无上一版）返回 `[]`。
- 纯函数，签名建议 `diffBrief(prev: ProjectBrief | null, draft: BriefDraft): BriefChange[]`，置于 `electron/brief/diff.ts`，可单测。

## 6. shared/types.ts 类型增删改清单（K1，用户已批准）

| 动作 | 成员 | 说明 |
|---|---|---|
| 新增 | `ProjectKind` / `StoryPremise` / `BriefStyle` / `BriefApprove` / `BriefChange` / `BriefMissingCode` / `BriefMissing` / `BriefPlan` | §1、§2 |
| 替换 | `ProjectBrief` | 旧 6 字段整体替换为 v2（§1）；消费方 StudioViewer BriefView 同步重写 |
| 改 | `GateId` | `'0-a'\|'0-b'\|'0-c'\|'0-d'\|'1-a'...` → `'0-final' \| '1-a' \| '1-b' \| '2-a' \| '2-b' \| '2-c'` |
| 改 | `RevisionSource` | 删除 `'0-c' \| '0-d'`；P0 不新增 `'0-final'`（立项后变更解锁属 B-03/P1，新模型 P0 无 unlock 产出门） |
| 删除 | `GateCard` 接口 | 旧消息内门模型，生产零消费（门渲染走 CanvasGate + GateCardView）；同步删 `ChatMessage.gate?` 字段与 dev-mock-api 中对应假数据 |
| 删除 | `PreflightCheck` 接口 | 随旧 ProjectBrief 一并作废 |
| 保留 | `Stage`（10 节点联合类型） | 仅 [library.ts](../../../electron/project/library.ts) `initialNodes()` 的历史 manifest 骨架在用；加注释标明「历史 manifest.nodes 骨架专用，B-04 随 7 态状态机清退」，不再扩散新消费 |
| 保留 | `VisualStyle` | StudioViewer 的 VisualStyleView 仍消费对话流 `visual-style` 消息；与 BriefStyle 并存（一个是对话态描述体，一个是立项单引用） |
| 保留 | `TopicDiagnosis` | 对话流 `diagnosis` 消息载荷形态，不动 |
| 不动 | `CanvasGate.gateId: string` / `CanvasNode` / `Canvas` / `StepId` | 门 id 本就是动态字符串，机制层零改动；§259 注释中「沿用 0-a/0-b 语义编号」更新为「门 id 由 Agent 经 gate.request 提交，STAGE 0 为 0-final」 |

## 7. 定案门协作时序（Agent ↔ 既有 gate 机制）

```
Agent: brief.plan(草案)            → ready:false → 继续对话追问（不建门）
ready:true → Agent: gate.request({
    gateId:'0-final',
    question:'立项定案卡 v(N+1)：…（含六要素/前提/风格/相对上版改动/待定点）',
    options:['发布立项 v(N+1)','再改改'],
    payload:{ version:N+1, pendingMarks, changesFromPrevious }
  })                               → CanvasGate 持久化 + GateCardView 弹出
用户「发布」→ gate 返回 approved
  → Agent: brief.publish({ ..., approve:{ by:'gate', note } })
用户口头「行，开始讲故事吧」→ Agent 可不发门（或门已发亦可）直接
  → brief.publish({ ..., approve:{ by:'verbal', verbal:{ quote:'行，开始讲故事吧' } } })
```

- 门 id `0-final` 是 STAGE 0 唯一定案门；rejected 后按既有 bridge 语义可**同 id 重开**（改完再发），无需新 id。
- 平台不做口头意图 NLP（需求 §4.2）；口头确认由 Agent 理解并携带原话调 publish。
- publish 不检查门状态（避免与 bridge 生命周期耦合）；是否先过门由 Agent 提示词纪律保证，测试层校验编排顺序。

## 8. 路径与命名约定

| 项 | 约定 |
|---|---|
| 立项单 JSON | `{项目根}/立项单.v{N}.json`，N 从 1 起、零填充**不**加（v1 而非 v01） |
| 立项单 MD | `{项目根}/立项单.v{N}.md`，与 JSON 同批双写 |
| 归档 | 不走 `版本/` 目录、不调 archiveExisting；v1..vN 全部作为正常文件永久保留 |
| 背景档案 | `{项目根}/故事背景档案.md`（既有 file.write + 归档机制） |
| 画布节点 | 唯一 id `step-0-brief`，`ref.path` 恒指**最新版** json |
| 匹配正则 | `^立项单\.v(\d+)\.(json|md)$`（仅项目根一层） |

## 9. 兼容与迁移

- 旧 `立项/brief.json`（旧 prompt 产物）：平台不自动迁移；新工具不读该路径。若根目录无 `立项单.v*.json`，`latestVersion=null`，下一版即 v1。旧文件留存不删（磁盘实况原则）。
- manifest.nodes 旧骨架（idea/diagnosis/brief/background…）原样保留，B-04 包清退；本包 publish 不写 manifest。
- 画布旧 demo 节点（dev-mock-api 中 n-brief 等）随 mock 数据更新；不影响真实 canvas（canvas 以磁盘文件为准）。
