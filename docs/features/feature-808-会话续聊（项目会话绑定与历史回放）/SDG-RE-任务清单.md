# feature-808 会话续聊（项目会话绑定与历史回放）· 任务清单

> 前置：本包 **K1 + K8 触发、K9 不触发**（[契约](./SDG-RE-契约.md) 头部卡口声明）。K1 单字段与 K8「恰 2 个新 IPC + openProject 返回扩展 + 两端镜像」的**具体范围已在契约 §2/§5 逐字钉死，用户评审批准本任务包即视为对该 K1/K8 变更的明确授权**；编码中任何突破「单字段 / 两通道 / 零新依赖 / 错误码不扩」的需要，立即停手回契约评审，不得临场扩面。
>
> 顺序约束：T1 基线冻结（起草时已实测，开工只复核）→ T2 K1 单字段先行 → T3 主进程/镜像 K8 面（T3a→T3e 同任务内顺序提交，两端 DTO 先落）→ T4 renderer（T4a 纯函数先行）→ T5 测试随 T3/T4 跟进 → T6 全量回归 + 真机目验 → T7 治理收尾（R-001 文档修订必须在代码与真机验证通过后才动）。

## 0. 上下文加载清单（工作围栏）

- 事实源：设计书 [短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §7.1（L553–607；R-001 点 L564/L599）、§5（runtime/会话 IPC 表）；Design 形态事实源 [MiniMax Design功能与架构参考.md](../../research/MiniMax%20Design功能与架构参考.md) §1.2/§2.1（L21/L28/L128–142）；[需求规格](./SDG-RE-需求规格.md)、[契约](./SDG-RE-契约.md)、[设计说明](./SDG-OD-设计说明.md)。
- 既有事实（编码前在围栏内复读，不再扩查）：
  - [shared/types.ts](../../../shared/types.ts) `ProjectSession`（L307–312 四字段；本包唯一 K1 触点）；
  - [client.ts](../../../electron/runtime/client.ts) `SdkHandle.session`（L56–66）、`abortSession`（L122–128 封装先例）、import L18；
  - [main.ts](../../../electron/main.ts) project:open（L128–150）、session IPC 区（L379–410）、canvas:get（L462–476，D-004 事实源）、withRuntime（L230–246）、isRecord/makeRuntimeError；
  - [library.ts](../../../electron/project/library.ts) sessionInfoFile（L14–16）、createProject（L90–118 四字段初始化）、openProject（L121–155 重建四字段 = 最关键存量陷阱）、enqueue 写队列；
  - [current.ts](../../../electron/project/current.ts) `getActiveProjectDir()`（无项目抛 INVALID_ARGUMENT）；
  - [preload.ts](../../../electron/preload.ts) L13–15 项目方法**顶层**暴露（D-005）、L20–49 runtime 块；[global.d.ts](../../../src/global.d.ts) L21–25/L29–44；
  - [StudioApp.tsx](../../../src/studio/StudioApp.tsx) items（L94）、onEvent effect（L115–131）、canvas effect（L134–163）、handleSend（L174–194）、toast（L107/L541–553，info tone 可直接复用）；
  - [ChatComposer.tsx](../../../src/studio/ChatComposer.tsx) Props（L90–99 现 9 个）、发送钮（L373–384）；
  - [dev-mock-api.ts](../../../src/dev-mock-api.ts) L284/L287–302；两端 runtime-types（[主进程](../../../electron/runtime/types.ts) 14 码 / [renderer](../../../src/lib/runtime-types.ts) 12 码，错误码零增）。
- 改动面白名单（共 **13 改 + 5 新**，全包只许这些代码文件出现 diff）：

| | 文件 | 性质 |
|---|---|---|
| 1 | shared/types.ts | K1 单字段 |
| 2 | electron/runtime/types.ts | K8 DTO 主进程端 |
| 3 | src/lib/runtime-types.ts | K8 DTO renderer 端 |
| 4 | electron/runtime/client.ts | messages 类型 + getSessionMessages + toMessageRecord |
| 5 | electron/project/library.ts | 绑定读写 + 五字段定型 |
| 6 | electron/main.ts | 恰 2 新 IPC + openProject 透传 |
| 7 | electron/preload.ts | runtime.sessionMessages + 顶层 activeSession |
| 8 | src/global.d.ts | 三处镜像 |
| 9 | src/lib/history-replay.ts | **新** replayMessages 纯函数 |
| 10 | src/lib/history-replay.test.ts | **新** H1–H8 |
| 11 | src/studio/StudioApp.tsx | 会话生命周期中改 |
| 12 | src/studio/ChatComposer.tsx | +2 可选 prop/停止钮/加载占位 |
| 13 | src/dev-mock-api.ts | 三桩 |
| 14 | src/test/runtime-session-messages.test.ts | **新** node 侧 client |
| 15 | src/test/project-session-binding.test.ts | **新** node 侧 library |
| 16 | src/studio/session-continue.test.tsx | **新** 组件八条 |
| 17 | src/studio/studio-flow.test.tsx | 仅 openProject mock 补字段（L58 区），断言不动 |
| 18 | src/studio/window-titlebar-integration.test.tsx | 仅 openProject mock 补字段（L45 区），断言不动 |

- 治理文档（T7）：docs/features/README.md、docs/设计现状与偏差清单.md、版本记录.md、设计书 §7.1（L564/L599）+ docs/design/ 下含同文案的 HTML 镜像、本包 SDG-AI-变更记录.md。
- 红线（契约 §8，越界即停）：
  - `git diff shared/` 只许 ProjectSession 一处；`git diff package.json package-lock.json resources/opencode/` 必须为空；
  - `git diff electron/runtime/projection.ts`、buildPromptBody 所在文件、RUNTIME_ERROR_NAMES 必须为空（投影/prompt/错误码零改）；
  - grep `ipcMain.handle` 新增计数恰为 2；不新增 IPC 订阅推送（回放走 invoke）；不新增 npm 依赖、不引 zod；
  - 不动 canvas/gate/brief/manifest/asset/comfy 任何既有通道；beforeStopHook（manager.ts L265）零改动；
  - 不做需求 §4.2 排除项（会话列表 UI/手动新建/删除/切换会话/虚拟滚动/多会话绑定/回放 reasoning·tool）。

### T1 · 基线实测冻结

- **起草时实测（2026-10-15，已冻结）**：`npm run test:run` = **40 文件 431 passed / 1 skipped / 0 failed**（skip=T8-4 需 ARK Key）；`npm run typecheck` 退出码 2，仅 2 条历史基线错误 canvas-zoom.test.tsx L13（TS2322）/L90（TS6133），均非本包文件；`tsc -b tsconfig.node.json` 与 `tsc -p tsconfig.preload.json --noEmit` 退出码均 0。
- 开工编码第一件事：原样复跑三条命令复核。数字若漂移（passed 减少/错误增多且非本包新改文件），**先停下排查混合工作树**（现状并存 feature-807/画布缩放/Markdown 气泡三路未提交改动），不得在漂移基线上开工。
- 完成标准：复核数字与上一致并回填变更记录 T1 行；不写任何产品代码。

### T2 · K1：shared/types.ts 单字段

- `ProjectSession`（L307–312）增加 `/** feature-808：… */ activeSessionId?: string | null`（契约 §2 代码块逐字照抄，含注释）。
- 不加共享函数/常量；不向 ChatMessage 等旧形态扩散；不动 shared/ 其余任何文件。
- 完成标准：`git diff shared/` 仅此字段一处；node 端 tsc 不新增错误。

### T3 · 主进程 / preload / 镜像（K8 面）

按下列子序在同一任务内完成，每步自带编译验证：

1. **T3a 两端 DTO**：electron/runtime/types.ts 与 src/lib/runtime-types.ts 各加 `RuntimeSessionMessagePart` / `RuntimeSessionMessageRecord` 两个 interface（契约 §5.2 代码块），**两端逐字一致**；错误码集零增（两端 14/12 差集维持现状）。
2. **T3b client.ts**：import 类型补 `Message`；`SdkHandle.session` 补 `messages` 方法类型（**不补 get**——无调用方，契约 §5.1 明确避免死代码）；新增 `getSessionMessages(sessionId)`（照 abortSession L122–128 的 requireSessionId→ensureReady→mapHttpError('SESSION_NOT_FOUND') 先例）；`toMessageRecord(raw)` 在**同文件导出**（不新建模块），规则照契约 §5.2：role 非 assistant 即 user 兜底、仅留 `type:'text'`、startedAt 取 `time.start` number、ignored/synthetic 透传、其余 part 整体丢弃、不打码不截断。
3. **T3c library.ts**：新增 `readActiveSession(dir)`（直接 readFile+parse，缺失/损坏返 `{sessionId:null}`，不走 enqueue）与 `setActiveSession(dir, sessionId)`（enqueue 内读-改-写，显式重建五字段对象，保留旧 lastOpenedAt 不刷新）；两者均 **dir 显式入参**；路径硬边界复用 openProject 同款两行校验（可内联本地 `assertProjectDir`，不出文件）；**openProject L145–151 重建对象必须加第五字段**（契约 §5.4 代码块逐字），返回类型改 `{ ok:true; activeSessionId:string|null }` 并回传刚写回的值；createProject L108–113 初始化显式加 `activeSessionId:null`，返回值仍 `{dir}`；listProjects 不动。
4. **T3d main.ts**：新增恰 2 个 handler——`runtime:session:messages`（插 session IPC 区 L379–410 旁，withRuntime 包裹，兼容裸串与 `{sessionId}`，空白/非法抛 INVALID_ARGUMENT）、`project:active-session`（插 project:open 旁，**不经 withRuntime**：无参读态经 getActiveProjectDir+readActiveSession，无项目 catch INVALID_ARGUMENT 返 `{sessionId:null}` 不抛；写态校验 `{sessionId:string|null}` 后 getActiveProjectDir+setActiveSession，无项目不 catch；不接受 dir 入参）；project:open handler 末尾改为透传 library 新返回值，settleAll/reset/recoverPending/广播链路一行不动。
5. **T3e preload + global.d.ts**：preload 顶层（L13–15 旁）加 `activeSession(sessionId?)`（undefined 不包对象，否则包 `{sessionId}`）；runtime 块（L24–30 旁）加 `sessionMessages(sessionId)`；import 补 RuntimeSessionMessageRecord。global.d.ts 三处镜像：openProject 返回类型扩展、顶层 `activeSession` 签名、runtime 块 `sessionMessages` 签名 + import 补类型。
- 完成标准：`grep ipcMain.handle`（对本包 diff）新增恰 2；node/preload 双 tsc 退出码 0；renderer typecheck 不新增错误。

### T4 · renderer（回放纯函数 + 会话生命周期）

1. **T4a history-replay.ts（新，先落）**：照契约 §3 实现 `replayMessages`（import `type { ChatItem }` from '../studio/ChatComposer'）与 ReplayMessageRecord/ReplayPart 类型；H1–H8 逐条落实——正序不重排；user 聚合未忽略文本 part（不认 hasPartTime）；agent 仅聚合带 number startedAt 且未忽略文本，输出带 `agent:'showrunner'`；空轮双向丢弃；输出只含 id/role/text（agent 多一个 agent 字段），禁带 brief/trace；零 fs/window/Date/Math.random、不 mutate；坏数据/非数组不抛错。
2. **T4b StudioApp.tsx（中改）**：
   - 新增 `activeSessionIdRef`、`historyLoading` state、`projectSessionSeqRef`（序号 token）、`subscribedRef`；**不**新增会话列表/多会话 state；
   - canvas effect 两处 projectId 到达点（onChange L136–144 复用既有 projectIdRef 切项目检测、canvas.get 初值 L145–151）统一汇入组件内 `onProjectSessionChange(pid)`，照 OD §3.1 十步伪码（清 items/stream/ref → 空 pid 结束 → 序号自增 → historyLoading → 顶层 `window.api.activeSession()` 读态 → 过期丢弃 → ref 赋值 → 有绑定 loadReplay / 无绑定结束）；**devMockActive 分支提前 return 且不清 demoChatItems**；
   - `loadReplay(sid, token)` 照契约 §4.2：成功 `setItems(replayMessages(records))`；404 先 `await activeSession(null)` 再清 ref/items + 复用既有 `setToast({tone:'info',…})` 一次弱化提示；非 404 走既有 setError 不锁死；token 比对包住成功/catch/finally；
   - 替换 handleSend L174–194：乐观气泡与 status→start 保留；ensureSubscribedOnce；无绑定才 createSession→`activeSession(s.id)` 回写（回写失败 setError 不阻断本轮）→ref 赋值；有绑定零 createSession；promptAsync 通道与入参形状不变；
   - handleStop：ref 有 sid 才 `runtime.abortSession(sid)`，空 no-op；**不本地复位 sending**（交给既有 idle/error 事件链）；
   - onEvent effect（mount 一次 []）回调首行过滤收紧为 `const evSid='sessionId' in ev ? ev.sessionId : undefined; if (evSid && evSid !== activeSessionIdRef.current) return`（精确匹配才放行，堵装载空窗期 A 事件闪现；无 sessionId 的 runtime 状态事件不受影响）；定稿逻辑零改动；
   - 订阅：ensureSubscribedOnce 内无参 `runtime.subscribe()` 全局一次（首发送确保 runtime 之后），回放路径不订阅；unmount cleanup 增 unsubscribe。
3. **T4c ChatComposer.tsx**：Props 仅增 `onStop?`、`historyLoading?` 两个可选 prop（既有 9 个与其他挂载点零改动）；发送钮区条件渲染——`sending && onStop` 出 `data-testid="chat-stop"`（内联实心方块 SVG，复用既有 Tailwind token，不引资产），否则维持 `data-testid="chat-send"` 且 disabled 公式增 historyLoading；消息区渲染 `data-testid="chat-history-loading"` 轻量占位（复用空态 token，不做骨架屏），允许与 items 同帧但 loading 期 items 已清空。
4. **T4d dev-mock-api.ts 三桩**：顶层 `openProject` 返 `{ok:true as const, activeSessionId:null}`；runtime 块加 `sessionMessages: () => resolve([])`；顶层加 `activeSession: () => resolve({sessionId:null})`；三桩受 global.d.ts 类型约束。
- 完成标准：renderer typecheck 不新增；stage0 等 ChatComposer 既有其他挂载点行为逐位不变；浏览器 mock 态控制台无「不是函数」错误。

### T5 · 测试（4 新套件 + 2 处连带夹具）

1. **src/lib/history-replay.test.ts（新）**：契约 §6.1 全覆盖——空/非数组；单 user 单/多 part 拼接（含无 time 用户 part）；user 空/ignored/synthetic 丢弃；assistant 带 startedAt 聚合、无 startedAt 文本不进、纯 reasoning/tool/abort 空轮无气泡；u/a 混排正序、id 取 info.id、agent 字段与无 brief/trace；坏记录三类不抛错；入参不被 mutate。
2. **src/test/runtime-session-messages.test.ts（新）**：照 runtime-client.test.ts 的 fake SDK 句柄注入模式——toMessageRecord：仅透传 text、startedAt 取 time.start、丢弃 reasoning/tool/file、role 归一、ignored/synthetic 透传；getSessionMessages：成功映射、404→抛 SESSION_NOT_FOUND、空白 id 经 requireSessionId 拒绝。
3. **src/test/project-session-binding.test.ts（新）**：照 canvas-store.test.ts 的 `vi.mock('electron')`+tmpdir 真文件模式——旧四字段文件经 openProject 写回成五字段（title/createdAt 保留、lastOpenedAt 刷新、activeSessionId:null）；已有绑定字符串 openProject 后原样保留；setActiveSession 写入/清空且不刷新 lastOpenedAt；open 后立即 set 的 enqueue 串行交叉不互覆盖；无文件/损坏 JSON 读态返 null；路径越界拒绝。
4. **src/studio/session-continue.test.tsx（新）**：照 studio-flow.test.tsx 的 window.api 整体桩 + emitRuntime/emitCanvas/emitGate harness（api 桩须含 activeSession/sessionMessages/abortSession 等本包触达的全部方法），落契约 §6.3 八条：R1 回放正序+loading 凭据出现/消失+无 demo；AC1 无绑定零 sessionMessages/零 runtime.start；R2 有绑定零 createSession、promptAsync 同 id、写态不被调；R3 空绑定 createSession 一次+activeSession(newId) 一次+promptAsync 用 newId；R4 chat-stop 出现/abortSession 绑定 id/事件链复位 sending（另断言不传 onStop 时仍是发送钮）；R5 B 会话事件不更新 A、切 B 清 items 加载 B、A 慢 B 快迟到回放不覆盖、装载空窗期 A 事件不闪现；R7 reject SESSION_NOT_FOUND 后空态+info toast 一次+activeSession(null)+再发惰性建；多次发送/切项目 subscribe 总次数 1（含 StrictMode 双挂载断言）。
5. **连带夹具（断言一行不动）**：studio-flow.test.tsx L58 区与 window-titlebar-integration.test.tsx L45 区 openProject mock 返值补 `activeSessionId:null`；若整体 api 桩因类型缺方法导致 typecheck 报错，补齐 activeSession/sessionMessages 桩，记名于变更记录（契约 §6.4 已预先认定的合理 diff）。
- 完成标准：4 套件全绿；除上述两处夹具外不修改任何既有测试断言；typecheck 零新增。

### T6 · 全量回归 + 红线核对 + 真机目验

- 复跑 T1 三条命令：passed 不减少（收尾回填新增后总数，预期 44 文件）、skipped/failed 不扩大；typecheck 仍仅那 2 条历史错误；node/preload 双 0；静态契约套件（architecture renderer 禁直连、mcp-pure-tools、agent-profiles、runtime-projection）无感通过。
- 红线证据（逐条留存命令输出）：`git diff -- shared/` 只一处；本包 diff 中 `ipcMain.handle` 新增=2；package.json/package-lock.json/resources/opencode、projection.ts、buildPromptBody、RUNTIME_ERROR_NAMES 零 diff；diff 文件全部在 §0 白名单 18 个代码文件 + T7 治理文档内（混合工作树按白名单甄别，不认其他三路存量改动）。
- 真机目验（dev 起应用，5 项，截图/日志证据入变更记录）：
  1. **重启续聊**：对话一轮→完全退出应用→重开同项目，右栏自动回放重启前文本气泡，无假数据闪屏；
  2. **同 sessionID 证据**：回放后续发，主进程日志/网络面板证据为同一 sessionID、无第二次 createSession；
  3. **上下文连续**：先让 Agent 记住一个专有词，重开项目后追问，答得上来；
  4. **abort 后同会话再发**：生成中停止→输入恢复→再发成功且仍在同会话（若 opencode 真机拒绝，按 OD §9 风险 2 备选=转惰性新建并回写，无须新通道，但必须回变更记录记名 D 决策）；
  5. **A 生成中切 B**：B 全程无 A 流式/定稿闪现，切回 A 历史正确，全程仅一条 SSE 订阅。
  - ARK Key 不可用时，2/3 可退化为夹具+日志证据并在记录中明示；1/4/5 为必做真机项。
- 完成标准：AC1–AC10 在变更记录逐条勾选；任何与契约偏差已有 D 编号承接，否则不放行 T7。

### T7 · 治理收尾（代码与真机验证通过后才动文档）

- **R-001 落地**：设计书 §7.1 L564（目录树 `chat.messages.json` 注释行）与 L599（replay/hydrate 描述）改为「消息历史复用 opencode 原生会话存储；.session.json 仅持久化 activeSessionId；UI 历史经 session.messages 回放」（L557 附近「纯文件持久化、无数据库」总述保留）；先 grep `chat.messages.json` 确认 docs/design/ 下哪几份 HTML 含同文案——设计书镜像 `短剧Agent平台设计.html` 与 `平台全景图.html` 有则同文案替换，其余 3 份（进度看板/架构模块关系图/原型）仅有才改、不做无依据扩散；每份记「文件+位置+旧新文案」修订清单。
- features/README.md：增 feature-808 行（横切 8xx 段；K1+K8 触发/ K9 不触发；四层横切；产出物与 R-001 索引）。
- 设计现状与偏差清单.md：把「每轮新建会话、重开项目无历史、设计书 chat.messages.json 与实现不符」登记为**由本包关闭**（无现成条目则在实施补记/遗留段新增一行，不重写历史结论）。
- 版本记录.md：追加 2026-10 条目（背景=Design 对齐：项目即会话入口；范围=最小续聊闭环；改动面；K1/K8 授权与 K9 零依赖声明；验证数据；R-001 修订索引）。
- 本包 SDG-AI-变更记录.md：回填 D-001~D-005 决策结论、K1/K8 批准范围、T1/T6 实测实数、真机目验证据、AC1–AC10 勾选、偏差与遗留。
- 完成标准：任务包 5 文件齐备闭环；README/清单/版本记录/设计书/HTML 多处留痕一致；混合树中本包白名单外文件零改动。

## 产出物清单

| 类型 | 路径 |
|---|---|
| K1 共享层 | shared/types.ts（+1 可选字段） |
| 主进程改 | electron/runtime/types.ts、electron/runtime/client.ts、electron/project/library.ts、electron/main.ts |
| preload/类型镜像 | electron/preload.ts、src/global.d.ts、src/lib/runtime-types.ts |
| renderer 改 | src/studio/StudioApp.tsx、src/studio/ChatComposer.tsx、src/dev-mock-api.ts |
| renderer 新 | src/lib/history-replay.ts |
| 新测试 ×4 | src/lib/history-replay.test.ts、src/test/runtime-session-messages.test.ts、src/test/project-session-binding.test.ts、src/studio/session-continue.test.tsx |
| 连带夹具 ×2 | src/studio/studio-flow.test.tsx、src/studio/window-titlebar-integration.test.tsx（仅 mock 返值补字段） |
| 治理 | docs/features/README.md、docs/设计现状与偏差清单.md、版本记录.md、设计书 §7.1（L564/L599）+ 含同文案的 HTML 镜像、本包 SDG-AI-变更记录.md |

预期总 diff：**12 改 + 5 新（其中 1 新源码 + 4 新测试）+ 治理文档**；package.json/lock、resources/opencode、projection/prompt/错误码零改动。

## 不做（防止越界）

- 不做会话列表 UI、手动新建/删除/重命名/切换会话、一会话多项目或一项目多会话；不做历史分页/虚拟滚动/搜索；
- 不回放 reasoning/tool part，不做打码/截断（如评审要求打码须回契约）；不做半截轮次内容保留；
- 不新增 IPC 订阅推送、不新增 npm 依赖、不引 zod、不新增错误码、不调 session.delete 做 GC、不改 serve cwd；
- 不动 projection/buildPromptBody/agent 纪律文件/beforeStopHook/canvas/gate/brief/manifest/asset/comfy 任何既有链路；
- 不做绑定写盘崩溃窗口的同步写/重试（需求 §3.2 已接受空态后果）；不做 T7 之外的存量文档扩散修订。
