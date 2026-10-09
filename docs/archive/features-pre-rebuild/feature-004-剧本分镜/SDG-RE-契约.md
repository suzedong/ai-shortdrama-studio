# SDG-RE-契约 · feature-004-剧本分镜

> **版本**：v1.0（2026-10-03）
>
> 本契约定义全部数据类型、IPC 通道、文件格式、prompt/解析、重放与画布契约。实现必须严格匹配。
>
> 卡口：涉及 **K1（共享层）**、**K4（新实体）**、**K8（新增 IPC）**，随规格审批生效。

## 1. 共享类型扩展（K1 + K4，shared/types.ts）

### 1.1 Stage 联合扩展

在现有联合末尾追加三个画布节点 id：

```ts
export type Stage =
  | 'idea' | 'diagnosis' | 'brief' | 'background' | 'story'
  | 'outline' | 'profiles'
  | 'scenes' | 'dialogue' | 'storyboard'
```

### 1.2 MessageKind 扩展

在现有联合末尾追加：

```ts
export type MessageKind =
  | 'text' | 'brief' | 'diagnosis' | 'visual-style'
  | 'progress' | 'error' | 'gate' | 'gate-action' | 'archive'
  | 'stage' | 'story-outline' | 'character-profiles'
  | 'scenes'          // 分场结果
  | 'dialogue'        // 台词结果
  | 'storyboard'      // 分镜表结果
```

> 阶段进入标记沿用 feature-003 的 `stage` kind，其 `data.phase` 由 `'story'` 扩展为 `'story' | 'script'`（见 §6）。

### 1.3 新增业务实体（K4）

```ts
// ===== 分场（一场戏）=====
export interface Scene {
  ep: number                    // 集号，一期恒为 1
  sceneNo: number               // 场号 1..N（台词、分镜的引用键；重排即整产物重生成）
  slug: string                  // 场次标题，如「公司·开放办公区」
  interiorExterior: '内' | '外' | '内外'
  dayNight: '日' | '夜' | '晨' | '昏'
  location: string              // 具体地点
  characterIds: string[]        // 出场角色 id（引用 CharacterProfile.id）
  beats: string[]               // 本场节拍 / 动作事件序列
  emotion: string               // 本场情绪基调
  estSeconds: number            // 预估时长（秒）
  summary: string               // 一句话场次梗概
}
export type SceneBreakdown = Scene[]

// ===== 台词（按场组织）=====
export interface DialogueLine {
  speakerId: string             // 引用 CharacterProfile.id；功能性无小传角色用 '' 兜底
  speakerName?: string          // speakerId 为空时的显示名（路人 / 画外音等）
  kind: '对白' | '旁白' | '独白'
  text: string                  // 台词内容
  emotion: string               // 情绪 / 语气提示（未来 T2A 配音任务直接消费）
  action?: string               // 括号动作提示（舞台指示）
}
export interface DialogueScene {
  ep: number
  sceneNo: number               // 引用 Scene.sceneNo
  lines: DialogueLine[]
}
export type DialogueScript = DialogueScene[]

// ===== 分镜表（对齐架构 §7 分镜条目）=====
export interface ShotDialogue {
  speakerId: string
  speakerName?: string
  text: string
  emotion: string
}
export interface Shot {
  ep: number
  shotNo: number                // 镜号 1..N
  rowOrder: number              // 行序（表格排序，与 shotNo 一致）
  shotSize: string              // 景别：特写 / 近景 / 中景 / 全景 / 远景
  sceneNo: number               // 场景id：一期以分场场号引用 Scene.sceneNo
  characterIds: string[]
  action: string                // 画面 / 动作描述（未来逐镜生成 prompt 原料）
  dialogue: ShotDialogue | null // 本镜主要台词；空镜为 null
  durationSec: number           // 时长（秒）
  camera: string                // 运镜
  refs: string[]                // 参考资产，一期恒为 []
}
export type ShotList = Shot[]
```

**引用键约束**：`sceneNo` 为本集稳定主键，台词与分镜均引用之；角色一律引用 `CharacterProfile.id`。跨实体引用一致性（台词的 sceneNo 须在分场中、分镜的 sceneNo 须在分场中、speakerId 可识别）作为 **Harness 软校验项**进确认门，不做解析期硬 reject（见 §8）。

## 2. IPC 通道（K8，全部新增；既有通道签名不变）

| 通道 | 入参 | 返回 | 行为 |
|---|---|---|---|
| `script:enter` | 无 | `{ ok: true }` | manifest 读-改-写：设 `status='script-scenes'`，保留其余字段 |
| `script:save` | `{ kind: 'scenes' \| 'dialogue' \| 'storyboard', data: SceneBreakdown \| DialogueScript \| ShotList }` | `{ files: string[] }` | 按 kind 分流写 JSON + MD 并推进 manifest.status（见 §3、§4） |
| `agent:scenes` | `instruction?: string` | `SceneBreakdown` | 组装 brief+背景+大纲+小传+指令，调方舟并解析 |
| `agent:dialogue` | `instruction?: string` | `DialogueScript` | 上述上下文 **+ 已定稿分场** |
| `agent:storyboard` | `instruction?: string` | `ShotList` | 上述上下文 **+ 已定稿分场 + 已定稿台词** |

通用规则：

- 以上通道均需当前会话；无会话 → reject，错误码 `NO_SESSION`。
- `agent:*` 通道缺少 brief（无五要素）→ reject，错误码 `STORY_CTX_MISSING`（复用 feature-003 错误码，语义为"上游剧本上下文缺失"）；其必需的直接上游产物缺失（dialogue 缺分场、storyboard 缺台词）→ 同样 reject `STORY_CTX_MISSING`（防御性，正常阶段机不会发生）。背景档案允许为空（按空事实处理）。
- 未配置方舟或调用失败时：三个 `agent:*` 通道使用 §5 本地 mock 兜底，**不 reject**。

## 3. 文件格式

会话目录在 feature-003 基础上新增（`分镜/` 为新建顶层产物目录）：

```
project-{时间戳}/
├── manifest.json          # script:enter / script:save 读-改-写，保留既有字段
├── brief.json             # 既有
├── 故事背景档案.md         # 既有，编剧只读事实
├── chat.messages.json     # 既有
├── .session.json          # 既有
├── 剧本/
│   ├── 故事大纲.json/.md   # 既有
│   ├── 人物小传.json/.md   # 既有
│   ├── 分场.json          # 新增 SceneBreakdown
│   ├── 分场.md            # 新增 人读镜像
│   ├── 台词.json          # 新增 DialogueScript
│   └── 台词.md            # 新增 人读镜像
└── 分镜/                  # 新建顶层目录
    ├── shotlist.json      # ShotList，结构化源
    └── shotlist.md        # Markdown 表格镜像
```

> 存储原则（用户 2026-10-03 拍板）：**三产物、三文件、三次定稿**。分场/台词属剧本文本归 `剧本/`，分镜表消费者是未来镜头/声音/时间线，归架构 §7 规定的 `分镜/`。文件名不带集号（一期 E01）；多集命名演进留待后续。JSON 为唯一结构化源（机器读、下游 Agent 消费），MD 由主进程从 JSON 单向渲染（只给人看，不回读）。

### 3.1 manifest.status 取值（阶段机，接续 feature-003）

```
initiating            # session:start
story-outline         # story:enter（feature-003）
story-profiles        # story:save outline（feature-003）
story-done            # story:save profiles（feature-003）
script-scenes         # script:enter                    ← 本包起点
script-dialogue       # script:save kind=scenes 定稿
script-storyboard     # script:save kind=dialogue 定稿
storyboard-done       # script:save kind=storyboard 定稿
```

> `script:enter` / `script:save` 必须读旧 manifest、保留 `fiveElements/visualStyle/createdAt` 等字段后只改 `status`，禁止整体覆盖。已知 manifest 历史债务不在本包治理（见 §10）。

### 3.2 JSON / MD 规则

- JSON 缩进 2；`分场.json` = `SceneBreakdown`；`台词.json` = `DialogueScript`；`shotlist.json` = `ShotList`。
- 目录不存在时 `mkdir { recursive: true }`。
- 返回 `files` 为本次写入的绝对路径数组（JSON + MD 顺序）。
- MD 渲染规则（字段缺失以空串渲染，不抛错）：

**分场.md**：`# 第一集 · 分场`，每场：

```
## 场{sceneNo} {slug}（{interiorExterior}/{dayNight}）
- 地点：{location}
- 出场：{characterIds 对应角色名，无映射时显示 id}
- 情绪：{emotion}　预估时长：{estSeconds}s
- 梗概：{summary}
### 节拍
- {beat}…
```

**台词.md**：`# 第一集 · 台词`，每场 `## 场{sceneNo}`，每行：

```
- **{显示名}**（{kind}·{emotion}）：{text}　（{action} 可选，前缀「动作：」）
```

**shotlist.md**：`# 第一集 · 分镜表`，Markdown 表格：

```
| 镜号 | 景别 | 场 | 角色 | 画面动作 | 台词 | 时长(s) | 运镜 |
|---|---|---|---|---|---|---|---|
```

台词列：空镜填 `—`，否则 `{显示名}：{text}`；角色列填 characterIds 对应角色名（无映射显示 id），以 `、` 连接。

## 4. script:save 分流与状态推进

| kind | JSON 路径 | MD 路径 | next status |
|---|---|---|---|
| `scenes` | `剧本/分场.json` | `剧本/分场.md` | `script-dialogue` |
| `dialogue` | `剧本/台词.json` | `剧本/台词.md` | `script-storyboard` |
| `storyboard` | `分镜/shotlist.json` | `分镜/shotlist.md` | `storyboard-done` |

三次写操作均纳入 feature-002 v1.1 的会话单写队列（`enqueue`），与消息写串行，不交错覆盖。

## 5. prompt 与解析契约（electron/prompts.ts 扩展）

### 5.1 三组 builder / parser

| 函数 | system schema 要点 | user 上下文拼接 |
|---|---|---|
| `buildScenesPrompt(context, instruction?)` | 输出 `Scene[]` JSON 数组；字段对应 §1.3 Scene；至少覆盖大纲 E01 全部主要情节；事实与背景档案一致；只输出 JSON | 五要素 + 视觉风格 + 背景档案全文 + 故事大纲 JSON + 人物小传 JSON |
| `buildDialoguePrompt(context, instruction?)` | 输出 `DialogueScene[]`（数组或 `{scenes:[...]}`）；speakerId 必须取小传角色 id，功能性角色 speakerId 留空并填 speakerName；台词金句化、强钩子 | 上述全部 **+ 已定稿分场 JSON** |
| `buildStoryboardPrompt(context, instruction?)` | 输出 `Shot[]`（数组或 `{shots:[...]}`）；字段对应 §1.3 Shot；refs 恒为 `[]`；空镜 dialogue=null；总时长向单集目标（约 60–120s）收敛 | 上述全部 **+ 已定稿分场 + 已定稿台词 JSON** |

- 三个 builder 均支持可选 `instruction`：非空时追加「用户修改要求：{instruction}」。

### 5.2 解析规则

- 复用 feature-003 的 `stripCodeBlock`（去 ```` ```json ```` 包裹）。
- `parseScenes(raw)`：截取首个 `[` 到末个 `]`；若顶层为对象则取其 `scenes` 字段；`JSON.parse` 后过 §5.3 形态校验。
- `parseDialogue(raw)`：兼容数组或 `{ scenes: [...] }`。
- `parseStoryboard(raw)`：兼容数组或 `{ shots: [...] }`。

### 5.3 形态校验（最小，不满足抛 `Error('story shape invalid')`）

- 分场：数组非空；每个元素 `typeof sceneNo === 'number'` 且非空 `location` 与 `summary`。
- 台词：数组非空；每个 DialogueScene 的 `lines` 非空；每行非空 `text`。
- 分镜：数组非空；每镜含数字 `shotNo`、`sceneNo`、`durationSec`，且非空 `action`。

### 5.4 mock 兜底（未配置 / 调用失败）

- `mockScenes(): SceneBreakdown`：产出至少 4 场，场号连续，含 `mockCharacterProfiles()` 的两个角色 id（`c-heroine`/`c-hero`），每场节拍 ≥2，estSeconds 合理。
- `mockDialogue(): DialogueScript`：按 mock 分场的场号组织，每场 lines ≥2，speakerId 用 mock 角色 id，含对白/旁白两类。
- `mockStoryboard(): ShotList`：产出至少 8 镜，shotNo 连续、sceneNo 引用 mock 分场场号、含至少 1 个空镜（dialogue=null）、refs 全为 `[]`。

## 6. 重放契约（src/lib/replay.ts 扩展）

### 6.1 类型扩展

```ts
export type GateId = '0-a' | '0-b' | '0-c' | '1-a' | '1-b' | '2-a' | '2-b' | '2-c'

export interface ReplayResult {
  phase: 'initiating' | 'story' | 'script'
  nodes: Record<Stage, 'done' | 'active' | 'pending'>
  pendingGate: GateId | null
  redoGate: '0-a' | '0-c' | null
  storyRedo: '1-a' | '1-b' | null
  scriptRedo: '2-a' | '2-b' | '2-c' | null          // 新增
  diagnosis: TopicDiagnosis | null
  fiveElements: FiveElements | null
  visualStyle: (VisualStyle & { rationale: string }) | null
  storyOutline: StoryOutline | null
  characterProfiles: CharacterProfile[] | null
  scenes: SceneBreakdown | null                     // 新增
  dialogue: DialogueScript | null                  // 新增
  storyboard: ShotList | null                      // 新增
  showArchive: boolean
  saved: boolean
}
```

### 6.2 新增 kind / 门的重放规则（按时间序）

| 消息 | 重放效果 |
|---|---|
| `stage`（data `{ phase:'script' }`） | `phase='script'` |
| `scenes` | `scenes=data`；节点 `scenes='active'` |
| `dialogue` | `dialogue=data`；节点 `dialogue='active'` |
| `storyboard` | `storyboard=data`；节点 `storyboard='active'` |
| `gate` 2-a/2-b/2-c | `pendingGate` 置对应门；`scriptRedo=null`（全部 redo 状态一并清，沿用 gate 总清规则） |
| `gate-action` confirm `2-a` | `scenes='done'`、`dialogue='active'`；清 pendingGate |
| `gate-action` confirm `2-b` | `dialogue='done'`、`storyboard='active'`；清 pendingGate |
| `gate-action` confirm `2-c` | `storyboard='done'`；清 pendingGate |
| `gate-action` reject 2-a/2-b/2-c | 清 pendingGate；**`scriptRedo` 置对应门**（产物卡保留、节点不回退，等待对话意见） |

- 三个新节点初始 `pending`；`phase='script'` 前的立项/故事规则全部不变。
- 调用方派生 `canEnterScript`：`phase==='story' && nodes.profiles==='done'`。
- App 统一发送路由扩展：`scriptRedo==='2-a'/'2-b'/'2-c'` → 意见作为 instruction 分别重生成分场/台词/分镜并重弹对应门。

## 7. 画布契约（StageCanvas 无需改结构，App 增第三组）

App 的 `buildGroups()` 在既有两组后追加：

```ts
{
  id: 'stage2',
  label: 'STAGE 2 · 剧本分镜',
  nodes: [
    { id: 'scenes',     title: '分场',   subtitle: '场次 · 节拍 · 时长' },
    { id: 'dialogue',   title: '台词',   subtitle: '对白 · 情绪 · 动作' },
    { id: 'storyboard', title: '分镜表', subtitle: '镜号 · 景别 · 运镜' },
  ],
}
```

- 动态行宽、缩放、组标签、节点三态沿用 feature-003 StageCanvas 既有实现，不新增视觉语言。

## 8. 确认门契约（src/lib/gates.tsx 扩展）

| 函数 | id / stage | summary | Harness（软校验，布尔） |
|---|---|---|---|
| `buildGate2a(scenes)` | `2-a` / `scenes`，标题「分场确认」 | `共 N 场 · 预估总时长约 Xs` | ① 场数 ≥ 3 ② 每场 beats 非空 ③ 出场角色 id 非空 |
| `buildGate2b(dialogue, scenes)` | `2-b` / `dialogue`，标题「台词确认」 | `覆盖 K 场 · M 句台词` | ① 台词覆盖分场全部 sceneNo ② 每场 lines 非空 ③ speakerId 可在小传中识别或带 speakerName |
| `buildGate2c(storyboard, scenes)` | `2-c` / `storyboard`，标题「分镜确认」 | `共 J 镜 · 总时长 Xs` | ① 镜数 ≥ 场数 ② 总时长在 60–120s 区间（边界只提示） ③ 每镜 sceneNo 存在于分场 |

> Harness 中引用一致性项用产物自身可计算的布尔表达；不满足只显示不通过（与 feature-003「事实与背景档案一致」pass=true 的软校验同策略），**不阻塞**用户确认——确认门仍是唯一人工裁决点。
>
> `buildGate2b` / `buildGate2c` 为做跨实体 Harness 校验，入参额外接收 `scenes`（已在 App 状态中）。details：2-a 展示场次节拍明细；2-b 展示场次台词预览（前若干行）；2-c 展示镜头表格预览。

## 9. 消息工厂契约（src/lib/messages.ts 扩展）

新增四个工厂，字段构造风格对齐 feature-003：

```ts
makeStage(phase: 'story' | 'script')          // 既有 makeStage 扩参数类型
makeScenes(s: SceneBreakdown): ChatMessage    // kind:'scenes'，content=`分场 ${s.length} 场`，data=s
makeDialogue(d: DialogueScript): ChatMessage  // kind:'dialogue'，content=`台词 ${总句数} 句`，data=d
makeStoryboard(s: ShotList): ChatMessage      // kind:'storyboard'，content=`分镜 ${s.length} 镜`，data=s
```

## 10. 已知差异登记（本包不治理，留待数据治理包 · 触发 K3 时签字）

以下为 feature-001~003 实证存在的数据债务，本包**仅登记、不重构**，避免回归面扩大：

1. **manifest 字段漂移**：0-c `project:save` 整体覆盖写 `{fiveElements,visualStyle,createdAt}`，会冲掉 `status`；后续 `story:enter`/`script:enter` 读-改-写补回。
2. **五要素/视觉风格双份存储**：manifest 与 brief.json 各存一份，无单一事实源。
3. **ProjectBrief.preflight 未落盘**：类型存在但从未持久化；架构 §7 manifest「集列表/采用决定/门状态」等字段尚未建立。

本包所有新增写操作一律使用读-改-写，不新添同类债务。

## 11. 错误码汇总

| 码 | 场景 |
|---|---|
| `NO_SESSION` | 任一新增通道无当前会话（复用） |
| `STORY_CTX_MISSING` | agent 剧本通道缺 brief 或缺直接上游产物（复用 feature-003） |
| `MSG_WRITE_FAILED` | 复用：消息落盘失败 |

## 12. 测试契约

新增/扩展测试（不新增依赖）：

- prompts（新文件 `src/test/script-prompts.test.ts`）：parseScenes/parseDialogue/parseStoryboard（代码块包裹、数组与对象包装、非法形态抛错）；三个 mock 产物字段齐备与引用自洽。
- gates（新文件 `src/lib/gates-script.test.ts`）：buildGate2a/2b/2c 的 id/标题/stage/摘要/harness 布尔。
- replay（扩展 `src/lib/replay.test.ts`）：STAGE 2 全流程（script→scenes→2-a confirm→dialogue→2-b confirm→storyboard→2-c confirm）节点与 pendingGate；2-a/2-b/2-c 否决后 scriptRedo、产物保留、新 gate 清除；canEnterScript 派生。
- ChatPanel（扩展）：scenes/dialogue/storyboard 三卡渲染。
- App（扩展 `src/App.restore.test.tsx`）：STAGE 2 集成（进入→分场卡→2-a 断言 script:save('scenes')→台词→2-b→分镜→2-c 断言 'storyboard'；2-a 否决输入意见重生成）。
