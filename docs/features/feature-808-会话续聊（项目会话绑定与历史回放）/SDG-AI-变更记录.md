# feature-808 会话续聊（项目会话绑定与历史回放）· 变更记录

> 三分类：决策记录（永久）/ 实施记录（落地后清理）/ 修订记录（决策稳定后清理）。
> 本包对齐 MiniMax Design（@hilo/hub）「左栏项目即会话入口、重开项目可续聊、画布节点跨会话」形态，补齐平台「每轮新建会话、重开无历史」缺口；溯源标签整体为 [改编]（opencode/MCP 同源组件自行实现，不复用其闭源代码）。

## 一、决策记录（K 卡口，永久保留）

### D-001 · 持久化路线 = opencode 原生存储 + R-001 授权（2026-10-15，✅ 用户已批准）

- **背景**：设计书 §7.1（L564/L599）原定项目目录下 `chat.messages.json` 持久化全量消息、UI 自行 hydrate。勘察 opencode 运行时事实：主进程 spawn `opencode serve`（cwd 固定平台工作区根，不按项目切换），SDK 已提供 `session.messages({path:{id}})`（时间正序 `{info, parts}[]`），消息历史本就持久化在 opencode 自带存储。
- **裁决**：消息历史**全部留在 opencode 原生存储**，平台不复制不镜像；`.session.json` 仅增 `activeSessionId` 绑定；重开项目经 SDK 回放。设计书 §7.1 的 chat.messages.json 终态作废，授权 **R-001 修订**（L564 目录树注释行、L599 replay/hydrate 描述 + 含同文案的 HTML 镜像），修订动作排在代码落地与真机目验通过后的 T7。
- **批准方式**：2026-10-15 AskUserQuestion 选定「opencode 原生存储 (Recommended)」。
- **联动结论**：K9 不触发（SDK 1.18.34 已含 session.messages，零新依赖）；回放投影与流式定稿同构。2026-10-31 D-008 将二者统一扩展为正文 + 可选推理。

### D-002 · 包范围 = 最小续聊闭环（2026-10-15，✅ 用户已批准）

- **裁决**：一项目绑定一条活跃会话。在包内的只有：重开放映历史文本气泡（R1）、新 prompt 复用同会话（R2）、首条 prompt 惰性建会话并回写绑定（R3）、发送中可停止（R4）、切项目对话随项目切换不串台（R5）、旧四字段项目零迁移兼容（R6）、404 诚实降级（R7）、dev-mock 可用（R8）。
- **显式排除**（需求 §4.2）：会话列表 UI、手动新建/删除/切换/重命名会话、一项目多会话、历史分页/虚拟滚动/搜索、tool 轨迹回放、半截轮次保留、session.delete GC。2026-10-31 D-008 将 reasoning 纳入正文气泡的可选折叠内容。
- **批准方式**：2026-10-15 AskUserQuestion 选定「最小续聊闭环 (Recommended)」。

### D-003 · 包编号 = feature-808（横切 8xx 段）

- 本包跨 STAGE 0–7（会话机制是全阶段右栏底座），按 features/README §0 编号规则归入横切 8xx 段；807 已用，取 808；004 空号保留给 STAGE 0 业务包。

### D-004 · 绑定通道由只写 IPC 收敛为双态 IPC `project:active-session`（契约期技术收敛）

- **新事实**：应用启动 renderer 调 canvas:get，主进程 [canvas:get](../../../electron/main.ts)（L462–476）经 canvasStore→getActiveProjectDir() **直接恢复上次项目画布，全程不经 project:open**；project:open 的 renderer 调用方只有 ProjectNav。故需求稿中「绑定 id 只从 openProject 返回值取得」无法覆盖 R1 启动恢复场景。
- **裁决**：原计划只写 IPC `project:bind-session` 撤销，收敛为**一个双态 IPC**：无参读当前项目绑定、`{sessionId}` 写/null 清空；仍保持「恰 2 个新 IPC」总量不变（另一个是 `runtime:session:messages`）。openProject 返回值仍扩展携带 activeSessionId（IPC 形状完整性），但 StudioApp 不消费，绑定统一走读通道；唯一装载信号 = canvas projectId 变化，覆盖启动恢复/左栏切换/新建三入口。
- **性质**：契约期对照既有代码的自我收敛，未改变 D-002 已批业务范围。

### D-005 · preload 顶层暴露 `activeSession`，无 project 命名空间（契约期技术收敛）

- **新事实**：复核 [preload.ts](../../../electron/preload.ts) L13–15 与 [global.d.ts](../../../src/global.d.ts) L21–25 确认既有项目库方法（listProjects/createProject/openProject）均在 `window.api` **顶层**暴露，不存在 `window.api.project` 命名空间（命名空间只有 runtime/canvas/gate/asset/settings/window）；studio-flow.test.tsx 顶层 mock 佐证。
- **裁决**：绑定方法顶层暴露为 `window.api.activeSession(sessionId?)`，dev-mock 同为顶层桩；**IPC channel 名 `project:active-session` 不变**（channel 前缀与 preload 暴露层级无关）；`runtime.sessionMessages` 仍在 runtime 命名空间内。契约 §4 早期伪码 `window.api.project.activeSession(...)` 全部作废，需求规格与契约 5 处表述已改齐。
- **性质**：契约期技术事实收敛，未改变已批业务范围与 IPC 数量。

### D-006 · 真机缺陷：R4 停止按钮在流式生成期间不可达（2026-10-16，T6 真机发现；✅ 方案 A 已批准·已修复·真机复测通过）

- **现象（真机实证）**：点发送后 `chat-stop` 按钮仅存在于约 **57ms 窗口**（MutationObserver 实测 378ms→435ms），与 `promptAsync` 的 HTTP 202 往返期重合；其后约 20s 真实流式生成期间按钮不在 DOM，用户无法通过界面停止。
- **根因**：[StudioApp.tsx](../../../src/studio/StudioApp.tsx) `handleSend`（L263–294）`setSending(true)` 后 `await promptAsync(...)`，而 promptAsync 经 [client.ts](../../../electron/runtime/client.ts)（L154–164）在 HTTP **accepted（202/204/200）即 resolve，不等流式结束**；`finally { setSending(false) }`（L292）于是在生成真正开始前就复位。[ChatComposer.tsx](../../../src/studio/ChatComposer.tsx)（L387–405）`sending && onStop` 才渲染停止钮，故停止钮随 sending 提前消失。grep 确认 `setSending` 全文件仅 L265/L292 两处，流式事件链未对其置位。
- **引擎契约事实**：`runtime.abortSession(sid)` 真机 `{ok:true}`、11ms 返回，**opencode 未拒绝 abort**，OD §9 风险 2 备选（惰性新建+回写）**无需触发**；直调 abort 后被中断轮 part 长度恒 0、同会话再发成功且 sid 不变。即底层 R4 能力完好，问题纯粹在 renderer 的「生成中」状态建模。
- **修复方案选项（裁决时列陈，用户已拍板 A）**：
  - 方案 A（推荐，已批准）：把「生成中」与 promptAsync 解耦——引入独立 `generating` 态（或复用 stream.status），由流式事件驱动置位/复位：收到该会话 `message.updated/running`（或等价 streaming 开始事件）置 true，收到 `session.idle` / 终止 / `runtime.error` 复位；停止钮在整个 generating 区间可见。handleSend 的 sending 仅保留为「提交禁用」瞬态。
  - 方案 B（更小改动）：发送后不立即在 finally 复位，改为监听本会话 running→idle 复位；改动集中但状态语义仍与 sending 混用。
- **影响面**：StudioApp.tsx + ChatComposer.tsx（白名单内）；session-continue.test.tsx R4 用例需同步加强为「生成中停止钮持续可见」（现有 R4 用例只钉事件链复位，未覆盖 promptAsync 提前 resolve 的真机时间窗，属测试盲区，一并记名）。
- **状态**：✅ 已闭环。2026-10-16 用户批复方案 A；当日修复落地（StudioApp 新增独立 `generating` 态，accepted 后置位、`session.idle`/`runtime.error` 无条件复位，dev mock 不置位；ChatComposer 停止钮与禁用公式绑 `sending || generating`；切项目清场同步复位），R3/R4 用例按新时序重写，真机复测项 4 通过（证据见 AC4），AC4 改 [x]。

### D-007 · 真机缺陷：R5 在「切到无绑定空项目」边界串台（2026-10-16，T6 真机发现；✅ 方案 A 已批准·已修复·真机复测通过）

- **现象（真机实证）**：项目 A 流式生成中切到**无绑定空项目 B**（`activeSession()=null`），B 右栏在 t5602ms 起出现 A 的「推理过程」流式，t21600ms 起正文逐帧涌入（199 污染帧、定稿 3381 字、含唯一标记「阿尔法鸑鷟」），A 定稿被落为 B 的气泡。切回 A 历史 16 条完整正确、sid 不变、会话总数 12→12；再切回 B 恢复空态——**污染仅为 renderer 临时 UI state，未持久化到任何会话存储**，不产生脏数据，但真机可见地违反 R5「B 全程无 A 流式/定稿闪现」。
- **根因**：renderer 订阅为**无参** `runtime.subscribe()`（[StudioApp.tsx](../../../src/studio/StudioApp.tsx) L256–260），主进程 `sessionFilter=undefined` 不做会话级过滤、广播全部事件（[main.ts](../../../electron/main.ts) L332–339 的 filter 分支因 undefined 不生效）；隔离完全依赖 renderer onEvent 首行 `if (sid && evSid && evSid !== sid) return`（StudioApp L126–128）。当 B 无绑定 `activeSessionIdRef.current=null` 时，守卫因 `sid` 为假被**短路**，A 的事件全部泄漏进 B：stream 被 reduce 出 A 的流式文本，running→非 running 时还经 L134–147 把 A 定稿 `setItems` 落进 B。
- **修复方案选项（裁决时列陈，用户已拍板 A）**：
  - 方案 A（renderer 严格归属，推荐，已批准）：过滤改为「按当前绑定 sid 严格归属」——**无绑定（sid=null）或 evSid 与当前 sid 不符时，一律丢弃带 sessionId 的事件**；仅无 sessionId 的 runtime 级状态事件放行。并在 `onProjectSessionChange` 切项目清场时同步清空未落定的 `streamRef`（现 L182–206 已清 items/ref，需确认 stream 一并复位，避免上一会话流式残影）。
  - 方案 B（主进程过滤，纵深防御，可选）：订阅 IPC 支持带 `{sessionId}`，切项目时重新订阅/更新 filter，让 main.ts 已有的 broadcast filter 真正生效；改动跨主进程+preload+renderer，面更大，可作为后续增强，不阻塞 A。
- **影响面**：方案 A 仅 StudioApp.tsx（白名单内）；session-continue.test.tsx R5 需补「切到无绑定空项目期间，他会话 streaming + idle 定稿事件均被丢弃」真机等价用例（现有 R5 覆盖了 A/B 都有会话及装载空窗期，但**未覆盖目标项目 sid=null 这一边界**，属测试盲区，一并记名）。
- **状态**：✅ 已闭环。2026-10-16 用户批复方案 A；当日修复落地（onEvent 守卫改严格归属 `evSid !== undefined && evSid !== sid` 即丢弃；无 sessionId 的 runtime 级事件放行经 reducer no-op；切项目清场已含 streamRef/setStream），新增 sid=null 边界回归用例，真机复测项 5 通过（证据见 AC5），AC5 改 [x]。白名单外 studio-flow.test.tsx 因旧守卫契约被连带修正（一处用例旧时序在发送前发事件，新守卫下不再成立），diff 仅 import 补 waitFor + 该用例时序对齐真实发送顺序，测试盲区与偏差结论见「偏差与遗留」。

### D-008 · 正式气泡与历史回放保留推理（2026-10-31，✅ 用户已批准）

- **背景**：流式生成期间可查看「推理过程」，但定稿只复制正文、历史 DTO 又过滤 reasoning，导致正文落泡后推理消失且重开项目无法恢复。
- **裁决**：正式 Agent 气泡增加可选 `reasoning`，定稿时保留本轮非空推理；既有 `runtime:session:messages` DTO 增量携带 `text | reasoning` part，回放恢复同一折叠块。assistant 无有效正文时仍不产生气泡；tool/file/step 等轨迹仍不回放。
- **边界**：不新增 IPC、不新增平台消息存储、不改 shared/types.ts、不新增依赖；仅扩展既有 DTO 两端镜像及其映射/回放/渲染。
- **批准方式**：2026-10-31 用户回复「好的，按这个方案修改」。本决策取代 D-001/D-002 中「仅文本 / 不回放 reasoning」的旧口径，tool 排除不变。

### D-009 · 正式气泡保留当轮工具轨迹（2026-10-31，✅ 用户反馈确认修复）

- **背景**：D-008 修复推理定稿留产后，用户发现流式期间可见的工具调用在推理与正文定稿后消失。根因是定稿仅复制正文与推理，清空 `stream` 时工具列表一并丢弃。
- **裁决**：正式 Agent 气泡增加可选 `tools: ToolView[]`，定稿时按首次出现顺序复制本轮工具快照，并复用流式 `ToolRow` 渲染完成/失败状态与耗时；无有效正文仍不产生气泡，无工具时不增加字段。
- **边界**：仅保留当轮定稿工具轨迹；历史 DTO 与 `replayMessages` 仍不回放 tool，不新增 IPC/存储/依赖，不改 shared/types.ts 与 SSE 投影。

### D-010 · 重开项目恢复推理与工具轨迹（2026-10-31，✅ 用户明确批准）

- **用户拍板**：「重新打开项目时要能看到『推理过程』和工具轨迹」。
- **裁决**：既有 `runtime:session:messages` DTO 增量携带 tool 的 `callId/tool/status/startedAt/endedAt/error`；`replayMessages` 按首次出现顺序聚合为 `ToolView[]`，正式历史气泡复用 `ToolRow`，恢复工具名称、pending/running/completed/error 状态和耗时。推理沿用 D-008。
- **边界**：不回放工具参数、结果或画布副作用，不为工具新建平台消息 JSON；不新增 IPC/依赖，不改 shared/types.ts 与 SSE 投影。无有效正文的纯工具/纯推理轮仍不产生气泡。本决策取代 D-001/D-002/D-009 中「历史不回放 tool」的旧口径。

### D-011 · 工具行中文化 + 折叠块 + 集体摘要（2026-10-31，✅ 用户已批准）

- **背景**：工具行直接显示裸物理 ID（`shortdrama_canvas_get`），用户「不太明白什么意思」；多条工具行平铺占屏、且看不出「工具集体干了什么」。用户三问：① 工具行是否也该有折叠块 ② 是否该显示工具集体摘要 ③ 工具是否该有中文名。
- **裁决（AskUserQuestion 拍板 A 档纯展示层 + 动作短语粒度）**：① 工具轨迹聚合为可折叠块（沿用「推理过程」折叠块形态，标题「工具轨迹 · N 项 · 中文动作摘要」，摘要 = 去重计数保序，如「读取画布 ×2 · 写入已捕获口径」）；② renderer 新增纯函数模块 `tool-labels.ts`，自持「物理 ID → 中文动作短语」枚举表（28 个 MCP 工具族全覆盖，短语取自 MCP 注册描述首个动宾，与注册处同源）；③ 物理 ID 保留在行级 `title` 供追溯。
- **边界**：纯展示层、零 LLM、零契约变更——枚举而非 AI 生成（D-016 标尺「能写成枚举规则→系统直做」）；不改 DTO/IPC/SSE 投影/持久化；未知工具回退去前缀原 ID，不臆造名称。
- **批准方式**：2026-10-31 AskUserQuestion 选定「A 档：纯展示层（推荐）」+「动作短语粒度（推荐）」。

### D-012 · 工具行显示白名单关键参数摘要 argsPreview（2026-10-31，✅ 用户已批准）

- **背景**：D-011 后工具行只显示动作短语（如连续 5 行「✓ 写入已捕获口径 0.0s」），用户反馈「具体写了什么为什么不显示，这太笼统了」。约束：D-010 起历史 DTO 不带工具入参，若仅流式现算会造成「当场可见、重开消失」的不一致。
- **裁决（AskUserQuestion 拍板白名单关键参数）**：每个工具定义一个关键参数白名单（`capture.upsert`→topic/id、`file.write`→path、`web.search`→query 等 13 类，按优先级取首个非空字符串，截断 80 字符），工具行显示为「中文动作 · 关键参数」。**历史侧**：主进程 `toMessageRecord` 从 SDK tool part `state.input` 按白名单提取，DTO 增量携带 `argsPreview?: string`（空串不落 DTO）；**流式侧**：渲染层用同一白名单从 `ToolView.args` 现算（`toolArgPreview()`），不落字段。键表在 `src/lib/tool-labels.ts` 与 `electron/runtime/client.ts` 双份镜像，注释互注「改任一侧必须同步另一侧」（electron 不 import src，避免分层倒置）。
- **边界**：完整入参/结果仍不回放（H6 口径保留，仅放行白名单摘要这一窄口）；白名单只收「读了/写了什么」的关键字段，不收大对象与敏感字段；不新增 IPC/依赖，不改 shared/types.ts 与 SSE 投影；属 K8 范围内既有 DTO 两端镜像的增量扩展（electron/runtime/types.ts 与 src/lib/runtime-types.ts 同步加 `argsPreview?: string`）。
- **批准方式**：2026-10-31 AskUserQuestion 选定「白名单关键参数（推荐）」。

### D-013 · AI 服务不可用在对话区显示（2026-10-31，✅ 用户已批准）

- **背景**：打开项目/进入对话区时不做任何健康检查，runtime（opencode serve）未运行时右栏看起来一切正常，用户发消息才撞墙；方舟侧失败（Key 缺失/欠费/网络）经 `runtime.error` 事件冒出，但此前仅复位 generating、从不上屏。
- **裁决（AskUserQuestion 三项拍板）**：① **进入对话区即探测**——项目会话装载（启动恢复/左栏切换/新建共用 `onProjectSessionChange` 入口）时调 `runtime.status()`，非 running 先尝试 `runtime.start()` 一次（与发送路径同策略），仍不可用则显示；② **两层覆盖**——runtime 未运行（进入探测）与方舟调用失败（`runtime.error` 事件）共用同一显示位；③ **显示形态 = 横幅 + 禁用输入**——对话区顶部常驻横幅（含错误原因与「重新检测」按钮），同时禁用输入框与发送钮。
- **恢复口径**：探测 healthy 或发送路径 status 检查通过即自动清除横幅；用户也可点「重新检测」手动复检。dev-mock 演示态不探测（`onProjectSessionChange` 首行已早退）。
- **边界**：纯 renderer 增量——新增 `aiDown` state 与 `checkAiHealth`，复用既有 `runtime.status/start` IPC 与 `runtime.error` 事件，不新增 IPC/依赖，不改 shared/types.ts、DTO 与 SSE 投影；不引入轮询（恢复靠重试/下次发送，避免后台空转）。
- **批准方式**：2026-10-31 AskUserQuestion 选定「进入对话区就探测（推荐）」+「两层都要（推荐）」+「横幅 + 禁用输入（推荐）」。

### D-014 · 纯推理 / 纯工具轮不再被丢弃：历史回放与流式定稿保留空正文轮（2026-11-01，✅ 用户已批准，B-49）

- **背景**：D-008/D-010 虽已把 reasoning 与 tools 纳入回放/定稿，但两侧仍残留「正文为空整条丢弃」——[history-replay.ts](../../../src/lib/history-replay.ts) H4 规则 `text.trim()==='' → continue` 把 reasonings/tools 一并丢弃；[StudioApp.tsx](../../../src/studio/shell/StudioApp.tsx) SSE 定稿仅在 text 非空时 push item。真机表现：Agent 首段推理（工具调用前、尚无正文）在重开会话后消失。D-012 追溯口径要求每段推理与工具调用可回放。
- **用户拍板**：「修历史回放丢推理 + 登记偏差」（循 B-18~B-47 不建包直接修先例）。
- **裁决**：H4 修订为「正文、reasonings、tools 三者全空才丢弃」；assistant item 以 `reasoningBlocks`（多段，与 B-48 同源）+ `tools`（callId 去重 upsert）回放；H6 白名单不变（仍仅放行 argsPreview，不回放完整入参/工具结果/brief/trace）；StudioApp 定稿条件同步改为 `text || reasoningBlocks.length || tools.length`。reasoning part 空文本（`''`）不入块（联跑实测发现会输出 `reasoningBlocks:['']`，已加 `part.text.length > 0` 过滤）。
- **边界**：纯 lib/renderer，**K1/K8/K9 零触发**——不新增 IPC/存储/依赖，不改 DTO 形状（reasoning/tool part 既有）、shared/types.ts 与 SSE 投影。
- **验证**：[history-replay.test.ts](../../../src/lib/history-replay.test.ts) 修订 H4 等 3 处旧断言 + 新增纯工具轮用例（空 reasoning 串过滤、白名单 argsPreview 随快照回放）；全量 **76 文件 935 passed / 0 failed / 1 skipped**，typecheck 恰 3 条历史基线零新增。
- **偏差登记**：[设计现状与偏差清单.md](../../设计现状与偏差清单.md) B-49。本决策取代 D-008/D-010 中「无有效正文不产生气泡」的旧口径。

### D-015 · capture 工具参数 topic 显示中文字段名（2026-11-01，B-51）

- **裁决**：`capture_upsert` 的 `topic` 参数在流式与历史工具行中经 `captureTopicLabel` 显示中文字段名；renderer 直接引用 feature-005 的 chain 事实源，主进程因分层约束保留静态镜像，并标明三处同步义务。点号 / 下划线工具名统一归一，未登记 topic 原样回退，不臆造名称。
- **边界**：仅呈现层与既有 `argsPreview` 白名单摘要映射；不改 DTO 形状、IPC、shared/types.ts、SSE 投影或依赖，不回放完整工具入参 / 结果。偏差登记 B-51。

### K 卡口登记与批准范围（随任务包评审呈批）

- **K1（shared/types.ts）触发**：唯一 diff = `ProjectSession.activeSessionId?: string | null`（可选可空，旧四字段文件零迁移，undefined≙未绑定、null=显式清空）。不向 ChatMessage 等旧形态扩散、不加共享函数/常量。
- **K8（IPC/preload/DTO 镜像）触发**：新增**恰 2 个** ipcMain.handle——`runtime:session:messages`（withRuntime，兼容裸串/对象参）与 `project:active-session`（不经 withRuntime，读/写双态）；既有 `project:open` 返回值扩展（非新增通道）；preload 两处方法 + global.d.ts 三处镜像 + `RuntimeSessionMessagePart/RuntimeSessionMessageRecord` 两个 DTO 在 electron/runtime/types.ts 与 src/lib/runtime-types.ts 两端逐字一致。
- **K9 不触发**：package.json / package-lock.json / resources/opencode 零 diff（SDK 已含 session.messages/get）。
- **错误码零增**：回放 404 复用 mapHttpError 归一 SESSION_NOT_FOUND；绑定层复用 INVALID_ARGUMENT/INVALID_PROJECT_DIR/PROJECT_NOT_FOUND。
- **批准方式**：任务包 5 文件建齐后呈报用户评审；用户明确「批准/开始编码」即视为对上述 K1/K8 范围与 D-001~D-005 的显式批准，T1→T7 一次授权。**批准前不触碰任何产品代码。**
- **状态**：✅ 已批准（2026-10-15，用户批复 "User has approved the given files, continue working."）；K1 单字段、K8 恰 2 IPC + openProject 返回扩展 + 三处镜像均按批准范围落地，实施期零扩面（红线结论见 AC9/AC10）。

### R-001 · 设计书 §7.1 修订（预登记，T7 落地）

- L564（目录树 `chat.messages.json` 注释行）、L599（版本归档区 replay/hydrate 描述）改为「消息历史复用 opencode 原生会话存储；`.session.json` 仅持久化 activeSessionId；UI 历史经 session.messages 回放」；L557 附近「纯文件持久化、无数据库」总述保留。
- HTML 镜像：`docs/design/短剧Agent平台设计.html` 与 `平台全景图.html` 按同文案替换；进度看板 / 架构模块关系图 / 原型三份仅在存在同文案时修改。
- **状态：✅ 已落地（2026-10-15 T7，3 文件 5 处）**；其余三份 HTML 无该文案未改，版本记录历史编年史条目按维护规则保留旧表述。逐处旧新文案属于已落地过程记录，现由二、节压缩注承接，现行口径以本 R-001 为准。

## 二、实施记录（过渡）

### T1—T7 及 D-010—D-015 已落地实施压缩注（2026-11-20）

T1—T7 及 D-010—D-015 对应实施已按任务清单与上述决策完成：项目会话绑定、历史回放、续聊 / 停止 / 隔离、推理与工具轨迹、工具中文标签及参数摘要、AI 不可用提示、空正文轮和 capture topic 中文显示均已落地；R-001 的根设计与两份 HTML 镜像共 3 文件 5 处修订已完成。原逐文件改动、过程命令、当时测试计数与排查流水不再复制，现行行为、边界和验收以本包需求规格、契约、设计说明、任务清单、D/K 决策及 AC 记录为准。

真实 Electron 初次点验项 1/2/3 通过，项 4/5 暴露的 D-006/D-007 经用户批准方案 A 修复后均已通过真机复测；对应证据与 AC4/AC5 结论保留在决策和验收区。X-002 的真机目验待用户执行，不因上述复测或本次清理转为通过。

### AC1–AC10 验收勾选（2026-10-15）

> 标记口径：`[x]` = 已闭环（自动化+真机双证据）。2026-10-16 D-006/D-007 方案 A 修复后，AC4/AC5 经真机复测改 [x]，本包 AC 10/10 闭环。

- [x] **AC1（R1 回放）**：session-continue R1 用例钉死重开自动正序回放文本气泡、loading 凭据出现/消失、无 demo 假数据；无绑定分支零 sessionMessages/零 runtime.start。**真机项 1 已通过**：t18 空白→t182 loading→t195 双气泡同帧、`fakeFramesBeforeReplay=[]` 无假数据闪屏（03-replay.png、reload-trace5.json）。
- [x] **AC2（R2 续聊上下文）**：自动化钉死「同 sessionID、无第二次 createSession」；**真机项 2 已通过**：回放态续发 sid 前后均为 `ses_ebde456…`、listSessions 12→12、两轮记录同属一 sid。
- [x] **AC3（R3 惰性建会话+落盘）**：R3 组件用例 + project-session-binding 7 例；端到端「完全重启后看到对话」由真机项 1 同帧回放坐实。
- [x] **AC4（R4 停止）**：R4 用例钉死「accepted 即 resolve 后停止钮持续可见 → 流式全程可 abort → idle 复位并定稿」新契约；引擎 abort 真机 `{ok:true}`（OD §9 风险 2 未触发）。**D-006 方案 A 修复后真机复测项 4 通过**：停止钮 43ms 首现后持续 13.1s 零断档（修复前仅 57ms 窗口），点击后 76ms idle 复位、文本冻结、sid 不变、会话数不增；abort 后同会话多轮再发成功（D-006）。
- [x] **AC5（R5 切项目隔离）**：subscribe 总次数 1 用例 + 真机网络层常驻仅 1 条 SSE（多轮 netstat 复核）；**D-007 方案 A 修复后真机复测项 5 通过**：A 流式中切无绑定空项目 B，20s/200 帧采样污染帧 0、停止钮未出现、bind=null、右栏始终空态提示；切回 A 内容完整（8546 字含标记）、sid 不变、会话数 12→12（D-007）。
- [x] **AC6（R6 旧项目兼容）**：project-session-binding 旧四字段 openProject 写回五字段用例（title/createdAt 保留、lastOpenedAt 按既有语义刷新、activeSessionId:null、不丢字段）。
- [x] **AC7（R7 404 降级）**：R7 用例钉死 SESSION_NOT_FOUND 后空态 + info toast 一次 + activeSession(null) 清绑定 + 再发惰性建会话成功。
- [x] **AC8（R8 dev-mock）**：dev-mock-api 三桩齐备（openProject/sessionMessages/activeSession），浏览器 mock 态演示气泡不变、新通道有空桩；自动化经组件套件 harness 同源验证，控制台无「不是函数」错误。
- [x] **AC9（工程红线）**：44 文件 **462 passed** / 1 skipped（基线 431 → T6 461 → D-006/D-007 修复净增 1 例 sid=null 边界用例至 462；skipped/failed 不扩大）；三层 typecheck 仅 3 条历史基线错误（canvas-zoom 2 + runtime-client.test L45 1，均零 diff）、本次修复 4 文件零错误；静态契约套件无感通过。
- [x] **AC10（卡口与修订）**：K1 仅 activeSessionId 一处；K8 恰 2 IPC（main.ts L162/L425）+ openProject 返回扩展，preload/global.d.ts/两端 runtime-types 镜像齐备且 DTO 逐字一致；package.json/lock/resources/opencode 零 diff；R-001 设计书 2 处 + 2 份 HTML 镜像 3 处修订完成，落地范围见 R-001 与二、节压缩注。

**AC 总览（2026-10-16 D-006/D-007 修复复测后）**：**AC1–AC10 全部 [x]，10/10 闭环**。AC4/AC5 经用户批复方案 A 修复（独立 generating 态 + renderer 严格归属），自动化 462 passed，真机复测项 4（停止钮 13.1s 持续可达、abort 76ms 复位、sid 不变）、项 5（空项目污染帧 0、切回完整、会话不增）均通过。包状态：**✅ 闭环**（features/README、偏差清单 B-17 同步此口径）。

### 偏差与遗留

- **真机缺陷（✅ 已解决，2026-10-16）**：D-006（R4 停止钮流式期不可达）、D-007（R5 切到无绑定空项目串台）经用户批复方案 A 修复，均为 renderer 状态/过滤建模问题，引擎层（abort、单流、绑定、回放、持久化隔离）真机本就正确。修复后自动化 462 passed、真机复测项 4/5 全通过，实数见 D-006/D-007 与 AC4/AC5；AC4/AC5 已改 [x]，本偏差闭环。
- **测试盲区（✅ 已补齐，2026-10-16）**：R4 已重写覆盖 promptAsync 在 HTTP accepted 即 resolve、流式仍在跑的时间窗（停止钮全程可达断言）；R5 已新增「目标项目 sid=null」边界用例（他会话 streaming + idle 定稿事件均丢弃）。另对 studio-flow.test.tsx 一处旧时序用例做连带修正（发送前 emit 事件在新归属守卫下不成立），diff 仅 import 补 waitFor + 该用例时序对齐，白名单外改动已在本条记名。
- **过程偏差（已自纠，非契约偏离）**：白名单外 runtime-client.test.ts 被误补桩，T6 自检发现并完整回退，过程在此记名；最终 diff 面与契约 §0 白名单 18 文件逐一对齐。
- **遗留（存量噪声，明确不在本包）**：opencode 侧历史「一轮游」会话不清理（不调 session.delete），平台不展示全局会话列表故仅为存储噪声，按需求 §4.2 留待另议；canvas-zoom.test.tsx 两条 typecheck 历史基线错误为画布缩放包存量，与本包无关。
- 实施期契约/需求修订以 R-001 及三、修订记录为准；X-002 的 B-54/B-56 修复、历史验证实数与真机待验结论保留在三、修订记录。

## 三、修订记录

- _（实施期偏离契约/需求的修订记本区；R-001 在一、节预登记，X-002 与后续 R 修订在下文保留。）_

### X-002 · B-54/B-56：流式多段推理 partId 契约 + 推理/结果交错 timeline（2026-11-01，✅）

- **背景**：真机上报（test 项目立项对话，右栏 6 段推理）——①Agent 调完工具再推理后，第 2~6 段推理流式期不增长、不出现，要等定稿快照才一次性出现；②流式与定稿均固定「全部推理→正文→全部工具」三段式，同一消息内原始顺序丢失。
- **K8 契约变更（用户已批准）**：双侧 `message.delta` DTO（[electron/runtime/types.ts](../../../electron/runtime/types.ts) / [runtime-types.ts](../../../src/lib/runtime-types.ts)）增 `partId: string`，两端逐字一致；[projection.ts](../../../electron/runtime/projection.ts) 投影 message.part.delta 时透传 part.partID。
- **归约（B-54）**：[chat-runtime.ts](../../../src/lib/chat-runtime.ts) 新增 `deltaParts`——按 partId 分段累加 delta，同 partId 快照 parts 到达即清该段 delta；`StreamingTurn` 增 `timeline`（part/tool 首次出现按事件到达追加）；`turnReasoningBlocks` 从 timeline 出多段（快照优先、delta 兜底、空段过滤），不再因任一快照 parts 存在即丢弃全部 delta。
- **交错（B-56）**：`turnSegments` 从 timeline 出有序 `TurnSegment[]`（tool 始终保留含 running；reasoning/text 空串跳过；timeline 全空回退旧平铺路径兼容）；[history-replay.ts](../../../src/lib/history-replay.ts) 改单遍扫描直接产有序段（同 callId 原地替换锚点，H4/H6 白名单与 ignored/synthetic 过滤不变）。渲染消费（InterleavedContent）与贴底（B-55）归 feature-809 登记；X-001 两个真机缺陷（静默段「正在思考…」、done 态光标）一并见 feature-809。
- **卡口**：K8 仅 DTO 加字段（本登记即凭据）；K1/K9 零触发，shared/types.ts、IPC、依赖零 diff。
- **测试**：chat-runtime.test.ts 新增多段流式/跨 messageId 用例；history-replay.test.ts 3 处旧断言改交错期望；双侧镜像测试同步。最终全量 **76 文件 950 passed / 0 failed / 1 skipped**，typecheck 恰 3 条历史基线零新增；真机目验待用户执行。
- **偏差登记**：[设计现状与偏差清单.md](../../设计现状与偏差清单.md) B-54、B-56（均 ✅ 已解决）。

### R-002 · D-037 会话数据与运行时模板约束归并（2026-11-19，纯文档）

- **来源 → 目标章节**：819 需求 §3 目标、§4 简化契约、§5 非目标 → 本包需求 §6、契约 §9.1、设计 §10.1；010 变更记录 D-003 修订 4 与 X-002 中 reasoning 与历史工具轨迹数据 → 本包需求 §6、契约 §9.2、设计 §10.2。010 的芯片视觉与立项交互分别归 817 / 013，不迁入本包。
- **归并内容**：`process.defaultApp` 优先的开发态判定、真打包资源路径、模板缺失 / 占位符缺失显式失败；多段 reasoning、纯 reasoning/tool 轮、partId/callId 交错顺序、流式与重载同口径和工具状态 / 错误 / 白名单参数摘要回放。
- **冲突处理**：010 的完整工具结果 / resultSummary 愿望被本包 H6 白名单边界收窄，不回放完整 input/output / 结果，也不新增字段；819 的 `app.isPackaged` 单判据按已落地修复改为 `app.isPackaged && !process.defaultApp`。归档正文和历史验证结论不改。
- **职责边界**：808 与 817 独立；本会话包不吞并视觉。真实 AI runtime 的本次状态未重新验证，819 缺失契约 / 设计文件不补造。
- **变更性质与验证**：无新接口、无代码 / 测试 / 依赖 / 真实项目数据改动；完成来源章节、目标章节、冲突和历史状态自审，**自审 + 无第二人复核**。
