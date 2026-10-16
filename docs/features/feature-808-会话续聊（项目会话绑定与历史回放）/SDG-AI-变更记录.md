# feature-808 会话续聊（项目会话绑定与历史回放）· 变更记录

> 三分类：决策记录（永久）/ 实施记录（落地后清理）/ 修订记录（决策稳定后清理）。
> 本包对齐 MiniMax Design（@hilo/hub）「左栏项目即会话入口、重开项目可续聊、画布节点跨会话」形态，补齐平台「每轮新建会话、重开无历史」缺口；溯源标签整体为 [改编]（opencode/MCP 同源组件自行实现，不复用其闭源代码）。

## 一、决策记录（K 卡口，永久保留）

### D-001 · 持久化路线 = opencode 原生存储 + R-001 授权（2026-10-15，✅ 用户已批准）

- **背景**：设计书 §7.1（L564/L599）原定项目目录下 `chat.messages.json` 持久化全量消息、UI 自行 hydrate。勘察 opencode 运行时事实：主进程 spawn `opencode serve`（cwd 固定平台工作区根，不按项目切换），SDK 已提供 `session.messages({path:{id}})`（时间正序 `{info, parts}[]`），消息历史本就持久化在 opencode 自带存储。
- **裁决**：消息历史**全部留在 opencode 原生存储**，平台不复制不镜像；`.session.json` 仅增 `activeSessionId` 绑定；重开项目经 SDK 回放。设计书 §7.1 的 chat.messages.json 终态作废，授权 **R-001 修订**（L564 目录树注释行、L599 replay/hydrate 描述 + 含同文案的 HTML 镜像），修订动作排在代码落地与真机目验通过后的 T7。
- **批准方式**：2026-10-15 AskUserQuestion 选定「opencode 原生存储 (Recommended)」。
- **联动结论**：K9 不触发（SDK 1.18.34 已含 session.messages，零新依赖）；回放投影仅文本，与流式定稿（StudioApp L122–127 只落 text）同构。

### D-002 · 包范围 = 最小续聊闭环（2026-10-15，✅ 用户已批准）

- **裁决**：一项目绑定一条活跃会话。在包内的只有：重开放映历史文本气泡（R1）、新 prompt 复用同会话（R2）、首条 prompt 惰性建会话并回写绑定（R3）、发送中可停止（R4）、切项目对话随项目切换不串台（R5）、旧四字段项目零迁移兼容（R6）、404 诚实降级（R7）、dev-mock 可用（R8）。
- **显式排除**（需求 §4.2）：会话列表 UI、手动新建/删除/切换/重命名会话、一项目多会话、历史分页/虚拟滚动/搜索、reasoning/tool 回放、半截轮次保留、session.delete GC。
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
- **状态**：✅ 已闭环。2026-10-16 用户批复方案 A；当日修复落地（StudioApp 新增独立 `generating` 态，accepted 后置位、`session.idle`/`runtime.error` 无条件复位，dev mock 不置位；ChatComposer 停止钮与禁用公式绑 `sending || generating`；切项目清场同步复位），R3/R4 用例按新时序重写，真机复测项 4 通过（见二、节「T6 真机复测（D-006/D-007 修复后）」），AC4 改 [x]。

### D-007 · 真机缺陷：R5 在「切到无绑定空项目」边界串台（2026-10-16，T6 真机发现；✅ 方案 A 已批准·已修复·真机复测通过）

- **现象（真机实证）**：项目 A 流式生成中切到**无绑定空项目 B**（`activeSession()=null`），B 右栏在 t5602ms 起出现 A 的「推理过程」流式，t21600ms 起正文逐帧涌入（199 污染帧、定稿 3381 字、含唯一标记「阿尔法鸑鷟」），A 定稿被落为 B 的气泡。切回 A 历史 16 条完整正确、sid 不变、会话总数 12→12；再切回 B 恢复空态——**污染仅为 renderer 临时 UI state，未持久化到任何会话存储**，不产生脏数据，但真机可见地违反 R5「B 全程无 A 流式/定稿闪现」。
- **根因**：renderer 订阅为**无参** `runtime.subscribe()`（[StudioApp.tsx](../../../src/studio/StudioApp.tsx) L256–260），主进程 `sessionFilter=undefined` 不做会话级过滤、广播全部事件（[main.ts](../../../electron/main.ts) L332–339 的 filter 分支因 undefined 不生效）；隔离完全依赖 renderer onEvent 首行 `if (sid && evSid && evSid !== sid) return`（StudioApp L126–128）。当 B 无绑定 `activeSessionIdRef.current=null` 时，守卫因 `sid` 为假被**短路**，A 的事件全部泄漏进 B：stream 被 reduce 出 A 的流式文本，running→非 running 时还经 L134–147 把 A 定稿 `setItems` 落进 B。
- **修复方案选项（裁决时列陈，用户已拍板 A）**：
  - 方案 A（renderer 严格归属，推荐，已批准）：过滤改为「按当前绑定 sid 严格归属」——**无绑定（sid=null）或 evSid 与当前 sid 不符时，一律丢弃带 sessionId 的事件**；仅无 sessionId 的 runtime 级状态事件放行。并在 `onProjectSessionChange` 切项目清场时同步清空未落定的 `streamRef`（现 L182–206 已清 items/ref，需确认 stream 一并复位，避免上一会话流式残影）。
  - 方案 B（主进程过滤，纵深防御，可选）：订阅 IPC 支持带 `{sessionId}`，切项目时重新订阅/更新 filter，让 main.ts 已有的 broadcast filter 真正生效；改动跨主进程+preload+renderer，面更大，可作为后续增强，不阻塞 A。
- **影响面**：方案 A 仅 StudioApp.tsx（白名单内）；session-continue.test.tsx R5 需补「切到无绑定空项目期间，他会话 streaming + idle 定稿事件均被丢弃」真机等价用例（现有 R5 覆盖了 A/B 都有会话及装载空窗期，但**未覆盖目标项目 sid=null 这一边界**，属测试盲区，一并记名）。
- **状态**：✅ 已闭环。2026-10-16 用户批复方案 A；当日修复落地（onEvent 守卫改严格归属 `evSid !== undefined && evSid !== sid` 即丢弃；无 sessionId 的 runtime 级事件放行经 reducer no-op；切项目清场已含 streamRef/setStream），新增 sid=null 边界回归用例，真机复测项 5 通过（见二、节），AC5 改 [x]。白名单外 studio-flow.test.tsx 因旧守卫契约被连带修正（一处用例旧时序在发送前发事件，新守卫下不再成立），diff 仅 import 补 waitFor + 该用例时序对齐真实发送顺序，留痕见二、节修复实施记录。

### K 卡口登记与批准范围（随任务包评审呈批）

- **K1（shared/types.ts）触发**：唯一 diff = `ProjectSession.activeSessionId?: string | null`（可选可空，旧四字段文件零迁移，undefined≙未绑定、null=显式清空）。不向 ChatMessage 等旧形态扩散、不加共享函数/常量。
- **K8（IPC/preload/DTO 镜像）触发**：新增**恰 2 个** ipcMain.handle——`runtime:session:messages`（withRuntime，兼容裸串/对象参）与 `project:active-session`（不经 withRuntime，读/写双态）；既有 `project:open` 返回值扩展（非新增通道）；preload 两处方法 + global.d.ts 三处镜像 + `RuntimeSessionMessagePart/RuntimeSessionMessageRecord` 两个 DTO 在 electron/runtime/types.ts 与 src/lib/runtime-types.ts 两端逐字一致。
- **K9 不触发**：package.json / package-lock.json / resources/opencode 零 diff（SDK 已含 session.messages/get）。
- **错误码零增**：回放 404 复用 mapHttpError 归一 SESSION_NOT_FOUND；绑定层复用 INVALID_ARGUMENT/INVALID_PROJECT_DIR/PROJECT_NOT_FOUND。
- **批准方式**：任务包 5 文件建齐后呈报用户评审；用户明确「批准/开始编码」即视为对上述 K1/K8 范围与 D-001~D-005 的显式批准，T1→T7 一次授权。**批准前不触碰任何产品代码。**
- **状态**：✅ 已批准（2026-10-15，用户批复 "User has approved the given files, continue working."）；K1 单字段、K8 恰 2 IPC + openProject 返回扩展 + 三处镜像均按批准范围落地，实施期零扩面（T6 红线逐条坐实见二、节）。

### R-001 · 设计书 §7.1 修订（预登记，T7 落地）

- L564（目录树 `chat.messages.json` 注释行）、L599（版本归档区 replay/hydrate 描述）改为「消息历史复用 opencode 原生会话存储；`.session.json` 仅持久化 activeSessionId；UI 历史经 session.messages 回放」；L557 附近「纯文件持久化、无数据库」总述保留。
- HTML 镜像：先 grep `chat.messages.json` 定位，`docs/design/短剧Agent平台设计.html` 与 `平台全景图.html` 有同文案则同文案替换；进度看板/架构模块关系图/原型三份仅有才改。每份记「文件+位置+旧新文案」于本记录实施区。
- **状态：✅ 已落地（2026-10-15 T7，3 文件 5 处，逐处旧新文案见二、节 T7「R-001 修订清单」）**；grep 甄别其余三份 HTML 无该文案不动，版本记录历史编年史条目按维护规则保留旧表述。

## 二、实施记录（过渡）

- 2026-10-15：建包前四轮调研——①opencode 运行时与 SDK 回放能力（serve cwd 固定、session.messages 形状、404 归一、SSE 全局单流）；②Design 形态（调研文档 L21/L28/L128–142：项目即会话入口、节点跨会话状态）；③现有会话链路（handleSend 每轮 createSession+subscribe、流式定稿只落 text、abortSession/beforeStopHook 先例）；④持久化面（.session.json 四字段 + enqueue、openProject 重建对象陷阱、canvas:get 启动恢复）。两项包级决策经 AskUserQuestion 获批（D-001/D-002）。
- 2026-10-15：任务包 5 文件建立（需求规格 / 契约 / 设计说明 / 任务清单 / 本记录）。契约期完成 D-004（双态 IPC）、D-005（顶层暴露）两次技术收敛并回改前三份文档；起草任务清单时实测冻结基线：**40 文件 431 passed / 1 skipped / 0 failed**（skip=T8-4 需 ARK Key）；`npm run typecheck` 退出码 2 仅 canvas-zoom.test.tsx L13/L90 两条历史错误（非本包）；`tsc -b tsconfig.node.json` 与 `tsc -p tsconfig.preload.json --noEmit` 退出码均 0。K1/K8 未获用户批准前不触碰任何代码。

### T1 · 基线复核（2026-10-15，✅）

- 开工首件事原样复跑三条命令，与起草冻结数字一致：**40 文件 431 passed / 1 skipped / 0 failed**；typecheck 退出码 2 仅 canvas-zoom.test.tsx 两条历史基线错误；node/preload 双 tsc 退出码 0。基线无漂移，按白名单开工。

### T2–T4 · 编码落地（2026-10-15，✅，严格按任务清单子序）

- **T2 K1**：[shared/types.ts](../../../shared/types.ts) `ProjectSession` 增 `/** feature-808：当前项目绑定的活跃 opencode 会话 id；undefined≙旧文件未绑定，null=显式清空 */ activeSessionId?: string | null`，全仓 `git diff -- shared/` 仅此一处 hunk。
- **T3 主进程/镜像（T3a→T3e 同任务内顺序）**：
  - T3a 两端 DTO：[electron/runtime/types.ts](../../../electron/runtime/types.ts) 与 [src/lib/runtime-types.ts](../../../src/lib/runtime-types.ts) 各增 `RuntimeSessionMessagePart` / `RuntimeSessionMessageRecord`，两端逐字一致；两端错误码集维持 14/12 差集，零增。
  - T3b [client.ts](../../../electron/runtime/client.ts)：import 类型补 Message；SdkHandle.session 仅补 `messages`（**未补 get**——无调用方，避免死代码）；新增 `getSessionMessages(sessionId)`（requireSessionId→ensureReady→mapHttpError('SESSION_NOT_FOUND')，照 abortSession 先例）；同文件导出 `toMessageRecord(raw)`——role 非 assistant 即 user 兜底、仅留 `type:'text'`、startedAt 取 `time.start` number、ignored/synthetic 透传、其余 part 整体丢弃。
  - T3c [library.ts](../../../electron/project/library.ts)：新增 `readActiveSession(dir)`（直接 readFile+parse，缺失/损坏返 `{sessionId:null}`，不走 enqueue）与 `setActiveSession(dir, sessionId)`（enqueue 读-改-写、显式重建五字段、保留旧 lastOpenedAt 不刷新），均 dir 显式入参、内联路径硬边界校验；openProject 重建对象补第五字段并回传 `{ok:true, activeSessionId}`；createProject 初始化显式 `activeSessionId:null`；listProjects 不动。
  - T3d [main.ts](../../../electron/main.ts)：新增恰 2 handler——L162 `project:active-session`（不经 withRuntime，无参读/写/null 清空双态，无项目读态 catch INVALID_ARGUMENT 返 `{sessionId:null}` 不抛、写态不 catch）、L425 `runtime:session:messages`（withRuntime，兼容裸串与 `{sessionId}`，空白/非法抛 INVALID_ARGUMENT）；project:open handler 末尾透传 library 新返回值，settleAll/reset/recoverPending/广播一行未动。
  - T3e [preload.ts](../../../electron/preload.ts)：顶层加 `activeSession(sessionId?)`（undefined 不包对象，否则包 `{sessionId}`）、runtime 块加 `sessionMessages(sessionId)`；[global.d.ts](../../../src/global.d.ts) 三处镜像（openProject 返回类型、顶层 activeSession、runtime.sessionMessages + import 补类型）。
- **T4 renderer（T4a 纯函数先行）**：
  - T4a 新增 [history-replay.ts](../../../src/lib/history-replay.ts)：`replayMessages(records)` 零 fs/window/Date/Math.random、不 mutate、非数组/坏记录不抛；正序不重排；user 聚合全部未忽略文本 part（不认 hasPartTime，用户 part 无 time）；agent 仅聚合带 number startedAt 且未忽略文本，输出带 `agent:'showrunner'`；空轮双向丢弃；输出只含 id/role/text（agent 多 agent 字段），无 brief/trace。
  - T4b [StudioApp.tsx](../../../src/studio/StudioApp.tsx)：新增 activeSessionIdRef、historyLoading、projectSessionSeqRef、subscribedRef；canvas effect 两 projectId 到达点（onChange 切项目检测 + canvas.get 初值）统一汇入 `onProjectSessionChange(pid)`（清 items/stream/ref→空 pid 结束→序号自增→historyLoading→顶层读绑定→过期 token 丢弃→ref 赋值→有绑定 loadReplay/无绑定结束；devMockActive 分支提前 return 不清 demoChatItems）；`loadReplay` 成功 setItems(replayMessages)，404 先 `await activeSession(null)` 再清场 + 复用既有 toast info 一次弱化提示，非 404 走 setError 不锁死，token 比对包成功/catch/finally；handleSend 改乐观气泡+status→start 保留、ensureSubscribedOnce、无绑定才 createSession→activeSession(newId) 回写（失败 setError 不阻断本轮）→ref 赋值，有绑定零 createSession，promptAsync 通道与入参形状不变；handleStop 有 sid 才 abortSession、空 no-op、不本地复位 sending（交 idle/error 事件链）；onEvent 回调首行收紧为 sessionId 精确匹配过滤（无 sessionId 的 runtime 状态事件放行），堵装载空窗期 A 事件闪现；订阅 ensureSubscribedOnce 无参全局一次（首发送确保 runtime 后），回放路径不订阅，unmount unsubscribe。
  - T4c [ChatComposer.tsx](../../../src/studio/ChatComposer.tsx)：Props 仅增 `onStop?`、`historyLoading?` 两可选；`sending && onStop` 渲染 `data-testid="chat-stop"`（内联实心方块 SVG，复用既有 Tailwind token），否则维持 `data-testid="chat-send"` 且 disabled 公式增 historyLoading；消息区 `data-testid="chat-history-loading"` 轻量占位；既有 9 prop 与 Stage0View 等其他挂载点零改动。
  - T4d [dev-mock-api.ts](../../../src/dev-mock-api.ts) 三桩：顶层 openProject 返 `{ok:true as const, activeSessionId:null}`、runtime 块 `sessionMessages: () => resolve([])`、顶层 `activeSession: () => resolve({sessionId:null})`，受 global.d.ts 类型约束。

### T5 · 测试（2026-10-15，✅，4 新套件 30 例全绿）

- [history-replay.test.ts](../../../src/lib/history-replay.test.ts) **9 例**（H1–H8：空/非数组、单/多 part 拼接含无 time 用户 part、空/ignored/synthetic 丢弃、agent startedAt 聚合与纯 reasoning/tool/abort 空轮、混排正序/id/agent 字段/无 brief/trace、坏记录三类不抛、入参不 mutate）。实施期 H7 坏记录用例内联数组字面量触发 6 条类型错误（null/42/'x'/{} 等被提前做联合类型检查，逐条 cast 无法覆盖数组上下文），修复为整组提取 `bad` 变量末尾单次 `as unknown as ReplayMessageRecord[]`，断言不变。
- [runtime-session-messages.test.ts](../../../src/test/runtime-session-messages.test.ts) **6 例**（toMessageRecord 仅透传 text/startedAt 取 time.start/丢弃 reasoning·tool·file/role 归一/ignored·synthetic 透传；getSessionMessages 成功映射、404→SESSION_NOT_FOUND、空白 id 经 requireSessionId 拒绝）。
- [project-session-binding.test.ts](../../../src/test/project-session-binding.test.ts) **7 例**（旧四字段经 openProject 写回五字段且 title/createdAt 保留、lastOpenedAt 刷新、activeSessionId:null；已有绑定原样保留；setActiveSession 写入/清空不刷新 lastOpenedAt；open 后立即 set 的 enqueue 串行交叉不互覆盖；无文件/损坏 JSON 读态返 null；路径越界拒绝）。
- [session-continue.test.tsx](../../../src/studio/session-continue.test.tsx) **8 例**（R1 回放正序+loading 凭据出现/消失+无 demo；AC1 无绑定零 sessionMessages/零 runtime.start；R2 有绑定零 createSession、promptAsync 同 id；R3 空绑定 createSession 一次+activeSession(newId) 一次；R4 chat-stop 出现/abortSession 绑定 id/事件链复位 sending；R5 B 会话事件不更新 A、切 B 清 items 加载 B、A 慢 B 快迟到回放不覆盖、装载空窗期 A 事件不闪现；R7 reject SESSION_NOT_FOUND 后空态+info toast 一次+activeSession(null)+再发惰性建；多次发送/切项目 subscribe 总次数 1，含 StrictMode 双挂载）。首跑 8 例全灭：`TypeError: win.isMaximized is not a function`（WindowControls.tsx:61）——夹具提供了不完整的 `window:{platform:'win32'}` 真值对象但缺 isMaximized()，挂载 effect 即抛。修复为直接省略 window 块走 api.window 缺省防御分支（studio-flow.test.tsx 同款模式，其夹具本就无 window 键），重跑 8 passed。
- 连带夹具：studio-flow.test.tsx、window-titlebar-integration.test.tsx 仅 openProject mock 返值补 `activeSessionId:null`，断言一行未动（契约 §6.4 预先认定的合理 diff）。

### T6 · 全量回归 + 红线证据（2026-10-15，✅ 自动化全绿；真机目验证据待补）

- **全量测试**：`npm run test:run` = **44 文件 461 passed / 1 skipped / 0 failed**（T1 基线 40 文件 431/1，净增 4 套件 30 例，精确等于契约 §6 预测；skip 仍为需 ARK Key 的 T8-4，skipped/failed 未扩大）。
- **三层 typecheck**：`npm run typecheck` 退出码 2，仅剩 canvas-zoom.test.tsx L13（TS2322）/L90（TS6133）两条历史基线错误，**本包 18 文件自身零错误**；`tsc -b tsconfig.node.json`、`tsc -p tsconfig.preload.json --noEmit` 退出码均 0。静态契约套件（architecture renderer 禁直连 runtime 端口、mcp-pure-tools、agent-profiles、runtime-projection）无感通过。
- **红线逐条坐实**：
  1. `git status --porcelain` 甄别混合工作树：本包代码 diff = 白名单 13 改 + 5 新（新源码 1 + 新测试 4），治理文档 5 份（设计书 md、2 份 HTML、features/README、偏差清单）+ 本包目录（untracked）；feature-807/画布缩放/Markdown 三路存量改动与本包不重叠。
  2. `git diff -- shared/` 仅 ProjectSession 一处 hunk（K1 单字段）。
  3. `grep ipcMain.handle`：electron/main.ts 全文件 31 个 handle，本包新增恰为 L162 `project:active-session`、L425 `runtime:session:messages` 两个；无新 IPC 订阅推送（回放走 invoke）。
  4. `git diff` package.json / package-lock.json / resources/opencode/ / electron/runtime/projection.ts 为空；buildPromptBody（client.ts）、RUNTIME_ERROR_NAMES 零命中本包 diff；无新 npm 依赖、未引 zod；错误码零增（404 复用 SESSION_NOT_FOUND，绑定层复用 INVALID_ARGUMENT/INVALID_PROJECT_DIR/PROJECT_NOT_FOUND）。
  5. canvas/gate/brief/manifest/asset/comfy 既有通道、beforeStopHook（manager.ts）零改动。
- **白名单外误改自检与回退（记名）**：T3 实施期曾给白名单外的 [runtime-client.test.ts](../../../src/test/runtime-client.test.ts) 补过 session.messages 桩（FakeState 的 `messages?: any[]` 与 makeFakeClient session 块的 `messages: vi.fn(...)` 两处），T6 红线甄别时发现：该文件 factory 入参为 any（L92），补桩非编译必需，grep 确认无用例消费。两处新增已用精确编辑完整回退，`git diff -- src/test/runtime-client.test.ts` 归零；回退后 runtime-client 25 例 + runtime-session-messages 6 例全绿。无行为影响，仅作过程留痕。
- **真机目验（任务清单 5 项，2026-10-16 由 AI 自动化 CDP 驱动真实 Electron 窗口完成，用户授权「你帮我测」）**：环境 = Electron 以 `--remote-debugging-port=9222` 启动，经 CDP `Runtime.evaluate` 在真实渲染进程主世界走真实 contextBridge+IPC 操作；ARK Key 真实可用，模型走火山方舟；单一 opencode runtime 端口 4096。固定被测对象：项目 A=`project-20261016-082710-ou3b`、绑定会话 `ses_ebde456afffe2o21UkHJuBNjXi`；空态项目 B=`project-20261016-085434-nfms`（绑定 null）。自动化脚本与 trace 留存仓库外 `%Temp%\sdg808\`（不进工作树）。**结论：项 1/2/3 通过；项 4/5 真机各暴露一个缺陷，详见一、节 D-006/D-007，修复前 AC4/AC5 不放行。**
  1. **重启续聊（必做真机）✅ 通过**：A 项目首轮发送「你好，这是 feature-808 真机点验。请记住一个专有词：紫晶麒麟。现在只需回复「收到」两个字。」，定稿后完全退出应用再重开。启动期 `Page.addScriptToEvaluateOnNewDocument`+reload 从文档最早期 16ms 一帧录制：**t18ms 空白 → t182ms 出现「正在载入历史对话…」loading → t195ms 用户紫气泡整句与 agent「收到」气泡同帧出现**；`fakeFramesBeforeReplay=[]`（回放就绪前无任何气泡/假数据闪现）。截图 `03-replay.png` 目视为紫气泡整句 + 灰气泡「收到」；trace 存 `reload-trace5.json`。
  2. **同 sessionID（需 ARK Key）✅ 通过**：在重启回放态不刷新页面直接续发第二轮。续发前后 `activeSession()` 均为 `ses_ebde456afffe2o21UkHJuBNjXi`（同一 id）；`runtime.listSessions()` 总数 **12→12**（`newSessionIds=[]`，零第二次 createSession）；两轮 user/assistant 记录同属该 sid（经 `sessionMessages` 读到 4 条记录，正序 u/a/u/a）。证据为运行时真实计数，未用 spy。
  3. **上下文连续（需 ARK Key）✅ 通过**：重开回放态追问「上一轮让你记住的专有词是什么？只回答那个词」，ARK 实答 **「紫晶麒麟」**（sessionMessages 第 4 条 assistant 记录）。截图 `04-context-continue.png`。
  4. **abort 后同会话再发（必做真机）⛔ 引擎层通过 / UI 层缺陷（D-006，修复前 AC4 不放行）**：**引擎契约通过**——真实生成中直调 `runtime.abortSession(sid)` 真机返回 `{ok:true}`、**11ms 返回，opencode 未拒绝 abort**（故 OD §9 风险 2「惰性新建备选」**未触发，无需补记备选 D**）；被中断轮 assistant part 文本长度恒为 0（确有中止效果）；随后同会话再发收到「恢复成功」回复（8023ms），sid 不变、`listSessions` 12→12、记录 14 条 user/assistant 交替。**UI 缺陷**——`chat-stop` 按钮因 `sending` 生命周期错位，经 MutationObserver 权威实证仅在点击发送后 **378ms→435ms（约 57ms 窗口，promptAsync HTTP 202 往返期）** 存在于 DOM，真正约 20s 的流式生成期间按钮不可达，用户无法在生成中通过界面停止。根因与修复方向见 D-006。
  5. **A 生成中切 B（必做真机）⛔ 串台缺陷复现（D-007，修复前 AC5 不放行）**：新建空态 B（绑定 null、右栏空态正确），切回 A 发带唯一标记「阿尔法鸑鷟」的约 2000 字 prompt，在 A 流式生成中**真实点击 B 卡片**并以 100ms 间隔采样约 22s。结果：t604ms B 尚为正常空态提示 → **t5602ms B 右栏出现 A 的「主 推理过程」流式** → **t21600ms 起 A 的正文逐帧涌入 B（199 个污染帧，末态 2175→定稿 3381 字，含「阿尔法鸑鷟」标记词）**，约 t40.6s A 的定稿被落为 B 的气泡；采样全程 `canvas=nfms`、`bind=null`、A 的 sessionMessages 记录数恒 16（污染纯为 renderer UI state，未写入任何会话存储），`sawStopButtonOnB=false`。**「切回 A 历史正确」半句通过**：切回 A 后 `activeSession()` 仍为同一 sid、sessionMessages 16 条 user/assistant 严格交替、首轮「紫晶麒麟」与末轮「深海热液…阿尔法鸑鷟」长文均完整回放、右栏 5789 字、会话总数 12→12；再切回 B 右栏恢复空态（51 字空态提示、无标记词、绑定仍 null）——证明串台内容**未持久化**。**「全程仅一条 SSE 订阅」通过**：代码侧主进程 `ensureRuntimeEventStream` 单例守卫 `if (runtimeEventStream) return`（main.ts L294）+ renderer `subscribedRef` 一次订阅（StudioApp L256-260）；网络侧实测到 opencode 端口 4096 的 Established 连接常驻仅 1 条（electron 主进程 pid，本地端口 53441 全程不变），发送瞬间多出来的第 2 条为 promptAsync 的短命 HTTP（100ms 采样 80 帧中 63 帧=1、17 帧=2，复轮 60 帧全程=1）。**核心失败点为 R5「B 全程无 A 流式/定稿闪现」**，根因与修复方向见 D-007。

### T6 补 · D-006/D-007 方案 A 修复与真机复测（2026-10-16，✅，用户批复方案 A 后实施）

- **修复面（4 文件，3 白名单内 + 1 白名单外连带，零主进程/preload/shared 改动，K1/K8/K9 均不触发）**：
  - [StudioApp.tsx](../../../src/studio/StudioApp.tsx)：①新增独立 `generating` 态（D-006）——`handleSend` 中 `await promptAsync(...)` 成功后置 `setGenerating(true)`（仅 `!devMockActive()`：dev mock 的 `onEvent: () => noop` 永不发事件，置位会致停止钮永久卡死），`finally` 仍只复位 sending；onEvent 内对归属事件中的 `session.idle` / `runtime.error` **无条件** `setGenerating(false)`（不能只挂 running→非 running 定稿分支：`session.idle` 在 turn=null 时 reducer 返回 null，无流式分片的空转 idle 也须复位）；`onProjectSessionChange` 清场段同步复位。②onEvent 守卫改严格归属（D-007）——`const evSid = 'sessionId' in ev ? ev.sessionId : undefined; if (evSid !== undefined && evSid !== sid) return`；无 sessionId 的 runtime 级事件（如 runtime.connected）放行，reducer 对其 no-op。ChatComposer 挂载点传 `generating`。
  - [ChatComposer.tsx](../../../src/studio/ChatComposer.tsx)：Props 增 `generating?`；停止钮渲染条件 `sending || generating`；submit 守卫与发送钮 disabled 公式同步加 `generating`；onStop 注释更新（不本地复位 generating，由 idle/error 事件链复位；abort 被引擎接受后必发 idle）。
  - [session-continue.test.tsx](../../../src/studio/session-continue.test.tsx)（白名单内新测试）：R4 重写为「accepted 即 resolve 后停止钮持续可见 → 流式全程可 abort → idle 复位并定稿」新契约（旧 deferred promptAsync 契约作废）；R3 补 idle 模拟「idle 结束本轮后二次发送仍只订阅一次」；**新增 D-007 边界用例**：sid=null（无绑定空项目）时他会话 message.part + session.idle 一律丢弃（标记词「阿尔法鸑鷟」不上屏、无 chat-stop），可正常为本项目输入发送，runtime.connected（无 sessionId）放行不报错。
  - [studio-flow.test.tsx](../../../src/studio/studio-flow.test.tsx)（**白名单外连带，记名留痕**）：仅一处流式用例的旧时序（发送前 emit sess-1 事件——旧守卫 sid=null 放行、新严格守卫丢弃，不符合真实顺序）改为先真实发送再 emit 流式事件、末尾补停止钮消失等待；import 补 `waitFor`。断言目标（流式文本进 GateCard 等）未变，属 D-007 迫使的测试时序对齐，非产品断言修改。
- **全量验证**：`npm run test:run` = **44 文件 462 passed / 1 skipped / 0 failed**（修复前 461，净增 1 例 sid=null 边界用例；skip 仍为需 ARK Key 的 T8-4）。`npm run typecheck` 退出码 2 共 3 条错误，逐条核实为**零 diff 既有基线**：canvas-zoom.test.tsx L13/L90（画布缩放包存量）、runtime-client.test.ts L45 TS2741（T6 误补桩完整回退后的既有缺口，见上节 T6 留痕）；本次修复 4 文件自身零错误。node/preload 双 tsc 退出码 0。
- **真机复测（CDP 自动化，同一真实 Electron/ARK/opencode 环境，脚本留存仓库外 `%Temp%\sdg808\v9c-*.js`）**：
  - **项 4 ✅ 通过（D-006 修复有效）**：A 项目发约 2000 字长文（标记「朱雀重明」），16ms 高频采样停止/发送钮信号——`chat-stop` **发送后 43ms 首现，持续 13074ms 直到用户点击停止，期间 0 次断档**（对照修复前仅 57ms 窗口）；t=13117ms 真实点击停止，t=13193ms 收到 idle 复位（76ms），右栏文本立即冻结（lenAfterClick 恒 6070，零继续增长），定稿落 assistant 气泡（含标记词）；`abortSession` 被引擎接受、sid 前后均为 `ses_ebde456…`、`listSessions` 12→12 不增。
  - **项 5 ✅ 通过（D-007 修复有效）**：A 发约 2000 字长文（标记「玄龟负书」），A 右栏真实增长 ≥200 字后真实点击无绑定空项目 B，100ms×200 采样 20s——B 右栏**污染帧 0**（标记词「玄龟负书/熔岩/极昼」零命中）、**停止钮全程未出现**、`canvas=nfms`、`bind=null`、右栏始终 51 字空态提示；A 期间照常生成完毕。切回 A：sid 不变、右栏 8546 字含完整标记长文、记录正序 user/assistant 持久化（末条 assistant 2533 字）、`listSessions` 12→12 不增。
  - **仅一条 SSE 订阅复测确认**：netstat 多轮采样 4096 端口——electron 主进程（单 PID）常驻连接本地端口 25343 跨 idle 与多轮发送始终唯一，流式中新增的第 2 条（如 63281）为 promptAsync 短命 HTTP、轮次结束即消失；多轮发送不产生新常驻连接。
  - **abort 后同会话多轮再发**：项 4 abort 后继续经 UI 完成 4 轮真实发送（朱雀重明/玄龟负书/白虎监兵/玄武执明四标记），同 sid 累计 30 条记录 user/assistant 严格交替、四标记齐全、空闲态停止钮消失/发送钮恢复，会话总数恒 12。

### T7 · 治理收尾（2026-10-15，✅；2026-10-16 D-006/D-007 闭环后口径更新）

- **R-001 修订清单（3 文件 5 处，代码与自动化验证通过后落地，逐处「文件+位置+旧→新」）**：
  1. [短剧Agent平台设计.md](../../../短剧Agent平台设计.md) 目录树（原 L563–564 两行）：旧为 `├── chat.messages.json # 会话消息流唯一事实源；replay 重建 UI 状态` 独立行 + `.session.json # { title, createdAt, lastOpenedAt }…` 行 → 新删除 chat.messages.json 行、合并为单行 `├── .session.json          # { title, createdAt, lastOpenedAt, activeSessionId }；activeSessionId 绑定 opencode 会话`（现 L564）。
  2. [短剧Agent平台设计.md](../../../短剧Agent平台设计.md) L598 版本归档区「消费方式」：旧为「replay/hydrate 时读取 chat.messages.json（唯一事实源）重建 UI 状态…」→ 新为「消息历史复用 opencode 原生会话存储（平台不另建消息 JSON，`chat.messages.json` 终态作废，R-001）；`.session.json` 仅持久化 `activeSessionId` 绑定，重开项目经 SDK `session.messages` 回放消息流，其中 unlock 消息对 source 为 idea/background 的 unlock 取 `newIdea`/档案全文，从 `版本/` 目录反查…」（unlock/版本目录反查/UI 角标语义逐字保留）；L557「纯文件持久化、无数据库」总述保留。
  3. [docs/design/短剧Agent平台设计.html](../../design/短剧Agent平台设计.html) L636 目录树 `<pre>` 块：同①HTML 版替换（单行，删 chat.messages.json 行、`.session.json` 行带 activeSessionId 注释）。
  4. [docs/design/短剧Agent平台设计.html](../../design/短剧Agent平台设计.html) L706 版本归档卡片「消费方式」：同②HTML 版替换（unlock 反查语义保留）。
  5. [docs/design/平台全景图.html](../../design/平台全景图.html) L476 会话目录卡片：旧含 `chat.messages.json` → 新为 `.session.json（activeSessionId 绑定 opencode 会话；消息历史存 opencode 原生存储，R-001）`。
  - grep 甄别：进度看板 / 架构模块关系图 / 原型三份 HTML 无 chat.messages.json 文案，不动；版本记录历史条目（feature-808 之前的编年史）含旧表述属历史事实，按版本记录维护规则「不重写历史」保留；本包内文档为自引用，不改。
- [docs/features/README.md](../../README.md) 8xx 表 807 行后增 feature-808 行（业务=项目即会话入口/重开放映回放续聊/他会话事件过滤/404 自愈/惰性建会话；解决偏差=设计书 §7.1 R-001；技术落点列 K1 单字段/K8 恰 2 IPC/DTO 两端镜像/history-replay 纯函数；K9 不触发；溯源=[改编]；状态=✅ 已落地，真机目验 5 项见本记录）。
- [docs/设计现状与偏差清单.md](../../设计现状与偏差清单.md)：§2 偏差表新增并关闭 **B-17**（会话不跨重开 + chat.messages.json 设计与实现不符）；§1.2 测试面刷为 44 文件 461 passed / 1 skipped（含演进链）；§3 反向补录路线表新增 feature-808 ✅ 行。
- [版本记录.md](../../../版本记录.md) `## 2026-10` 顶部追加 2026-10-15 feature-808 编年史条目（背景与授权、K1/K8/K9 卡口声明、13 改 5 新白名单、D-001~D-005、验证实数、R-001 修订索引、真机 5 项待补）。

### AC1–AC10 验收勾选（2026-10-15）

> 标记口径：`[x]` = 已闭环（自动化+真机双证据）。2026-10-16 D-006/D-007 方案 A 修复后，AC4/AC5 经真机复测改 [x]，本包 AC 10/10 闭环。

- [x] **AC1（R1 回放）**：session-continue R1 用例钉死重开自动正序回放文本气泡、loading 凭据出现/消失、无 demo 假数据；无绑定分支零 sessionMessages/零 runtime.start。**真机项 1 已通过**：t18 空白→t182 loading→t195 双气泡同帧、`fakeFramesBeforeReplay=[]` 无假数据闪屏（03-replay.png、reload-trace5.json）。
- [x] **AC2（R2 续聊上下文）**：自动化钉死「同 sessionID、无第二次 createSession」；**真机项 2 已通过**：回放态续发 sid 前后均为 `ses_ebde456…`、listSessions 12→12、两轮记录同属一 sid。
- [x] **AC3（R3 惰性建会话+落盘）**：R3 组件用例 + project-session-binding 7 例；端到端「完全重启后看到对话」由真机项 1 同帧回放坐实。
- [x] **AC4（R4 停止）**：R4 用例钉死「accepted 即 resolve 后停止钮持续可见 → 流式全程可 abort → idle 复位并定稿」新契约；引擎 abort 真机 `{ok:true}`（OD §9 风险 2 未触发）。**D-006 方案 A 修复后真机复测项 4 通过**：停止钮 43ms 首现后持续 13.1s 零断档（修复前仅 57ms 窗口），点击后 76ms idle 复位、文本冻结、sid 不变、会话数不增；abort 后同会话多轮再发成功（D-006、T6 补节）。
- [x] **AC5（R5 切项目隔离）**：subscribe 总次数 1 用例 + 真机网络层常驻仅 1 条 SSE（多轮 netstat 复核）；**D-007 方案 A 修复后真机复测项 5 通过**：A 流式中切无绑定空项目 B，20s/200 帧采样污染帧 0、停止钮未出现、bind=null、右栏始终空态提示；切回 A 内容完整（8546 字含标记）、sid 不变、会话数 12→12（D-007、T6 补节）。
- [x] **AC6（R6 旧项目兼容）**：project-session-binding 旧四字段 openProject 写回五字段用例（title/createdAt 保留、lastOpenedAt 按既有语义刷新、activeSessionId:null、不丢字段）。
- [x] **AC7（R7 404 降级）**：R7 用例钉死 SESSION_NOT_FOUND 后空态 + info toast 一次 + activeSession(null) 清绑定 + 再发惰性建会话成功。
- [x] **AC8（R8 dev-mock）**：dev-mock-api 三桩齐备（openProject/sessionMessages/activeSession），浏览器 mock 态演示气泡不变、新通道有空桩；自动化经组件套件 harness 同源验证，控制台无「不是函数」错误。
- [x] **AC9（工程红线）**：44 文件 **462 passed** / 1 skipped（基线 431 → T6 461 → D-006/D-007 修复净增 1 例 sid=null 边界用例至 462；skipped/failed 不扩大）；三层 typecheck 仅 3 条历史基线错误（canvas-zoom 2 + runtime-client.test L45 1，均零 diff）、本次修复 4 文件零错误；静态契约套件无感通过。
- [x] **AC10（卡口与修订）**：K1 仅 activeSessionId 一处；K8 恰 2 IPC（main.ts L162/L425）+ openProject 返回扩展，preload/global.d.ts/两端 runtime-types 镜像齐备且 DTO 逐字一致；package.json/lock/resources/opencode 零 diff；R-001 设计书 2 处 + 2 份 HTML 镜像 3 处修订完成并逐处登记于本记录 T7。

**AC 总览（2026-10-16 D-006/D-007 修复复测后）**：**AC1–AC10 全部 [x]，10/10 闭环**。AC4/AC5 经用户批复方案 A 修复（独立 generating 态 + renderer 严格归属），自动化 462 passed，真机复测项 4（停止钮 13.1s 持续可达、abort 76ms 复位、sid 不变）、项 5（空项目污染帧 0、切回完整、会话不增）均通过。包状态：**✅ 闭环**（features/README、偏差清单 B-17 同步此口径）。

### 偏差与遗留

- **真机缺陷（✅ 已解决，2026-10-16）**：D-006（R4 停止钮流式期不可达）、D-007（R5 切到无绑定空项目串台）经用户批复方案 A 修复，均为 renderer 状态/过滤建模问题，引擎层（abort、单流、绑定、回放、持久化隔离）真机本就正确。修复后自动化 462 passed、真机复测项 4/5 全通过，实数见一、节「T6 补」；AC4/AC5 已改 [x]，本偏差闭环。
- **测试盲区（✅ 已补齐，2026-10-16）**：R4 已重写覆盖 promptAsync 在 HTTP accepted 即 resolve、流式仍在跑的时间窗（停止钮全程可达断言）；R5 已新增「目标项目 sid=null」边界用例（他会话 streaming + idle 定稿事件均丢弃）。另对 studio-flow.test.tsx 一处旧时序用例做连带修正（发送前 emit 事件在新归属守卫下不成立），diff 仅 import 补 waitFor + 该用例时序对齐，白名单外改动已在「T6 补」记名。
- **过程偏差（已自纠，非契约偏离）**：白名单外 runtime-client.test.ts 被误补桩，T6 自检发现并完整回退，详见 T6 留痕；最终 diff 面与契约 §0 白名单 18 文件逐一对齐。
- **遗留（存量噪声，明确不在本包）**：opencode 侧历史「一轮游」会话不清理（不调 session.delete），平台不展示全局会话列表故仅为存储噪声，按需求 §4.2 留待另议；canvas-zoom.test.tsx 两条 typecheck 历史基线错误为画布缩放包存量，与本包无关。
- 无契约/需求层面的实施期修订，三、修订记录区除预登记 R-001（已在 T7 落地）外当前为空。

## 三、修订记录

- _（实施期偏离契约/需求的修订记本区。R-001 已在一、节预登记；其余当前无。）_
