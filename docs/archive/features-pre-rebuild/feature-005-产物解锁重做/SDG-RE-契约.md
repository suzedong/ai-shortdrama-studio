# SDG-RE-契约 · feature-005-产物变更传播

> **版本**：v1.4（2026-10-03，取代 v1.3；新增画幅字段与「立项六要素」术语）
>
> 卡口：**K1**（shared/types.ts 追加类型与消息种类；VisualStyle 追加可选字段；FiveElements 追加 aspectRatio）、**K3**（确认门流程增加变更传播）、**K5**（业务术语「立项五要素」→「立项六要素」）、**K8**（新增 2 个 IPC：只读 `archive:read`、文本改写 `agent:revise-text`；save 通道仅追加返回字段）。谱系目录为主进程本地常量快照，非新 IPC、非新依赖。无 K4。

## 1. 共享类型扩展（K1，shared/types.ts）

### 1.1 MessageKind 追加 3 种

```ts
| 'unlock'          // 变更定稿事实：下游失效（S1/S2 采用时；S3-S8 过门时）
| 'revision'        // 修改会话生命周期：action 'start' | 'cancel'
| 'revision-draft'  // 人工事实候选文本（创意/档案的对话改写候选）
```

### 1.2 数据载荷

```ts
export type RevisionSource =
  | 'idea' | 'background'
  | '0-c' | '1-a' | '1-b' | '2-a' | '2-b' | '2-c'

export interface UnlockData {
  source: RevisionSource
  downstream: Stage[]   // 需重新走的节点；S3-S8 不含已过门的本棒；2-c 为 []
  newIdea?: string      // 仅 source==='idea'
}

export interface RevisionMessageData {
  action: 'start' | 'cancel'
  source: RevisionSource
}

export interface RevisionDraftData {
  source: 'idea' | 'background'
  text: string          // Agent 改写后的完整新文本
}
```

### 1.3 ChatMessage 增加候选标记

```ts
export interface ChatMessage {
  // …既有字段不变…
  candidate?: boolean   // true=AI 产物的未定稿候选（kind 为 visual-style/story-outline/character-profiles/scenes/dialogue/storyboard）
}
```

- 候选消息与正式产物消息**同 kind、同 data 结构**，仅 candidate=true；
- replay 不把候选计入有效态（§3）；superseded 不标候选；
- 创意/档案候选用独立 kind `revision-draft`（纯文本，结构不同于产物）。

### 1.4 其他类型

```ts
export type NodeStatus = 'done' | 'active' | 'pending' | 'invalidated'
export type GateId = '0-a' | '0-b' | '0-c' | '1-a' | '1-b' | '2-a' | '2-b' | '2-c'
```

GateId 提升至共享层（replay.ts 改 import）。

### 1.4a-0 FiveElements 扩展（K1）与六要素派生（K5）

```ts
export interface FiveElements {
  // …既有 5 字段（genre/platforms/episodeDuration/episodeCount/tone）不变…
  aspectRatio: string     // 画幅：'竖屏 9:16' | '横屏 16:9'（必填新字段）
}
```

- **派生规则**（src/lib/deriveFiveElements.ts，函数名不改）：平台含 抖音/红果/快手/视频号 → '竖屏 9:16'；含 B站/B站(bilibili)/YouTube → '横屏 16:9'；两者皆有 → 竖屏优先；认不出 → '竖屏 9:16'；
- **旧数据回退**：旧 brief.json / 旧 visual-style 消息的 fiveElements 无 aspectRatio → 运行时按 `'竖屏 9:16'` 回退（仅显示与 prompt 使用，不回写磁盘，等下次 0-c 落盘自然带上）；
- **术语（K5）**：界面与提示词中「立项五要素」一律改「立项六要素」；0-b 门标题「立项单 v1 · 五要素」→「立项单 v1 · 六要素」；类型名 `FiveElements`、函数名 `deriveFiveElements` **保持不改**（避免无意义代码翻动，代码级名称与业务术语解耦）。

### 1.4a VisualStyle 扩展（K1，仅追加可选字段）

```ts
export interface VisualStyle {
  // …既有 6 字段（form/mainStyle/l2Anchor/l1World/qualityRecipe/anchorWords）语义不变…
  family?: string          // 家族名（如「A 写实影像系」，谱系提取）
  auxiliaryStyle?: string  // 辅助画风（可选，仅限谱系「备」7 项）
  feasibility?: string     // 可行度（●高/●中/●低，照抄目录）
}
```

- 旧会话 brief.json 中的 VisualStyle 无新字段 → 原样展示，不迁移；
- `form` 取值域由 prompt 自由文本收敛为谱系 4 形态（旧数据的旧枚举值仅作历史展示）。

### 1.4b visual-style 消息 data 扩展

kind `'visual-style'` 的 data = `VisualStyle & { fiveElements?: FiveElements }`：

- 立项单候选与采用补发的正式消息**必须携带 fiveElements**（立项单整体候选）；
- 首次流程的 visual-style 消息携带推荐时依据的 fiveElements（与派生值一致，冗余但统一读取路径）；
- 旧消息无 fiveElements → replay 回退到 deriveFiveElements（§3.1 feOverride 规则）。

### 1.5 消息工厂（src/lib/messages.ts）

```ts
makeUnlock(data: UnlockData): ChatMessage                      // role system
makeRevision(action: 'start'|'cancel', source): ChatMessage    // role system
makeRevisionDraft(source: 'idea'|'background', text): ChatMessage // role agent, kind revision-draft
```

unlock content 映射：idea「创意已修订，下游已标记失效，请在失效节点「重新生成」」；background「背景档案已修订，大纲起产物已标记失效」；其余「{产物名}已重新定稿，下游已标记失效」。

## 2. 变更常量表（新建 src/lib/revision.ts）

```ts
export interface RevisionSpec {
  downstream: Stage[]                       // 失效下游（S3-S8 不含本棒）
  phase: 'initiating' | 'story' | 'script'
  label: string
  productKind: MessageKind | null           // AI 源的候选产物 kind；idea/background 为 null
}
export const DOWNSTREAM: Record<RevisionSource, RevisionSpec> = {
  idea:       { downstream: ['diagnosis','brief','outline','profiles','scenes','dialogue','storyboard'], phase: 'initiating', label: '创意输入', productKind: null },
  background: { downstream: ['outline','profiles','scenes','dialogue','storyboard'], phase: 'story', label: '故事背景档案', productKind: null },
  '0-c':      { downstream: ['outline','profiles','scenes','dialogue','storyboard'], phase: 'initiating', label: '立项单', productKind: 'visual-style' },
  '1-a':      { downstream: ['profiles','scenes','dialogue','storyboard'], phase: 'story', label: '故事大纲', productKind: 'story-outline' },
  '1-b':      { downstream: ['scenes','dialogue','storyboard'], phase: 'story', label: '人物小传', productKind: 'character-profiles' },
  '2-a':      { downstream: ['dialogue','storyboard'], phase: 'script', label: '分场', productKind: 'scenes' },
  '2-b':      { downstream: ['storyboard'], phase: 'script', label: '台词', productKind: 'dialogue' },
  '2-c':      { downstream: [], phase: 'script', label: '分镜表', productKind: 'storyboard' },
}

export const CHAIN_ORDER: Stage[] = ['diagnosis','brief','outline','profiles','scenes','dialogue','storyboard']

export const NODE_REVISION: Partial<Record<Stage, RevisionSource>> = {
  idea: 'idea', background: 'background',
  brief: '0-c', outline: '1-a', profiles: '1-b',
  scenes: '2-a', dialogue: '2-b', storyboard: '2-c',
}
export const STAGE_GATE /* 同 v1.1 */ = { diagnosis:'0-a', brief:'0-c', outline:'1-a', profiles:'1-b', scenes:'2-a', dialogue:'2-b', storyboard:'2-c' }
export const STAGE_PRODUCT_KINDS /* 同 v1.1 */ = { diagnosis:['diagnosis','brief'], brief:['visual-style'], outline:['story-outline'], profiles:['character-profiles'], scenes:['scenes'], dialogue:['dialogue'], storyboard:['storyboard'] }
```

## 3. replay 契约（src/lib/replay.ts）

### 3.1 ReplayResult 新增

```ts
ideaText: string                    // 最后 idea-unlock 的 newIdea，否则首条 user/text
activeUnlock: UnlockData | null     // 最后 unlock 后 downstream 未全部 confirm
activeDraft: RevisionSource | null  // 进行中的修改会话
feOverride: FiveElements | null     // 五要素修订值（最新 visual-style data.fiveElements），null=未修订走派生
```

### 3.2 revision 生命周期

- 扫到 `revision/start`：activeDraft = source；
- 扫到 `revision/cancel`：activeDraft = null；
- `revision-draft` 消息：不改变任何 state/节点（仅展示）；
- AI 源草稿终结：扫到该 source 的 `gate-action confirm`（门由 source→STAGE_GATE 映射，0-c 对 brief）→ activeDraft = null；随后必有 unlock（§3.4）；
- 人工源草稿终结：扫到 source 匹配的 unlock（idea/background）→ activeDraft = null；
- 门 reject（gate-action reject）不终结草稿（回到对话态）。

### 3.3 候选消息（candidate=true）

- 不赋值产物 state、不推节点、不产生 gate 状态；
- gate 消息本身不带 candidate；采用时正式产物消息（无 candidate）与 gate 成对由 App 补发（§5.3）；
- 损坏/孤儿子 candidate（无对应 activeDraft 历史起点）正常展示为只读候选卡，按钮不显示。

### 3.4 unlock 消息

1. 节点：downstream 全部 invalidated；phase = DOWNSTREAM[source].phase；redo 清零；pendingGate=null；
2. state 清空（downstream 范围）：idea 清 diagnosis→storyboard 全部 state + fiveElements=null + feOverride=null + ideaText=newIdea；background/0-c/1-a/1-b/2-a/2-b/2-c 清各自 downstream 的产物 state（0-c 即 outline→storyboard；刚定稿的视觉风格与 feOverride **保留不清**）；
3. idea/background 节点状态不动；background 节点不动；
4. activeUnlock 终扫：取最后一条 unlock U，当且仅当 U.downstream 每个节点在 U 之后都有对应 STAGE_GATE 的 gate-action confirm（diagnosis→0-a、brief→0-c），置 null；否则保留；
5. 损坏 data 忽略；
6. feOverride 终值 = 消息流中最后一条携带 fiveElements 的 visual-style 消息（candidate 或正式均计）的 fiveElements；无则 null。六要素有效值 = (feOverride ?? deriveFiveElements(ideaText, diagnosis))，缺 aspectRatio 时回退 '竖屏 9:16'（diagnosis 缺失时为 null）。

### 3.5 0-c 档案跳过（沿用 v1.1）

0-c confirm 时若消息流此前存在任意 `archive` 消息 → showArchive=false。

### 3.6 runnable 判定（纯函数 src/lib/revision.ts）

```ts
isRunnable(stage, { nodes, phase, activeUnlock, gate, loading })
```

= activeUnlock≠null ∧ stage∈downstream ∧ nodes[stage]==='invalidated' ∧ CHAIN_ORDER 直接前驱为 done（首棒前驱不在 downstream 内天然 done）∧ 同段 ∧ gate=null ∧ !loading。

### 3.7 旧数据兼容

无 unlock/revision 消息的旧会话：activeUnlock=null、activeDraft=null、无 invalidated、ideaText=首条 user 文本，与现状逐字节一致（测试红线）。

## 4. 产物世代（src/lib/superseded.ts）

`annotateSuperseded(messages): Set<string>`：

1. 忽略 candidate=true 与 revision-draft；
2. 正序：每遇 unlock U，对 U.downstream 经 STAGE_PRODUCT_KINDS 展开的 kind 世代 +1（idea 源额外把 diagnosis/brief 计入——已在 downstream 内）；
3. 每遇正式产物消息标记其 kind 当前世代；
4. 终扫：同 kind 中世代号小于最大世代的消息 id 入集；
5. 创意气泡的历史标注：idea-unlock 之后，旧的首条 user/text 气泡由 App 标记（不进本函数，App 依据 ideaText 比对或 unlock 计数传入 class）。

## 5. renderer 编排（src/App.tsx）

### 5.1 三种入口动作

| 节点 | 动作 | 结果 |
| :-- | :-- | :-- |
| idea | ✎ 编辑 | IdeaEditDialog 预填 ideaText；保存 → commitIdea(newText) |
| idea/background | 💬 对话修改 | push revision/start；输入框挂 @ chip；进入 draft 路由 |
| background | 查看/编辑 | 打开档案模态（readArchive 预填）；保存 → commitArchive(text) |
| 六 AI 节点 | 💬 对话修改 | push revision/start（source=对应门）；挂 @ chip；draft 路由 |

入口门控：`!loading && !gate && !activeUnlock && !activeDraft`；background 查看例外（activeDraft/activeUnlock 期间只读）。

### 5.2 draft 路由（输入框在 @ chip 态发送）

**人工源（idea/background）**：

1. push 用户意见气泡（user/text）；
2. 调 `window.api.reviseText(kind, currentText, instruction, turns)`：
   - kind 'idea'：current=ideaText；'background'：current=档案文本（App 缓存最近 readArchive 结果；无缓存先读）；
   - turns=本草稿内已有的 {instruction, draft} 对（从消息流抽取 revision/start 之后的 user 文本与 revision-draft）；
3. push revision-draft 候选（role agent）；卡片带「采用这版 / 继续修改 / 放弃」；
4. 失败 error 卡，草稿不终结，可重试。

**AI 源（0-c/1-a/1-b/2-a/2-b/2-c）**：

1. push 用户意见气泡；
2. 调既有生成通道（instruction 可选参）；多轮时前端把**最近一版候选 JSON** 拼入 instruction 前缀：`请基于以下未定稿版本修改：\n<candidate>{json}</candidate>\n修改意见：{意见}`；首版/重摇不带此前缀；消息「重摇一版」（或 chip 旁快捷按钮）= instruction undefined；
3. 结果以 `candidate: true` 产物消息 push（不 setState、不动节点、不开门）；候选卡带「采用这版 / 继续修改 / 🎲 重摇 / 放弃」（重摇等同再发一次空意见，按钮直接触发）；
4. 失败 error 卡，草稿不终结。

### 5.3 采用 / 放弃

**commitIdea(text)**（直接编辑保存或创意候选采用）：

1. 更新 idea 节点 detail=text；setIdeaText(text)；
2. push unlock({source:'idea', downstream, newIdea:text})；
3. state 清空（diagnosis→storyboard、fiveElements=null）；phase='initiating'；activeDraft=null；不生成。

**commitArchive(text)**（档案模态保存或档案候选采用）：

1. `saveArchive(text)`（旧档归档，返回 archived）；
2. push unlock({source:'background', downstream})；background 节点保持 done；
3. 清空大纲起到分镜 state；phase='story'；activeDraft=null；不生成。

**adoptAiCandidate(source)**（AI 候选卡「采用」）：

1. 从该 draft 最后一条 candidate 消息取 data；
2. setState 对应产物（0-c 源：visualStyle + feOverride=data.fiveElements）；push **正式产物消息**（同 data、无 candidate）；节点 active；
3. openGate：push gate 消息并打开对应门（复用 buildGateXxx；0-c 门展示采用后的五要素+视觉风格整体）；
4. 不归档、不写盘、不发 unlock（全部推迟到门 confirm）。

**放弃（任一源）**：push revision/cancel；activeDraft=null；候选卡留聊天流（按钮消失，标「已放弃」）。

### 5.4 门 confirm 在变更链上的行为

- **AI 源 draft 门 confirm**：执行既有 save（归档旧文件发生在此刻）→ push gate-action confirm → 若 DOWNSTREAM[source].downstream 非空 push unlock(source, downstream) 并置节点失效/phase/清 state；2-c 不发 unlock（activeUnlock 保持 null、收尾文案）；activeDraft=null；
- **门 reject**：不终结 draft，输入框恢复 @ chip，可继续发意见；
- **0-a confirm（S1 链上）**：照常开 0-b 门（派生展示）；
- **0-b confirm**：不自动推荐视觉风格，brief 留 invalidated（runnable）；
- **0-c confirm**：saveProject 归档 brief；档案按 §3.5 跳过；「进入故事创作」CTA；
- **1-a / 2-a / 2-b confirm（无论首次还是变更链）**：变更链上（activeUnlock≠null 或本 confirm 刚产生 unlock）不自动跑下一棒；首次流程维持现状自动连跑（判定依据：该 gate-action 是否处于 DOWNSTREAM 表 unlock 之后——App 以「最近一条 unlock 是否存在且未消化」判定）；
- **1-b confirm**：维持「进入剧本分镜」CTA 手动转段。

### 5.5 手动起跑 runRevisionStage(stage)

守卫 isRunnable；路由：diagnosis→diagnose(ideaText)（重算派生六要素）；brief→recommendVisualStyle(有效六要素=feOverride 回退规则, instruction?)；outline/profiles/scenes/dialogue/storyboard→对应 generate*(undefined)（失效后重跑不带意见；用户有意见可在新门里否决走既有 redo 机制）；大纲/分场/台词/分镜 prompt 显式携带画幅。起跑产出的是正式产物消息 + gate（非 candidate）。

### 5.6 hydrate

replay 驱动；不自动起跑/改写：

- activeDraft≠null：输入框恢复 @ chip（不可自动重发）；候选卡按钮恢复（数据取自消息流）；档案文本缓存缺失时采用时再 readArchive；
- activeUnlock≠null：失效节点按 isRunnable 注入「重新生成」；
- idea 链 diagnosis 已重生成且无 feOverride 时 hydrate 补派五要素；有 feOverride 用 override（0-b 展示同源）。

### 5.7 输入区互斥

activeDraft≠null：普通发送变为 draft 路由；显示 chip+×（× 需二次确认？否——× 等同放弃，直接 push cancel，候选留存）；activeUnlock≠null：输入框禁用（同 v1.1）。

## 6. 主进程

### 6.1 归档（同 v1.1 §5）

archiveExisting(filePath, now)；saveProject/saveStory/saveScript/saveArchive 写前归档；同次同时间戳、序号兜底；返回 archived: string[]。

### 6.2 readArchive（新）

`readArchive(): Promise<string | null>`，读会话目录 `故事背景档案.md`。

### 6.3 文本改写通道（新，K8）

```ts
// electron/main.ts
ipcMain.handle('agent:revise-text', async (_e,
  kind: 'idea' | 'background',
  current: string,
  instruction: string,
  turns?: { instruction: string; draft: string }[],
): Promise<{ text: string }>
```

- prompts.ts：buildReviseTextPrompt（角色=剧本创意编辑/事实档案编辑；输入原文+多轮历史+本次意见；输出纯文本全文，不要 Markdown 围栏、不要解释；档案改写须保留模板段落结构与未提及内容）；
- 复用 arkClient chat；未配置/失败的降级策略与既有 agent:* 通道一致（内置 mock：无 key 时回显 current 并做指令追加的保守处理）；
- 长度/空文本校验：返回 trim 后为空则 reject `REVISE_EMPTY`；
- preload：`reviseText(kind, current, instruction, turns?)`。

### 6.4 视觉风格谱系目录（新文件 electron/style-catalog.ts）

- **快照来源**：《AI 短剧制作视觉风格谱系.html》谱系 v1.45（2026-10-01，外部路径 `~/Documents/Dufs/AI短剧工作流/`）；实施时将目录内容**固化进仓库**，文件头注释标明来源路径与版本号；谱系升级时人工同步本文件并递增 `CATALOG_VERSION`；
- **内容结构**：4 形态（仿真人/2D 漫/3D 漫/沙雕漫）× 18 画风（A 写实影像系 6 / B 青春治愈系 1 / C 动画插画系 5 / D 类型氛围系 5 / E 材质工艺系 1；11「主」+ 7「备」），每项含：family（家族）、name（画风名）、tier（'主'|'备'）、visualFeatures（视觉特征）、anchorWords（锚点词示例）、qualityRecipe（质感配方：预览档/标准档）、feasibility（●高/●中/●低）；
- **导出**：`CATALOG_VERSION: string`、`FORMS: string[]`（4 形态）、`STYLE_CATALOG: CatalogEntry[]`（18 项）、`validateVisualStyle(v: VisualStyle): { ok: true } | { ok: false; reason: string }`（form ∈ FORMS；mainStyle ∈ 18 项名称；auxiliaryStyle 若有必 ∈ tier='备' 名称；锚点词/质感配方不作逐字校验，仅非空）；（2026-10-07 起经 feature-014 修订为归一比对并新增 normalizeStyleName/matchForm/matchStyle/canonicalizeVisualStyle 导出，见 feature-014 契约 §1–§2）
- **VISUAL_SYSTEM 重写**（electron/prompts.ts，首推与修订共用）：角色=短剧美术指导；**只允许从 STYLE_CATALOG 中选择**——按题材/平台/基调选形态与主画风（可选 1 个「备」辅助画风），锚点词与质感配方**照抄目录对应行**，禁止目录外画风与自造锚点体系；输入含画幅（横/竖屏不影响目录选型，但锚点词补充对应构图取向）；仅当用户意见只涉六要素时原样保留风格字段；输出 JSON 在既有 6 字段上补 family/auxiliaryStyle?/feasibility，并带 fiveElements（修订时输出修订后的六要素）；
- **校验**：生成返回后过 validateVisualStyle，不通过 reject `STYLE_NOT_IN_CATALOG`（首推与候选同规则），UI 报错卡可重试；（2026-10-07 起经 feature-014 修订：校验前先 canonicalizeVisualStyle 回写规范名，错误消息附值域名单，见 feature-014 契约 §2–§3）
- 无新依赖、无新 IPC（纯主进程常量）。

## 7. IPC 清单（K8）

| 通道 | 变化 |
| :-- | :-- |
| `archive:read` | 新增（只读） |
| `agent:revise-text` | 新增（创意/档案对话改写） |
| `archive:save` | 返回 {archived} |
| `project:save`/`story:save`/`script:save` | 返回追加 archived |
| 其他 | 零变化 |

## 8. 异常

| 场景 | 行为 |
| :-- | :-- |
| 候选生成失败/改写失败 | error 卡；draft 保留；可重试，不影响定稿 |
| 采用后门 confirm 前退出 | 重开：gate 恢复（现有机制），正式产物消息已在流中；候选→正式的对应不影响 replay（正式消息独立） |
| save/归档失败 | 门保持打开可再确认；归档不回滚（副本语义） |
| draft 中又触发别的入口 | UI 禁止 |
| revise-text 返回空 | REVISE_EMPTY，error 卡，draft 保留 |
| 同秒定稿 | .1/.2 序号 |

## 9. 测试契约

1. revision.ts：DOWNSTREAM 8 行与需求 §3 一致；isRunnable 真值表；NODE_REVISION/STAGE_GATE 映射；
1a. deriveFiveElements：画幅派生规则（竖屏平台/横屏平台/混合/未知四例）；旧数据无 aspectRatio 回退；
2. superseded：candidate 不入集；unlock 世代；未起跑旧卡不标；
3. replay：start/cancel/confirm/unlock 各种 activeDraft 终结；candidate 不推进态；unlock 清空 8 源（0-c 不清视觉风格与 feOverride、idea 清 feOverride）；activeUnlock 消化；0-c 档案跳过；损坏 data；feOverride 终值与有效五要素回退；旧会话零差异；
4. 主进程：归档系列（v1.1 同）；readArchive；revise-text prompt/解析/空校验（+mock 降级）；style-catalog 形状（4 形态/18 项/11主7备/字段非空）与 validateVisualStyle（含辅画风限「备」）；VISUAL_SYSTEM 含目录与禁止目录外约束、仅五要素变更时保留风格；STYLE_NOT_IN_CATALOG 路径；
5. App 集成：① 创意对话 start→意见→draft→采用：无 diagnose 调用、unlock 落盘、diagnosis runnable；② AI 对话：两次候选不 save/不开门/不失效，采用→gate，reject 回 draft，confirm 才 save+unlock+下游失效；③ 多轮 instruction 含 candidate JSON 前缀；④ 首次流程自动连跑回归；⑤ 档案对话采用序列；
6. 组件：节点入口（创意两个、背景两个、AI 一个、诊断无、门控）；@ chip 发送/×；候选卡按钮显隐（仅最后候选可操作/放弃后消失）；候选徽标；失效/runnable 态；IdeaEditDialog；档案模态预填。
