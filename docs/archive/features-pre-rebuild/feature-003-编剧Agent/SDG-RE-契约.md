# SDG-RE-契约 · feature-003-编剧Agent

> **版本**：v1.0（修订重提，2026-10-03）
>
> 本契约定义全部数据类型、IPC 通道、文件格式、prompt/解析、重放与画布契约。实现必须严格匹配。
>
> 卡口：本文件涉及 **K1（共享层）**、**K4（新实体）**、**K8（新增 IPC）**，随规格审批生效。背景档案落盘（`archive:save`）已在 feature-002 v1.1 交付，不在本契约新增范围。

## 1. 共享类型扩展（K1 + K4，shared/types.ts）

### 1.1 Stage 联合扩展

```ts
export type Stage =
  | 'idea' | 'diagnosis' | 'brief' | 'background' | 'story'
  | 'outline' | 'profiles'
```

> `outline` / `profiles` 为 STAGE 1 故事行画布节点 id。

### 1.2 MessageKind 扩展

在现有联合末尾追加：

```ts
export type MessageKind =
  | 'text' | 'brief' | 'diagnosis' | 'visual-style'
  | 'progress' | 'error' | 'gate' | 'gate-action' | 'archive'
  | 'stage'              // 阶段进入标记
  | 'story-outline'      // 故事大纲结果
  | 'character-profiles' // 人物小传结果
```

### 1.3 新增业务实体（K4）

```ts
// 故事大纲
export interface StoryOutline {
  logline: string        // 一句话故事
  seasonArc: string      // 本季主线（如：第一季=相识）
  themes: string[]       // 主题/情绪关键词
  conflicts: string[]    // 核心冲突 / 钩子设计
  episodes: {
    ep: number
    title: string
    synopsis: string     // 本集剧情梗概
    hook: string         // 集尾钩子
  }[]                    // 至少含 E01
}

// 人物小传（单个角色）
export interface CharacterProfile {
  id: string             // 稳定 id（如 c-linxia）
  name: string
  age: string
  role: string           // 身份 / 职业
  personality: string    // 性格
  background: string     // 背景（须与背景档案一致）
  motivation: string     // 目标 / 欲望
  arc: string            // 人物弧光
  relationships: string  // 与其他角色关系
  voice: string          // 台词风格 / 音色提示
}
```

## 2. IPC 通道（K8，全部新增；既有通道签名不变）

| 通道 | 入参 | 返回 | 行为 |
|---|---|---|---|
| `story:enter` | 无 | `{ ok: true }` | manifest 读-改-写：设 `status='story-outline'`，保留其余字段 |
| `story:save` | `{ kind: 'outline' \| 'profiles', data: StoryOutline \| CharacterProfile[] }` | `{ files: string[] }` | 定稿写 JSON + MD，并按 kind 推进 manifest.status（见 §3） |
| `agent:story-outline` | `instruction?: string` | `StoryOutline` | 组装 brief + 背景档案 + 指令，调方舟并解析 |
| `agent:character-profiles` | `instruction?: string` | `CharacterProfile[]` | 组装 brief + 已定稿大纲 + 背景档案 + 指令，调方舟并解析 |

通用规则：

- 以上通道均需当前会话；无会话 → reject，错误码 `NO_SESSION`。
- 两个 `agent:*` 通道在 brief.json 缺失（无五要素）时 → reject，错误码 `STORY_CTX_MISSING`；背景档案允许为空（按空事实处理）。
- 未配置方舟或调用失败时：`agent:*` 通道使用 §5 定义的本地 mock 兜底（与既有 diagnose/visual-style 降级策略一致），**不 reject**。

## 3. 文件格式

会话目录在 feature-002 基础上新增：

```
project-{时间戳}/
├── manifest.json          # story:enter / story:save 读-改-写，保留既有字段
├── brief.json             # 既有（含 fiveElements / visualStyle）
├── 故事背景档案.md         # feature-002 v1.1 已落盘，编剧只读事实
├── chat.messages.json     # 既有（消息流）
├── .session.json          # 既有
└── 剧本/
    ├── 故事大纲.json       # story:save kind=outline，结构化源
    ├── 故事大纲.md         # 人读镜像
    ├── 人物小传.json       # story:save kind=profiles
    └── 人物小传.md         # 人读镜像
```

### 3.1 manifest.status 取值（阶段机）

```
initiating            # 初始（session:start）
story-outline         # story:enter
story-profiles        # story:save outline 定稿后
story-done            # story:save profiles 定稿后
```

> 注：0-c 时 project:save 写的 manifest 可能无 status 字段；story:enter 必须读旧文件、保留 `fiveElements/visualStyle/createdAt` 等字段后补 `status`，禁止整体覆盖。

### 3.2 JSON / MD 规则

- JSON 缩进 2；`故事大纲.json` = `StoryOutline`；`人物小传.json` = `CharacterProfile[]`。
- MD 由主进程根据实体渲染（标题 + 字段小节）；字段缺失以空串渲染，不抛错。
- 目录不存在时 `mkdir { recursive: true }`。
- 返回 `files` 为本次写入的绝对路径数组（JSON + MD 顺序）。

## 4. prompt 与解析契约（electron/prompts.ts 扩展）

### 4.1 buildStoryOutlinePrompt

- system：要求模型扮演短剧编剧，严格输出 JSON，schema：

```json
{
  "logline": "string",
  "seasonArc": "string",
  "themes": ["string"],
  "conflicts": ["string"],
  "episodes": [{ "ep": 1, "title": "string", "synopsis": "string", "hook": "string" }]
}
```

- 约束：至少 E01；事实（年龄/城市/季边界）必须与背景档案一致；不得输出 JSON 以外内容。
- user：拼接五要素 + 视觉风格 + 背景档案全文；当 `instruction` 非空，追加「用户修改要求：{instruction}」。

### 4.2 parseStoryOutline(raw): StoryOutline

复用既有剥离逻辑：去 ```` ```json ```` 包裹 → 截取首个 `{` 到末个 `}` → `JSON.parse`；结果须通过 §5.2 形态校验，否则抛错（触发上层错误卡）。

### 4.3 buildCharacterProfilesPrompt / parseCharacterProfiles

- schema：顶层为角色数组，或 `{ "characters": [...] }`；元素字段对应 `CharacterProfile`。
- user：五要素 + 视觉风格 + 已定稿大纲 + 背景档案 + 可选指令。
- parse：兼容数组或对象 `characters` 包装；返回 `CharacterProfile[]`，长度 ≥ 1。

## 5. mock 兜底与形态校验

### 5.1 本地 mock（未配置/调用失败）

- `mockStoryOutline()`：以五要素为题材，产出含 logline / seasonArc / 2–3 主题 / 2–3 冲突 / E01 的大纲。
- `mockCharacterProfiles()`：产出至少 2 个角色（女主、男主），字段齐全、id 稳定。

### 5.2 形态校验（最小）

- 大纲：`typeof logline === 'string'` 且 `Array.isArray(episodes)` 且 episodes 非空。
- 小传：数组非空，每个元素含非空 `name`。
- 不满足则解析函数抛 `Error('story shape invalid')`。

## 6. 重放契约（src/lib/replay.ts 扩展）

### 6.1 ReplayResult 扩展

```ts
interface ReplayResult {
  phase: 'initiating' | 'story'
  nodes: Record<Stage, 'done' | 'active' | 'pending'>
  pendingGate: '0-a' | '0-b' | '0-c' | '1-a' | '1-b' | null
  redoGate: '0-a' | '0-c' | null              // feature-002 v1.1 既有
  storyRedo: '1-a' | '1-b' | null            // 故事产物待重做（否决后等待用户意见）
  diagnosis: TopicDiagnosis | null
  fiveElements: FiveElements | null
  visualStyle: (VisualStyle & { rationale: string }) | null
  storyOutline: StoryOutline | null
  characterProfiles: CharacterProfile[] | null
  showArchive: boolean
  saved: boolean
}
```

### 6.2 新增 kind 的重放规则（按时间序）

| 消息 | 重放效果 |
|---|---|
| `stage`（data `{ phase:'story' }`） | `phase='story'` |
| `story-outline` | `storyOutline=data`；节点 `outline='active'` |
| `character-profiles` | `characterProfiles=data`；节点 `profiles='active'` |
| `gate` 1-a / 1-b | `pendingGate` 置对应门；`storyRedo=null` |
| `gate-action` confirm `1-a` | `outline='done'`、`profiles='active'`；清 pendingGate |
| `gate-action` confirm `1-b` | `profiles='done'`；清 pendingGate |
| `gate-action` reject 1-a / 1-b | 清 pendingGate；**`storyRedo` 置对应门**（产物卡保留、节点不回退，等待对话意见） |

- 故事节点初始 `pending`；`phase` 初始 `initiating`；`storyRedo` 初始 `null`。
- 立项既有重放规则（含 feature-002 v1.1 的 redoGate）不变。
- 调用方据结果派生 `canEnterStory`：`phase==='initiating' && nodes.background==='done'`。
- App 统一发送路由扩展：`storyRedo==='1-a'` → 意见作为 instruction 重生成大纲、重弹 1-a；`storyRedo==='1-b'` → 重生成小传、重弹 1-b。

## 7. 画布契约（src/components/StageCanvas.tsx 泛化）

```ts
interface CanvasNode {
  id: Stage
  title: string
  subtitle: string
  status: 'done' | 'active' | 'pending'
  detail?: React.ReactNode
}
interface CanvasGroup { id: string; label: string; nodes: CanvasNode[] }
interface Props { groups: CanvasGroup[] }
```

- 渲染顺序：STAGE 0「立项」（4 节点）→ STAGE 1「故事创作」（2 节点），纵向两行，各带组标签。
- 行宽 = `nodes*224 + (nodes-1)*32`；缩放 = `min(1, (容器宽-32)/max(各自行宽))`。
- 节点卡/连线/状态着色/序号与既有视觉完全一致；删除原「立项阶段」硬编码提示，改为组标签。

## 8. 错误码汇总

| 码 | 场景 |
|---|---|
| `NO_SESSION` | 任一新增通道无当前会话 |
| `STORY_CTX_MISSING` | agent 故事通道缺少 brief（五要素） |
| `MSG_WRITE_FAILED` | 复用：消息落盘失败 |

## 9. 测试契约

新增/扩展测试（不新增依赖）：

- prompts：parseStoryOutline / parseCharacterProfiles（代码块包裹、数组与 `{characters}` 包装、非法形态抛错）。
- gates：buildGate1a / buildGate1b 的 id/标题/harness。
- replay：故事全流程（stage→outline→1-a confirm→profiles→1-b confirm）节点与 pendingGate；1-a/1-b 否决后 `storyRedo` 正确、产物保留、新 gate 清除；canEnterStory 派生。
- ChatPanel：story-outline / character-profiles 卡渲染。
- App 故事集成：进入→大纲卡→1-a 确认（断言 story:save 调用、files）→小传卡→1-b 确认。
