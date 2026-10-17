# SDG-RE-契约 · feature-809 对话流式活跃指示

> **卡口声明（置顶）**：本包 **K1 / K8 / K9 零触发**——不改 `shared/types.ts`；不新增/修改任何 IPC 通道、MCP 工具、electron/preload 文件；零新 npm 依赖；动画 token 复用既有（`animate-cursor-blink` / 内置 `animate-bounce` / `animate-spin`），tailwind.config.js 零 diff。实施中一旦发现必须越界，**立即停手**、回写变更记录并呈报用户裁决。

## 1. 既有数据面（零改动，只读消费）

[chat-runtime.ts L15-41](../../../src/lib/chat-runtime.ts#L15-L41)：

- `ToolView { callId, tool, status: 'running'|'completed'|'error', args, result?, errorText?, startedAt?, endedAt? }`
- `StreamingTurn { messageId, parts, deltaPreview: { text, reasoning }, tools: Record<string, ToolView>, status: 'running'|'done'|'error' }`
- `turn.tools`：key = callId，**值顺序即首次 upsert 顺序**（JS 对象插入序，reduceRuntimeEvent L106-122 保证）；
- `turn.status` 终态锁定（L78：done/error 后事件不再翻转）；
- `turnText(turn)` / `turnReasoning(turn)`：快照优先、deltaPreview 兜底。

本包对上述类型与函数**只 import 不修改**。

## 2. 纯函数契约（新增，落 ChatComposer.tsx 并 export 供单测）

### 2.1 `toolDurationLabel(tool: ToolView): string | null`

| 规则 | 输入条件 | 输出 |
|---|---|---|
| D1 | `startedAt`、`endedAt` 均存在且 `endedAt >= startedAt` | `((endedAt - startedAt) / 1000).toFixed(1) + 's'`（如 `1.2s`、`0.0s`） |
| D2 | 缺任一端 | `null`（不显示耗时） |
| D3 | `endedAt < startedAt`（异常时钟） | `null`（不展示、不猜测） |

### 2.2 `showStreamCursor(turn: StreamingTurn, text: string): boolean`

| 规则 | 条件 | 输出 |
|---|---|---|
| C1 | `turn.status === 'running' && text.length > 0` | `true` |
| C2 | 其余一切组合（无正文 / done / error） | `false` |

### 2.3 工具行序

| 规则 | 约定 |
|---|---|
| T1 | 渲染顺序 = `Object.values(turn.tools)`（首次出现序），不另行排序 |
| T2 | 空对象 → 不渲染工具区 |

## 3. 组件契约

### 3.1 AgentTurn（改造，签名 `{ turn, text }` 不变）

渲染顺序恒为：reasoning 折叠块 → 正文（MarkdownText + 光标）→ 工具行区 → 空态三点。

| # | 条件 | 渲染 |
|---|---|---|
| A1 | reasoning 非空 | 现有 `<details>` 块，零改动 |
| A2 | text 非空 | `<MarkdownText text={text} />`；`showStreamCursor(turn, text)` 为真时尾随 `<span data-testid="chat-stream-cursor" className="animate-cursor-blink …">▍</span>` |
| A3 | tools 非空 | 逐行 `<ToolRow />`（§3.2），整体位于正文之后 |
| A4 | `!text && status==='running'`（2026-10-17 X-001 修订：去掉 `!reasoning`，仅推理态也出 TypingDots，满足 AC7 活跃不变式） | `<TypingDots />`（`data-testid="chat-typing-dots"`）+「主控 Agent 正在思考…」文案（替换原纯静态行） |
| A5 | done / error | 不渲染 cursor / TypingDots / spinner；工具行以 ✓ / ✗ 定格（规则同 A3） |

### 3.2 ToolRow（新增内部组件）

| 状态 | 图标 | 文本 |
|---|---|---|
| running | `animate-spin` 圆弧（复用 L504 类组合：`rounded-full border-2 border-line border-t-violet`，尺寸 h-2.5 w-2.5） | 工具原名 + 「执行中」 |
| completed | `✓`（text-ok） | 工具原名 + `toolDurationLabel` 非 null 时追加耗时 |
| error | `✗`（text-bad） | 工具原名 + errorText（`truncate` 单行省略 + `title` 悬停全文）；errorText 为空 → 「执行失败」 |

### 3.3 占位气泡（新增分支）

`!stream && generating` → Avatar(showrunner) + 气泡壳（与流式气泡同 max-w / 圆角 / 底色类）+ `<TypingDots />`，行容器带 `data-testid="chat-turn-placeholder"`。**与原 `{stream && …}` 块并列新增，不改原块内部结构**（GateCardView 随挂逻辑不动）。

### 3.4 空态提示联动

L508 条件 `items.length === 0 && !stream` → `items.length === 0 && !stream && !generating`。

## 4. Props 与 data-testid 凭据

ChatComposer Props **零新增**（`stream: StreamingTurn | null`、`generating = false` 已存在，L448）。

| testid | 元素 | 出现条件 |
|---|---|---|
| `chat-turn-placeholder` | 占位气泡行 | `!stream && generating` |
| `chat-stream-cursor` | 光标 span | `running && 有正文` |
| `chat-typing-dots` | 三点动画容器 | 占位气泡 / 空态思考行 |
| `chat-tool-row` | 单行工具状态 | tools 非空，逐行一个 |

## 5. 最小 diff 描述

- [ChatComposer.tsx](../../../src/studio/ChatComposer.tsx)：新增两纯函数 + TypingDots / ToolRow 两内部组件；AgentTurn 按 §3.1 改造；流式区新增占位分支（§3.3）；L508 条件 +1 子句（§3.4）；
- 新增 `src/studio/chat-liveness.test.tsx`；
- **零 diff 红线**：`src/lib/chat-runtime.ts`、`src/lib/runtime-types.ts`、`shared/**`、`electron/**`、`package.json`、`tailwind.config.js`、`src/studio/StudioApp.tsx`、其余一切既有测试文件（只允许新增用例通过，不允许改既有断言）。

## 6. 测试契约

- 纯函数 6 例：`toolDurationLabel` D1 / D2 / D3；`showStreamCursor` C1 / C2（无正文）/ C2（done 有正文）；
- 组件 ≥9 例：AC1–AC8 各 ≥1 例（其中 AC7 活跃不变式为参数化多状态遍历断言）；
- 写法先例：[chat-markdown.test.tsx](../../../src/studio/chat-markdown.test.tsx)（@testing-library/react + 内存构造 StreamingTurn，不依赖 electron）；
- **回归红线**：`npx tsc --noEmit` 仅 3 条历史基线零新增；全量 **48 文件 528 passed / 0 failed / 1 skipped** 起步，passed 不减少、skip 不增、文件数净增恰 1。

## 7. 卡口与越界处置

| 情形 | 处置 |
|---|---|
| 需要给历史消息留工具痕（扩 `ChatMessage` / `shared/types.ts`） | 触发 **K1** → 停手，回写变更记录呈报 |
| 需要新 RuntimeEvent 类型 / 改归约逻辑 | 越出白名单 → 停手呈报 |
| 需要新动画 token / 新依赖 | 触发 K9 或配置红线 → 停手呈报（现状评估：不需要） |
| 需要 StudioApp 传新 props | 越出白名单 → 停手呈报（现状评估：不需要，stream/generating 已下传） |
