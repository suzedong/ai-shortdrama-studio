# SDG-RE 契约 · feature-006 通用产物查看

> 版本：v1.4（2026-10-04 再修订：新增定稿文件回退源与只读 IPC `session:read-finalized`，见 §10）
> 实现必须严格匹配本契约；字段/通道/函数签名冲突按 L1 修代码。
> 复用：不改 `shared/types.ts`（`Stage`/产物类型齐备）；v1.4 **新增一条只读 IPC**（K8，见 §10）。

## 1. 数据基础

产物的主事实源是 App 的消息流 `messages: ChatMessage[]`（chat.messages.json），背景档案由 `window.api.readArchive()` 读取。

**v1.4 起新增定稿文件作为回退源**：当消息流缺失某节点产物（如对话被清空）时，查看器与画布状态回退读取会话目录下的独立定稿文件，保证「定稿即存在、可查看」。详见 §10。

相关既有映射（`src/lib/revision.ts`，只读复用）：

- `STAGE_PRODUCT_KINDS`：节点 → 产物 kind：
  - `diagnosis: ['diagnosis','brief']`
  - `brief: ['visual-style']`
  - `outline: ['story-outline']`、`profiles: ['character-profiles']`
  - `scenes: ['scenes']`、`dialogue: ['dialogue']`、`storyboard: ['storyboard']`
- `NODE_REVISION`：节点 → RevisionSource（idea/background/0-c/1-a/1-b/2-a/2-b/2-c）。
- `CHAIN_ORDER`：`['diagnosis','brief','outline','profiles','scenes','dialogue','storyboard']`。

## 2. 入口契约（StageCanvas）

### 2.1 Props 扩展

在现有 Props 基础上：

```ts
// 现有：viewEntries?: Partial<Record<Stage, boolean>>
// 新增：onOpenViewer?: (stage: Stage) => void   // 整卡点击 / 👁 统一回调
```

整卡可点判定（纯派生）：

```ts
const canView = viewEntries?.[n.id] === true   // done 或 invalidated 由 App 置 true
```

渲染规则：

1. `canView === true` 时：卡片根节点 `cursor-pointer`，`onClick={() => onOpenViewer?.(n.id)}`；
2. hover 动作区保留：👁 按钮（`data-testid="entry-{id}-view"`，点击 stopPropagation 后同样调 onOpenViewer）+ 现有 nodeEntries（✎/💬，`data-testid="entry-{id}-{action}"`）；
3. `canView === false`：卡片维持现状（无 cursor-pointer、无整卡点击）；
4. 失效节点普通入口 `nodeEntries=[]`（沿用现状），但 👁 与整卡点击保留。

注意：节点卡片内的 hover 动作按钮 onClick 必须 `e.stopPropagation()`，避免触发整卡查看。

### 2.2 App 侧 viewEntries 计算

替换原硬编码 `viewEntries={{ background: true }}`：

```ts
const viewEntries: Partial<Record<Stage, boolean>> = {}
viewableStages.forEach(st => { if (hasViewContent(st)) viewEntries[st] = true })
```

- `viewableStages`：全部 9 节点 `['idea','diagnosis','brief','background','outline','profiles','scenes','dialogue','storyboard']`；
- `hasViewContent(st)`：节点状态 ∈ {done, invalidated}，且按 §3 能解析出非空内容；
- 该判定**不看** loading/gate/activeUnlock/activeDraft（查看始终可用）。

## 3. 内容解析契约（纯函数 `src/lib/viewer.ts`）

新增纯函数，便于单测：

```ts
export interface ViewerContent {
  stage: Stage
  status: NodeStatus                         // 'done' | 'invalidated'
  kind: MessageKind                          // 主渲染 kind（见 §4 路由表）
  data: unknown                              // 该 kind 卡片所需 data
  // 数据来源文件名（相对会话目录）；复合产物按出现顺序去重
  sourceFiles: string[]
  extra?: {
    // diagnosis 附带简报
    briefFields?: { label: string; value: string }[]
    // brief 复合立项单：简报字段（必） + 视觉风格（若已生成）
    briefBriefFields?: { label: string; value: string }[]
    visualStyle?: VisualStyle | null
    // brief 聚合诊断结论（diagnosis 存在时）
    diagnosis?: TopicDiagnosis | null
  }
}

export function resolveViewer(
  stage: Stage,
  messages: ChatMessage[],
  nodes: Partial<Record<Stage, NodeStatus>>,
): ViewerContent | null
```

规则：

1. 返回 `null` 当且仅当节点状态 ∉ {done, invalidated} 或找不到对应正式产物；
2. 选取消息：在 `messages` 中按 ts 正序，取目标 kind 的**最后一条正式产物**（忽略 `candidate === true` 与 `role==='user'`；`revision-draft` 不参与）；
3. 目标 kind 按 stage：

| stage | 目标 kind | data 断言类型 |
| :-- | :-- | :-- |
| idea | （无 kind，取创意文本） | string：见 §3.4 |
| diagnosis | diagnosis | TopicDiagnosis；extra.briefFields 由最后一条 `brief` 消息 data.fields 提供（无则省） |
| brief | brief（复合立项单） | data 为最后一条 `brief` 消息 data（含 fields）；extra.briefBriefFields = 该 fields，extra.visualStyle = 最后一条正式 `visual-style`（无则 null），extra.diagnosis = 最后一条正式 `diagnosis`（无则 null） |
| outline | story-outline | StoryOutline |
| profiles | character-profiles | CharacterProfile[] |
| scenes | scenes | SceneBreakdown |
| dialogue | dialogue | DialogueScript |
| storyboard | storyboard | ShotList |

4. idea 特殊处理：不查 kind，data 为当前创意全文（App 传入 `ideaText`；纯函数通过读取首条 `role:'user' && kind:'text'` 的最新定稿文本——为避免歧义，idea 内容由 App 以参数注入，见 §3.5）；
5. background 特殊处理：内容来自 `readArchive()`，不经本函数（App 打开档案只读模态）；
6. `status` 取自 nodes 中该 stage 状态，用于徽标显示。

### 3.5 函数签名最终形态

为消除 idea/background 歧义，签名定为：

```ts
resolveViewer(
  stage: Stage,
  ctx: {
    messages: ChatMessage[]
    nodes: Partial<Record<Stage, NodeStatus>>
    ideaText?: string          // stage==='idea' 时使用
  },
): ViewerContent | null
```

background 不调用本函数。

`sourceFiles` 取值：

| 节点 | sourceFiles |
| :-- | :-- |
| idea | ['chat.messages.json'] |
| diagnosis | ['chat.messages.json'] |
| brief | ['chat.messages.json']（三段均在同一消息文件，去重后一个） |
| background | （不经 resolveViewer；App 打开档案模态；档案模态不适用来源标注，其标题即「故事背景档案」） |
| outline/profiles/scenes/dialogue/storyboard | ['chat.messages.json'] |

## 4. 查看器组件契约（`src/components/ProductViewer.tsx`）

```ts
interface Props {
  stage: Stage
  status: NodeStatus
  content: ViewerContent
  profiles?: CharacterProfile[] | null      // scenes/dialogue/storyboard 卡片解析人名用
  canEdit: boolean                          // §5 路由是否可执行
  editBlockedReason?: string                // 置灰提示
  onClose: () => void
  onGoEdit: () => void
}
```

渲染：

1. 模态壳（居中、遮罩、Esc 关闭）；头部：节点标题 + 来源标注 + 状态徽标；
   - 来源标注位于标题与徽标之间：`data-testid="viewer-source"`，文本 `来源：{sourceFiles.join('、')}`，12px 灰色；

   - done：绿色「✓ 当前定稿」`data-testid="viewer-badge-done"`
   - invalidated：琥珀色「⚠ 已失效·旧版本」`data-testid="viewer-badge-invalidated"`
2. 主体按 `content.kind` 路由到**既有只读富卡片**：

| kind | 复用组件 | 传参 |
| :-- | :-- | :-- |
| brief（复合立项单） | BriefCard + VisualStyleView + 诊断结论摘要 | ① BriefCard fields=extra.briefBriefFields；② 分隔标题「视觉风格」+ VisualStyleView（vs=null 显示「视觉风格尚未生成」）；③ 分隔标题「选题诊断结论」（extra.diagnosis 为 null 时整段省略）：conclusion 原文 + 对标案例精简表（名称/平台或成绩/insight） |
| story-outline | OutlineCard | outline=data as StoryOutline |
| character-profiles | ProfilesCard | profiles=data as CharacterProfile[] |
| scenes | ScenesCard | scenes, profiles |
| dialogue | DialogueCard | dialogue, profiles |
| storyboard | StoryboardCard | storyboard, profiles |
| visual-style | VisualStyleView（见下） | vs=data |
| diagnosis | DiagnosisView（见下） | d=data；下方附 BriefCard（若 extra.briefFields） |
| text（idea） | `<pre class="whitespace-pre-wrap">` | content.data as string |

3. visual-style / diagnosis 只读段：本特性新增最小只读渲染（字段与 TopicDiagnosis/VisualStyle 对齐），不复用 gate details（那是弹门前简版）；
4. 底部：`去修改` 主按钮（`data-testid="viewer-go-edit"`，disabled=!canEdit，title=editBlockedReason）+ 关闭按钮。

## 5. 「去修改」路由契约（App）

打开查看时计算：

```ts
const editRoute = computeEditRoute(stage, {
  nodes, loading, gate, activeUnlock, activeDraft, phase,
})
// 返回：{ canEdit: boolean; reason?: string; action: 'draft' | 'regen' | 'idea-dialog' | 'archive-modal' }
```

`computeEditRoute`（放入 `src/lib/viewer.ts`，纯函数）：

1. `loading` → canEdit false，reason「正在生成中」；
2. `gate` 非空 → false，「有确认门待处理」；
3. `activeDraft` 非空 → false，「正在修改中，请先完成或放弃」；
4. `activeUnlock` 非空（变更链中）：
   - 节点 invalidated 且 `isRunnable(stage,...)` true → canEdit true，action 'regen'；
   - 节点 invalidated 但前驱未 done → false，reason `请先完成上游：{prevTitle}`；
   - 其余 → false，「变更链进行中」；
5. 无变更链、节点 done → canEdit true：
   - idea → 'idea-dialog'；background → 'archive-modal'；其余 → 'draft'（NODE_REVISION 映射 source）；
6. 节点非 done/invalidated → canEdit false。

执行（onGoEdit）：先关闭查看模态，再按 action：

- 'draft' → `startDraft(NODE_REVISION[stage])`（沿用现有）；
- 'regen' → 既有「重新生成」处理函数；
- 'idea-dialog' → setShowIdeaEdit(true)；
- 'archive-modal' → openArchiveModal(false)（可编辑态）。

## 6. App 状态契约

新增：

```ts
const [viewerStage, setViewerStage] = useState<Stage | null>(null)
```

- `handleEntry` 的 `'view'` 分支与新 `onOpenViewer` 统一走 `openViewer(stage)`：
  - background → openArchiveModal(只读/沿用)（保持档案模态路径）；
  - 其余 → setViewerStage(stage)；
- 查看内容用 useMemo 由 resolveViewer(viewerStage,...) 得到；
- 查看是覆盖层，不纳入 `entriesEnabled` 门控计算（不阻塞画布）。

## 7. 不变量

1. 查看路径**零写入**：不 push 消息、不改节点状态、不调生成/保存；
2. 只有显式点「去修改」才进入写路径，且完全复用既有门控；
3. 不新增/修改 IPC 通道与 DTO；不改 shared/types.ts。

## 8. 异常规则

| 情况 | 处理 |
| :-- | :-- |
| resolveViewer 返回 null（无内容） | 不打开模态（理论上入口不显示；防御性 return） |
| readArchive 返回 null（仅 background） | 沿用档案模态现有错误态 + 重试 |
| 富卡片 data 结构不符 | 类型断言失败由测试与既有生产契约保证；不新增静默兜底 |

## 9. 测试契约

1. `resolveViewer`：done/invalidated 返回最近正式产物；candidate/revision-draft 被忽略；无内容返回 null；各 kind data 类型正确；
2. `computeEditRoute`：done→draft（idea/background 特殊 action）；invalidated+runnable→regen；前驱未 done/loading/gate/activeDraft/activeUnlock→canEdit false 且 reason 正确；
3. StageCanvas：canView 时整卡点击触发 onOpenViewer；👁 触发且 stopPropagation；✎/💬 点击不触发查看；canView false 不可点；
4. ProductViewer：done/invalidated 徽标；各 kind 渲染对应卡片；来源标注 viewer-source 显示 sourceFiles；立项单 brief 出现简报五要素、视觉风格、诊断结论摘要（含对标案例精简表，无 diagnosis 时该段省略）；去修改 disabled 与 reason；关闭/Esc；
5. App 集成：点卡片打开查看、不改状态；去修改路由正确；门控中可查看；
6. 回归：feature-005 既有入口/失效/档案预填测试不破坏。

## 10. 定稿文件回退源（v1.4）

### 10.1 触发条件

当且仅当消息流（`chat.messages.json`）无法提供某节点的正式产物时（典型：用户清空对话），才回退到定稿文件。消息流存在对应产物时**一律以消息流为准**，定稿文件不参与（避免双源歧义）。

判定「消息流无该节点产物」：对除 idea/background 外的节点，`lastFormal(messages, targetKind)` 为 `undefined`；对 idea，注入的 `ideaText` 为空。

### 10.2 新增只读 IPC（K8）

```ts
// 通道：'session:read-finalized'（无入参）
// preload：readFinalized: () => ipcRenderer.invoke('session:read-finalized')
// 返回 FinalizedSnapshot；纯读取，不写任何文件、不改 manifest
export interface FinalizedSnapshot {
  // 有独立定稿文件的节点才出现；文件缺失/损坏则该字段缺省
  brief?: {
    fiveElements: FiveElements
    visualStyle: VisualStyle
    conclusion: string            // = brief.json.benchmarkSummary/conclusion（诊断结论原文，仅一段文本）
  }
  outline?: StoryOutline
  profiles?: CharacterProfile[]
  scenes?: SceneBreakdown
  dialogue?: DialogueScript
  storyboard?: ShotList
}
```

读取路径（主进程，相对当前会话目录；复用既有 `requireDir()`，无会话抛 `NO_SESSION`）：

| 字段 | 文件 | 备注 |
| :-- | :-- | :-- |
| brief | `brief.json` | 取 `fiveElements` / `visualStyle` / `conclusion`（conclusion 缺失回退 `benchmarkSummary`）；三者缺一则 brief 缺省 |
| outline | `剧本/故事大纲.json` | |
| profiles | `剧本/人物小传.json` | |
| scenes | `剧本/分场.json` | |
| dialogue | `剧本/台词.json` | |
| storyboard | `分镜/shotlist.json` | |

background 不纳入本快照（既有 `archive:read` 已覆盖）。任一文件读/解析失败只跳过该字段，不影响其他字段、不抛错。

### 10.3 不可回退的节点（硬边界）

以下两项**没有独立定稿文件**，消息流清空后无法恢复，查看器不显示其内容：

| 节点 | 原因 |
| :-- | :-- |
| idea | 创意原文仅存于消息流（由用户消息派生），无独立文件 |
| diagnosis（完整诊断） | 定稿时仅把 conclusion 文本存入 brief.json；对标案例表、用户洞察、钩子模式、合规风险均未落独立文件 |

> 因此清空对话后：brief 立项单仍可查看，但其「选题诊断结论」段仅有 conclusion 文本、无对标案例表（snapshot.brief 无完整 TopicDiagnosis）；diagnosis 节点本身不可查看。此为当前持久化结构的既定边界，非本次可补。

### 10.4 resolveViewer 回退规则

`resolveViewer` 的 ctx 增加可选 `finalized?: FinalizedSnapshot | null`。当 §10.1 判定消息流无产物时，按下表回退；仍解析不出则返回 null：

| stage | 回退内容 | sourceFiles |
| :-- | :-- | :-- |
| idea | 不回退（snapshot 无 idea）→ null | — |
| diagnosis | 不回退（snapshot 无完整诊断）→ null | — |
| brief | snapshot.brief：data 复合适配——extra.briefBriefFields 由 `fiveElements` 生成（见 §10.5），extra.visualStyle = brief.visualStyle，extra.diagnosis = `{ conclusion: brief.conclusion }` 且 `benchmarkCases=[]`（结论段只渲染原文、无案例表） | ['brief.json'] |
| outline | snapshot.outline | ['剧本/故事大纲.json'] |
| profiles | snapshot.profiles | ['剧本/人物小传.json'] |
| scenes | snapshot.scenes | ['剧本/分场.json'] |
| dialogue | snapshot.dialogue | ['剧本/台词.json'] |
| storyboard | snapshot.storyboard | ['分镜/shotlist.json'] |

回退产物一律 `status='done'`（定稿文件语义为当前定稿，不存在 invalidated 回退）。

### 10.5 FiveElements → brief 字段

回退生成 brief 卡片字段时，按固定顺序映射（与既有画布 briefDetail 口径一致）：

```ts
[
  { label: '题材', value: fe.genre },
  { label: '平台', value: fe.platforms.join('、') },
  { label: '单集时长', value: fe.episodeDuration },
  { label: '集数', value: fe.episodeCount },
  { label: '风格基调', value: fe.tone },
  { label: '画幅', value: fe.aspectRatio },
]
```

### 10.6 hydrate 合并规则

启动恢复（App hydrate）时，除现有 `replayMessages(msgs)` 外，额外 `await window.api.readFinalized()` 取得 snapshot：

1. 节点状态：replay 得到的状态优先；仅当某节点 replay 判定非 done/invalidated、但 snapshot 含该节点定稿时，将该节点补为 `done`（idea/diagnosis 不补）；
2. 产物数据：对应 React state（storyOutline/profiles/scenes/dialogue/storyboard/fiveElements/visualStyle）在 replay 为空、snapshot 有值时用 snapshot 兜底填充，保证画布摘要与查看器有内容；
3. phase/gate/activeUnlock/activeDraft **不从 snapshot 恢复**（定稿文件不携带变更链/门控语义），保持 replay 结果。

### 10.7 回退路径不变量

1. `session:read-finalized` 与回退渲染**零写入**；
2. 回退仅在消息流缺产物时发生，消息流与定稿文件并存时永不采用定稿文件；
3. 回退产物的「去修改」沿用 §5，但因 activeUnlock/activeDraft/gate 均为空、status='done'，路由为对应 draft（brief→'draft' 等）；idea/diagnosis 无回退故无此问题。
