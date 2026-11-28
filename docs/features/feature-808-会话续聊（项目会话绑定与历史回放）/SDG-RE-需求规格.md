# feature-808 会话续聊（项目会话绑定与历史回放）· 需求规格

> 任务包性质：**把右栏会话管理对齐 MiniMax Design「左栏项目即会话入口、重开历史项目可续聊」形态的横切平台基础包**（贯穿 STAGE 0–7，按 [features/README §0](../README.md) 编号规则「跨阶段横切机制归入 8xx」落 **808**；004 空号保留给 STAGE 0 业务包）。**触发 K1（shared/types.ts 加一个可选字段）+ K8（新增 2 个 IPC 及 preload/global.d.ts 镜像）；K9 不触发**（@opencode-ai/sdk 已含 session.messages/get，零新依赖）。
>
> **通道口径以[契约 §0/§5](./SDG-RE-契约.md) 为准（D-004 + D-005 收敛）**：绑定读写为**一个双态 IPC `project:active-session`**（无参读当前绑定 / `{sessionId}` 写），回放读为 `runtime:session:messages`；`project:open` 返回值携带 `activeSessionId`。本规格正文中早期写法「`project:bind-session` 只写、绑定仅来自 openProject 返回值」已被契约 D-004 取代（原因：应用启动经 canvas.get 恢复上次项目、不经 openProject，须有读绑定通道）。**D-005**：preload 中该双态方法在 `window.api` **顶层**暴露为 `activeSession(sessionId?)`（既有项目库方法均在顶层，无 project 命名空间）；IPC channel 名 `project:active-session` 不变。
>
> 事实源：[短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §7.1（L553–607，会话数据目录；**L564 / L599 原定 `chat.messages.json` 为消息流唯一事实源，本包走 R-001 修订**）、§5（runtime/会话 IPC 表）；Design 形态事实源 [MiniMax Design功能与架构参考.md](../../design/MiniMax%20Design功能与架构参考.md) §1.2 入口 4（L28「历史项目继续编辑」）、§1.1（L21 左栏项目管理）、§2.1（L128–142，@hilo/hub = Electron + 标准 opencode）。
>
> 前置已闭环：runtime 单轨（`electron/runtime/*`，opencode serve + SDK 客户端、SSE 六类事件投影、12 错误码）；项目库（`electron/project/library.ts`，`.session.json` 四字段 + 写队列）；feature-003（右栏 ChatComposer 已真实化、流式定稿落文本气泡）。
>
> 溯源标签：**[改编]**（对齐 Design「项目即会话、历史项目继续编辑」交互形态；底层以 opencode SDK 原生会话存储 + 平台自管项目↔会话绑定自行实现，不复用 @hilo/hub 闭源代码）。

## 1. 背景

Design 的会话形态是**项目即会话**：左栏项目列表就是会话入口，重开历史项目等于继续上次对话，画布节点是跨会话持久状态（§1.2 入口 4、§2.1 用户数据目录）。其内部正是标准 opencode（§2.1：`opencode.exe` + MCP 网关），会话天然由 opencode 存储。

本平台当前存在两处不对齐：

1. **会话用完即弃**：[StudioApp.tsx](../../../src/studio/StudioApp.tsx) `handleSend`（L174–194）**每发一条 prompt 都 `createSession()` 新建 opencode 会话**，Agent 轮次之间不共享上下文，会话 id 不持久化；重开项目右栏永远空白。opencode 侧其实已积累大量「一轮游」会话，但平台无法把它们与项目对应。
2. **绑定关系无人管理**：opencode serve 的 cwd 固定为平台工作区根 `~/Documents/ai-shortdrama-studio`（[main.ts](../../../electron/main.ts) ensureRuntime L211–222），**不按项目切换**，故 `session.list` 是全局会话集——项目↔会话的归属必须由平台自管。
3. 设计书 §7.1 L564 / L599 原定项目内 `chat.messages.json` 为「会话消息流唯一事实源，replay 重建 UI 状态」。该设计早于「runtime 基于标准 opencode」的实测结论；opencode 自带本地文件会话存储与 `session.messages` 回放 API，**再维护一份消息 JSON 是重复事实源**（双写一致性、压缩、删除级联全部要自担）。

两项包级决策已于建包前经 AskUserQuestion 拍板（见[变更记录 D-001/D-002](./SDG-AI-变更记录.md)）：

- **D-001 持久化路线 = opencode 原生存储**：项目 `.session.json` 只增加 `activeSessionId` 绑定；消息历史全部留在 opencode 自带存储，重开项目经 SDK `session.messages` 回放；设计书 §7.1 `chat.messages.json` 终态走 R-001 修订。
- **D-002 包范围 = 最小续聊闭环**：一项目绑定一条活跃会话；**不做**手动新建/删除/切换会话、会话列表 UI、多会话/项目。

## 2. 谁在什么场景下要做什么

| # | 角色 | 场景 | 要做什么 | 达成效果 |
|---|---|---|---|---|
| R1 | 创作者 | 从左栏重开一个对话过的项目 | 右栏自动呈现该项目历次对话的用户/Agent 正文气泡（按时间正序），Agent 可展开查看推理过程，并恢复工具名称、状态和耗时，无需任何「加载历史」操作 | 重开项目 = 继续编辑（对齐 Design §1.2 入口 4）；不闪假数据、不弹错误 |
| R2 | 创作者 | 回放后继续输入新 prompt | 新消息进入**同一条 opencode 会话**，Agent 能引用上文（人物名、决策、已聊事实） | 上下文连续，等价于 Design 重开项目后续聊；不再每轮新开会话 |
| R3 | 创作者 | 新建项目 / 打开旧项目（从未对话）后发出第一条 prompt | 平台惰性创建会话、把会话 id 回写进该项目 `.session.json`，再发送 | 绑定在首条消息时才建立（不预建空会话）；重启应用后绑定仍在 |
| R4 | 创作者 | Agent 生成中点发送区的停止按钮 | 中止当前会话当前轮（既有 `abortSession` 通道）；停止后输入框立即可用，再发仍在同会话继续 | 与现有时序一致（abort 不删会话）；停止不丢历史、不破坏绑定 |
| R5 | 创作者 | 在两个都对话过的项目间切换 | 右栏对话随项目切换：A 的历史 / B 的历史互不串台；A 生成中切到 B，B 不显示 A 的流式内容 | 对话是项目的一部分，切项目即切对话；切回任一项目历史仍正确 |
| R6 | 创作者 | 打开 feature-808 之前创建的旧项目（`.session.json` 只有四字段） | 右栏空态（与现状一致），正常发首条消息即建立绑定 | 旧项目零迁移、零报错；缺字段按「未绑定」处理 |
| R7 | 创作者 | 绑定指向的会话在 opencode 侧已不存在（外部清理/存储损坏，messages 返回 404） | 右栏呈现诚实空态 + 一次弱化提示，绑定自动清空；再发消息按 R3 重新惰性建会话 | 失败可见但不锁死；不向不存在的会话发 prompt |
| R8 | 开发者 | 浏览器 dev-mock 态（无 preload，`window.api.__devMock`）打开应用 | 演示气泡照常、新增通道有空桩，回放为空，不崩溃 | mock/真机两态都可用 |

## 3. 核心机制（对齐设计书与 Design 形态的实现口径）

### 3.1 一项目一活跃会话（绑定模型）

- 每个项目在 `.session.json` 中**至多**绑定一条 opencode 会话 id：`ProjectSession.activeSessionId: string | null`（[shared/types.ts](../../../shared/types.ts) L307–312 `ProjectSession` 内加**可选**字段，旧文件缺字段即 `undefined` ≙ 未绑定，天然兼容，**不做文件迁移**；锚点与契约 §2 一致）。
- 绑定生命周期：`未绑定（undefined/null）` —首条 prompt 后→ `已绑定（id）`；仅当回放/续聊发现会话 404 时回到 `未绑定`（清绑定，R7）。
- **opencode serve cwd 不按项目切换**（现状保持），绑定是平台侧唯一的项目↔会话归属事实；不使用 `session.list` 做推断（全局列表无法可靠归属，猜测属越界）。
- [library.ts](../../../electron/project/library.ts) `openProject`（L121–155）现有读-改-写会把 `.session.json` **重建为只含四字段的对象**——本包必须在重建时显式保留 `activeSessionId`（否则切一次项目绑定即丢，这是本包最关键的存量陷阱）。

### 3.2 首条 prompt 惰性建会话 + 回写绑定（R3）

改造 [StudioApp.tsx](../../../src/studio/StudioApp.tsx) `handleSend`（现 L174–194）：

1. 乐观追加用户气泡（现状保留）；确保 runtime running（现状保留）。
2. 取当前项目的 `activeSessionId`（renderer 持有，来源见 §3.3：projectId 变化时经双态 IPC `project:active-session()` 读态取得，`project:open` 返回值亦携带）：
   - **无绑定**：`createSession()` → 经双态 IPC `project:active-session(id)`（写态）把 id 写入该项目 `.session.json` → renderer 更新本地绑定值；
   - **有绑定**：直接复用，**不再 createSession**。
3. `promptAsync({ sessionId, text, agent: 'showrunner' })`（现状通道与白名单不变）。
4. SSE 事件订阅是**全局单流**（主进程 armWindow 一条 /event 连接广播六类事件，事件自带 `sessionId`），不随项目/轮次重订阅；renderer 在 onEvent 归约前按「当前绑定会话 id」过滤（见 §3.4）。现状每轮 `subscribe(session.id)` 的调用删除（mount 后订阅一次，由首个发送动作确保 runtime 后建立）。

绑定写盘经既有写队列 enqueue（与 createProject/openProject 同通道），进程崩溃最坏情况是「本轮会话已建但绑定未写」——重开表现为未绑定空态，下一条 prompt 建新会话，不产生错误数据（可接受，OD 风险表记名）。

### 3.3 历史回放（R1）

- 触发时机：项目打开与项目切换（**含应用启动恢复**：启动时主进程经 `canvas:get` + currentDir 直接恢复上次项目画布，不经 `project:open`，故绑定不能只靠 openProject 返回值——此即 D-004 收敛原因）。renderer 复用既有 canvas 订阅的 **projectId 变化信号**（[StudioApp.tsx](../../../src/studio/StudioApp.tsx) L134–163 已有 `projectIdRef` 切项目检测模式）：projectId 变化或初值到达时，经双态 IPC `project:active-session()`（**无参读态**，不经 withRuntime）取当前项目绑定；有绑定才调新 IPC `runtime:session:messages({ sessionId })`（无绑定/旧项目直接空态，**不因此启动 runtime**——回放通道与发送一样经 withRuntime 惰性自启，但 renderer 侧先判空绑定，避免仅打开空项目就拉起 opencode 进程）。
- 主进程：SDK `session.messages({ path: { id } })` → `200: Array<{ info: Message; parts: Part[] }>`（[client.ts](../../../electron/runtime/client.ts) SdkHandle L56–66 补 `messages` 方法类型（**不补 `get`**——无调用方，契约 §5.1 明确避免死代码），OpencodeRuntimeClient 增 `getSessionMessages` 封装 + 同文件导出 `toMessageRecord` 纯映射；HTTP 404 经既有 `mapHttpError` 归一 `SESSION_NOT_FOUND`，**不新增错误码**）。原始 `{info, parts}[]` 经 `toMessageRecord` **主进程侧裁剪为正文 + 推理 + 工具状态 DTO** 后再过 IPC（工具参数/结果不跨进程；结构化 JSON 可克隆，DTO 在 runtime-types 两端镜像，见契约 §5.2）。
- renderer 侧新纯函数 `replayMessages(records): ChatItem[]`（落点 `src/lib/history-replay.ts`，契约 §3 定形状与规则）：
  - **user 消息**：聚合该消息全部 `type:'text'` part 的文本（用户 text part 无 time，不套用流式投影的 hasPartTime 规则）→ 一个用户气泡；id 取 `info.id`。
  - **assistant 消息**：聚合带 `time.start` 的 text part 正文及 reasoning part 推理 → 一个 agent 气泡；推理非空时写入 `reasoning`；**正文、推理、工具三者全空才不产生气泡**，纯推理 / 纯工具轮按 §6 R37-03 保留（与现行 H4 修订及 `history-replay.ts` 实现一致）。
  - **回放粒度 = 正文气泡 + 可折叠推理 + 工具轨迹**：与流式定稿同构，恢复工具名称、pending/running/completed/error 状态与耗时；工具参数、结果和画布副作用不随气泡回放（节点/门/产物由画布订阅承载）。
  - 按 SDK 返回顺序（时间正序）输出；忽略 file/step-*/snapshot/patch/agent/retry/compaction 等 part；ignored/synthetic part 跳过。
- 回放期间右栏显示加载态（不闪假数据）；回放完成前禁止发送会导致竞态的时序处理由 OD 定（最简：回放与首条发送互斥，loading 中 composer 维持现状 disabled 逻辑）。

### 3.4 事件按会话过滤（R5 防串台）

全局 SSE 流可能携带其他会话事件（多窗口、abort-all 后的 idle、未来多会话）。renderer onEvent 回调在 `reduceRuntimeEvent` 前增加过滤：事件 `sessionId` 存在且不等于当前绑定 id 时忽略（runtime.connected 等无会话字段的状态事件不过滤）。切项目时同步：清空 items → 清 stream/streamRef → 绑定 id 切换 → 拉新历史。进行中的 stream 因切项目被丢弃（主进程 abort-all 仅发生在运行时退出；切项目不 abort 会话，事件到达后因 id 不符被忽略）。

### 3.5 发送中停止（R4）

- [ChatComposer.tsx](../../../src/studio/ChatComposer.tsx) Props 增加 `onStop`；`sending` 中发送按钮切换为停止形态（方形停止图标 + 中性/危险色，复用既有 Tailwind token，不新增资产），点击调 `window.api.runtime.abortSession(activeSessionId)`。
- abort 后既有事件链（session.idle 或 runtime.error `PROMPT_ABORTED`）使流式归约离开 running；sending 复位、输入恢复。会话不删除、绑定不变，下一条 prompt 仍走同会话（SDK prompt 在 abort 后可继续，编码时真机验证；若 opencode 对 abort 后同会话 prompt 有限制，按 OD 风险表备选处置并回本包记名）。

### 3.6 与设计书 R-001 修订的关系

设计书 §7.1 L564（目录树 `chat.messages.json` 注释行）与 L599（版本归档区「replay/hydrate 时读取 chat.messages.json」）修订为：**消息历史复用 opencode 原生会话存储（本地文件，由 opencode 自管），项目 `.session.json` 仅持久化 `activeSessionId` 绑定；UI 历史经 SDK `session.messages` 回放**。「纯文件持久化、无数据库」的总述（L557 附近）保持成立——opencode 自带存储同样是本地文件。根设计的全文 HTML 镜像已于 2026-11-27 删除，不再维护或补建；只需修订根设计 Markdown，两个 B 类总览仅按既有触发规则更新。

## 4. 范围

### 4.1 本包做

- **K1**：[shared/types.ts](../../../shared/types.ts) `ProjectSession` 增加 `activeSessionId?: string | null`（唯一字段变更；可选，旧文件兼容）。
- **主进程**：
  - [client.ts](../../../electron/runtime/client.ts)：SdkHandle.session 类型仅补 `messages`（SDK 已生成；`get` 无调用方不补，避免死代码），OpencodeRuntimeClient 增 `getSessionMessages(sessionId)` 封装（含参数校验与既有错误归一）+ 同文件 `toMessageRecord` 纯映射（正文 + 推理 DTO，契约 §5.2）。
  - [main.ts](../../../electron/main.ts)：新 IPC `runtime:session:messages`（withRuntime 包裹，照 session:list/create 区先例）；新**双态** IPC `project:active-session`（project 层，不经 withRuntime：**无参读态**返回当前项目绑定 `{sessionId}`，无当前项目返 `{sessionId:null}` 不抛错；**写态** `{sessionId: string|null}` 校验非空白字符串/null → library 读-改-写绑定，无当前项目抛 INVALID_ARGUMENT；不接受 dir 入参，只作用于 currentDir）；`project:open` 返回值携带 `activeSessionId`（renderer 打开项目即知绑定，亦可经读态取得——启动恢复场景只走读态，见 §3.3）。
  - [library.ts](../../../electron/project/library.ts)：openProject 读-改-写保留 `activeSessionId`；createProject 初始化显式写 `activeSessionId: null`（五字段定型）；新增绑定读函数与经 enqueue 的绑定读-改-写函数（写绑定不刷新 lastOpenedAt）。
- **preload / 类型镜像（K8）**：[preload.ts](../../../electron/preload.ts) 暴露 `runtime.sessionMessages(sessionId)`（runtime 命名空间内）与**顶层** `activeSession(sessionId?)`（无参读 / 传参写，双态一方法，与 listProjects/openProject 同级；D-005：既有项目库方法均在 `window.api` 顶层，无 project 命名空间），openProject 返回值类型更新；[runtime-types.ts](../../../src/lib/runtime-types.ts) 增回放 DTO（镜像 SDK `{info,parts}` 最小必要形状，字段以契约为准）；[global.d.ts](../../../src/global.d.ts) 同步。
- **renderer**：
  - 新纯函数 `src/lib/history-replay.ts`：`replayMessages(records): ChatItem[]`（§3.3 规则，不碰 fs/window.api/Date）。
  - [StudioApp.tsx](../../../src/studio/StudioApp.tsx)：绑定状态（ref + 必要 state）；handleSend 改惰性建会话/复用 + 回写；项目切换/打开的回放 effect（复用 projectIdRef 信号）；onEvent 会话过滤；mount 后单次 subscribe；新增 handleStop。
  - [ChatComposer.tsx](../../../src/studio/ChatComposer.tsx)：`onStop` 可选 Prop + sending 中停止按钮；回放加载态展示。
  - [dev-mock-api.ts](../../../src/dev-mock-api.ts)：runtime mock 增 `sessionMessages` 桩（返回 `[]`）、顶层增双态 `activeSession` 桩（无参读返 `{sessionId:null}`、传参写空成功）；openProject mock 返回值带 `activeSessionId: null`。
- **测试**：history-replay 纯函数套件；StudioApp/ChatComposer 组件用例（回放渲染、续聊不建新会话、停止按钮、切项目隔离）；主进程 client 封装/library 绑定读写单测（沿用 electron 既有 vitest 套件模式）。
- **治理收尾**：features/README 增 808 行；偏差清单登记并关闭「右栏每轮新开会话、重开项目无历史」偏差；版本记录留痕；设计书 R-001 修订落地；全文 HTML 镜像已删除，不恢复、不补建。

### 4.2 本包不做（显式排除）

- **不做会话管理 UI**：手动新建会话、会话列表、会话切换/重命名/删除入口（Design 左栏是项目列表不是会话列表；一项目一活跃会话是本包范围边界）。
- **不做多会话/项目**：一项目多条平行会话、会话分叉/分支、跨项目搬运会话。
- **工具轨迹只恢复状态，不重放副作用**：历史 Agent 气泡恢复工具名称、状态与耗时（§3.3）；工具参数/结果不进入历史 DTO，节点/门/产物等副作用仍只看画布。
- **不做 opencode 会话回收/清理**：不调 session.delete 做 GC，不清理历史「一轮游」会话（存量垃圾会话仅列表噪声，平台不展示全局列表；清理另议）。
- **不改 SSE 投影六类事件、不改错误码集、不改 prompt 白名单/agent 强制/模型白名单**（[client.ts](../../../electron/runtime/client.ts) buildPromptBody 一行不动）。
- **不做消息编辑/重发/删除/复制/导出**、不做聊天内文件附件展示（file part 一期忽略）。
- **不把消息另存平台 JSON**（R-001 的核心）；不动 serve cwd 固定工作区根的约束；不做按项目切换 cwd/opencode 实例。
- **不碰** canvas/gate/brief/manifest 任何既有链路；退出时 beforeStopHook 的 abort-all 语义保持不变（abort 不删历史、不冲突）。
- **不新增 npm 依赖**（K9 零触发）；不动 `resources/opencode/**`（Agent 纪律）；不做 TUI 嵌入。
- 不碰打包（B-11）、不代做 B-10 窗口标题栏真机验收。

## 5. 验收（业务层）

- **AC1（R1 回放）**：重开对话过的项目，右栏自动按正序呈现历次用户/Agent 文本气泡，文本与 opencode 会话内容一致；Agent 本轮有推理时，正文气泡内可展开查看同一推理内容；加载期有加载态、无假数据、无未捕获错误；无绑定项目不启动 runtime 进程（不出现仅打开项目就拉起 opencode）。
- **AC2（R2 续聊上下文）**：回放后发送新 prompt，网络/日志证据为**同一 sessionID**（无第二次 createSession）；真机目验 Agent 能引用上文（如先让其记住一个词，重开项目后追问，答得上来）。
- **AC3（R3 惰性建会话 + 落盘）**：新项目与旧四字段项目首条 prompt 时才 createSession；`.session.json` 此时含写入的 `activeSessionId`（五字段）；**完全重启应用后**重开该项目能看到重启前的对话。
- **AC4（R4 停止）**：生成中点停止，当前轮中止、输入恢复可用；停止后再发仍在同会话，且该轮不产生半截 agent 气泡（或按既有 abort 定稿口径，以流式现状为准）。
- **AC5（R5 切项目隔离）**：A 项目生成中切到 B 项目，B 右栏不出现 A 的流式/定稿事件；B 显示自身空态或历史；切回 A，A 历史回放正确；订阅全程只有一条 SSE 流（无重复 subscribe/泄漏）。
- **AC6（R6 旧项目兼容）**：feature-808 前的旧 `.session.json`（仅四字段）openProject 成功、不丢字段；首次打开右栏空态；openProject 写回后文件为五字段（`activeSessionId: null`），其余四字段值不被破坏（title/createdAt 保留，lastOpenedAt 按既有语义刷新）。
- **AC7（R7 404 降级）**：构造绑定指向已删除会话（或 mock messages 拒绝 SESSION_NOT_FOUND）：右栏空态 + 一次弱化提示（不弹阻断错误），`.session.json` 绑定被清空；再发 prompt 可重新建会话成功。
- **AC8（R8 dev-mock）**：浏览器 mock 态应用可用：演示气泡不变、控制台无「api 不是函数」类错误；新通道均有桩。
- **AC9（工程红线）**：`npm run typecheck` 不新增错误（基线 T1 实测冻结：当前仅 2 条 canvas-zoom.test.tsx 历史基线错误）；node/preload 双工程 tsc 退出码 0；全量 vitest passed 不减少、skipped/failed 不扩大（基线 T1 实测：40 文件 431 passed / 1 skipped，skip=T8-4 需 ARK Key）；静态契约套件（architecture 红线 renderer 禁直连 runtime 端口、mcp-pure-tools、agent-profiles 等）无感通过。
- **AC10（卡口与修订）**：K1 改动仅 `activeSessionId?: string | null` 一处；K8 新增恰为 2 个 IPC（`runtime:session:messages`、`project:active-session` **双态**：无参读 / `{sessionId}` 写，D-004）+ openProject 返回值扩展，preload/global.d.ts/runtime-types 三处镜像齐备且形状一致；package.json/package-lock.json 与 resources/opencode 零 diff（K9）；设计书 L564/L599 完成 R-001 修订；全文 HTML 镜像已删除，不再要求同步或补建；修订记入本包变更记录。

## 6. D-037 现行归并约束（2026-11-19）

本节自包含承接 feature-819 的运行时模板路径修复约束，以及 feature-010 的 reasoning / 工具轨迹历史回放数据约束。此次只归并现行规格，不新增产品能力。

| 编号 | 现行有效需求 |
| :-- | :-- |
| R37-01 | **Agent 模板路径按真实启动形态解析**：`resolveAgentTemplatePath(file)` 的签名不变；打包态判据为 `app.isPackaged && !process.defaultApp`。`process.defaultApp` 为真时必须读取仓库 `<root>/resources/opencode/agents/<file>`；真打包态读取 `process.resourcesPath/opencode/agents/<file>`。 |
| R37-02 | **路径错误不得静默降级**：模板不存在沿用 ENOENT；`__MODEL_REF__` 等必需占位符缺失沿用既有 INTERNAL 明确报错。不得改读 `node_modules/electron/dist/resources` 的残留副本、用旧模板兜底或伪造 runtime 启动成功。 |
| R37-03 | **历史回放数据完整且有序**：同一用户/助手轮次的正文、reasoning 与工具调用须按原始 partId / callId 顺序形成可回放段；多段推理不得折叠丢失，纯 reasoning / 纯工具轮不得因正文为空被丢弃，同 callId 的状态更新原位替换。ignored / synthetic 文本及 system / tool-role 原始消息继续按现行 H1–H4 规则过滤。 |
| R37-04 | **流式与重载同口径**：Think、正文和工具状态在流式期间与关闭重开后使用同一排序、过滤与字段映射；重载由空输入开始构建历史，不沿用上轮 `streaming`，不伪造仍在运行的动画。 |
| R37-05 | **工具数据最小披露**：回放保留工具名、callId、pending/running/completed/error 状态、起止时间、错误文本与既有白名单 `argsPreview`；完整 input/output、附件和工具结果继续按 H6 排除。010 的 resultSummary 愿望不得被解释为开放完整结果或新增未批字段；没有可信摘要时显示已有状态/错误，不编造。 |
| R37-06 | **职责边界**：本包只负责会话绑定、运行时模板解析、回放 DTO / 数据归约与失败降级；交错内容、活跃态、滚动和卡片视觉归 feature-817。808 与 817 独立，本包不吞并视觉，也不承担 001 的立项定案协议。 |

**范围声明**：无新 IPC、MCP / Agent 协议、共享类型或依赖；内部模板解析函数签名与既有回放通道不变。本 Change 是文档归并，不把历史修复写成新的真机验收完成。

## 7. 运行中断恢复 Change（2026-11-26，用户已批准计划与 K8）

### R-IR1 持久运行事实

- 每项目新增 `.agent-runs.json`，主进程唯一写者；记录 `id/sessionId/request/status/createdAt/updatedAt/endedAt?/error?/retryOfMessageId?`。`id` 严格等于提交给 opencode 的真实用户 `messageID`，不另造 runId。
- 状态仅限 `running | stopping | completed | failed | stopped | interrupted`；终态不可倒退。正文、推理和工具日志仍由 opencode 历史保存，账本不逐 delta 写盘，不保存密钥。
- 正常发送在 SDK 调用前落 `running`；同会话只允许一个非终态运行。同步拒绝记 `failed`，HTTP accepted 不代表完成；idle 定稿 `completed`，会话 abort 定稿 `stopped`，运行错误定稿 `failed`。
- 非主动进程退出将活跃运行记 `interrupted`；SIGKILL 由下次首次读取该项目账本时统一对账。账本损坏不得静默重置；消息仍可回放，但修复前禁止新运行。

### R-IR2 恢复与重试

- 历史回放同时读取消息和 runs，以用户 messageID 关联整轮；没有运行记录的历史不猜测为 interrupted。引擎尚未留下用户消息的孤儿运行只表达“提交结果未知”，不伪造历史气泡。
- 未提交 OptionCard 不代选，pending Gate 不代决，已落盘 Canvas/资产不回滚；无自动重试、无原 Token 流续接。
- 只有用户显式确认后才允许重试当前项目、当前绑定会话的 interrupted 记录；同会话有活跃运行或项目存在 pending Gate 时拒绝。
- 主进程读取原 request，重新执行资产校验和完整发送链，生成新 messageID，写 `retryOfMessageId=旧 id`；旧运行保留 interrupted。

### R-IR3 新增验收

| AC | 可复现预期 |
| :-- | :-- |
| AC16 | running/stopping/completed/failed/stopped/interrupted 迁移正确；终态不被迟到事件改写；首次对账幂等 |
| AC17 | 同步拒绝、异步错误、正常 idle、会话 abort、runtime stop 与异常退出分别得到正确状态；SIGKILL 重启后可对账 |
| AC18 | 重开保留真实消息、工具日志、OptionCard、pending Gate 与已落盘产物；请求数零自动增长，遗留活跃工具只在 UI 显示已中断 |
| AC19 | 孤儿 interrupted 运行显示提交结果未知；无运行记录的旧历史不伪装中断 |
| AC20 | 未经点击不重试；pending Gate/活跃并发/非法状态拒绝；确认后新 messageID 与 retryOfMessageId 可查，旧记录不变 |
| AC21 | runs 查询失败不阻断消息回放，但禁止覆盖损坏账本；真实 messageID 替换乐观 ID 且不串项目/会话 |

## 8. D-041 / D-042 通用编排前置规格（2026-11-27，仅规格准备）

本节落实总体计划 §4.1-A，是 P3 业务接入前的**目标逻辑规格**，不是通用执行层已存在的声明。本次不新增 IPC、preload、MCP、共享类型、持久化文件或依赖，不授权开始 §4.1-B/C 的实施；既有运行账本及现行恢复行为保持不变。

### 8.1 主负责与协同边界

| 负责方 | 本目标模型中的职责 | 明确不承担 |
|---|---|---|
| **808（主控）** | Workflow Definition 引用、Plan / Stage / Work Item 生命周期、DAG 就绪判定、Run / Attempt 血缘、OpenCode 适配、人工重试与恢复编排 | 不另写 Manifest / Gate / 正式版本；不让 Agent 自行迁移状态；不接管项目包事务 |
| **817** | 只读消费 808 投影，展示 `pending / doing / waiting_user / blocked / done`、Gate、Attempt `interrupted` 与人工重试入口 | 不持久化第二套状态，不在 mount / effect 自动重试，不从视觉状态推断业务完成 |
| **827** | Proposal 的 `targetRevision`、单文件原子写、revision / CAS、写队列及崩溃故障验证 | 不决定 DAG / Gate 是否就绪，不把单文件原子写包装成跨文件事务 |
| **828** | Plan 聚合只读投影、Resource / Version 引用查询、静态项目包导入导出；运行 Attempt 继续排除 | 不执行 Plan、不修改运行账本、不把只读快照恢复成活跃运行 |
| **801 / 806** | 801 唯一持有 Manifest 七态六事件；806 唯一持有 Gate 决策及现有后置动作 | 808 不直接写 `manifest.json`，不复制 Gate 决策事实 |
| **001 / 101 / 201 / 301 / 302 / 401 / 501 / 601 / 602 / 701** | 分阶段定义产物、审核、正式版本及完成判据；逐包接入，不新建“大复刻包” | 不用通用 Stage 状态替代本业务验收，不跳过各自 Gate |
| **802 / 803 / 816 / 820 / 821 / 822** | 按风格、媒体、画布和可信资产既有职责协同；ComfyUI job 与 Agent Attempt 通过 ID 关联 | 不混同媒体 job 与 Agent Attempt 状态，不开放其他媒体模型或公网回退 |

表中 001／101／201 为现行业务包，301／302／401／501／601／602／701 为规划编号，当前 Feature 索引尚未建包；实施前须另行裁决并完成建包授权，不能据本表直接开工。

808 是主控规格入口，不吞并上述包的字段写权。若实施需要新增公开 DTO、IPC / preload / MCP、共享类型或依赖，必须在对应负责包重新检查 K1 / K8 / K9；本规格不构成批准。

### 8.2 `drama-series` 的完整覆盖要求

1. 一个已确认 Plan 必须显式覆盖 STAGE 0—7；Stage 可含多个 Work Item，Stage 1 的大纲与小传、Stage 2 的分场 / 台词 / 分镜不得合并为一个含糊完成项。
2. 八步按 DAG 并行生产，不设置全局串行锁。只有声明的上下游产物、Gate、Resource / Version 和文件写权依赖可以限制就绪；无依赖的草案可并行，正式下游产物仍须等待上游验收。
3. Plan / Stage / Work Item 是内部通用骨架，不替代业务产物。STAGE 0 立项与 STAGE 7 发布必须显式存在，其他 Workflow 不得取代 `drama-series` 主线。
4. 详细字段和唯一 Manifest 映射见[契约 §11](./SDG-RE-契约.md#11-d-041--d-042-通用编排目标契约2026-11-27仅规格准备)。Manifest 仍只是阶段指针；`storyboard-done` 不表示 STAGE 3—7 或整个 Plan 完成。

### 8.3 Run / Attempt 与人工恢复要求

- 现有 `.agent-runs.json` 的六态记录作为 **Attempt 执行事实**；`id` 继续等于真实用户 `messageID`。逻辑 Run 按 `retryOfMessageId` 血缘聚合，不另存一份可漂移的 Run 状态。
- 进程恢复发现的遗留活跃 Attempt 标为 `interrupted`，旧记录和消息不可改写为继续运行。人工确认后创建新 Attempt，旧 Token / SSE 流不续接；自动 mount 重试和静默切换模型均禁止。
- 同一 Work Item、同一生产目标最多三次实质不同 Attempt（含首次）。达到上限后必须进入可解释的 `blocked` / 人工处理或 Replan，不得借新 Plan revision 重置计数。
- Replan 必须产生新 Plan revision 并再次获得用户确认；保留原 revision、Attempt、Gate 和版本血缘。范围未变的 Work Item 保持稳定 ID，禁止一键全部重跑。

### 8.4 本次规格验收与未来实施验收矩阵

本次仅验收以下文档项：

| 编号 | 规格验收标准 |
|---|---|
| P3-SPEC-01 | 808 需求、契约、设计、任务和变更记录均明确“仅规格准备”，且归包、写权与 K 卡口一致。 |
| P3-SPEC-02 | STAGE 0—7、801 七态六事件、Gate、Resource / Version 和 Run / Attempt 有唯一映射；无第二套 Manifest / Gate 状态机。 |
| P3-SPEC-03 | DAG 并行、Plan revision / CAS、Replan、三次 Attempt 上限、中断恢复及静态包排除均有可测试不变量。 |
| P3-SPEC-04 | 总体计划、Parity、根设计和 Feature 索引只增加主规格入口，不改 P0 已完成、P1 未通过及 P2—P7 未验收状态。 |

后续实施至少按下列矩阵逐项补自动化与真实 Electron 证据，未执行不得标通过：

| 域 | 必测场景 |
|---|---|
| Definition / DAG | 缺少任一步、非法依赖或环均拒绝；独立 Work Item 可并行；上游未验收不能写下游正式版本。 |
| Plan / CAS | 未确认 Plan 不可执行；旧 revision、重复提交、并发写和跨目标 `targetRevision` 冲突 fail closed，旧事实保留。 |
| Gate / Manifest | 六事件各自由对应正式版本 + Gate / 发布动作触发一次；重复批准不重复推进；STAGE 3—7 不推断 Manifest 事件。 |
| 中断 / 重试 | 进程中断后原 Attempt 为 `interrupted`；人工新 Attempt 血缘完整；消息与旧记录不改写；三次上限生效。 |
| Replan / 版本 | 新 revision 再确认；稳定 Work Item 局部重试；Resource 稳定、Version 不可变，失败写入不可成为正式输出。 |
| 投影 / 导入导出 | 817 五态和恢复项只来自真实投影；静态包保留业务与版本引用，排除 `.agent-runs.json`，导入不复活运行。 |

本 Change 不把文档验收扩展成代码、全量测试、真实 Provider、媒体生成、P1 / P2 / P3 或 Parity 通过。
