# SDG-RE 契约 · feature-009 运行时界面接入（调试面板）

> 状态：**v1.0 待批准**
> 日期：2026-10-05
> 实现必须严格匹配本契约；组件 props / 模块函数签名变更视为契约破坏，须重新评审。

---

## 1. 边界

| 项 | 契约 |
|---|---|
| 上游能力 | 仅消费 feature-008 preload 暴露的 `window.api.runtime`（签名以 [global.d.ts](../../../src/global.d.ts) 为准） |
| IPC 变更 | **无**。不新增 / 修改任何主进程通道，不修改 preload |
| DTO 变更 | **无**。类型一律从 `@/lib/runtime-types` 导入（即 `src/lib/runtime-types.ts`），不在本 Feature 内复制 / 扩展 |
| shared/ | 只读，不修改（K1） |
| 依赖 | 不新增 npm 依赖（不触发 K9） |
| 技术栈 | React 18 函数组件 + TypeScript + Tailwind；测试 vitest + @testing-library/react（既有） |

## 2. 文件布局（全部新增，均在既有顶层目录 `src/` 内）

```
src/components/runtime/
├── RuntimeDrawer.tsx      # 抽屉容器 + 显隐控制 + 订阅生命周期编排
├── RuntimeStatusBar.tsx   # F2 状态徽标/控制按钮/错误条/agent 列表
├── RuntimeSessionList.tsx # F3 会话创建/列表/选中/中止/删除
├── RuntimePromptBox.tsx   # F4 promptAsync 输入与发送
├── RuntimeEventLog.tsx    # F5 事件流缓冲/筛选/渲染/滚动
└── runtime-panel.ts       # 纯函数：错误归一、事件摘要、id 截断等（可单测）
```

入口接入点：在 [App.tsx](../../../src/App.tsx) header 右侧加「运行时」开关按钮，条件渲染 `<RuntimeDrawer open={...} onClose={...} />`。App.tsx 的改动以最小必要为限（新增一个 `useState` + 一个按钮 + 一个组件挂载点），不得改动既有任何业务逻辑 / 布局节点（footer 展示性文案调整除外——本期也不调整）。

测试文件：

```
src/components/runtime/RuntimeDrawer.test.tsx   # 集成级：mock window.api.runtime，覆盖面板全链路
src/components/runtime/runtime-panel.test.ts    # 纯函数单测
```

命名约束：目录 `runtime/` 是 `src/components/` 下子目录，非新增顶层目录（不触发 K6）。

## 3. window.api.runtime 消费契约

### 3.1 调用点与时机

| API | 调用组件 / 时机 | 约束 |
|---|---|---|
| `status()` | RuntimeDrawer 打开后（挂载）一次；RuntimeStatusBar 手动刷新时 | 永不因 status() 失败导致整面板崩溃；失败显示错误条 |
| `onStatusChange(cb)` | RuntimeDrawer 挂载时注册 | 返回的退订函数必须在卸载时调用 |
| `start()` | 「启动」按钮 | 按钮在 pending / starting / running 迁移期间禁用（防重入）；调用 reject → 错误条 |
| `stop()` | 「停止」按钮 | 同上；调用后不做任何会触发惰性自启的调用 |
| `listAgents()` | 状态进入 running 后一次；手动重试时 | 失败独立错误条 + 重试按钮，不影响其他分区 |
| `createSession(title?)` | RuntimeSessionList「新建会话」 | title 为空字符串时传 `undefined`；成功后刷新列表 |
| `listSessions()` | 挂载时一次；create/delete 成功后；手动「刷新」 | 失败显示会话分区错误条，保留旧列表 |
| `abortSession(id)` | 会话行「中止」 | 行内禁用至 settle；失败 → 会话分区错误条 |
| `deleteSession(id)` | 会话行「删除」 | 同上；删除选中会话时清空选中态并刷新 |
| `promptAsync(req)` | RuntimePromptBox「异步发送」 | 见 §3.2 请求构造 |
| `subscribe()` | RuntimeDrawer 挂载、且 status 拉取完成后调用 | **不传参数**（全量事件）；重复挂载不得并发多次订阅（见 §5） |
| `unsubscribe()` | RuntimeDrawer 卸载时 | 与 onEvent 退订同一清理阶段；失败仅 console.error |
| `onEvent(cb)` | subscribe 成功后注册 | 退订函数卸载时调用 |

`runtime.prompt`（同步）本期**禁止调用**。

### 3.2 promptAsync 请求构造

```ts
const req: RuntimePromptRequest = {
  sessionId: selectedSession.id,
  text,
  // agent / model / format / tools 一律不传（undefined）
}
```

返回 `{ accepted, messageId }`：accepted 恒为 true（类型层面），messageId 在发送成功后于 Prompt 分区以轻提示展示一次（如「已受理 msg_…」，3 秒后消失或被下一次提示覆盖；不做通知系统）。

## 4. 组件 Props 契约

### 4.1 RuntimeDrawer

```ts
interface RuntimeDrawerProps {
  open: boolean
  onClose: () => void
}
```

- `open=false` 时返回 `null`（不渲染、不持有订阅）；
- 内部编排：挂载时按序 `status()` → `subscribe()` → `onEvent`；`running` 态下并行拉取 `listSessions()` 与 `listAgents()`；
- **进场可见性不依赖 `subscribe()` 结果**：`status()` 结算后即触发滑入（`setMounted(true)`），subscribe 成功 / 失败均须可见——错误条渲染在面板内部，subscribe 被拒绝时用户仍须看到面板与订阅错误条（2026-10-05 T9-4 真机冒烟缺陷补定，见变更记录 I-003）；
- 持有面板级 state：`status: RuntimeStatus | null`、`agents: RuntimeAgent[]`、`sessions: RuntimeSession[]`、`selectedId: string | null`、`events: PanelEvent[]`、各分区错误条与忙碌标记；
- 卸载时清理顺序：`unsubscribe()` → 调用 `onEvent` / `onStatusChange` 退订 → 清空 state（组件销毁即回收，不必显式置空）。

### 4.2 RuntimeStatusBar

```ts
interface RuntimeStatusBarProps {
  status: RuntimeStatus | null
  busy: boolean                 // start/stop 请求进行中
  agents: RuntimeAgent[]
  agentsError: string | null
  onStart: () => void
  onStop: () => void
  onRetryAgents: () => void
}
```

### 4.3 RuntimeSessionList

```ts
interface RuntimeSessionListProps {
  sessions: RuntimeSession[]
  selectedId: string | null
  busyActionId: string | null   // 正在 abort/delete 的会话 id
  disabled: boolean             // 非 running 时禁用创建
  error: string | null
  onSelect: (id: string) => void
  onCreate: (title: string) => void
  onAbort: (id: string) => void
  onDelete: (id: string) => void
  onRefresh: () => void
}
```

### 4.4 RuntimePromptBox

```ts
interface RuntimePromptBoxProps {
  session: RuntimeSession | null   // 选中会话；null → 禁用
  running: boolean                 // status.state === 'running'
  sending: boolean
  error: string | null
  lastAcceptedId: string | null
  onSend: (text: string) => void
}
```

### 4.5 RuntimeEventLog

```ts
type PanelEvent = { seq: number; event: RuntimeEvent }

interface RuntimeEventLogProps {
  events: PanelEvent[]             // 已截断至 200 条
  activeTypes: RuntimeEvent['type'][]
  onToggleType: (type: RuntimeEvent['type']) => void
  onClear: () => void
}
```

## 5. runtime-panel.ts 纯函数契约

```ts
// 错误归一：unknown → 可展示文案；RuntimeErrorBody 形态取 code/message，否则兜底
export function normalizePanelError(err: unknown): string

// 会话 id 截断：长度 > 18 时保留前 8 + '…' + 后 8，否则原样
export function truncateId(id: string): string

// 事件摘要：按六类返回 { title: string; detail: string }，detail 为单行可空字符串
export function eventSummary(event: RuntimeEvent): { title: string; detail: string }

// 缓冲压入：追加后超过上限丢弃最旧；seq 由调用方在事件入栈时分配（1 起递增，不清零）
export function appendEvent(
  buffer: PanelEvent[],
  event: RuntimeEvent,
  nextSeq: number,
  limit?: number,                // 默认 200
): PanelEvent[]
```

事件摘要规则（与需求 F5.2 对应，均为单行，detail 超长 120 字符截断）：

| type | title | detail 来源 |
|---|---|---|
| runtime.connected | 运行时已连接 | `version` |
| message.delta | 文本增量 | `delta` |
| message.part | 消息片段 | `${part.kind}${part.tool ? '·'+part.tool : ''}${part.status ? '·'+part.status : ''}${part.text ? ' '+part.text : ''}` |
| tool.call | 工具调用 | `${tool}·${status} args=${argsPreview}${resultPreview ? ' result='+resultPreview : ''}` |
| session.idle | 会话空闲 | `sessionId` |
| runtime.error | 运行时错误 | `${error.code} ${error.message}` |

## 6. 错误处理契约

- 所有 `window.api.runtime` Promise 调用必须在组件内 catch（无悬空 Promise）；catch 到的错误经 `normalizePanelError` 转为文案，写入对应分区错误条 state。
- 错误条可手动关闭（×）；下一次同分区成功调用时自动清除。
- 错误条仅展示 message 文本，不渲染堆栈；错误条内不得出现口令——feature-008 主进程已保证错误消息打码，面板不额外处理。

## 7. 测试契约

### 7.1 runtime-panel 单测（runtime-panel.test.ts）

- `normalizePanelError`：RuntimeErrorBody 形态 / Error 实例 / 字符串 / null 兜底，四例；
- `truncateId`：短 id 原样、长 id 前 8 后 8、边界长度 18 原样；
- `eventSummary`：六类各一例，含 tool.call 的 completed 带 resultPreview；
- `appendEvent`：未超限追加、超限丢最旧且长度恒为上限、seq 正确分配、自定义 limit。

### 7.2 RuntimeDrawer 集成测试（RuntimeDrawer.test.tsx）

在 `src/test/setup.ts` 既有环境下，于每个用例构造并挂载 `window.api.runtime` mock（全部方法 vi.fn；事件与状态迁移通过捕获 cb 手动驱动）：

1. 入口与挂载：open=false 不渲染；open=true 时按序调用 status / subscribe；渲染四分区标题。
2. 状态迁移：mock `onStatusChange` 回调依次推 starting / running，断言徽标文案与端口 / 版本展示；running 后调用 listSessions / listAgents。
3. 启动 / 停止：点击触发对应 API；进行中按钮 disabled；reject 时错误条出现并显示 code/message。
4. 会话闭环：create（空标题传 undefined）→ 列表刷新；选中行高亮；abort / delete 调用与行禁用；删除选中清空选中态。
5. Prompt：非 running 或未选中时禁用；发送调用 promptAsync 且请求只含 sessionId/text；成功后清空输入并显示 messageId；失败错误条。
6. 事件流：驱动 onEvent 依次投递六类事件，断言顺序 / 摘要；筛选取消某类后该类不渲染；清空后列表空；构造 201 条事件断言仅保留最后 200。
7. 卸载清理：关闭（open=false）后调用 unsubscribe 一次，onEvent / onStatusChange 退订函数各调用一次。
8. subscribe 失败可见性：mock `subscribe` reject，断言订阅错误条出现，且抽屉容器不再带 offscreen 类（面板仍滑入可见，见 §4.1）。

### 7.3 测试隔离

- mock 挂在 `window.api.runtime`，每个用例后 `vi.restoreAllMocks()`；
- 不得渲染真实 App.tsx（App 层接入仅经 renderer typecheck 与手工冒烟验证，与 feature-008 IPC 层同样处理）；
- 计时器（messageId 轻提示消失）用 vi.useFakeTimers 或直接不断言消失（二选一，实现从简可不断言）。

## 8. 验收口径

- `npm run test:run`：全量通过，用例数较 feature-008 基线（328 passed / 1 skipped）只增不减，唯一 skipped 仍为真机 ark 门控；
- `npm run typecheck`（renderer tsc）零错误；
- `npm run build` 通过；
- 真机冒烟：dev 启动 → 打开面板 → 启动运行时（真 opencode）→ 建会话 → 发 prompt → 见 delta 与 idle → 关闭面板（验证 unsubscribe）→ 停止 → 退出应用无进程残留（`pgrep -f 'opencode-ai/bin/opencode.exe'` 为 0）。
