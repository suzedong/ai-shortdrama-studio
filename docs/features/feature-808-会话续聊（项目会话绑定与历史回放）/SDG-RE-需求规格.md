# feature-808 会话续聊（项目会话绑定与历史回放）· 需求规格

> 任务包性质：**把右栏会话管理对齐 MiniMax Design「左栏项目即会话入口、重开历史项目可续聊」形态的横切平台基础包**（贯穿 STAGE 0–7，按 [features/README §0](../README.md) 编号规则「跨阶段横切机制归入 8xx」落 **808**；004 空号保留给 STAGE 0 业务包）。**触发 K1（shared/types.ts 加一个可选字段）+ K8（新增 2 个 IPC 及 preload/global.d.ts 镜像）；K9 不触发**（@opencode-ai/sdk 已含 session.messages/get，零新依赖）。
>
> **通道口径以[契约 §0/§5](./SDG-RE-契约.md) 为准（D-004 + D-005 收敛）**：绑定读写为**一个双态 IPC `project:active-session`**（无参读当前绑定 / `{sessionId}` 写），回放读为 `runtime:session:messages`；`project:open` 返回值携带 `activeSessionId`。本规格正文中早期写法「`project:bind-session` 只写、绑定仅来自 openProject 返回值」已被契约 D-004 取代（原因：应用启动经 canvas.get 恢复上次项目、不经 openProject，须有读绑定通道）。**D-005**：preload 中该双态方法在 `window.api` **顶层**暴露为 `activeSession(sessionId?)`（既有项目库方法均在顶层，无 project 命名空间）；IPC channel 名 `project:active-session` 不变。
>
> 事实源：[短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §7.1（L553–607，会话数据目录；**L564 / L599 原定 `chat.messages.json` 为消息流唯一事实源，本包走 R-001 修订**）、§5（runtime/会话 IPC 表）；Design 形态事实源 [MiniMax Design功能与架构参考.md](../../research/MiniMax%20Design功能与架构参考.md) §1.2 入口 4（L28「历史项目继续编辑」）、§1.1（L21 左栏项目管理）、§2.1（L128–142，@hilo/hub = Electron + 标准 opencode）。
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
  - **assistant 消息**：聚合带 `time.start` 的 text part 正文及 reasoning part 推理 → 一个 agent 气泡；推理非空时写入 `reasoning`；**最终正文为空的 assistant 消息（纯工具轮/纯推理/被 abort）不产生气泡**。
  - **回放粒度 = 正文气泡 + 可折叠推理 + 工具轨迹**：与流式定稿同构，恢复工具名称、pending/running/completed/error 状态与耗时；工具参数、结果和画布副作用不随气泡回放（节点/门/产物由画布订阅承载）。
  - 按 SDK 返回顺序（时间正序）输出；忽略 file/step-*/snapshot/patch/agent/retry/compaction 等 part；ignored/synthetic part 跳过。
- 回放期间右栏显示加载态（不闪假数据）；回放完成前禁止发送会导致竞态的时序处理由 OD 定（最简：回放与首条发送互斥，loading 中 composer 维持现状 disabled 逻辑）。

### 3.4 事件按会话过滤（R5 防串台）

全局 SSE 流可能携带其他会话事件（多窗口、abort-all 后的 idle、未来多会话）。renderer onEvent 回调在 `reduceRuntimeEvent` 前增加过滤：事件 `sessionId` 存在且不等于当前绑定 id 时忽略（runtime.connected 等无会话字段的状态事件不过滤）。切项目时同步：清空 items → 清 stream/streamRef → 绑定 id 切换 → 拉新历史。进行中的 stream 因切项目被丢弃（主进程 abort-all 仅发生在运行时退出；切项目不 abort 会话，事件到达后因 id 不符被忽略）。

### 3.5 发送中停止（R4）

- [ChatComposer.tsx](../../../src/studio/ChatComposer.tsx) Props 增加 `onStop`；`sending` 中发送按钮切换为停止形态（方形停止图标 + 中性/危险色，复用既有 Tailwind token，不新增资产），点击调 `window.api.runtime.abortSession(activeSessionId)`。
- abort 后既有事件链（session.idle 或 runtime.error `PROMPT_ABORTED`）使流式归约离开 running；sending 复位、输入恢复。会话不删除、绑定不变，下一条 prompt 仍走同会话（SDK prompt 在 abort 后可继续，编码时真机验证；若 opencode 对 abort 后同会话 prompt 有限制，按 OD 风险表备选处置并回本包记名）。

### 3.6 与设计书 R-001 修订的关系

设计书 §7.1 L564（目录树 `chat.messages.json` 注释行）与 L599（版本归档区「replay/hydrate 时读取 chat.messages.json」）修订为：**消息历史复用 opencode 原生会话存储（本地文件，由 opencode 自管），项目 `.session.json` 仅持久化 `activeSessionId` 绑定；UI 历史经 SDK `session.messages` 回放**。「纯文件持久化、无数据库」的总述（L557 附近）保持成立——opencode 自带存储同样是本地文件。两个 HTML 人读镜像（docs/design/ 下设计书镜像与全景图）的同文案处理方式在 OD §8 定（随事实源同步修订）。

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
- **治理收尾**：features/README 增 808 行；偏差清单登记并关闭「右栏每轮新开会话、重开项目无历史」偏差；版本记录留痕；设计书 R-001 修订落地（含 HTML 镜像处理）。

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
- **AC10（卡口与修订）**：K1 改动仅 `activeSessionId?: string | null` 一处；K8 新增恰为 2 个 IPC（`runtime:session:messages`、`project:active-session` **双态**：无参读 / `{sessionId}` 写，D-004）+ openProject 返回值扩展，preload/global.d.ts/runtime-types 三处镜像齐备且形状一致；package.json/package-lock.json 与 resources/opencode 零 diff（K9）；设计书 L564/L599 完成 R-001 修订且两个 HTML 镜像按 OD 口径处理，修订记入门本包变更记录。
