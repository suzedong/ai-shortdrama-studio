# SDG-RE-契约 · feature-002-对话消息动态化

> **版本**：v1.1（2026-10-03，v1.0 交付后缺陷修复，已实现并闭环）
>
> 本契约定义全部数据类型、IPC 通道、文件格式、重放规则。实现必须严格匹配。
>
> 卡口：本文件涉及的 **K1（shared/types.ts）**、**K8（project:save 变更；v1.1 追加 archive:save 与可选 instruction）** 随规格审批生效。

## 1. 数据类型（shared/types.ts，K1）

### 1.1 ChatMessage 扩展

```ts
export type MessageKind =
  | 'text'        // 普通文本（用户气泡 / Agent 文本）
  | 'brief'       // 创意简报卡
  | 'diagnosis'   // 选题诊断结果
  | 'visual-style'// 视觉风格结果
  | 'progress'    // 进度提示
  | 'error'       // 失败（可重试）
  | 'gate'        // 确认门待处理
  | 'gate-action' // 确认门动作（确认/否决）
  | 'archive'     // 背景档案锁定

export type MessageStatus = 'pending' | 'done' | 'error'

export interface ChatMessage {
  id: string                    // 生成规则：`m-{Date.now()}-{自增序号}`
  role: 'user' | 'agent' | 'system'
  kind: MessageKind             // 新增（必填）；旧数据无此字段时按 'text' 处理
  content: string               // 文本内容/摘要；结构化数据放 data
  status?: MessageStatus        // progress 类消息必填；其余可省略
  data?: unknown                // kind 对应的结构化载荷，见 §1.2
  toolCall?: { name: string; args: string; result: string }
  gate?: GateCard
  ts: number
}
```

兼容性：`kind`/`status`/`data` 为新增字段；feature-001 代码不产生历史消息文件，无迁移负担。

### 1.2 各 kind 的 data 载荷契约

| kind | role | data 类型 | data 内容 |
|---|---|---|---|
| `text` | user/agent | 无 | — |
| `brief` | agent | `{ fields: { label: string; value: string }[] }` | 简报字段（类型/集数/时长/画幅/风格） |
| `diagnosis` | agent | `TopicDiagnosis` | 完整诊断（复用现有类型） |
| `visual-style` | agent | `VisualStyle & { rationale: string }` | 视觉风格 |
| `progress` | agent | `{ label: string }` | 如 `{ label: '正在检索同赛道对标…' }`；状态用 `status` |
| `error` | agent | `{ reason: string; retryToken: string }` | retryToken 标识重试动作（一期固定 `'diagnose'`） |
| `gate` | system | `{ gateId: string; title: string }` | 门弹出记录；门完整数据由 App 从关联 data 消息重建 |
| `gate-action` | system | `{ gateId: string; action: 'confirm' \| 'reject' }` | 动作留痕 |
| `archive` | system | `{ chars: number }` | 档案锁定 |

### 1.3 新增会话类型

```ts
export interface ProjectSession {
  dir: string
  title: string          // 一期固定 '新项目'
  createdAt: string      // ISO
  lastOpenedAt: string   // ISO
}

// userData/session-state.json 的文件格式
export interface SessionStateFile {
  currentDir: string | null
}
```

## 2. IPC 通道（K8）

### 2.1 新增通道

| 通道 | 入参 | 返回 | 行为 |
|---|---|---|---|
| `session:start` | 无 | `ProjectSession` | 创建会话目录与初始 manifest；设置当前会话；写 session-state.json。已有当前会话时直接返回当前会话（不重复创建） |
| `session:current` | 无 | `ProjectSession \| null` | 当前会话（读 session-state.json 并校验目录存在；目录缺失返回 null 并清空记录） |
| `chat:append` | `message: ChatMessage` | `{ ok: true }` | **upsert** 消息到当前会话 `chat.messages.json`：同 id 替换，否则追加；无当前会话 → reject（错误码 `NO_SESSION`）。**v1.1：写操作经单写队列串行执行（§4.3）** |
| `chat:load` | 无 | `ChatMessage[]` | 读取当前会话消息；文件不存在返回 `[]`；无当前会话 → reject（`NO_SESSION`） |
| `archive:save`（v1.1 新增） | `text: string` | `{ ok: true }` | 写当前会话 `故事背景档案.md`（UTF-8 全文覆盖）；无当前会话 → reject（`NO_SESSION`） |

### 2.2 变更通道（K8 破坏性变更，仅 App 调用，同步修改）

`project:save`：

- **旧行为**：入参 `{ manifest, brief }`；创建 `project-{Date.now()}` 新目录写文件
- **新行为**：入参不变；写入**当前会话目录**的 `manifest.json` / `brief.json`（覆盖更新）；无当前会话 → reject（`NO_SESSION`）；返回 `{ dir }`（当前会话目录）

### 2.3 通道增量（v1.1，K8，向后兼容）

- `agent:diagnose`：入参由 `(idea: string)` 扩展为 `(idea: string, instruction?: string)`；`instruction` 非空时在 prompt 追加「用户修改要求：{instruction}」；返回结构不变。
- `agent:visual-style`：入参由 `(fe: FiveElements)` 扩展为 `(fe: FiveElements, instruction?: string)`；同上；返回结构不变。
- 其余 `project:create`、`app:ark-status` 签名与行为保持不变。

### 2.4 异常约定

- 主进程 Agent 通道沿用"失败不外抛，降级 mock"
- 会话/消息类通道失败时 reject，错误对象形如 `{ code: string; message: string }`，code 枚举：`NO_SESSION`、`SESSION_DIR_MISSING`、`MSG_WRITE_FAILED`

## 3. 渲染进程 API（preload）

```ts
window.api = {
  // 既有（v1.1：两个 Agent 方法增加可选 instruction）
  createProject(title: string): Promise<{ id: string; title: string; createdAt: string }>
  diagnose(idea: string, instruction?: string): Promise<TopicDiagnosis>
  recommendVisualStyle(fe: FiveElements, instruction?: string): Promise<VisualStyle & { rationale: string }>
  arkStatus(): Promise<{ configured: boolean; keyMasked: string; model: string }>
  // 变更
  saveProject(data: { manifest: unknown; brief: unknown }): Promise<{ dir: string }>
  // 新增
  startSession(): Promise<ProjectSession>
  currentSession(): Promise<ProjectSession | null>
  appendMessage(message: ChatMessage): Promise<{ ok: true }>
  loadMessages(): Promise<ChatMessage[]>
  saveArchive(text: string): Promise<{ ok: true }>
}
```

## 4. 文件格式契约

### 4.1 会话目录

```
{Documents}/ai-shortdrama-studio/project-{时间戳}/
├── manifest.json        # session:start 初始写入；project:save 覆盖更新
├── brief.json           # project:save 时写入
├── 故事背景档案.md       # archive:save 写入（v1.1），后续编剧只读事实
└── chat.messages.json   # chat:append 按 id upsert（同 id 替换/否则追加），JSON 数组缩进 2
```

- 初始 `manifest.json`：`{ status: 'initiating', createdAt: ISO }`
- 写消息采用"读取既有数组 → 同 id 替换或 push → 整体写回"；写失败返回 `MSG_WRITE_FAILED`

### 4.2 主进程会话状态文件

- 路径：`{app.getPath('userData')}/session-state.json`
- 格式：`SessionStateFile`；目录不存在时写 `{ currentDir: null }`

### 4.3 落盘串行化（v1.1）

- 主进程维护单写队列（Promise 链）：`chat:append` 与其他会话文件写操作按**入队顺序**依次执行读-改-写。
- 保证：连续/并发 append 不丢更新、不互相覆盖，文件内最终顺序与调用顺序一致。
- 单个写失败只 reject 对应调用，不中断队列（队列继续接收后续任务）。

## 5. 消息重放契约（replay）

新增纯函数模块 `src/lib/replay.ts`：

```ts
interface ReplayResult {
  nodes: Record<Stage, 'done' | 'active' | 'pending'>
  pendingGate: '0-a' | '0-b' | '0-c' | null
  redoGate: '0-a' | '0-c' | null      // v1.1：待重做（否决后等待用户意见）
  diagnosis: TopicDiagnosis | null
  fiveElements: FiveElements | null
  visualStyle: (VisualStyle & { rationale: string }) | null
  showArchive: boolean
  saved: boolean
}

replayMessages(messages: ChatMessage[]): ReplayResult
```

重放规则（按时间顺序逐条应用）：

| 消息 | 状态变化 |
|---|---|
| 首个 user text | idea: active |
| `diagnosis` 数据 | diagnosis 数据保存 |
| `gate` {gateId} | pendingGate = gateId；redoGate = null |
| `gate-action` confirm | 清除 pendingGate；0-a → idea/diagnosis done、brief active；0-b → brief 保持 active（等待 0-c）；0-c → brief done、background active、showArchive=true、saved=true |
| `gate-action` reject 0-a / 0-c | 清除 pendingGate；**redoGate = 对应门**（节点状态不变） |
| `gate-action` reject 0-b | 清除 pendingGate；**pendingGate 重新置为 0-b**（App 据此重开门；redoGate 不变） |
| `visual-style` 数据 | visualStyle 保存；pendingGate=0-c（由 gate 消息负责，不由此条推断） |
| `archive` | background done、showArchive=false |

`fiveElements` 不在消息中独立存储：从 `diagnosis` 数据 + 对应用户消息原文经 `deriveFiveElements` 重新推导（重放时取首个 user text）。

## 6. 前端模块划分

| 模块 | 职责 |
|---|---|
| `src/lib/deriveFiveElements.ts` | 从 App.tsx 抽出现有推导函数（纯函数，逻辑不变） |
| `src/lib/messages.ts` | 消息构造工厂（`makeUserText` / `makeProgress` / `makeError` / `makeGateAction` 等，统一 id 生成） |
| `src/lib/replay.ts` | §5 重放函数 |
| `src/state/chat.ts` | 消息状态管理（useState/useReducer；append/update 两个基本操作） |
| `src/components/ChatPanel.tsx` | 接收 `messages`、`onSend`、`onRetry`；渲染与自动滚动 |
| `src/components/messages/*` | BriefCard / ProgressBubble / ErrorBubble 子组件 |
| `src/App.tsx` | 持有会话与消息状态；恢复流程编排；既有确认门业务逻辑 |

## 7. 测试契约（K9）

dev 依赖（实际落地版本）：`vitest@^3.2`（**固定 3.x**：vitest 5 的 peer 要求 vite ≥6，本项目 vite 5，故不采用 5.x）、`@testing-library/react`、`@testing-library/jest-dom`、`@testing-library/user-event`、`jsdom`。

- 配置：`vitest.config.ts`（environment jsdom，setup 文件 `src/test/setup.ts`）
- 必测：
  - `deriveFiveElements`：关键词分支、默认值、平台 Top3
  - `replayMessages`：全流程消息序列、否决分支、空数组
  - `messages.ts`：id 唯一、字段完整
  - `ChatPanel`：渲染消息列表、Enter 发送、错误重试回调
- **v1.1 追加必测**：
  - replay：0-a / 0-c 否决后 `redoGate` 正确；0-b 否决后 pendingGate 回置 0-b；重做后（新 gate 消息）redoGate 清空
  - App 编排：0-a 否决→输入意见→`diagnose(idea, instruction)` 被调用、重弹 0-a、不新建会话；0-c 否决→`recommendVisualStyle(fe, instruction)`、重弹 0-c；0-b 否决→直接重开门
  - 档案锁定：成功调 `saveArchive(text)` 后标记完成；失败时保持录入区、不标记
- 脚本：`"test": "vitest"`、`"test:run": "vitest run"`
