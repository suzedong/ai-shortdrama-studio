# SDG-RE · 契约 · feature-010 对话通道全量接入

> 版本：v1.0（待用户签字）
> 日期：2026-10-05
> 卡口：本契约含 **K3**（旧 ark 对话 IPC 退役）、**K6**（新增主进程 MCP 工具模块）、**K8**（RuntimeEvent 扩展 / 工具白名单 / IPC 变更）。用户签字即视为对上述卡口决策的授权，实施时仍须在变更记录追加永久决策条目。
> 兼容：不改 `shared/types.ts`（K1）、不新增依赖（K9）。

---

## 1. 进程拓扑（契约性约束）

```
Electron 主进程 (Node)
 ├─ MCP 业务工具服务  ── MCP over Streamable HTTP，127.0.0.1:<mcpPort>，Bearer <mcpToken>
 │     handler 直接复用主进程 service（ark chat / prompts / parsers / 持久化）
 └─ spawn opencode serve ─ 127.0.0.1:<ocPort>，Basic opencode:<ocPassword>
        env 注入: OPENCODE_MCP_URL / OPENCODE_MCP_TOKEN / ARK_API_KEY / XDG_*
        opencode config: mcp.shortdrama = { type:'remote',
          url: '{env:OPENCODE_MCP_URL}',
          headers: { Authorization: 'Bearer {env:OPENCODE_MCP_TOKEN}' } }
        director agent  tools/permission 放行 "shortdrama_*"
```

硬约束：
- MCP 服务**只绑 loopback**；除 `127.0.0.1` 外不可达。
- `mcpToken` 每次启动随机（`crypto.randomBytes(24).toString('base64url')`），仅经子进程环境变量传递，**不写入 opencode.json、不出现在 argv、不落盘**。
- opencode v1.18.34 内置配置文本插值（JSON 解析前执行）：仅识别 `{env:NAME}` 与 `{file:path}` 两种占位符，**不支持** `${NAME}` 等 shell 语法；env 缺失时展开为空串（不报错）。故生成态 opencode.json 只写字面占位符 `{env:OPENCODE_MCP_URL}` / `Bearer {env:OPENCODE_MCP_TOKEN}`，由 manager 保证 env 已注入。
- MCP 服务在主进程内（与 ComfyUI 引擎同进程边界），renderer 与 opencode 均不直连任何媒体通道。

---

## 2. 主进程 MCP 服务接口

### 2.1 传输与生命周期

| 项 | 约定 |
| :-- | :-- |
| Transport | `@modelcontextprotocol/sdk` 的 `StreamableHTTPServerTransport`（SDK 1.31.0 已内置，不新增依赖） |
| 监听 | `http.createServer` + `127.0.0.1`，端口动态探测（起始 4100，顺探 25 个） |
| 路径 | 单一 `/mcp`；`POST` 处理 JSON-RPC，`GET` 打开 SSE（session 模式） |
| 生命周期 | `runtime:start` 成功后启动；`runtime:stop`、`before-quit` 时关闭 server 与所有 transport |
| 鉴权中间件 | 校验 `Authorization: Bearer <mcpToken>`；缺失 / 不匹配返回 HTTP 401 |

模块位置（K6 决策）：`electron/mcp/`（新顶层业务目录，仅含主进程 MCP 服务）：
- `electron/mcp/server.ts`：服务创建 / 鉴权 / 生命周期，导出：

```ts
export interface McpToolServerHandle {
  port: number
  close: () => Promise<void>
}
export function startMcpToolServer(opts: { host?: string; portRangeStart?: number }): Promise<McpToolServerHandle>
```

- `electron/mcp/tools.ts`：工具注册，导出 `registerBusinessTools(server: McpServerLike): void`。
- 既有顶层 [mcp/server.ts](../../../mcp/server.ts)（stdio 骨架）**不动**。

### 2.2 JSON-RPC 方法

遵循 MCP 标准：`initialize` / `notifications/initialized` / `tools/list` / `tools/call`；`tools/call` 错误用标准 JSON-RPC error（code −32603 内部错误），`message` 内携带本项目错误码（见 §5）。

### 2.3 工具返回形态

`tools/call` 结果：

```ts
{
  content: [{ type: 'text', text: string }]   // text = JSON.stringify({ kind, product, meta })
  isError?: boolean                            // 业务可恢复错误时 true（opencode 不中断 loop，供 UI 展示）
}
```

- `text` 必须是可 `JSON.parse` 的字符串，解析后为 `ToolResultEnvelope`（§3.2）。
- 致命 / 鉴权 / 参数结构错误走 JSON-RPC error；业务可恢复错误（目录外画风、上下文缺失等）走 `isError:true` + envelope。

---

## 3. 业务工具清单（tools/list）

工具 ID 经 opencode 注册为 `shortdrama_<tool>`；director frontmatter 放行 `shortdrama_*`。所有工具 handler 在主进程内复用现有 prompts / parsers / mock 逻辑（抽出自 [main.ts](../../../electron/main.ts) 现有 `ipcMain.handle` 实现，保持行为一致，包括无 Key mock 兜底与 STYLE_NOT_IN_CATALOG 校验）。

### 3.1 工具定义

| 工具（shortdrama_ 后） | 入参（JSON Schema） | 出参 product | 等价现有 IPC |
| :-- | :-- | :-- | :-- |
| `diagnose` | `{ idea: string; instruction?: string }` | `TopicDiagnosis` | `agent:diagnose` |
| `visual_style` | `{ fiveElements: FiveElements; instruction?: string }` | `VisualStyle & { rationale: string }` | `agent:visual-style` |
| `revise_text` | `{ kind:'idea'\|'background'; current:string; instruction:string; turns?: {instruction:string;draft:string}[] }` | `{ text:string }` | `agent:revise-text` |
| `story_outline` | `{ instruction?: string }`（ctx 由主进程读当前项目） | `StoryOutline` | `agent:story-outline` |
| `character_profiles` | `{ instruction?: string }` | `CharacterProfile[]` | `agent:character-profiles` |
| `scenes` | `{ instruction?: string }` | `SceneBreakdown` | `agent:scenes` |
| `dialogue` | `{ instruction?: string }` | `DialogueScript` | `agent:dialogue` |
| `storyboard` | `{ instruction?: string }` | `ShotList` | `agent:storyboard` |

说明：
- 入参字段类型与现有 IPC 参数逐一同构；`FiveElements` 等结构以 `shared/types.ts` 既有定义为准（仅引用类型，不改共享层）。
- `story_outline` 等不需要业务入参的工具，其上下文由主进程经现有 `readStoryContext / readScriptContext` 读取当前项目目录；**不要求 director 回传产物上下文**，避免上下文膨胀。
- 不注册 write/bash/edit/webfetch 等工具；director 只读 + 业务工具。

### 3.2 ToolResultEnvelope

```ts
export interface ToolResultEnvelope {
  kind: BusinessToolName         // 'diagnose'|'visual_style'|'revise_text'|'story_outline'|
                                 // 'character_profiles'|'scenes'|'dialogue'|'storyboard'
  product: unknown               // §3.1 出参结构
  meta?: {
    source: 'ark' | 'mock'       // 实际通道（无 Key 走 mock）
    durationMs?: number
  }
  error?: { code: RuntimeErrorCode; message: string }   // isError:true 时存在
}
```

---

## 4. RuntimeEvent 契约扩展（K8）

### 4.1 `tool.call` 事件（扩展后）

```ts
export interface RuntimeToolCallEvent {
  type: 'tool.call'
  ts: number
  sessionId: string
  messageId: string
  callId: string                 // 新增：opencode ToolPart.callID，关联同一调用的多次更新
  tool: string                   // opencode 工具名（形如 shortdrama_diagnose）
  status: 'running' | 'completed' | 'error'
  argsPreview: string            // 保留：JSON.stringify(args) 截断 500
  resultPreview?: string         // 保留：output/error 截断 500
  args: unknown                  // 新增：完整入参原对象（不截断）
  result?: unknown               // 新增：completed 时解析后的对象/文本（尝试 JSON.parse envelope，失败则原字符串）
  errorText?: string             // 新增：status=error 时的完整错误文本（不截断）
  startedAt?: number             // 新增：state.time.start（ms）
  endedAt?: number               // 新增：state.time.end（ms）
}
```

投影规则（[projection.ts](../../../electron/runtime/projection.ts)）：
- 从 ToolPart 取 `callID`、`state.input`、`state.output/state.error`、`state.time`。
- `result`：对 `state.output` 尝试 `JSON.parse`；得到 `ToolResultEnvelope` 时返回其解析对象，否则返回原始字符串。
- pending 仍并入 running；非 running/completed/error 返回 null。
- `state.attachments` 本 Feature 不透出（媒体附件后续 Feature）。

### 4.2 其余事件（一处受控变更：message.delta 分轨）

T10-4 真机冒烟发现投影缺陷并修复（K8，见变更记录 D-006；其 field 分轨假设经 D-009 反转）：推理增量此前被无条件当正文累加，导致助手气泡正文混入内心推理（实测定稿白气泡内容为"用户…"内心推理）。

`message.delta` 在 feature-009 契约上**新增一个必填字段 `track`**：

```ts
| {
    type: 'message.delta'; ts: string
    sessionId: string; messageId: string
    track: 'text' | 'reasoning'   // 新增：由 partID → part 类型映射投影（D-009）
    delta: string
  }
```

> ⛔ **D-006 原方案反转（见 D-009）**：曾规定「按 delta 的 `field` 前缀分轨」。原始 SSE 取证证伪——opencode 1.18.34 对**所有** delta（含 reasoning）一律下发 `field: "text"`，field 不携带轨道信息；但 delta 事件稳定携带 `partID`，与 `message.part.updated` 的 `part.id` 一一对应。

投影规则（D-009 定稿）：投影器维护 `partID → kind`（`text` / `reasoning`）映射——每收到 `message.part.updated` 即登记该 part 的 `id → type`；收到 `message.part.delta` 时按 `properties.partID` 查表：命中 `reasoning` → `track: 'reasoning'`；命中 `text` 或尚未登记 → `track: 'text'`。**`field` 字段不作为分轨依据**。`runtime.connected` / `message.part` / `session.idle` / `runtime.error` 字段保持 feature-009 契约不变。

> 说明：新增字段虽为加性，但属封闭联合事件形态变更（renderer 归约必须读取），按 K8 管控并镜像同步三处（§4.3），不视为"旧消费方零改动"。

**`message.part.updated` 的 role 过滤（T10-4 真机冒烟发现并修复，见变更记录 D-007）**：opencode 的**用户消息同样携带 text part** 并经 `message.part.updated` 下发；Part 载荷本身不带 role。此前投影未区分消息归属，把用户输入当成 agent 轮惰性建轮，随后 assistant 的 part 因 `messageId` 不匹配被归约忽略，`session.idle` 定稿即产生"内容为用户原文的 agent 白气泡"。

投影判别（零网络成本，依据 opencode 1.18.34 实测 Part 形态）：

| part.type | 用户消息 | assistant 消息 | 投影动作 |
| :-- | :-- | :-- | :-- |
| `text` | **无 `time` 字段** | 必有 `time:{start,end}` | 用户 part → 返回 null（忽略计数）；assistant → `message.part` |
| `reasoning` | 不存在 | 必有 `time` | 仅 assistant → `message.part` |
| `tool` | 不存在 | ToolPart | 仅 assistant → `tool.call`（§4.1 规则不变） |

即：`text` / `reasoning` 仅当 `part.time` 为含 `start` 的对象时才投影，否则按非 agent part 忽略。此为投影层过滤，**不改 RuntimeEvent DTO 字段**，无需镜像 DTO。

**`message.part` 新增 `partId` + 快照 replace 归约（T10-4 真机冒烟发现并修复，见变更记录 D-008）**：opencode 对同一段正文**并行**下发两路事件——逐 token 的 `message.part.delta` 与携带**累积全量快照**的 `message.part.updated`（官方持久化按 part.id 整体替换，可证其为快照）。此前归约把两路无条件拼接，定稿正文重复（实测"角色修复角色修复"）。

`message.part` 在既有形态上**新增一个必填字段 `partId`**：

```ts
| {
    type: 'message.part'; ts: string
    sessionId: string; messageId: string
    partId: string               // 新增：opencode Part.id，同一 part 的多次快照共享
    part: { kind: 'text' | 'reasoning' | 'tool' | 'structured'; text?: string;
            tool?: string; status?: 'running' | 'completed' | 'error' }
  }
```

投影规则：`partId` 取 `part.id`；`part.text` 原样透传快照全量（不截断的正文语义不变，preview 截断仅用于 tool.call）。归约规则见 §7.2：**同一 partId 的快照 replace 该 part，不追加；delta 仅在尚无对应快照时作流式预览**。属封闭联合事件形态变更，按 K8 管控并镜像同步三处（§4.3）。

### 4.3 镜像同步

三处须一一对应（K8）：
- [electron/runtime/types.ts](../../../electron/runtime/types.ts)（主进程 DTO）
- [src/lib/runtime-types.ts](../../../src/lib/runtime-types.ts)（renderer DTO）
- [projection.ts](../../../electron/runtime/projection.ts)（投影实现）

---

## 5. 错误码

在现有 `RuntimeErrorCode` 封闭集合（runtime-types.ts）基础上**新增一个值 `RUNTIME_UPSTREAM_ERROR`**（2026-10-05 用户裁决 L2：契约需表达"业务上游可恢复错误"语义，既有 11 码无对应项；两侧 DTO 镜像同步新增，见变更记录 D-005）。业务工具错误映射：

| 场景 | code | 通道 |
| :-- | :-- | :-- |
| 未带 / 错误 Bearer 访问 MCP | HTTP 401（不到 JSON-RPC） | 中间件 |
| 入参 JSON Schema 不合法 | `INVALID_ARGUMENT` | JSON-RPC error |
| 上下文缺失（STORY_CTX_MISSING） | `RUNTIME_UPSTREAM_ERROR` | envelope isError |
| 画风目录外（STYLE_NOT_IN_CATALOG） | `RUNTIME_UPSTREAM_ERROR`（message 保留 STYLE_NOT_IN_CATALOG） | envelope isError |
| 上游 ark 调用失败且无 mock | `RUNTIME_UPSTREAM_ERROR` | envelope isError |
| opencode / 子进程异常 | 现有对应码 | runtime.error |

---

## 6. IPC / preload 变更（K8）

### 6.1 renderer 与 runtime（无新 IPC）

renderer 仅使用 feature-009 已有 `window.api.runtime.*` 方法与事件，不新增通道。

### 6.2 旧 ark 对话 IPC 退役（K3）

以下对话 IPC 在对话链路零引用：`agent:diagnose`、`agent:visual-style`、`agent:revise-text`、`agent:story-outline`、`agent:character-profiles`、`agent:scenes`、`agent:dialogue`、`agent:storyboard`。

决策：
- 其**业务实现抽入** `electron/mcp/tools.ts` 复用；抽出后上述 `ipcMain.handle` 注册块 **删除**（含 `app:ark-status` 仅在确认无 renderer 引用后处理；搜索确认引用后决定，默认保留）。
- preload 对应方法（`diagnose / recommendVisualStyle / reviseText / generateOutline / generateProfiles / generateScenes / generateDialogue / generateStoryboard`）：从 [preload.ts](../../../electron/preload.ts) 与 [global.d.ts](../../../src/global.d.ts) **移除**（K8）；`arkStatus` 若保留则 IPC 保留。
- 持久化 / 会话 / workflow / clear 等 IPC **全部保留**。
- [ark.ts](../../../electron/ark.ts) 的 `chat / isConfigured / maskKey` 🟢沿用（被 MCP handler 复用）。

### 6.3 runtime manager 扩展（内部，非 IPC）

- [manager.ts](../../../electron/runtime/manager.ts)：`start()` 成功后由主进程编排启动 MCP server，并把 MCP url/token 并入子进程 env（新增内部 env 名 `OPENCODE_MCP_URL` / `OPENCODE_MCP_TOKEN`，仅子进程环境，不进 DTO；env 缺失即配置展开为空串，故注入须在 spawn 前完成并校验非空）。
- [provider.ts](../../../electron/runtime/provider.ts)：config 增加 `mcp.shortdrama`（remote），**只写字面占位符**：`url: '{env:OPENCODE_MCP_URL}'`、`headers.Authorization: 'Bearer {env:OPENCODE_MCP_TOKEN}'`；真实值不经任何函数参数传入，结构上保证不被序列化落盘（同 ARK key 模式）。
- [client.ts](../../../electron/runtime/client.ts)：prompt tools 白名单由 `['read','glob','grep']` 扩展为含 `shortdrama_*`（前缀匹配）；白名单定义移出写死常量，改为允许 director 声明工具集合，仍拒绝集合外工具。

> **D-012 · MCP 远程工具调用超时取 180s（2026-10-05 真机取证修订）**
>
> - 背景：实现初版把 `mcp.shortdrama.timeout` 写死为 10s（`SHORTDRAMA_MCP_TIMEOUT_MS`），契约 §1/§6.3 并未规定该值。真机 T10-4 触发 `shortdrama_diagnose` 时，工具内部经 `ark.ts chat()` 做**整段非流式生成**（diagnose / outline / profiles / scenes / dialogue / storyboard 均如此），实测该类生成耗时 20–60s，10s 必然触发 opencode MCP 客户端错误 `-32001 Request timed out`，工具行落 ✕ 且产物永不交付。
> - 决策：`SHORTDRAMA_MCP_TIMEOUT_MS = 180_000`（3 分钟），写入 opencode config 的 `mcp.shortdrama.timeout`。取值依据：覆盖 ark 长生成 P99 并留余量；超时不是常态控制手段，仅作为兜底防止 opencode 永久挂起。
> - 边界：该超时是 **opencode → 本机 MCP 工具服务**这一跳的等待上限，不改变 renderer 侧「流式文本 + 停止生成」体验（主控对话仍由 SSE 事件实时驱动，用户可随时停止）；也不改变工具内部 ark 调用本身的行为。
> - 真机佐证（修订前）：一轮重生复仇创意，`diagnose` 在约 10s 报 `-32001`，同轮 `read` 卡 running 196s（3:16 未 idle），DOM/磁盘均无 brief/diagnosis 产物。

---

## 7. renderer 编排契约

### 7.1 App.tsx 发送编排（handleSend 替换）

```
ensureRuntimeRunning()            // 未 running：runtime.start()（内部已起 MCP server、写 mcp config）
ensureOpencodeSession()           // 无映射会话：createSession() → subscribe(sessionId)
pushUserMessage(text)             // 本地 setMessages + appendMessage（落盘不变）
runtime.promptAsync({ sessionId, text })   // 不加 agent/model/format/tools
```

- opencode 会话与项目会话目录的映射：App 内以 ref/state 保存 `{ projectDir → opencodeSessionId }`；不新增 IPC。切换 / 重建项目时重新 createSession。

### 7.2 事件 → 消息归约（纯函数层，新增 src/lib/chat-runtime.ts）

导出（签名）：

```ts
export interface StreamingTurn {
  messageId: string
  /** partId → 快照 part（快照 replace 模型，D-008）；插入顺序即首次出现顺序 */
  parts: Record<string, SnapshotPart>
  /** delta 预览（仅在该 track 尚无快照 part 时展示） */
  deltaPreview: { text: string; reasoning: string }
  tools: Record<string, ToolView> // callId → ToolView
  status: 'running' | 'done' | 'error'
}
export interface SnapshotPart {
  partId: string
  kind: 'text' | 'reasoning'
  text: string                    // 累积全量快照（同 partId replace）
}
export interface ToolView {
  callId: string; tool: string; status: 'running'|'completed'|'error'
  args: unknown; result?: unknown; errorText?: string
  startedAt?: number; endedAt?: number
}
export function reduceRuntimeEvent(turn: StreamingTurn | null, event: RuntimeEvent): StreamingTurn | null
export function turnToChatMessage(turn: StreamingTurn): ChatMessage  // 投影为共享层消息（不改 shared）
```

归约规则（快照 replace，D-008）：

- `message.part`：按 `event.partId` upsert——**已存在则整体 replace（text 覆盖，绝不追加）**，不存在则插入。
- `message.delta`：按 `event.messageId` 归并（delta 无 partId 键），分轨累加进 `deltaPreview.{text|reasoning}`；**仅作该 track 尚无快照 part 时的预览**（视图层：已有任一 text 快照则正文以 parts 为准，deltaPreview.text 不展示；reasoning 同理）。
- 定稿正文 `turnToChatMessage`：有 text 快照 → 按 part 插入顺序拼接各快照 `text`；无 text 快照 → 回退取 `deltaPreview.text`。reasoning 同理用于推理展示，绝不混入正文。
- `tool.call`：按 `callId` upsert ToolView。
- `session.idle`：status=done。
- `runtime.error`：status=error。
- **终态锁定（D-010）**：turn 一旦进入 `done` / `error` 即视为终态，后续任何事件（含另一类终态事件）一律原样返回该 turn，**不再翻转状态**。opencode 1.18.34 真机取证：用户点停止后，`runtime.error(PROMPT_ABORTED)` 与 `session.idle` 会**先后成对到达**（error 先、idle 后，且各自重复一次）；若不锁定，error 定稿「已停止生成」后 idle 又定稿「本轮没有产出有效结果」，一轮落两个矛盾气泡。abort 场景以先到的 `error` 为准（走 finalizeErrorTurn）；正常完成时 error 不会到达，idle 定稿 done 不受影响。
- **纯归约 / 副作用隔离（D-011）**：`setStreamingTurn` 的 updater 必须是**纯函数**，只允许返回新轮次，**禁止在 updater 内调用 `pushMessage` / 落盘等副作用**。React 18 `<React.StrictMode>` 在开发态会**双调用 state updater** 以检出不纯；真机取证：abort 轮 `runtime.error(PROMPT_ABORTED)` 到达时，updater 内「无轮则落错误气泡」分支被双调用，同一条消息经 `pushMessage` 两次追加进 React `messages`（DOM 出现两个同 id 气泡），而 `appendMessage` 主进程侧按 id 去重故落盘仅一条。正确做法：updater 只做 `reduceRuntimeEvent` 纯归约；需要读取当前轮以决定副作用时，读独立的 `streamingTurnRef`（与 state 同步），在 updater **之外**执行副作用。此外，**定稿 effect 必须按轮次 id 幂等**：维护一个 `finalizedIdsRef: Set<messageId>`，定稿某轮前先判 id 是否已在集合中，命中即跳过；React 18 StrictMode 开发态会对 effect 做「setup → cleanup → setup」重放，仅靠会被复位的 `finalizingRef` 布尔锁无法跨两次 setup 去重，真机取证同一终态 turn 被定稿两次（同 id 两次 `pushMessage`）。生产构建无 StrictMode 双调用，但幂等集合在两种环境下都成立，作为定稿唯一的去重依据。

### 7.3 ChatPanel Props 变更（K8，受控扩展）

新增 props（不破坏既有）：

```ts
onStop?: () => void               // 停止生成 → abortSession(sessionId)
streaming?: StreamingTurn | null  // 当前进行轮（正文/推理/工具实时视图）
```

- 消息主体仍经 `messages` props；进行中轮以 `streaming` 驱动流式区（正文 + 折叠 reasoning + 工具卡），done 后由 App 落为正式 ChatMessage（appendMessage 落盘）。
- 现有产物卡 / gate / 候选 / 修改流 props 与行为不变。

---

## 8. 异常规则汇总

1. runtime 未运行：首次发送触发惰性 start；start 失败显示错误条，不吞消息。
2. MCP server 端口占用：顺探；25 个全占用 → runtime start 失败（`RUNTIME_UPSTREAM_ERROR`）。
3. opencode 对 MCP 连接失败（`GET /mcp` = failed）：director 无工具可用；runtime.error → 错误气泡。
4. 停止生成：abortSession；已生成 delta 保留为部分消息（status=error 或标注已中止）。
5. 重启恢复：仅恢复已落盘 ChatMessage；不自动重放未 idle 的轮，避免重复生成。
6. 任何契约字段实现不得增删 / 改名；冲突按 L1/L2/L3 处理。

---

## 9. 验收映射

见任务清单 AC 表（AC-1 ~ AC-11 与需求规格 §5 对齐）。
