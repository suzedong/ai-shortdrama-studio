# feature-808 会话续聊（项目会话绑定与历史回放）· 接口与数据契约

> 事实源：[需求规格](./SDG-RE-需求规格.md)、设计书 §7.1（L553–607，R-001 修订）、§5（runtime/会话 IPC 表）、Design 调研 §1.2/§2.1。
>
> **卡口声明：本包触发 K1 + K8，K9 不触发。**
> - **K1（[shared/types.ts](../../../shared/types.ts)）**：`ProjectSession` 增加**唯一**字段 `activeSessionId?: string | null`（可选可空，旧四字段文件零迁移）。除此之外 shared/ 零 diff。
> - **K8（IPC / preload / DTO 镜像）**：新增**恰 2 个 IPC** —— `runtime:session:messages`（回放读，withRuntime）与 `project:active-session`（项目↔会话绑定的读/写双态，不经 withRuntime）；外加 `project:open` 返回值扩展（既有通道，非新增）。preload / [global.d.ts](../../../src/global.d.ts) / [runtime-types.ts](../../../src/lib/runtime-types.ts) / [electron/runtime/types.ts](../../../electron/runtime/types.ts) 镜像同步。
> - **K9（依赖）**：不触发。`@opencode-ai/sdk` 已含 `session.get` / `session.messages`（1.18.34），package.json / package-lock.json 与 `resources/opencode/**` 零 diff。
>
> 编码中发现必须突破「单字段 / 两通道 / 零依赖 / 错误码不扩」任一边界：**立即停手回本契约评审**，不得临场扩面。

## 0. 契约相对需求规格的一处收敛（已与既有事实核对）

需求规格 §3.2/§4.1 原写「新 IPC `project:bind-session` 只做绑定写，renderer 持有的绑定 id 来自 project:open 返回值」。勘察补出一个需求阶段未知的启动事实：

- 应用启动时 renderer 调 `canvas:get`，主进程 [canvas:get](../../../electron/main.ts)（L462–476）**直接读 currentDir 对应项目的画布**；若上次有打开的项目，画布（含 projectId）被恢复，**全程不经过 `project:open`**（openProject 只在用户点左栏/新建时由 ProjectNav 调用）。
- 因此「仅靠 openProject 返回值」无法覆盖**启动即恢复上次项目**这一 R1 场景，必须有一个项目层读取当前绑定的通道。

为不突破「恰 2 个新 IPC」，本契约把绑定读写收敛为**一个双态 IPC `project:active-session`**（取代规格中的只写 `project:bind-session`）：

- 无入参 → 读当前项目绑定；
- `{ sessionId: string | null }` → 写绑定（首条 prompt 建会话后写入；404 降级时写 null 清空）。

这仍是「2 个新 IPC + openProject 返回值扩展」，不扩 K8 面。需求规格 §3.2/§4.1/AC10 的通道名以本契约为准（包内规格在实现前由本契约统一修订，记 D-004）。

**D-005 再收敛（preload 暴露位置）**：复核 [preload.ts](../../../electron/preload.ts) L13–15 与 [global.d.ts](../../../src/global.d.ts) L21–25 确认，既有项目库方法（`listProjects`/`createProject`/`openProject`）均在 `window.api` **顶层**暴露，**不存在 `window.api.project` 命名空间**（命名空间只有 runtime/canvas/gate/asset/settings/window）。故本包绑定方法同样顶层暴露为 `window.api.activeSession(sessionId?)`（dev-mock 同为顶层桩）；**IPC channel 名仍为 `project:active-session` 不变**（channel 前缀是主进程分组约定，与 preload 暴露层级无关）。早期伪码中的 `window.api.project.activeSession(...)` 全部以 `window.api.activeSession(...)` 为准；`runtime.sessionMessages` 仍在 runtime 命名空间内（§4.6 那句「project 命名空间」作废）。此为契约期技术事实收敛，不改变已批业务范围与 IPC 数量。

## 1. 既有数据面（只消费，签名一行不动）

### 1.1 运行时与项目库现状

- opencode serve cwd 固定平台工作区根 `~/Documents/ai-shortdrama-studio`（[main.ts](../../../electron/main.ts) ensureRuntime L211–222），**不按项目切换**；`session.list` 是全局会话集，平台不据其推断项目归属。
- 主进程是 opencode 唯一客户端（[client.ts](../../../electron/runtime/client.ts)）；renderer 禁直连（architecture 红线）。SDK `session.messages({ path: { id } })` 返回 `200: Array<{ info: Message; parts: Part[] }>`，时间正序；HTTP 404 经既有 `mapHttpError` 归一 `SESSION_NOT_FOUND`（**不新增错误码**）。
- SSE 全局单流：`runtimeSubscribers = Map<webContentsId, {wc, filter}>`（main.ts L167–173），`event:subscribe` 已接受 `{ sessionId? }`。本包 renderer **mount 后订阅一次（不带 filter）**，会话隔离改在 renderer onEvent 侧按当前绑定 id 过滤（§4.3）；删除现状每轮 `subscribe(session.id)`。
- 项目库 [library.ts](../../../electron/project/library.ts)：`.session.json` 经 enqueue 写队列；`openProject`（L121–155）读-改-写**重建只含四字段对象**，本包必须显式保留第五字段（§2.2，最关键存量陷阱）。
- 流式定稿口径：[StudioApp.tsx](../../../src/studio/StudioApp.tsx) L122–127 轮次定稿只落 `{ id: messageId, role:'agent', text }`，reasoning/tool 仅流式临时态。**回放必须与此同构**（§3）。

### 1.2 不使用 / 不改动面（防越界）

- 不改 SSE 六类事件投影（[projection.ts](../../../electron/runtime/projection.ts) 零 diff）、不扩 12+2 错误码集、不改 prompt 通道（buildPromptBody 的 agent=showrunner / model 白名单 / tools 白名单 / parts 固定 text 一行不动）。
- 不调 `session.delete` 做 GC；不动 serve cwd 约束；不新增 npm 依赖；不动 `resources/opencode/**`。
- 不改 canvas/gate/brief/manifest/asset/comfy 任何既有通道与链路；beforeStopHook 的 abort-all 语义不变。

## 2. K1：共享层唯一字段变更

[shared/types.ts](../../../shared/types.ts) L307–312：

```ts
// 项目会话
export interface ProjectSession {
  dir: string
  title: string                 // 一期固定 '新项目'
  createdAt: string             // ISO
  lastOpenedAt: string          // ISO
  /** feature-808：当前项目绑定的 opencode 会话 id；未绑定/旧文件为 undefined，清空为 null */
  activeSessionId?: string | null
}
```

规则：

1. 字段**可选可空**：旧四字段文件读出为 `undefined` ≙ 未绑定；显式清空写 `null`。不做文件迁移。
2. 除本字段外 shared/types.ts 与 shared/ 全目录零 diff（收尾 `git diff shared/` 只许有此一处）。
3. 不新增任何共享层函数/常量；K1 不向 ChatMessage（L267–277）等旧共享形态扩散。

## 3. 纯函数契约：replayMessages（renderer 侧，本包测试核心）

新建 `src/lib/history-replay.ts`。把 IPC 取回的会话消息记录投影为右栏气泡，与流式定稿同构（**仅文本气泡**）。

```ts
import type { ChatItem } from '../studio/ChatComposer'

/** IPC runtime:session:messages 的单条记录（runtime-types 镜像，主进程从 SDK {info,parts} 映射） */
export interface ReplayMessageRecord {
  info: {
    id: string
    role: 'user' | 'assistant'
  }
  parts: ReplayPart[]
}

/** 回放仅消费文本 part；其余 part 类型不进 DTO（主进程侧丢弃，见 §5.2） */
export interface ReplayPart {
  type: 'text'
  text: string
  /** assistant 文本 part 的起始时间（ms）；用户文本 part 无此值 */
  startedAt?: number
  ignored?: boolean
  synthetic?: boolean
}

export function replayMessages(records: ReplayMessageRecord[]): ChatItem[]
```

规则（逐条可单测，编号 H1–H8）：

- **H1 顺序**：按入参数组顺序（SDK 返回即时间正序）输出，不重排、不排序。
- **H2 用户气泡**：`info.role==='user'`，聚合该消息全部**未忽略**文本 part（`ignored===true` / `synthetic===true` 跳过），按 parts 顺序 `join('')` → 一个 `{ id: info.id, role:'user', text }`。用户文本 part 无 `startedAt`，**不套用**流式投影的 hasPartTime 判定（projection L90–93 是流式规则，回放不认）。
- **H3 Agent 气泡**：`info.role==='assistant'`，仅聚合**带 `startedAt`（number）**且未忽略的文本 part，`join('')` → `{ id: info.id, role:'agent', text, agent:'showrunner' }`。
- **H4 空 agent 轮丢弃**：assistant 消息聚合后文本 `trim()` 为空（纯工具轮 / 被 abort / 仅 reasoning）→ **不产生气泡**。
- **H5 用户空文本**：user 消息聚合后为空 → 不产生气泡（防御，正常 prompt 非空）。
- **H6 形状裁剪**：输出气泡只含 `id/role/text`（agent 另含 `agent:'showrunner'`）；**绝不带** `brief`/`trace`（reasoning/tool 不回放）。
- **H7 纯函数**：禁止 fs / window.api / Date / Math.random / 网络；不改入参（深拷贝不要求，但不得 mutate）。
- **H8 容错**：入参为外部数据，字段缺失/类型不符按「无文本」处理（H4/H5 丢弃），不抛错（坏记录不崩右栏）。非数组 → 返回 `[]`。

`id` 冲突：user 与 assistant 的 id 来自 opencode 不同 id 空间（`msg` 前缀等），按 SDK 事实不冲突；同一条 user/assistant 各产出至多一个气泡，不另造 id。

## 4. renderer 行为契约（StudioApp / ChatComposer）

### 4.1 绑定与会话生命周期状态（StudioApp）

新增 renderer 侧状态（最小集）：

- `activeSessionIdRef = useRef<string | null>(null)`：当前项目绑定 id（事件过滤、发送复用的事实源）。
- `const [historyLoading, setHistoryLoading] = useState(false)`：回放加载态（传 ChatComposer）。
- 不引入会话列表/多会话 state；绑定 id 同时存一份 state 仅在需要驱动渲染时（当前实现下 ref 足够，编码时按最小必要决定，不为未来多会话预留）。

**项目切换/打开信号（复用既有 projectId 检测，不新开订阅）**：既有 canvas `onChange`（L136–144）已在 projectId 变化时检测。回放挂同一信号——在 onChange 回调与 `canvas.get()` 初值到达处，当 projectId 变化（含从 `''` 到首次有项目）时执行「切项目会话装载」：

```
onProjectSessionChange(projectId):
  1. setItems([])（dev-mock 演示态除外，见 §4.5）；streamRef.current=null; setStream(null)
  2. activeSessionIdRef.current = null
  3. 若 !projectId（无项目空态）→ 结束
  4. setHistoryLoading(true)
  5. const bind = await window.api.activeSession()   // 读当前项目绑定（D-005：顶层暴露）
  6. if 已过期（projectId !== 当前 projectIdRef）→ 丢弃结果，return（切项目竞态保护）
  7. activeSessionIdRef.current = bind.sessionId
  8. if (bind.sessionId) → loadReplay(bind.sessionId)        // §4.2
     else → setHistoryLoading(false)（空态，不启动 runtime）
```

- 初值到达（canvas.get().then）同样触发一次（覆盖**启动恢复上次项目**：此时不经 openProject，绑定靠步骤 5 读得）。
- 用「序号 token / projectId 比对」防快速切项目时旧回放覆盖新右栏（参考 feature-003 的 alive/序号做法）。

### 4.2 回放装载与 404 降级

```
loadReplay(sessionId):
  try {
    const records = await window.api.runtime.sessionMessages(sessionId)  // withRuntime 惰性自启
    if 过期 → return
    setItems(replayMessages(records))
  } catch (e) {
    if (e?.name/code === 'SESSION_NOT_FOUND') {
      await window.api.activeSession(null)   // 清绑定（R7，D-005 顶层暴露）
      activeSessionIdRef.current = null
      setItems([])
      setToast({ tone:'info', text:'上次的会话记录已不可用，已为你开始新对话。' })  // 一次弱化提示
    } else {
      setError('历史对话加载失败，请稍后重试。')   // 不锁死；绑定保留，可重试发送
    }
  } finally { if 未过期 setHistoryLoading(false) }
```

- **无绑定不调 sessionMessages**（不因此拉起 opencode 进程，AC1）；有绑定才走 withRuntime（回放需要 runtime，惰性自启是既有语义）。
- 弱化提示用既有 toast（tone `info`），不用阻断弹窗；同一项目同一次打开只提示一次。
- 回放完成前：composer 发送维持现状 disabled 逻辑叠加 `historyLoading`（`sending || historyLoading || !draft.trim()`），避免回放未齐时发送造成气泡顺序竞态。

### 4.3 发送：惰性建会话 + 回写 + 复用（handleSend 改造）

替换现状 L174–194「每轮 createSession + subscribe」：

```
handleSend(text):
  setError(null); setSending(true)
  乐观追加用户气泡（现状：id=`u-${Date.now()}`，保留）
  try {
    确保 runtime running（现状 status→start 逻辑保留）
    ensureSubscribedOnce()                       // §4.4，mount 后/首发送时单次
    let sid = activeSessionIdRef.current
    if (!sid) {
      const s = await window.api.runtime.createSession()
      sid = s.id
      await window.api.activeSession(s.id)   // 回写绑定（写态，D-005 顶层暴露）
      activeSessionIdRef.current = s.id
    }
    await window.api.runtime.promptAsync({ sessionId: sid, text, agent:'showrunner' })
  } catch (e) { setError(...) } finally { setSending(false) }
```

- 有绑定**绝不**再 createSession（R2 同 sessionID 的网络证据来自此）。
- 建会话成功但回写崩溃：记 error，不阻断本轮发送（sid 在 ref 中本轮可用）；重开表现为未绑定空态（需求 §3.2 已接受的崩溃窗口，OD 风险表记名）。
- 乐观用户气泡 id 与回放 H2 的 `info.id` 不同源（`u-` 前缀），不冲突。

### 4.4 SSE 订阅：全程一次 + renderer 侧会话过滤

- 新增 `subscribedRef`：在首次需要时（ensureSubscribedOnce，于首发送或回放有绑定需 runtime 之后）调**一次** `window.api.runtime.subscribe()`（**不带 sessionId**），unmount 时 unsubscribe。不得在每轮 / 每项目 subscribe。
- onEvent 回调（现状 L116–129）在 `reduceRuntimeEvent` **之前**加过滤：

```
onEvent(ev):
  const sid = activeSessionIdRef.current
  const evSid = 'sessionId' in ev ? ev.sessionId : undefined
  if (sid && evSid && evSid !== sid) return        // 他会话事件忽略（R5）
  // runtime.connected / 无 sessionId 的 status 类不受影响
  …既有 reduceRuntimeEvent / 定稿落 items 逻辑不变…
```

- 切项目（§4.1）会丢弃进行中 stream：进行中的是 A 会话，切到 B 后 A 事件因 id 不符被忽略；切回 A 时该轮是否仍在跑由 opencode 决定，本包不为跨项目中的流式做保留（定稿文本靠下次回放，R5 验收只要求不串台）。

### 4.5 ChatComposer Props 与凭据

Props（在现 L90–99 基础上增加两个可选 prop，默认行为不变）：

```ts
interface Props {
  // …既有全保留…
  onStop?: () => void          // R4：sending 中显示停止钮；不传则维持仅发送钮形态
  historyLoading?: boolean     // 回放加载态（默认 false）
}
```

- 发送/停止按钮（现 L373–384）：`sending===true` 且提供 `onStop` 时渲染为停止钮（方形停止图标：实心方块或圆角矩形 SVG，中性/危险色复用既有 Tailwind token，不新增图片资产），`data-testid="chat-stop"`，`onClick={onStop}`；否则维持纸飞机发送钮，`data-testid="chat-send"`，`disabled={sending || historyLoading || !draft.trim()}`。
- 回放加载态：右栏消息区显示加载占位，`data-testid="chat-history-loading"`（文案/骨架由实现定，不闪假数据、不显示 demo 气泡）。
- StudioApp 传 `onStop={handleStop}`：

```
handleStop(): await window.api.runtime.abortSession(activeSessionIdRef.current)
  - ref 为空时 no-op（理论上 sending 中必有绑定，防御）
  - 不在此复位 sending：由既有事件链（session.idle / runtime.error PROMPT_ABORTED）离开 running 后定稿复位
  - abort 不删会话、不清绑定；下一条仍走同会话（真机验证 abort 后同会话 prompt；受限则按 OD 风险表备选）
```

### 4.6 dev-mock（R8）

[dev-mock-api.ts](../../../src/dev-mock-api.ts)：

- `openProject` mock 返回 `{ ok:true, activeSessionId:null }`（类型对齐，渲染不消费也可）。
- `runtime` mock 增 `sessionMessages: () => resolve([])`。
- 顶层 api 增 `activeSession: (sessionId?: string | null) => resolve({ sessionId: null as string | null })`（**D-005：顶层暴露，与 openProject/listProjects 同级，不新增 project 命名空间**；见 §5.5 preload 落点）。
- mock 态下右栏保持 `demoChatItems()` 现状（§4.1 切项目清 items 的逻辑只在非 devMock 执行；沿用 L94 的 devMockActive 分支，不为 mock 造回放）。

## 5. 主进程 / IPC / DTO 契约（K8）

### 5.1 client.ts：SDK 封装增补

[SdkHandle.session](../../../electron/runtime/client.ts) L57–66 类型补两个 SDK 已生成方法：

```ts
get(o: { path: { id: string } }): Promise<SdkResult<Session>>
messages(o: { path: { id: string } }): Promise<
  SdkResult<Array<{ info: Message; parts: Part[] }>>
>
```

- import 类型补 `Message`（或按需 `UserMessage`）：`import type { Agent, AssistantMessage, Message, Part, Session } from '@opencode-ai/sdk/client'`。
- `OpencodeRuntimeClient` 增封装（照 `abortSession` L122–128 的校验/错误先例）：

```ts
async getSessionMessages(sessionId: string): Promise<RuntimeSessionMessageRecord[]> {
  const id = requireSessionId(sessionId)
  const sdk = this.ensureReady()
  const result = await sdk.session.messages({ path: { id } })
  if (result.error || !result.data) throw mapHttpError(result, 'SESSION_NOT_FOUND')
  return result.data.map(toMessageRecord)   // 主进程侧裁剪为文本 DTO（§5.2）
}
```

- `mapHttpError` 已把 404 归一 `SESSION_NOT_FOUND`（不扩错误码）；`get` 封装本包**可不实现**（需求只消费 messages；列在 SdkHandle 仅为类型完整性可选——编码时若不使用则**不添加**，避免死代码，以实际调用为准）。
- `toMessageRecord`：见 §5.2，是纯映射（不含 fs/网络），建议从 client.ts 抽出或置于同模块以便单测。

### 5.2 回放 DTO 与主进程侧裁剪

两端镜像（[electron/runtime/types.ts](../../../electron/runtime/types.ts) 与 [src/lib/runtime-types.ts](../../../src/lib/runtime-types.ts) 逐字段一致）：

```ts
/** session.messages 回放记录（仅回放所需最小形状；reasoning/tool 不透传） */
export interface RuntimeSessionMessagePart {
  type: 'text'
  text: string
  /** assistant text part 的 time.start（ms）；user text part 无 */
  startedAt?: number
  ignored?: boolean
  synthetic?: boolean
}
export interface RuntimeSessionMessageRecord {
  info: { id: string; role: 'user' | 'assistant' }
  parts: RuntimeSessionMessagePart[]
}
```

`toMessageRecord(raw)` 映射规则（主进程侧）：

1. `info.id`：取 `raw.info.id`（非字符串按 `''`）；`info.role`：`raw.info.role==='assistant' ? 'assistant' : 'user'`（user 为兜底）。
2. parts：仅保留 `p.type==='text'` 的 part；`text` 取 `p.text ?? ''`；`startedAt` 取 `typeof p.time?.start==='number' ? p.time.start : undefined`；`ignored`/`synthetic` 为 true 时透传布尔。
3. 丢弃 file / reasoning / tool / step-start / step-finish / snapshot / patch / agent / retry / compaction / subtask 等全部非文本 part（这些不跨 IPC，renderer 只见文本）。
4. 不截断、不打码文本内容（会话历史可能含用户内容；现有 SSE 打码针对工具入参凭证。若评审认为需打码，须回本契约——本包默认不打码，因为这是用户本人会话回放）。
5. DTO 可结构化克隆（纯 JSON），可安全经 IPC。

### 5.3 新 IPC（恰 2 个）

**(1) `runtime:session:messages`（回放读，withRuntime）**——照 session:list/abort 先例（main.ts L392–401）：

```ts
ipcMain.handle('runtime:session:messages', (_e, arg: unknown) =>
  withRuntime(async () => {
    let sessionId: string
    if (typeof arg === 'string') sessionId = arg                    // 兼容裸字符串
    else if (isRecord(arg) && typeof arg.sessionId === 'string') sessionId = arg.sessionId
    else throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { sessionId: string }')
    if (!sessionId.trim()) throw makeRuntimeError('INVALID_ARGUMENT', 'sessionId 必须为非空字符串')
    return runtimeClient.getSessionMessages(sessionId)             // RuntimeSessionMessageRecord[]
  }),
)
```

- 成功返回数组（可能为 `[]`）；404 → reject `SESSION_NOT_FOUND`（renderer §4.2 降级）；其余错误经 normalizeRuntimeError 归一。

**(2) `project:active-session`（绑定读/写双态，不经 withRuntime，不碰 opencode）**：

```ts
ipcMain.handle('project:active-session', (_e, arg?: unknown) => {
  // 写态：{ sessionId: string } 绑定；{ sessionId: null } 清空
  if (arg !== undefined) {
    if (!isRecord(arg) || !(typeof arg.sessionId === 'string' || arg.sessionId === null)
        || (typeof arg.sessionId === 'string' && !arg.sessionId.trim())) {
      const err = new Error('参数必须为 { sessionId: string | null }')
      err.name = 'INVALID_ARGUMENT'; throw err
    }
    return setActiveSession(arg.sessionId)        // library，enqueue；返回 { sessionId }
  }
  // 读态：无入参 → 当前项目绑定（无项目 → { sessionId: null }，不抛错）
  return readActiveSession()
})
```

返回统一形如 `{ sessionId: string | null }`。

- 读写都作用于**当前激活项目**（经 [getActiveProjectDir](../../../electron/project/current.ts)；读态无项目时返回 `{sessionId:null}` 不抛错，写态无项目抛 `INVALID_ARGUMENT`「当前没有打开的项目」）。
- **不接受 dir 入参**：绑定只针对当前项目，避免 renderer 指定任意路径（路径硬边界留在 library 内）。
- 不经 withRuntime：绑定是平台侧文件事实，与 opencode 进程无关（清空/读取绝不应拉起 runtime）。
- project 层错误沿用 `INVALID_ARGUMENT` / `INVALID_PROJECT_DIR` / `PROJECT_NOT_FOUND`（既有，不新增错误码）。

**(3) `project:open` 返回值扩展（既有通道，非新增 IPC）**：

- [library.openProject](../../../electron/project/library.ts) 返回 `{ ok:true, activeSessionId }`（§5.4 保留读出的值，无则 null）；main.ts project:open handler（L134–149）把该值透传在最终 `return res` 中。
- 类型：`Promise<{ ok: true; activeSessionId: string | null }>`。renderer 主要靠 (2) 读通道（覆盖启动恢复），openProject 返回值作为打开动作的同步便利，不强制消费。

### 5.4 library.ts：绑定读写 + openProject 保留字段

```ts
/** 读当前项目（指定 dir）绑定；.session.json 缺失/损坏 → null */
export async function readActiveSession(dir: string): Promise<{ sessionId: string | null }>
/** 写绑定（enqueue 读-改-写，保留其余字段）；sessionId=null 清空 */
export async function setActiveSession(dir: string, sessionId: string | null): Promise<{ sessionId: string | null }>
```

实现要点：

1. **openProject L145–151 重建对象必须含第五字段**：

```ts
const session: ProjectSession = {
  dir: resolved,
  title: info.title || '新项目',
  createdAt: info.createdAt || nowIso,
  lastOpenedAt: nowIso,
  activeSessionId: typeof info.activeSessionId === 'string' ? info.activeSessionId : null,
}
```

旧文件（undefined）经一次 openProject 写回为显式 `null`（AC6：五字段定型，不破坏 title/createdAt）。

2. createProject L108–113 初始化对象显式加 `activeSessionId: null`。
3. `setActiveSession` 经 `enqueue`：读出现有 `.session.json`（缺失按默认），仅改 `activeSessionId`，保留 dir/title/createdAt/lastOpenedAt（**不**刷新 lastOpenedAt——绑定写不是「打开项目」），整体写回。
4. main.ts 写态 IPC 用 `getActiveProjectDir()` 取 dir 后调 `setActiveSession`；读态用同一 dir 调一个读 `.session.json` 的 library 函数（可复用 readActiveSession；无 currentDir 时 readActiveSession 不被调用，IPC 直接返回 null）。
5. listProjects 不强制读 activeSessionId（列表不需要，避免无谓 diff）；如顺手读到不破坏现有摘要形状。

### 5.5 preload / global.d.ts 镜像（K8 三处）

[preload.ts](../../../electron/preload.ts)：

- 项目区（L13–15 旁）增：

```ts
activeSession: (sessionId?: string | null): Promise<{ sessionId: string | null }> =>
  ipcRenderer.invoke('project:active-session',
    sessionId === undefined ? undefined : { sessionId }),
```

- runtime 块（L24–30 旁）增：

```ts
sessionMessages: (sessionId: string): Promise<RuntimeSessionMessageRecord[]> =>
  ipcRenderer.invoke('runtime:session:messages', { sessionId }),
```

类型从 `../src/lib/runtime-types` 补 import `RuntimeSessionMessageRecord`。

- [global.d.ts](../../../src/global.d.ts)：`openProject` 返回类型改 `Promise<{ ok: true; activeSessionId: string | null }>`；项目区加 `activeSession(sessionId?: string | null): Promise<{ sessionId: string | null }>`；runtime 块加 `sessionMessages(sessionId: string): Promise<RuntimeSessionMessageRecord[]>`；import 补 `RuntimeSessionMessageRecord`。
- 两端 DTO（electron/runtime/types.ts 与 src/lib/runtime-types.ts）§5.2 两个 interface 字段逐字一致。

## 6. 测试契约

### 6.1 纯函数 history-replay（新增套件，H1–H8）

- 空数组 / 非数组 → `[]`。
- 单 user（单/多 text part 拼接、含无 time 字段的用户 part 仍输出）→ 用户气泡。
- user 空文本 / ignored / synthetic → 丢弃。
- assistant：带 startedAt 的 text 聚合；无 startedAt 的 text 不进；纯 reasoning/tool（parts 里无文本）→ 无气泡；abort 空轮 → 无气泡。
- 混排 u/a/u/a 正序；id 取 info.id；agent 气泡带 `agent:'showrunner'` 且无 brief/trace。
- 坏记录（info 缺 id、parts 非数组、part.text 非字符串）不抛错按空处理。
- 不改入参（快照）。

### 6.2 主进程映射 / library（node 侧 vitest，沿用 electron 既有套件）

- `toMessageRecord`：仅透传 text part；startedAt 来自 time.start 数字；丢弃 reasoning/tool/file 等；role 归一；ignored/synthetic 透传。
- `setActiveSession`：写入并保留 title/createdAt/lastOpenedAt 不被改；null 清空；经 enqueue 不与 openProject 互相覆盖（串行写）。
- `openProject`：旧四字段文件打开后写回含 `activeSessionId:null` 且 title/createdAt 保留、lastOpenedAt 刷新；已有绑定字符串原样保留（R6/AC6）。
- 读态无 currentDir → `{sessionId:null}`；写态无项目 → 抛 INVALID_ARGUMENT。
- IPC 参数校验：非字符串 id / 空白 id / 写态非法 arg → INVALID_ARGUMENT（可在 handler 或封装层单测）。

### 6.3 组件（TestingLibrary，mock window.api）

- **回放渲染（R1）**：sessionMessages resolve 若干记录 → 按正序出现用户/agent 文本；加载期 `chat-history-loading` 出现、完成后消失；无 demo 假数据。
- **无绑定不拉起 runtime（AC1）**：activeSession resolve `{sessionId:null}` 的项目，断言 **未调用** sessionMessages / runtime.start。
- **续聊不新建（R2/AC2）**：activeSession 返回已有 id → handleSend 后 createSession **零调用**、promptAsync 以同一 sessionId 调用；activeSession 写态不被调用。
- **惰性建会话 + 回写（R3）**：绑定 null → 发送后 createSession 一次、activeSession(newId) 一次、promptAsync 用 newId。
- **停止（R4）**：sending 中出现 `chat-stop`（无 onStop 时仍是发送钮）；点击调 abortSession(当前绑定 id)；abort 后事件链复位 sending。
- **切项目隔离（R5）**：A 绑定期间 onEvent 投递 B 的 sessionId 事件 → 不更新 stream/items；切到 B 清 items 并加载 B 历史；快速 A→B 切换时 A 的迟到回放不覆盖 B（竞态）。
- **404 降级（R7）**：sessionMessages reject `{name:'SESSION_NOT_FOUND'}` → 空态、info toast 一次、activeSession(null) 被调、再发送走惰性建会话。
- 订阅一次：多次发送 / 切项目后 subscribe 总调用次数为 1（unmount 时 unsubscribe）。

### 6.4 回归红线（T1 实测冻结基线）

- `npm run typecheck`：零新增（基线仅 2 条 canvas-zoom.test.tsx L13/L90 历史错误，非本包）。
- node/preload 双工程 tsc 退出码 0。
- 全量 vitest：passed 不减少、skipped/failed 不扩大（基线 **40 文件 431 passed / 1 skipped**，skip=T8-4 需 ARK Key；开工 T1 复测回填）。
- 静态契约套件（architecture renderer 禁直连 runtime 端口、mcp-pure-tools、agent-profiles 等）无感通过；既有 studio-flow / window-titlebar 等用例的 openProject mock 需补 `activeSessionId:null` 字段（形状变化的连带修，属本包合理 diff，不视为破坏）。

## 7. data-testid / 文案凭据表

| 凭据 | 位置 | 语义 |
|---|---|---|
| `chat-send` | ChatComposer 发送钮 | 非 sending 态；disabled = sending \|\| historyLoading \|\| !draft.trim() |
| `chat-stop` | ChatComposer 停止钮 | sending 且传 onStop；点击 abort 当前绑定会话 |
| `chat-history-loading` | 右栏消息区 | 回放加载中占位；禁止与 demo/回放气泡并存 |
| （既有错误条/ toast） | StudioApp | 404 用 tone info toast 一次；其他回放失败用既有 error 条 |

## 8. 卡口与越界处置

| 卡口 | 本包范围 | 证据要求（收尾） |
|---|---|---|
| K1 shared/ | 仅 `ProjectSession.activeSessionId?: string \| null` 一处 | `git diff shared/` 只此一处 |
| K8 IPC | 恰 2 新：`runtime:session:messages`、`project:active-session`；+openProject 返回扩展 | grep ipcMain.handle 新增计数=2；preload/global.d.ts/runtime-types×2 镜像齐 |
| K8 preload/global | 三处镜像 + DTO 两端逐字一致 | typecheck 0 新增 + 人工比对 |
| K9 依赖 | 不触发 | package.json / package-lock.json 零 diff |
| 错误码 | 不扩（复用 SESSION_NOT_FOUND / INVALID_ARGUMENT） | RUNTIME_ERROR_NAMES 零 diff |
| 投影/prompt | projection.ts / buildPromptBody 零 diff | git diff 为空 |
| Agent 纪律 | resources/opencode/** 零 diff | git diff 为空 |

编码中若发现「两通道/单字段/不扩错误码」无法满足某 AC：**停手回本契约评审**，对应需求移出本包或走 K 变更，不得临场加通道/字段/错误码。
