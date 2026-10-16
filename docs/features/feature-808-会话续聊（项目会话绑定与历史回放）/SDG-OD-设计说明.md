# feature-808 会话续聊（项目会话绑定与历史回放）· 设计说明

> 本篇只描述代码层面的结构决策与影响面；业务语义以[需求规格](./SDG-RE-需求规格.md)为准、接口形状以[契约](./SDG-RE-契约.md)为准。契约 §0 的 D-004（双态 IPC）、D-005（preload 顶层暴露）是本设计的前提，不再重复论证。

## 1. 改动总览

跨 shared / 主进程 / preload / renderer 四层的横切包。改动文件：

```
shared/types.ts                              [小改] K1：ProjectSession 增 activeSessionId?（全文件唯一 diff）
electron/runtime/types.ts                    [小改] K8：回放 DTO 两个 interface（主进程侧镜像端）
src/lib/runtime-types.ts                     [小改] K8：同两个 interface（renderer 侧镜像端，逐字一致）
electron/runtime/client.ts                   [小改] session.messages 类型 + getSessionMessages 封装 + toMessageRecord 纯映射
electron/project/library.ts                  [小改] readActiveSession/setActiveSession；openProject 保留第五字段；createProject 显式 null
electron/main.ts                             [小改] 恰 2 个新 ipcMain.handle；project:open 返回值透传 activeSessionId
electron/preload.ts                          [小改] runtime.sessionMessages + 顶层 activeSession
src/global.d.ts                              [小改] 三处镜像（openProject 返回类型 + activeSession + sessionMessages）
src/lib/history-replay.ts                    [新]   replayMessages 纯函数（H1–H8）
src/lib/history-replay.test.ts               [新]   纯函数套件
src/studio/StudioApp.tsx                     [中改] 绑定生命周期/回放 effect/惰性建会话/单次订阅/事件过滤/handleStop
src/studio/ChatComposer.tsx                  [小改] Props 增 onStop?/historyLoading?；停止钮 + 加载占位
src/dev-mock-api.ts                          [小改] 三桩（openProject 返回值、runtime.sessionMessages、顶层 activeSession）
src/test/runtime-session-messages.test.ts    [新]   主进程 node 侧：toMessageRecord / getSessionMessages（fake SDK 注入）
src/test/project-session-binding.test.ts     [新]   主进程 node 侧：library 绑定读写 + openProject 五字段（tmpdir 真文件）
src/studio/session-continue.test.tsx         [新]   组件八条（契约 §6.3）
```

- package.json / package-lock.json / `resources/opencode/**` / projection.ts / buildPromptBody：**零 diff**（K9 与契约 §1.2）。
- 不新增图片/图标资产：停止钮为内联 SVG（实心圆角方块），配色复用既有 Tailwind token（`bg-bad` 或中性 `bg-[#1E2233]`，编码时与发送钮视觉层级取齐，不引新色板）。
- 不新增 npm 依赖；不新增 IPC 订阅推送（回放是请求-响应，复用 invoke）。

## 2. 主进程结构

### 2.1 client.ts：getSessionMessages 与 toMessageRecord

- `SdkHandle.session` 的接口类型补 `messages`（`get` **不写**——全包无调用方，契约 §5.1 明确避免死代码；编码后若确认无引用即不引入）。
- `getSessionMessages` 与既有 `abortSession`（L122–128）同构：`requireSessionId` 空白校验 → `ensureReady` → SDK 调用 → `result.error || !result.data` 时 `throw mapHttpError(result, 'SESSION_NOT_FOUND')`（404 fallback 码与 abort 先例一致）。
- `toMessageRecord(raw)` 放在 client.ts 同文件导出（纯映射，node 侧测试直接 import），不新建目录/模块——仅本文件一处消费，避免过度抽象。规则照契约 §5.2：role 归一（非 assistant 即 user 兜底）、仅保留 `type:'text'`、startedAt 取 `time.start` number、ignored/synthetic 布尔透传、其余 part 类型整体丢弃。

### 2.2 library.ts：绑定读写与五字段定型

- 新增两个导出函数，签名照契约 §5.4，均以 **dir 显式入参**（library 层不读 currentDir——currentDir 判定留在 main handler，与 openProject 现有分层一致：library 只对给定 dir 做路径内操作）：
  - `readActiveSession(dir)`：直接 `fsp.readFile(sessionInfoFile(dir))` + JSON.parse，取 `typeof info.activeSessionId==='string' ? info.activeSessionId : null`；文件缺失/损坏返 null（不走 enqueue，纯读）。
  - `setActiveSession(dir, sessionId)`：`enqueue` 内读-改-写：读出旧 info（缺失按 `{}`），**仅替换 activeSessionId**，显式重建 `{dir, title, createdAt, lastOpenedAt, activeSessionId}` 五字段；`lastOpenedAt` 取旧值不刷新（绑定写不是打开项目）。
- `openProject` L145–151 重建对象加第五字段（契约 §5.4 代码块逐字照抄）；返回类型由 `{ ok: true }` 改 `{ ok: true; activeSessionId: string | null }`，返回刚写回的值（与文件终态一致）。
- `createProject` L108–113 初始化对象显式加 `activeSessionId: null`；返回值仍 `{ dir }`（创建链路不需要绑定，renderer 创建后随 projectId 变化走读通道）。
- 路径硬边界：setActiveSession 复用 openProject 同款校验（`path.dirname(resolved)===root && basename startsWith 'project-'`），抽不抽 helper 取最简——校验逻辑仅两行、两处使用，可内联一个本地 `assertProjectDir(dir)`（若抽出则只在 library.ts 内，不跨文件）。

### 2.3 main.ts：两 IPC 落点

- `runtime:session:messages`：插在现有 session IPC 区（L379–410 的 list/abort/delete 旁），`withRuntime` 包裹；参数兼容裸串与 `{sessionId}`（照契约 §5.3 (1)，与 abort 现有「裸串」先例保持兼容）。
- `project:active-session`：插在 project:open handler 旁（L128–150 区），**不经 withRuntime**。读态无参：`getActiveProjectDir()` 抛错（current.ts 的「当前没有打开的项目」）被 catch 后返 `{sessionId:null}`——注意 current.ts 抛的是 INVALID_ARGUMENT，读态必须吞掉返 null（契约 §5.3）；写态无项目则让错误抛给 renderer（但实际 renderer 只在有项目时才发 prompt，写态无项目属调用方 bug，INVALID_ARGUMENT 可见即可）。
- project:open handler 末尾 `return res` 改为透传 library 返回（res 已含 activeSessionId），中间 settleAll/reset/recoverPending/广播 canvas:changed 一行不动。

## 3. renderer 结构（StudioApp 会话生命周期）

### 3.1 状态与信号挂载

新增状态最小集（契约 §4.1）：`activeSessionIdRef`（事实源）、`historyLoading`（驱动 composer disabled/占位）；不新增绑定 state（ref 不驱动渲染，发送/过滤都在事件回调内读 ref 即可）。

**唯一装载信号 = canvas projectId 变化**。现有 canvas effect（L134–163）已有两处 projectId 到达点：onChange 回调（L136–144，内含 projectIdRef 切项目检测 L140–143）与 `canvas.get()` 初值（L145–151）。本包在这两处统一汇入一个 `onProjectSessionChange(projectId)`（useCallback，组件内函数，不抽文件）：

```
onProjectSessionChange(pid):
  1. setItems([])（仅 !devMockActive；dev-mock 保持 demoChatItems，见 §3.5）
  2. streamRef.current = null; setStream(null)
  3. activeSessionIdRef.current = null
  4. if (!pid) { setHistoryLoading(false); return }
  5. const token = ++projectSessionSeqRef.current
  6. setHistoryLoading(true)
  7. const bind = await window.api.activeSession()
  8. if (token !== projectSessionSeqRef.current) return        // 迟到结果丢弃
  9. activeSessionIdRef.current = bind.sessionId
 10. bind.sessionId ? await loadReplay(bind.sessionId, token)
                    : setHistoryLoading(false)
```

- 初值路径（get 返 `projectId:''` 空画布，main.ts L462–476 事实）天然走步骤 4 空态结束，不会为「从未打开项目」读绑定/拉 runtime。
- ProjectNav 点项目/新建后，主进程 project:open → canvasStore.reset → 广播 canvas:changed（main.ts L137–149 现有链路），renderer 收到新 projectId 即触发装载——**openProject 返回值不被 StudioApp 消费**（消费方只有 ProjectNav 的 refresh）；其携带 activeSessionId 属契约保留的同步便利与 IPC 形状完整性，AC6/openProject mock 断言其存在即可。
- token 用递增序号（与 feature-003 selectStage0State 的 alive/seq 同款做法），不用 abort 信号（window.api 不支持取消，序号丢弃最简）。

### 3.2 loadReplay 与 404 降级

照契约 §4.2 伪码。两个细节定死：

- 过期检查（token 比对）同时包住成功与 catch/finally，确保快速切项目后迟到的 404 清绑定不会清到新项目。
- info toast 复用现有 `setToast({tone:'info',text})`（StudioApp L107/L541–553，2400ms 自动消失，data-toast 既有），**不新增 toast 设施**；「同一次打开只提示一次」由降级路径本身保证（404 后绑定已清空，不会再对同一会话第二次请求 messages）。
- 非 404 错误走既有 error 条（`setError`，ChatComposer 现有错误展示），不锁死：绑定保留、composer 在 historyLoading 复位后可发送。

### 3.3 handleSend / handleStop / SSE 过滤

- handleSend 替换 L174–194：乐观气泡与 status→start 保留；`ensureSubscribedOnce`（§3.4）；无绑定才 createSession → `activeSession(s.id)` 回写 → ref 赋值；有绑定零 createSession；promptAsync 通道不变。建会话成功但回写失败：catch 内 setError 但**不阻断**本轮（sid 已在 ref，promptAsync 照常）——finally 仍 setSending(false)。
- handleStop：`const sid = activeSessionIdRef.current; if (sid) await window.api.runtime.abortSession(sid)`；ref 空 no-op。sending 复位完全交给既有事件链（idle/error 定稿 → 现有 onEvent L122–127/finally 逻辑），handleStop 不本地复位。
- onEvent 过滤照契约 §4.4：`if (sid && evSid && evSid !== sid) return`。**sid 为 null（切项目清空中/未绑定）时不过滤**——未绑定时不会有属于自己的流式，runtime.connected 等无 sessionId 状态事件照常通过；切项目瞬间旧会话事件到达时 ref 已被步骤 3 清空，这些事件会穿过过滤，但此时 stream/items 刚被清空、且它们只会生成/更新 stream 临时态——为堵住「切项目空窗期 A 的事件在 B 空态上闪一下」，过滤再加一道：**projectId 非空但 activeSessionIdRef 为 null 的装载窗口内，带 sessionId 的事件同样忽略**（即条件放宽为 `if (evSid && sid !== evSid) return`，仅当事件会话与当前绑定精确相等才放行；runtime 状态类无 evSid 不受影响）。组件测试「A 生成中立即切 B」用例断言此窗口无 A 内容闪现。

### 3.4 SSE 订阅：全程一次

- `subscribedRef = useRef(false)`；`ensureSubscribedOnce` 内若已订阅直接返回，否则 `window.api.runtime.subscribe()`（**无参**）置 true。调用时机：handleSend 确保 runtime 之后（与现状「先起 runtime 再订阅」的时序一致）；回放路径**不主动订阅**（纯拉历史不需要事件流，AC1 无绑定不拉 runtime 之外，有绑定回放也只发 sessionMessages 一条 invoke，订阅推迟到首次发送）。
- unmount cleanup 增 unsubscribe（现有 onEvent effect 的 cleanup 模式同款）；订阅在组件整个生命周期只有一条流，切项目/多轮发送不重订阅（契约 §6.3「subscribe 总次数 1」断言）。
- onEvent effect 保持 mount 一次 `[]`（现状 L115–131），回调内读 ref，无需重绑定。

### 3.5 dev-mock 分支

- StudioApp 现有 `devMockActive` 分支（L94 items 初值 demoChatItems）保留；`onProjectSessionChange` 步骤 1 的清 items 仅在非 devMock 执行，mock 态永不切到回放空态（契约 §4.6）。mock 下不调 activeSession/sessionMessages 也可（初值即 demo，装载函数在 devMock 分支提前 return），但桩必须齐备（AC8 防「api 不是函数」）。
- dev-mock 三桩照契约 §4.6：openProject 返 `{ok:true, activeSessionId:null}`、runtime.sessionMessages 返 `[]`、顶层 activeSession 恒返 `{sessionId:null}`。

### 3.6 ChatComposer

- Props 在现 L90–99 基础上仅增两个**可选** prop：`onStop?: () => void`、`historyLoading?: boolean`（不传时组件行为与现状逐位一致，stage0/其他既有挂载点零改动）。
- 发送钮区（L373–384）条件渲染：`sending && onStop` → 停止钮（`data-testid="chat-stop"`，方块 SVG，点击 onStop）；否则发送钮（`data-testid="chat-send"`，disabled 增 `historyLoading`）。
- 加载占位：消息区顶部/空态处 `historyLoading` 时渲染 `data-testid="chat-history-loading"` 的轻量占位（复用现有空态样式 token，不做骨架屏资产）；**占位与 items 可并存**（回放 setItems 与 setHistoryLoading(false) 同批，但 loading 期 items 已先清空，视觉上不会与 demo 气泡并存）。

## 4. 与既有代码的接触面（已逐一核实）

| 既有面 | 现状事实 | 本包影响 |
|---|---|---|
| shared/types.ts ProjectSession L307–312 | 四字段；ChatMessage L267–277 旧形态 | 仅加 `activeSessionId?: string \| null`；不向 ChatMessage 扩散（K1） |
| library.openProject L137–154 | enqueue 内读-改-写**重建四字段对象** | 必改：显式第五字段，否则切项目丢绑定（本包最关键存量陷阱）；返回值加 activeSessionId |
| main.ts canvas:get L462–476 | 启动经 currentDir 直读画布恢复项目，不经 openProject | 零改动；此事实是 D-004 根因，renderer 装载只挂 canvas projectId 信号 |
| main.ts project:open L128–150 | return res（res 现 `{ok:true}`） | res 形状扩展后直接透传；其余链路零改动 |
| current.ts getActiveProjectDir | 无 currentDir 抛 INVALID_ARGUMENT | 读态 IPC catch 该错返 `{sessionId:null}`；写态不 catch |
| StudioApp handleSend L174–194 | 每轮 createSession + subscribe(session.id) | 整体替换为惰性建/复用 + 单次订阅 |
| StudioApp onEvent effect L115–131 | mount 一次 []，定稿只落 text（L122–127） | 回调首行加会话过滤；定稿逻辑零改动 |
| StudioApp canvas effect L134–163 | onChange 已有 projectIdRef 切项目检测；get 初值 | 两处汇入 onProjectSessionChange；检测模式保留复用 |
| StudioApp toast L107/L541–553 | {tone,text} + 2400ms 自动消失 + data-toast | 404 弱化提示直接复用，零新增设施 |
| ChatComposer Props L90–99 / 发送钮 L373–384 | 9 个 props；纸飞机钮 disabled=sending\|\|!draft | +2 可选 prop；条件渲染停止钮；disabled +historyLoading |
| preload 项目方法 L13–15 | **顶层**暴露（window.api.openProject），无 project 命名空间 | 顶层增 activeSession（D-005）；runtime 块内增 sessionMessages |
| global.d.ts L21–25 / L29–44 | openProject `Promise<{ok:true}>`；runtime 块 14 方法 | 三处镜像；DTO import 补 RuntimeSessionMessageRecord |
| runtime-types 两端 | renderer 12 错误码；主进程 14 码（多 PATH_ESCAPE_DENIED/GATE_TIMEOUT） | 各加 2 个 DTO interface 逐字一致；**错误码零增**，两端差集维持现状 |
| dev-mock-api.ts L284/L287–302 | openProject `{ok:true}`；runtime mock 无 sessionMessages | 三桩；mock 整体仍是顶层结构 |
| studio-flow.test.tsx L58 / window-titlebar-integration.test.tsx L45 | openProject mock 返 `{ok:true as const}` | 连带补 `activeSessionId:null`（契约 §6.4 已记名的合理 diff） |
| beforeStopHook（manager.ts L265） | 退出时 abort-all + 关 SSE | **零改动**；abort 不删历史，与续聊无冲突 |
| projection.ts / buildPromptBody / RUNTIME_ERROR_NAMES | 流式投影与白名单/12 错误码名 | 零 diff（收尾 git diff 证据） |

## 5. 关键边界决策

1. **一个 projectId 信号覆盖三个入口**：启动恢复（canvas.get 初值）、左栏切换（canvas:changed 广播）、新建串联（openProject → reset → 广播）汇入同一 onProjectSessionChange；不监听 openProject 返回值、不新增导航事件订阅——信号源头只有画布，避免双信号不同步。
2. **绑定事实源只在主进程文件，ref 是缓存**：renderer 的 activeSessionIdRef 每次 projectId 变化都经读通道重建，不信任跨切换残留；404 降级时先写盘清空再改 ref（写盘失败也改 ref——本轮 UI 必须脱离死绑定，下次打开读盘仍是旧 id 会再走一次 404 降级，幂等可接受）。
3. **回放与流式定稿同构**：历史气泡只含文本（H1–H8），不回放 reasoning/tool；这不是功能裁剪而是一致性要求——流式定稿本就只落 text，两条投影路径产出必须可互换（用户无法区分某气泡来自回放还是当轮）。
4. **回放不订阅、不预启 runtime**：无绑定项目打开时主进程零 opencode 进程（AC1）；有绑定回放经 sessionMessages 的 withRuntime 惰性自启（看历史必须起 runtime 是既有架构约束，可接受）；SSE 订阅推迟到首次发送。
5. **openProject 返回值扩展但不消费**：保留扩展是 IPC 形状完整性（打开动作的响应理应包含打开后的绑定事实），renderer 统一走读通道拿绑定，杜绝「启动/点击两条代码路径」。
6. **写绑定不刷 lastOpenedAt**：首条 prompt 回写是高频动作，刷新 lastOpenedAt 会污染左栏项目排序（列表按 mtime/打开时间排）；绑定写对用户是不可见的内部状态。
7. **停止钮复用 error 色但不新增交互语义**：abort 是既有通道，按钮只是把既有 abortSession 能力在发送中暴露；不做「停止并删除本轮」等分叉。
8. **toMessageRecord 默认不打码**：这是用户本人会话的回放（契约 §5.2.4）；如评审要求打码须回契约，本包不临场加。

## 6. 测试落点

| 套件 | 位置惯例（已核实） | 覆盖 |
|---|---|---|
| 纯函数 | 新 `src/lib/history-replay.test.ts`（同目录先例 chat-runtime.test.ts） | H1–H8 全用例（契约 §6.1） |
| 主进程 client | 新 `src/test/runtime-session-messages.test.ts`（先例 runtime-client.test.ts：fake SDK 句柄注入，不连真进程） | toMessageRecord 裁剪/归一；getSessionMessages 成功/404/空白 id |
| 主进程 library | 新 `src/test/project-session-binding.test.ts`（先例 canvas-store.test.ts：vi.mock('electron') + tmpdir 真文件） | 旧四字段→五字段保留；绑定读写/清空；串行写不互覆盖；lastOpenedAt 不被绑定写刷新；无文件/损坏容错 |
| 组件 | 新 `src/studio/session-continue.test.tsx`（先例 studio-flow.test.tsx：window.api 整体桩 + emitRuntime/emitCanvas harness） | 契约 §6.3 八条；harness 的 api 桩需含 activeSession/sessionMessages/abortSession/listSessions/deleteSession 等本包会触达的全部方法 |
| 连带修改 | studio-flow.test.tsx L58、window-titlebar-integration.test.tsx L45 | openProject mock 补字段；既有断言一行不动 |

- 组件 harness 关键设计：`activeSession` 用可切换的 vi.fn（默认按 canvas projectId 返回绑定表），`sessionMessages` 按 id 返回记录夹具；切项目隔离用例通过 emitCanvas 推不同 projectId 的画布驱动（与真实广播链路同构）。
- StrictMode effect 双调用由序号 token 天然覆盖；订阅一次用例可包 StrictMode 双断言。
- 真机目验（T6，手动）：①完全重启应用后右栏回放重启前对话；②回放后续发，主进程日志/网络证据为同一 sessionID；③真机让 Agent 记住一个词，重开追问验证上下文连续；④abort 后同会话再发 prompt（opencode 真机行为，契约 §4.5 列为本包必须真机验证项）；⑤A 生成中切 B 无串台。

## 7. 视觉/回归基线

- typecheck：开工 T1 实测冻结；当前已知仅 2 条 canvas-zoom.test.tsx L13/L90 历史基线错误（非本包文件），红线零新增。
- node/preload 双工程 tsc 退出码 0（DTO 两端逐字一致由双端编译共同保证）。
- 全量 vitest：基线 **40 文件 431 passed / 1 skipped**（skip=T8-4 需 ARK Key）；T1 开工复测回填实数；本包预计净增 4 个测试文件（纯函数 1 + node 侧 2 + 组件 1，上表 4 行，T6 收尾预期 44 文件 = 40 + 4），收尾回填新增后总数。
- 静态契约套件（architecture renderer 禁直连、mcp-pure-tools、agent-profiles、runtime-projection 等）：本包不改投影/prompt/红线面，应全部无感通过；新 IPC 主进程收敛（renderer 只见 preload 方法）不触 architecture 红线。

## 8. R-001 设计书修订与 HTML 镜像

- 事实源 [短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §7.1：L564（目录树 `chat.messages.json` 注释行）与 L599（版本归档区 replay/hydrate 描述）改为「消息历史复用 opencode 原生会话存储；`.session.json` 仅持久化 activeSessionId；UI 历史经 session.messages 回放」；L557 附近「纯文件持久化、无数据库」总述保持成立。
- HTML 镜像 5 份（docs/design/ 下，Glob 已核）：其中**设计书镜像** `短剧Agent平台设计.html` 与**平台全景图.html** 若含 chat.messages.json 同文案则随事实源做同文案替换（人读镜像的职责是与事实源一致）；其余 3 份（进度看板/架构模块关系图/原型）仅在确有该文案时改，不做无依据扩散。每份改动记 R-001 修订清单（文件 + 位置 + 旧新文案）。
- 修订动作排在 T7 治理收尾（代码落地、真机目验通过后），避免文档先行描述未验证行为。

## 9. 风险与备选

| # | 风险 | 评估 | 处置 / 备选 |
|---|---|---|---|
| 1 | 绑定写盘崩溃窗口：会话已建、`.session.json` 未写时进程退出 | enqueue 异步写，窗口客观存在 | 需求 §3.2 已接受：重开为未绑定空态，下一条新建会话，无错误数据；不做同步写/重试（代价不值） |
| 2 | abort 后同会话 prompt 被 opencode 拒绝或行为异常 | 契约 §4.5 要求真机验证，SDK 层面无禁止但未实测 | T6 真机目验项；若受限，备选=abort 后下一条发送走「新建会话并回写」（同 R3 惰性建路径，UI 无感知差异，仅上下文从新轮开始），该备选不需新通道（复用 createSession+activeSession 写态），但须回本包变更记录记名 |
| 3 | 快速切项目时迟到回放覆盖新右栏 | 两个异步链路（读绑定 + messages）均可能迟到 | 单调序号 token，每个 await 后比对，过期连 finally 都不动 loading；组件测试构造 A 慢 B 快夹具 |
| 4 | 切项目空窗期（ref 已清空）旧会话事件闪现 | §3.3 过滤放宽后已堵：无精确匹配即丢弃带 sessionId 事件 | 组件用例「A 生成中立即切 B」断言 B 全程无 A 文本；runtime 状态类事件无 sessionId 不受影响 |
| 5 | 回放期间用户发送造成气泡顺序竞态 | historyLoading 时 composer disabled | 契约 §4.2 已锁 disabled 公式；测试断言 loading 中发送钮禁用 |
| 6 | SDK 真实 Part 联合类型含本包未知的新 part 类型 | opencode 升级可能扩类型 | toMessageRecord 白名单式（仅 type==='text' 保留），未知类型天然丢弃；H8 容错保证坏数据不抛错 |
| 7 | 回放消息量巨大导致右栏一次性渲染卡顿 | 长会话可能数百轮 | 本包不做虚拟滚动（现状流式长会话同样全量渲染，无既有分页机制）；若真机发现卡顿，另开性能包，不在本包临场扩面 |
| 8 | enqueue 串行队列中 openProject 与 setActiveSession 交叉 | 同一写队列天然串行；setActiveSession 在 openProject 之后入队时读到的是已含五字段的新文件 | library 测试显式覆盖「open 后立即 set」交叉序列；不另加锁 |
| 9 | dev-mock 与真实 API 形状漂移 | 三桩手工维护 | AC8 兜底；类型上三桩受 global.d.ts 约束，形状错会 typecheck 报错 |
| 10 | 工作树混合存量（feature-807/画布缩放/Markdown 气泡未提交改动并存） | 现状 | T7 收尾 git diff 按文件白名单核对，只认本包 15 个文件的 diff；基线测试在混合树上跑（与 feature-003 收尾同做法） |
