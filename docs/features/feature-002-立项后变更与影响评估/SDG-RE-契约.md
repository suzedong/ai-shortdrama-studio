# feature-002 立项后变更与影响评估 · 接口与数据契约

> 事实源：[需求规格](./SDG-RE-需求规格.md)、设计书 §2.6.6/§2.6.7/§7.1、D-011/D-013-4。
>
> **K1 卡口**：§1 改 [shared/types.ts](../../../shared/types.ts) 三处（briefVersion / parentReference / dirty），字段形状以本契约为唯一报批文本，用户 K1 批准前不动 shared/types.ts。
>
> **K8 卡口**：§4 新增 3 个 MCP 工具（19 → 22）。

## 1. K1：shared/types.ts 字段形状（三处，全部向后兼容可选/可空）

### 1.1 `ProjectManifest` 增加 briefVersion（L33–39 类型）

```ts
export interface ProjectManifest {
  status: ManifestStatus
  createdAt: string
  workflowVersion: 1
  updatedAt: string
  statusHistory: ManifestTick[]
  /** 当前项目对齐的立项版本；未发布立项为 null；brief.publish(v1)→1，brief.impact.commit→N（feature-002） */
  briefVersion: number | null
}
```

- 初始档：[library.ts](../../../electron/project/library.ts) createProject 写 `briefVersion: null`。
- 旧档兼容：[manifest.ts](../../../electron/project/manifest.ts) `parseManifest` 对缺字段读默认 `null`（与 `...rest` 透传并存：显式字段 + 读默认值）；写回时该字段落盘。
- 类型为非可选 `number | null`：旧档 JSON 经 parse 后内存态必有该键；直接 `JSON.parse` 未过 parse 的裸读取点（如有）须容忍 undefined——全仓 `readManifest` 为唯一读取入口（编码时 grep 确认）。

### 1.2 `CanvasNode` 增加 parentReference 与 dirty（L324–333 类型）

```ts
/** 产物血缘：本节点定稿时基于哪一版立项、引用了立项单哪些叶子字段（feature-002） */
export interface CanvasParentReference {
  briefVersion: number      // 定稿时 manifest.briefVersion
  fields: string[]          // 引用的立项字段路径（取值集见 §7），如 ['fiveElements.episodeCount']
}

/** 脏标记：产物基于旧版立项、与当前最新版存在命中字段差异（feature-002 §2.6.7） */
export interface CanvasDirty {
  sinceBriefVersion: number   // 产物基于的旧版 vN
  latestBriefVersion: number  // 发布时的新版 vM
  fields: string[]            // 命中的 Δ 字段（= parentReference.fields ∩ Δ）
  severity: 'high' | 'medium' // 命中字段最高级
  impactReport: string        // 影响清单文件名（相对项目根），如 '影响清单.v2-v3.json'
}

export interface CanvasNode {
  id: string
  step: StepId
  kind: string
  title: string
  status: 'pending' | 'active' | 'done' | 'invalidated'
  ref?: { path: string; format: 'json' | 'md' }
  meta?: Record<string, unknown>
  /** 产物血缘；showrunner 定稿挂 done 时由 canvas.update 写入；无立项前定稿不出现 */
  parentReference?: CanvasParentReference
  /** 脏态；仅 brief.impact.commit 可写、canvas.align 可清；canvas.update 入参不接收 */
  dirty?: CanvasDirty
  updatedAt: string
}
```

- dirty 与 `status:'invalidated'`（红色、opacity-60、硬失效）正交：dirty 节点 status 保持 done，只加黄色角标。
- 无 K1 其他面：RevisionSource / UnlockData **不改形状**，仅把 L280/L288 注释从「暂不加入 / feature-002 落地时重构」更新为「feature-002 已落 CanvasNode.parentReference/dirty；RevisionSource 扩 0-final 留待修订传播包」的事实陈述。

### 1.3 electron 侧本地类型（新增于 `electron/brief/impact.ts`，不进 shared）

```ts
import type { BriefChange, Canvas, CanvasDirty } from '../../shared/types.js'

export type ImpactSeverity = 'high' | 'medium'
export type ImpactDefaultAction = 'regenerate' | 'mark'
export type ImpactDecision = 'regenerate' | 'mark'

export interface ImpactItem {
  nodeId: string
  step: string
  title: string
  severity: ImpactSeverity
  fields: string[]                 // 命中 Δ 字段（交集）
  defaultAction: ImpactDefaultAction
}

export interface ImpactAssessment {
  fromVersion: number              // vN（最新已发布）
  toVersion: number                // v(N+1)
  changes: BriefChange[]
  items: ImpactItem[]              // 高在前、同级别按 step/id
  counts: { high: number; medium: number; total: number }
}

// commit 落盘的影响清单 JSON（§3）
export interface ImpactReportFile {
  schemaVersion: 1
  kind: 'brief-impact-report'
  fromVersion: number
  toVersion: number
  committedAt: string              // ISO
  changes: BriefChange[]
  items: Array<ImpactItem & { decision: ImpactDecision }>
}
```

## 2. 影响评估纯函数（`electron/brief/impact.ts`，同步、零 IO、零 LLM）

### 2.1 `classifyField(field: string): ImpactSeverity | 'low'`

| 级别 | 字段路径（全集） |
|---|---|
| high | `premise.leads` `premise.time` `premise.place` `premise.coreEvent` `premise.seasonBoundary`、`style.mainStyleId`、`style.catalogVersion`、`fiveElements.aspectRatio` |
| medium | `fiveElements.episodeCount` `fiveElements.episodeDuration` `fiveElements.genre` `fiveElements.tone` `fiveElements.platforms`、`style.auxiliaryStyleId`、`kind`、`diagnosisSummary` |
| low | 其余（现状 Δ 命名空间内无剩余字段；防御性归类，不抛错） |

- 注：`style.catalogVersion` 归 high——谱系版本漂移等价于主风格引用基线变化（802 中 mainStyleId 与 catalogVersion 成对）。
- defaultAction：high→`regenerate`；medium→`mark`；low 项不产生。

### 2.2 `classifyChanges(changes: BriefChange[]): Map<string, ImpactSeverity>`

逐字段过 classifyField，返回 field→该字段级别（low 不入 Map）。

### 2.3 `assessImpact(changes, canvas, fromVersion): ImpactAssessment`

```text
1. toVersion = fromVersion + 1
2. level = classifyChanges(changes)；level 为空 → items=[]、counts 全 0（只有 low/无 Δ 的再版）
3. 候选节点 = canvas.nodes 中：
   n.status === 'done'
   && n.parentReference?.briefVersion === fromVersion
4. 对每个候选：hit = n.parentReference.fields ∩ level.keys()
   hit 非空 → ImpactItem {
     nodeId, step, title,
     fields: hit（按 §2.1 表顺序）,
     severity: hit 内最高级,
     defaultAction: severity==='high' ? 'regenerate' : 'mark',
   }
5. items 排序：severity（high 先）→ step（字典序）→ nodeId
6. counts = 聚合
```

纯函数确定性，直接以构造 Canvas 夹具单测；不读 manifest、不读盘。

## 3. 落盘形状与路径

### 3.1 影响清单文件

- 路径（**包级选型，K8 一并报批**）：项目根 `影响清单.vN-vM.json`，例 `影响清单.v2-v3.json`。
  - 相对设计书差异：§2.6.7/§7.1 写 `立项/影响清单.vN→v(N+1).json`；与立项单实况一致地落在**项目根**（立项单自 feature-001 即在根，§7.1 目录树 L555 同口径，「立项/」前缀从未实现）；文件名箭头 `→` 换 ASCII `-`，规避 Windows + `resolveInside` 沙箱与 opencode 工具链的 Unicode 文件名风险。差异登记偏差清单形态备注，不回改设计书。
- 内容 = `ImpactReportFile`（§1.3），UTF-8、`JSON.stringify(obj, null, 2)`。
- 不写 md 镜像；不归档（每次 N 不同，天然不覆盖；同 N 重发被立项单防覆盖闸门先拦下）。
- `CanvasDirty.impactReport` 存该相对文件名。

### 3.2 manifest 指针推进

- brief.publish（v1）成功后：读-改-写 manifest，`briefVersion = 1`（不触发状态机推进之外的 status 变化；状态推进维持现状仅 v1 调 advance 的 Agent 纪律）。
- brief.impact.commit（v2+）成功后：同队列内 `briefVersion = toVersion`，`updatedAt` 刷新；**不**追加 statusHistory（版本再版不是阶段事件）。

### 3.3 立项单双写与 brief 画布节点

- 文件对象、双写、防覆盖、节点 upsert 全部沿用 feature-001 publish 逻辑；v2+ 发布抽出共享内部函数（`electron/brief/publish.ts`），v1 handler 与 commit handler 共用，v1 返回形状不变。
- brief 节点 `meta.version` 照旧写 `vM`；再版不新增节点（同一 `step-0-brief` 覆盖更新）。

## 4. K8：MCP 工具契约（19 → 22；物理名保留点号；仅 showrunner 放行）

信封沿用 `{ok:true,...} | {ok:false,error:{code,message}}`；错误即 `isError:true`。

### 4.1 `brief.impact.assess`（20，只读）

- 入参（zod）：`{ draft: BriefDraftSchema }`（BriefDraftSchema 与 brief.plan/publish 同源复用；编码时从既有 handler 抽出共享 schema）。
- 行为：
  1. `getActiveProjectDir()`（缺激活项目 → `NO_ACTIVE_PROJECT`）。
  2. `listBriefVersions` 取最新版；`latestVersion === null` → 错误 `BRIEF_NO_BASELINE`（v1 无再版评估对象，R1 应走 brief.plan/publish）。
  3. 读最新立项单为 prev；`diffBrief(prev, draft)` 得 Δ（**不**装载风格谱系、**不**做就绪校验——assess 只读且允许草案不完整；谱系非法属 plan/commit 的闸门）。
  4. `canvasStore.get()` 后 `assessImpact(Δ, canvas, latestVersion)`。
- 返回 `{ ok:true, fromVersion, toVersion, changes, items, counts, latestPublishedAt }`。
- 零写盘、零队列、不挂脏。

### 4.2 `brief.impact.commit`（21，写；v2+ 专用）

- 入参（zod）：

```ts
{
  draft: BriefDraftSchema,
  approve: z.object({
    by: z.enum(['gate', 'verbal']),
    verbal: z.object({ quote: z.string().min(1) }).optional(),
    note: z.string().optional(),
  }),
  // 每项 ImpactItem 的用户决策；key = nodeId
  decisions: z.array(z.object({
    nodeId: z.string().min(1),
    decision: z.enum(['regenerate', 'mark']),
  })).min(0),
}
```

- 行为（**全部在一次 `enqueue` 内读-改-写**）：
  1. 激活项目检查；listBriefVersions 得最新 vN；null → `BRIEF_NO_BASELINE`。
  2. **就绪闸门**：装载谱系（802 纪律，失败即三码信封不降级）+ `evaluateDraft(draft, catalog)`；`missing.length>0 || styleIssues.length>0` → `BRIEF_NOT_READY`（消息含缺失明细，复用既有码）。
  3. verbal 无 quote → `INVALID_ARGUMENT`（沿用 publish 规则）。
  4. `diffBrief` + `assessImpact` **复算**（不信任 Agent 传入的清单，防绕过/陈旧）。
  5. 校验 decisions：nodeId 集合必须**恰好覆盖**复算 items 全集（多、少、未知 id）→ `IMPACT_DECISION_MISMATCH`（message 列差异）。
  6. 立项单双写 `立项单.v(N+1).json/.md`（对象形状同 feature-001，version=toVersion，changesFromPrevious=Δ）；`fsp.access` 防覆盖沿用（撞档 → 既有版本存在错误码）。
  7. 写 `影响清单.vN-v(N+1).json`（§3.1）。
  8. 读-改-写 manifest：`briefVersion = N+1`、updatedAt 刷新；不动 status/statusHistory。
  9. 挂脏：对每个 item 节点读-改-写（保留节点其余字段），写 `dirty`（§1.2，severity 取 item.severity、impactReport 为清单文件名）；status 保持 done。regenerate 与 mark **本步同样挂脏**（regenerate 项完成对齐前也是脏态）。
  10. upsert `step-0-brief` 节点（meta.version=`v(N+1)`，沿用 feature-001 字段，linksTo 不变）。
- 返回：

```ts
{
  ok: true,
  version: N+1,
  jsonPath, mdPath,
  impactReportPath,
  changes,
  items: ImpactItem[],                    // 复算结果（含 defaultAction）
  markedDirty: string[],                  // 全部挂脏节点 id（= items 全集）
  regenerate: ImpactItem[],               // decision='regenerate' 的项（Agent 工作队列）
  canvas: Canvas
}
```

- Agent 纪律：commit 后 showrunner 对 regenerate 项逐个委派重生成 → 定稿后调 canvas.align；mark 项保持脏读。

### 4.3 `canvas.align`（22，写）

- 入参（zod）：`{ nodeId: string, briefVersion: number(可选) }`。
- 行为（enqueue 内）：
  1. 激活项目检查；canvas.get。
  2. 节点不存在 → `CANVAS_NODE_NOT_FOUND`；节点无 dirty → 幂等成功（`alreadyAligned:true`，不报错）。
  3. 目标版本 = 入参 briefVersion ?? 读 manifest.briefVersion；目标 ≤ dirty.sinceBriefVersion → `INVALID_ARGUMENT`（不允许对齐到更旧版本；回滚再版场景会产生更高版本号，正常）。
  4. 读-改-写节点：删 dirty；`parentReference = { briefVersion: 目标版本, fields: 原 fields }`（fields 不由工具猜测改写；重生成产物若引用字段集变化，由 showrunner 随后的定稿 canvas.update 按 §5 保留语义更新）。
- 返回 `{ ok:true, nodeId, briefVersion, alreadyAligned?: true, canvas }`。

### 4.4 canvas.update 契约微调（既有工具 5，不开新工具）

- zod nodes 元素新增 `parentReference: z.object({ briefVersion: z.number().int().positive(), fields: z.array(z.string()) }).optional()`。
- **不**新增 dirty 入参（dirty 只能经 commit/align 流转）。
- store 行为变更（[store.ts](../../../electron/canvas/store.ts) L68–74）：替换节点时——
  - 入参无 `dirty` 键 → 沿用旧节点 `dirty`；
  - 入参无 `parentReference` 键 → 沿用旧节点 `parentReference`；
  - 显式传 `parentReference`（含定稿场景）→ 覆盖；dirty 无入口可传故不可经此工具清除。
- upsert 新节点（idx<0）时两字段按入参原值（通常 undefined）。

## 5. parentReference 字段表（showrunner 定稿纪律；契约固定取值集）

产物节点 `fields[]` 声明该产物内容实际消费的立项字段。平台不校验字段名合法性（自由字符串集会误伤），但 showrunner.md 固定如下取值表；assess 按交集工作，**少声明 = 漏标影响**（Agent 纪律责任，测试只断言机制）。

| step | 典型节点 kind / 产物 | fields（叶子路径） |
|---|---|---|
| 1 | outline 故事大纲 | `premise.leads` `premise.time` `premise.place` `premise.coreEvent` `premise.seasonBoundary` `fiveElements.genre` `fiveElements.platforms` `fiveElements.tone` `style.mainStyleId` `style.catalogVersion` `kind` |
| 1 | profiles 人物小传 | `premise.leads` `premise.coreEvent` `premise.seasonBoundary` `fiveElements.genre` `fiveElements.tone` `style.mainStyleId` `style.catalogVersion` |
| 2 | scenes 分场 | 小传全集 + `fiveElements.episodeCount` `fiveElements.episodeDuration` |
| 2 | dialogue 台词 | 同 scenes（去掉 episodeDuration，加 `fiveElements.platforms`） |
| 2 | storyboard 分镜文字稿 | scenes 全集 + `fiveElements.aspectRatio` |
| 3+ | 资产/分镜/镜头/后期（节点尚不存在） | 至少含 `style.mainStyleId` `style.catalogVersion` `fiveElements.aspectRatio`；涉及叙事的加 premise.* 与 episodeCount/duration |

- `diagnosisSummary` 与 `style.auxiliaryStyleId` 不进任何默认字段表（诊断是历史对话记录；辅助风格在 STAGE 3 包启用时由该包追加）。
- 节点首次定稿时若 `manifest.briefVersion === null`（理论上 v1 publish 后才允许下游，属流程违例）：showrunner 不挂 parentReference；该节点此后不进任何影响清单（无版本可追溯），Agent 须在汇报中点名。

## 6. renderer 契约（最小标识，无新 IPC）

数据全部来自既有 canvas 订阅（CanvasNode.dirty / parentReference / meta.version），无 preload/IPC 改动。

1. **CanvasBoard 节点卡**：`node.dirty` 存在时，标题行 meta.version 旁显示黄色 `⚠️`（用既有黄 chip 色值 `bg-[#FFF4DE] text-[#C0841D]` 同族）；title 属性 hover 文案：
   `基于 v${sinceBriefVersion}，与最新 v${latestBriefVersion} 不一致：${fields 中文映射}`。
   - 不添加 opacity/灰显；不加红。fields 中文映射在 renderer 维护一个 field→中文名常量表（与 §2.1 同源措辞：集数/单集时长/题材/平台/基调/画幅/主风格/谱系版本/辅助风格/项目性质/诊断摘要/人物/时间/地点/核心事件/季边界）。
2. **StageNavPanel STAGE 0**：
   - briefVersion 为 null：现状（跳动/灰底）不变。
   - 非 null 且画布无 dirty 节点：`✓ vN`（绿，现状样式）。
   - 非 null 且存在 dirty 节点：`vN ⚠️k`（黄，k = 全画布 dirty 节点数；N 取 manifest.briefVersion——renderer 若无 manifest 数据源则取 dirty.latestBriefVersion 最大值与 brief 节点 meta.version，编码时读 StudioApp 现状取既有可得源，不新增 IPC；在设计说明中记录取舍）。
3. **脏读黄条**：CanvasBoard 顶部（画布有任一 dirty 节点时）纯文本条：
   `有 k 个产物基于旧版立项（最新 vM），内容可能与最新立项不一致。`
   无按钮、无链接（交互面板/一键对齐在通道包）。

## 7. provider / Agent 纪律登记

- [provider.ts](../../../electron/runtime/provider.ts) showrunner allow 列表追加 3 个物理 ID：`shortdrama_brief.impact.assess`、`shortdrama_brief.impact.commit`、`shortdrama_canvas.align`（14 → 17）。writer / media-director / comfyui-operator 不给。
- [showrunner.md](../../../resources/opencode/agents/showrunner.md)：frontmatter tools true + permissions allow 两处各 +3；正文新增/修订：
  - 再版工作流（STAGE 1+ 收到改立项诉求）：① 改草案在对话内进行，明示「将在发布时落盘 v(N+1)」；② `brief.plan` 就绪自检（沿用，含谱系）；③ 用户拍板（定案卡/口头等价）；④ `brief.impact.assess`，向用户呈报 Δ 与分级影响清单（高默认重生成、中默认仅标记）；⑤ 用户三选一——取消则止、仅标记→ decisions 全 mark 调 commit、重生成选中→ 相应项 decision=regenerate 其余 mark 调 commit；⑥ commit 后串行委派重生成 regenerate 队列，每个定稿后 `canvas.align`。
  - 定稿纪律：任一产物挂 done 的 canvas.update 必须带 `parentReference { briefVersion: 当前 manifest.get().briefVersion, fields: 按字段表 }`。
  - 脏读纪律：canvas.get 发现 dirty 节点，打开/引用时向用户复读警告；委派下游（writer/media-director）交接物中写明「某产物基于 vN 与 vM 不一致」及命中字段。
  - v1 纪律不变（plan→门→publish→仅 v1 调 manifest.advance）；再版**不**调 manifest.advance。
- writer.md / media-director.md / comfyui-operator.md 不改（它们不感知立项版本；警告由 showrunner 写进委派交接物）。

## 8. 错误码全表

| 码 | 触发工具 | 类别 | 语义 |
|---|---|---|---|
| `NO_ACTIVE_PROJECT` | 三工具 | 错误信封（沿用） | 无激活项目 |
| `BRIEF_NO_BASELINE` | assess / commit | 错误信封（新增） | 无已发布立项，不存在再版基线；v1 走 brief.publish |
| `BRIEF_NOT_READY` | commit | 错误信封（沿用） | 就绪闸门失败（missing/styleIssues），消息含明细 |
| `BRIEF_VERSION_EXISTS` | commit | 错误信封（沿用 publish 防覆盖码） | 目标版本文件已存在（队列撞档/重复提交） |
| `STYLE_CATALOG_MISSING/PARSE_ERROR/DRIFT` | commit | 错误信封（沿用 802 三码） | 谱系装载失败，不降级 |
| `INVALID_ARGUMENT` | commit / align | 错误信封（沿用） | verbal 缺 quote；align 目标版本不高于旧版 |
| `IMPACT_DECISION_MISMATCH` | commit | 错误信封（新增） | decisions 节点集合 ≠ 复算影响清单全集，message 列缺失/多余 id |
| `CANVAS_NODE_NOT_FOUND` | align | 错误信封（新增） | nodeId 在画布不存在 |

新增码共 3 个：`BRIEF_NO_BASELINE`、`IMPACT_DECISION_MISMATCH`、`CANVAS_NODE_NOT_FOUND`。

## 9. 测试契约

### 9.1 纯函数（新建 `src/test/brief-impact.test.ts`，仿 brief.test.ts 纯函数夹具）

- classifyField：§2.1 全表逐字段断言（high 8 路径 + medium 8 路径 + 未知路径 low）。
- assessImpact：
  - 空 Δ / 仅 medium / 含 high 的 severity 聚合与 defaultAction；
  - 过滤四分支：非 done、无 parentReference、briefVersion≠fromVersion、fields 不相交；
  - 排序（high 先、step、id）与 counts；
  - fields 交集内容与顺序。
- 纯函数不引入任何 fs/electron import。

### 9.2 MCP 工具（新建 `src/test/mcp-brief-impact-tools.test.ts`，仿 mcp-brief-tools.test.ts 临时项目 + writeSessionState + canvasStore.reset）

- assess：无历史 → BRIEF_NO_BASELINE；v1 发布后改集数 → 命中 done 节点 medium、过滤分支正确；零写盘（断言目录文件快照）。
- commit v2：就绪草案 + 全 mark → 四落盘（立项单 json/md、影响清单、manifest briefVersion）+ 节点 dirty 五字段 + status 仍 done；返回值 regenerate=[]。
- commit v2：含 regenerate 决策 → 项同样挂脏且出现在返回 regenerate[]。
- decisions 缺项/多 id → IMPACT_DECISION_MISMATCH 且无写盘。
- 未就绪草案 → BRIEF_NOT_READY；verbal 缺 quote → INVALID_ARGUMENT。
- 重复 commit 同版本 → 版本存在错误且第二次调用前后文件不被破坏。
- align：清脏 + parentReference 推进；无 dirty 幂等 alreadyAligned；节点不存在 → CANVAS_NODE_NOT_FOUND；目标版本倒退 → INVALID_ARGUMENT。
- v1 回归：brief.publish v1 落盘后 manifest.briefVersion===1；v1 发布返回形状与既有断言逐字一致（既有 mcp-brief-tools.test.ts 断言只增不改）。
- manifest 旧档：手工写无 briefVersion 的 manifest.json，brief.impact.assess 正常运行（读默认 null → 由 listBriefVersions 决定基线，不依赖 manifest 指针）。

### 9.3 store / schema

- canvas-store.test.ts 增补：脏节点经普通 update（不带两字段）后 dirty/parentReference 保留；显式 parentReference 覆盖；新节点不带脏。
- canvas.update zod 传 dirty 键 → 校验剥离/拒绝行为断言（zod object 默认剥离多余键，断言结果节点无 dirty）。

### 9.4 编排与静态契约

- agent-profiles.test.ts：`TOOLS_TRUE['showrunner.md']` 14 → 17 键并含三个新物理 ID；permissions allow 同步；其余 profile 不含。
- mcp-pure-tools：注册总数 19 → 22；runtime-client 放行数；runtime-integration listAgents 同步（按 802 既有改动面照做）。

### 9.5 renderer

- CanvasBoard/StageNavPanel 为既有 studio-flow 渲染测试薄弱区（基线 10 failed 在该域）：以不扩大失败为红线；若现有套件挂得住则加 dirty 角标/黄条/导航计数的轻断言，挂不住则以人工/typecheck 验证并在变更记录登记。

## 10. 路径与命名约定

- 影响清单：项目根 `影响清单.vN-vM.json`（ASCII 连字符；理由 §3.1）。
- 工具编号 20–22，物理名 `shortdrama_brief.impact.assess` / `shortdrama_brief.impact.commit` / `shortdrama_canvas.align`。
- 新增 electron 模块：`electron/brief/impact.ts`（纯函数 + 本地类型）、`electron/brief/publish.ts`（双写共享主体）；不新增目录。
- Canvas schemaVersion **维持 2**（两字段均为可选，旧 canvas.json 读入不受影响；不升版）。

## 11. 非目标（与需求规格 §4.2 一致，契约层再确认）

不做弹窗面板与交互按钮、不强制产物内部 parentReference、不做 STAGE 3–7 重生成与 STAGE 1–2 自动编排、不扩 RevisionSource/UnlockData 形状、不做 30 天漂移提醒、不写清单 md、不改立项单 schema 与 diff 范围、不做历史 diff UI/回滚按钮、不新增 IPC/preload。

## 12. 对既有包契约的联动说明

- **feature-001**：brief.publish 主体抽共享函数属等价重构，v1 行为/返回形状不变；其契约「再版无联动」表述由本包增补（publish 增写 manifest.briefVersion 一项，属指针初始化不是新行为通道）；在 001 变更记录回填交叉指针。
- **feature-801**：manifest 增字段不改状态机（7 态/6 事件/转换表零变化），statusHistory 语义不动；parseManifest 增读默认值。801 契约联动处回填指针。
- **feature-802**：commit 复用谱系装载/校验与三码；assess 明确**不**装载谱系。
- 设计书 §2.6.7「manifest.nodes[*]」旧表述以本契约 CanvasNode 收口（B-09 后 manifest 无 nodes）；`立项/` 前缀与 `→` 文件名两处形态差异记名偏差清单与变更记录，不回改设计书。

## 13. 验收映射

| AC（需求 §5） | 契约落点 |
|---|---|
| AC1 | §4.1 assess 错误、§3.2 v1 指针、§9.2 v1 回归 |
| AC2 | §2 纯函数、§4.1、§9.1/§9.2 |
| AC3 | §2.3 过滤四分支、§9.1 |
| AC4 | §3 落盘、§4.2 步骤 6–9、§9.2 |
| AC5 | §4.2 返回值、§4.3 align、§9.2 |
| AC6 | §4.2 步骤 6 防覆盖、取消不调工具（Agent 纪律 §7）、§9.2 |
| AC7 | §4.4 store 保留、§9.3 |
| AC8 | §1.1 旧档兼容、§9.2 |
| AC9 | §6 renderer |
| AC10 | §7 登记、§9.4 |
| AC11 | §9 全量 + typecheck 基线 7 / 测试 302·7·12 |
