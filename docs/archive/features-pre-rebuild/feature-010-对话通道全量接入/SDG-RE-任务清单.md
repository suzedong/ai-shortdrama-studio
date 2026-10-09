# SDG-RE 任务清单 · feature-010 对话通道全量接入（ChatPanel ⇄ opencode runtime）

> 版本：v1.0（待用户签字）
> 日期：2026-10-05
> 前置：feature-008（opencode runtime）、feature-009（运行时调试面板）均已闭环；`@modelcontextprotocol/sdk` 已在依赖中（声明 ^1.0.4，实装 1.31.0，内置 StreamableHTTPServerTransport），本 Feature **不新增依赖**。
> 卡口状态：本 Feature 触发 **K3**（ark 对话 IPC 旧链路退役）、**K6**（新增主进程业务模块目录 `electron/mcp/`）、**K8**（RuntimeEvent 扩展、client 工具白名单、preload 方法移除、ChatPanel props 扩展）。用户对本任务包签字即视为授权；实施时在变更记录逐条追加永久决策记录。不触发 K1（shared 只读）、K9（零新依赖）。

## 0. 上下文加载清单（工作围栏，逐项读取）

- [x] `AGENTS.md`
- [x] 本目录 `SDG-RE-需求规格.md`、`SDG-RE-契约.md`、`SDG-OD-设计说明.md`
- [x] `shared/types.ts`（**只读引用类型，禁止修改**）
- [x] `electron/main.ts`（8 个 agent:* IPC 实现 + 上下文拼装辅助函数，抽取来源）
- [x] `electron/ark.ts`（chat / isConfigured / maskKey，🟢沿用）
- [x] `electron/prompts.ts`、`electron/style-catalog.ts`（prompt 与画风目录校验，🟢沿用）
- [x] `electron/session.ts`（项目目录 / 上下文读取能力来源）
- [x] `electron/preload.ts`（旧桥方法移除点）
- [x] `electron/runtime/manager.ts`、`provider.ts`、`client.ts`、`projection.ts`、`types.ts`
- [x] `resources/opencode/agents/director.md`（模板，放行 MCP 工具）
- [x] `mcp/server.ts`（既有顶层 stdio 骨架，**只读不动**）
- [x] `src/App.tsx`（handleSend 路由切换、会话映射、事件归约接入）
- [x] `src/components/ChatPanel.tsx`、`src/components/ChatPanel.test.tsx`
- [x] `src/lib/messages.ts`、`src/lib/runtime-types.ts`
- [x] `src/global.d.ts`（旧桥类型移除点）
- [x] `src/test/runtime-projection.test.ts`、`src/test/runtime-client.test.ts`、`src/test/runtime-manager.test.ts`、`src/test/runtime-provider.test.ts`（既有运行时测试，同步修改参照）
- [x] `src/test/setup.ts`、`tailwind.config.js`
- [x] `package.json`（确认零依赖变更）
- [x] `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts` §McpRemoteConfig（仅核对）
- [x] `node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.d.ts`、`.../server/mcp.d.ts`（仅核对 API）

> 禁止读取与修改清单以外文件，除非实施中明确需要（如测试夹具）。

## 1. 签字前置

- [x] P1 用户对需求规格 v1.0 / 契约 v1.0 / OD v1.0 / 任务清单 v1.0 逐项签字（NotifyUser 审批）
- [x] P2 用户确认 K3 / K6 / K8 卡口授权（本文件头部已列明，签字即确认）
- [x] P3 T1 存量迁移决策表（含 🔴弃用 / 🟣替换项）须用户再次签字后，方可执行旧 IPC 删除（存量迁移四步法第 ④ 步）

## 2. 原子任务

### T1 · 存量快照与迁移决策（四步法 ①②③，先于一切改动）

- [x] T1-1 读真实源码：`electron/main.ts` 中 8 个 `agent:*` handler + `app:ark-status`、上下文拼装辅助函数（describeFiveElements / describeBrief / readStoryContext / readScriptContext）、mock 兜底分支；记录输入、输出、错误码（STYLE_NOT_IN_CATALOG / REVISE_EMPTY / STORY_CTX_MISSING 等）、持久化交互
- [x] T1-2 补快照：`docs/SDG-OD-legacy/feature-010-ark对话IPC快照.md`（含通道清单、逐 handler 行为、preload 方法、renderer 调用点）
- [x] T1-3 迁移决策表（写入快照文件）：每项落 🟢沿用 / 🟡改造 / 🔴弃用 / 🟣替换，初步结论：
  - ark.ts `chat/isConfigured/maskKey` 🟢沿用
  - prompts.ts / style-catalog.ts / 各 parser 🟢沿用
  - 8 个 handler 业务实现 → 🟣替换（抽为 MCP 工具 handler）
  - 8 个 `ipcMain.handle` 注册块 + preload 8 方法 + global.d.ts 8 类型 → 🔴弃用删除
  - `app:ark-status` / preload `arkStatus`：搜索 renderer 引用后在决策表定（无引用 → 🔴弃用；有引用 → 🟢沿用）
  - 持久化 / workflow / clear IPC 全部 🟢沿用
- [x] T1-4 本步只新增快照文档，**不改任何代码**；决策表提交用户签字（P3）

### T2 · 业务工具层 `electron/mcp/tools.ts`（K6 + 业务抽取）

- [x] T2-1 新建 `electron/mcp/tools.ts`，导出 `registerBusinessTools(server: McpServerLike): void` 与 `ToolResultEnvelope` / `BusinessToolName` 类型（契约 §3.2）；`McpServerLike` 采用结构类型（只含 `tool(name, schemaShape, handler)` 方法签名），不绑定 SDK 具体类
- [x] T2-2 抽出 main.ts 业务逻辑为 8 个 handler（diagnose / visual_style / revise_text / story_outline / character_profiles / scenes / dialogue / storyboard），保持行为逐一同构：prompt 拼装、ark chat 调用、parser、无 Key mock 兜底、画风目录校验、错误分支；**复用 electron/ark.ts、prompts.ts、style-catalog.ts，不复制实现**
- [x] T2-3 上下文读取：story_outline / character_profiles / scenes / dialogue / storyboard 所需项目上下文由 handler 经主进程能力读取（readStoryContext / readScriptContext 一并从 main.ts 迁入 tools.ts 或抽到 `electron/mcp/context.ts`——二选一，以实现从简；若新增 context.ts 属 K6 已授权范围内的同目录文件，任务清单此处先行列明）
- [x] T2-4 handler 输入用 zod schema 声明（与契约 §3.1 表逐字段同构；`@modelcontextprotocol/sdk` 依赖 zod，已随 SDK 存在，不新增依赖）；校验失败由 SDK 转为 INVALID_ARGUMENT
- [x] T2-5 返回形态：成功 `{ kind, product, meta:{source,durationMs} }`；业务可恢复错误 `isError:true` + envelope.error（§5 错误码映射：STYLE_NOT_IN_CATALOG / STORY_CTX_MISSING / 上游失败 → RUNTIME_UPSTREAM_ERROR，message 保留原错误码文本）；`JSON.stringify` 必须可 parse

### T3 · MCP Streamable HTTP 服务 `electron/mcp/server.ts`（K6）

- [x] T3-1 新建 `electron/mcp/server.ts`：`http.createServer` + 仅绑 `127.0.0.1`；端口动态探测（起始 4100，顺探 25 个；复用 runtime findFreePort 模式或在本模块实现等价逻辑）
- [x] T3-2 鉴权中间件：校验 `Authorization: Bearer <mcpToken>`；缺失 / 不匹配 → HTTP 401（不进入 JSON-RPC）
- [x] T3-3 路径 `/mcp`：POST → stateful `StreamableHTTPServerTransport`（sessionIdGenerator: randomUUID）处理 JSON-RPC；GET → 同 session SSE；其余路径 / 方法返回标准 404/405；transport 按 session 复用，关闭时清理
- [x] T3-4 导出契约签名：`startMcpToolServer(opts:{host?,portRangeStart?}): Promise<McpToolServerHandle>`，handle = `{ port, close }`；close 关闭所有 transport 与 http server（幂等）
- [x] T3-5 `mcpToken = crypto.randomBytes(24).toString('base64url')` 仅在内存与 handle 中返回；不写文件、不进 argv

### T4 · runtime 编排接入（manager / provider / director）

- [x] T4-1 `manager.ts`：start 序列中 runtime 文件就绪后、opencode spawn 前启动 MCP server（`startMcpToolServer`），取得 port/token；buildChildEnv 增加 `OPENCODE_MCP_URL=http://127.0.0.1:<port>/mcp`、`OPENCODE_MCP_TOKEN=<token>`，spawn 前校验非空；stop / 子进程异常退出 / before-quit 路径均关闭 MCP server
- [x] T4-2 `provider.ts`：`generateRuntimeConfig` 生成对象增加 `mcp.shortdrama = { type:'remote', url:'{env:OPENCODE_MCP_URL}', headers:{Authorization:'Bearer {env:OPENCODE_MCP_TOKEN}'}, timeout:10000 }`（占位符字面量；函数签名不接收 url/token）
- [x] T4-3 `director.md` 模板：frontmatter tools 放行 `shortdrama_*`（read/glob/grep 保留，其余仍 false）；permission allow 增加同名前缀；正文增补行为约束：业务产物必须调用 MCP 工具产出、不得臆造、产物交付前简要说明
- [x] T4-4 `client.ts`：prompt 白名单由 `['read','glob','grep']` 扩展为含 `shortdrama_*` 前缀匹配（保留越权拒绝）；`DIRECTOR_DECLARED_TOOLS` 常量同步更新（provider.ts）

### T5 · RuntimeEvent 契约扩展与投影（K8）

- [x] T5-1 `electron/runtime/types.ts`：新增 `RuntimeToolCallEvent`（契约 §4.1 全字段：callId/status/argsPreview/resultPreview/args/result/errorText/startedAt/endedAt）
- [x] T5-2 `projection.ts`：projectTool 从 ToolPart 取 callID / state.input / state.output / state.error / state.time；pending→running；output 尝试 JSON.parse（envelope → 返回解析对象，失败 → 原字符串）；preview 截断 500 保留；attachments 不透出
- [x] T5-3 `src/lib/runtime-types.ts`：镜像相同字段，与主进程 DTO 一一对应
- [x] T5-4 同步更新 `src/test/runtime-projection.test.ts` 既有断言并新增：callId 透传、结构化 args/result、envelope JSON.parse 成功 / 失败两路径、errorText 不截断、time 映射

### T6 · renderer 纯函数层 `src/lib/chat-runtime.ts`

- [x] T6-1 新建 `src/lib/chat-runtime.ts`：`StreamingTurn` / `ToolView` 类型（契约 §7.2）
- [x] T6-2 `reduceRuntimeEvent(turn, event)`：delta 按 messageId 累加 textDelta；part 中 reasoning 累加（text part 作为正文完成片段）；tool.call 按 callId upsert（running/completed/error 三态 + 耗时）；session.idle → done；runtime.error → error；首轮事件（turn=null）由 delta/part/tool 事件惰性建轮
- [x] T6-3 `turnToChatMessage(turn)`：投影为 ChatMessage（id 用 messageId，content 取 textDelta；工具产物的结构化结果不在此函数内重复造正文——产物卡由 App 根据 completed tool 的 envelope.product 另行落消息）
- [x] T6-4 新建 `src/lib/chat-runtime.test.ts`：穷尽事件序列用例（纯文本流、reasoning 分轨、多工具 upsert 与排序、idle 定稿、error、abort 部分保留、非 envelope output）
- [x] T6-5 `npx vitest run src/lib/chat-runtime.test.ts` 全绿

### T7 · ChatPanel 流式 UI（受控扩展）

- [x] T7-1 Props 新增 `onStop?`、`streaming?`（契约 §7.3）；既有 props 与行为全部保留
- [x] T7-2 进行中卡（OD §3）：header 行（● 正在生成… / 工具数 / 用时 / ■停止生成按钮，running 才可点，点击后禁用态「停止中」）；canvas 底 + 1px line 无阴影
- [x] T7-3 流式正文区：textDelta 渲染 + 末尾 2px violet 闪烁光标（1s）；自动滚底沿用 bottomRef；无文本输出显 muted 单行；done/error 后光标消失
- [x] T7-4 推理折叠区：默认折叠、header 显示字符数、有更新显 warn 小圆点不自动展开、展开后 muted 11px 保留换行，与正文分轨
- [x] T7-5 工具调用区：按 startedAt 排序 running 置顶；三态行（running 实时计时 / completed ✓+耗时+[参数][结果] / error ✕+一行错误+[重试]）；工具名去 `shortdrama_` 前缀，title 显完整 ID；[参数][结果] 展开 10px 等宽 JSON（最多 6 行滚动、break-all）
- [x] T7-6 停止态：header muted「已停止」，非 error；错误就地无 alert
- [x] T7-7 更新 `src/components/ChatPanel.test.tsx`：流式渲染、光标、停止按钮可用 / 禁用、reasoning 折叠与更新点、工具三态与 JSON 展开、已停止态、既有 props 行为不回归

### T8 · App.tsx 发送编排切换

- [x] T8-1 `handleSend` 改为契约 §7.1 链：ensureRuntimeRunning（失败显错误条不吞消息）→ ensureSession（无映射则 createSession → subscribe）→ pushUserMessage（setMessages + appendMessage 落盘不变）→ promptAsync `{sessionId, text}`
- [x] T8-2 项目→opencode 会话映射：`useRef<Map<projectDir, sessionId>>`；切换 / 重建项目重新 createSession；不新增 IPC
- [x] T8-3 订阅事件归约：onEvent 回调经 reduceRuntimeEvent 更新 `streamingTurn` state；done 时 turnToChatMessage + 按 envelope.product 落对应产物消息（走 messages.ts 工厂，保证产物卡 / gate 字段语义），随后清空 streamingTurn；error 落错误气泡
- [x] T8-4 `onStop`：abortSession(sessionId)；streaming 保留为已停止
- [x] T8-5 onRetry：重发上一条 user 文本（沿用现有重试语义）
- [x] T8-6 启动恢复：仅恢复已落盘消息（不重放未落定轮）；arkStatus 调用依 T1 决策保留或移除
- [x] T8-7 删除 / 改造现有 ark IPC 调用点；全仓搜索确认对话链路对 8 个旧方法零引用

### T9 · 旧通道退役执行（T1 决策表签字后）

- [x] T9-1 删除 `electron/main.ts` 中 8 个 `ipcMain.handle('agent:*')` 注册块（业务实现已在 T2 被 MCP handler 取代；确认无其他主进程引用后删除其专属辅助函数，仍被复用的保留）
- [x] T9-2 按 T1 决策处理 `app:ark-status` 注册块
- [x] T9-3 `preload.ts` 移除 8 个方法（及按决策处理 arkStatus）；`src/global.d.ts` 移除对应类型
- [x] T9-4 持久化 / workflow / clear 等 IPC 与 preload 方法不动；ark.ts / prompts.ts / style-catalog.ts 不动

### T10 · 收尾验收

- [x] T10-1 `npm run typecheck` 零错误（含 tsconfig.node / preload 配置）
- [x] T10-2 `npm run test:run` 全量通过，只增不减（记录基线 357/1 与新增数）
- [x] T10-3 `npm run build` 通过
- [x] T10-4 真机冒烟（CDP 驱动）：启动应用 → 面板 / runtime 启动（MCP server 起、opencode.json 占位符正确、opencode mcp 状态 connected）→ ChatPanel 发送创意 → 文本流式 + 光标 → 工具卡 running→completed（参数 / 结果展开）→ 产物卡定稿 → 停止生成一轮 → 错误场景（断 runtime / 目录外画风）就地展示可重试 → 重启恢复一致
- [x] T10-5 loopback 与鉴权核对：`lsof` 确认 MCP 仅绑 127.0.0.1；无 Bearer curl 返回 401；grep opencode.json 无 token 明文
- [x] T10-6 视觉自检对照 OD §10（V-1~V-8）逐项达标并记录
- [x] T10-7 变更记录补永久决策（K3/K6/K8）与实施清理；本清单全部勾选，输出最终汇报

## 3. AC 自检表（收尾时逐项填写）

| AC | 内容 | 结果 / 证据 |
|---|---|---|
| AC-1 | MCP 仅 loopback，无 Bearer 被拒，令牌不落盘 | ✅ T10-5：MCP server `http.createServer` 仅绑 127.0.0.1（lsof 核对）；无/错 Bearer 经中间件返回 HTTP 401；mcpToken 随机仅经子进程 env（OPENCODE_MCP_TOKEN）注入，opencode.json 只含 `{env:OPENCODE_MCP_TOKEN}` 占位符、无明文，不进 argv |
| AC-2 | director 经 MCP 产出全部文本产物，产物卡字段无回归 | ✅ T10-4：director 经 shortdrama_diagnose（envelope `kind:"visual_style"`/diagnose 等，meta.source=ark）产出；创意简报 + 选题诊断正文落产物气泡，字段走 messages.ts 工厂无回归；8 工具与契约 §3.1 同构 |
| AC-3 | 正文流式逐字、自动滚底，idle 解除 loading | ✅ T10-4：message.delta 逐字渲染 + bottomRef.scrollIntoView 滚底；session.idle 归约 done 后流式卡卸载、loading 解除 |
| AC-4 | 停止生成中止本轮、解除 loading、保留已生成内容 | ✅ T10-4：停止按钮 → abortSession；runtime.error(PROMPT_ABORTED) 定稿单气泡「已停止生成」，已生成 delta 保留，非 error 僵尸；停止后按钮禁用显「停止中」 |
| AC-5 | 推理折叠区与正文分轨、默认折叠 | ✅ T10-4/V-2：ReasoningPanel 默认折叠、warn 色更新点，track=reasoning 经 D-009 partID 映射，与正文分轨不混入 |
| AC-6 | 工具卡三态 + 耗时 + 参数；结果可展开结构化 JSON | ✅ T10-4：diagnose running（实时计时 ~84s）→ completed ✓+耗时；参数块实读 404 字（fiveElements/platforms/…）、结果块实读 1010 字 envelope 结构化 JSON，展开/收起状态机正确；error 态 ✕ + 重试 |
| AC-7 | 错误气泡可重试；无僵尸 loading；无重复生成 | ✅ T10-4：kill 子进程后错误气泡「opencode 子进程运行期异常退出（signal=SIGKILL）」，点重试 4s 新卡 running、runtime 自动拉起（I-001 补播 runtime.error 消除永久 running）；D-011 幂等定稿无重复气泡 |
| AC-8 | 重启恢复：消息 / 产物 / 工作流一致，无重复产物 | ✅ T10-4：Electron 重启后历史消息（含最后一条已上屏未交付 prompt）完整恢复，无残留进行轮、无重复产物；仅恢复已落盘消息 |
| AC-9 | legacy 快照 + 决策表 + 用户签字齐全；旧 IPC 对话链路零引用 | ✅ T1：`docs/SDG-OD-legacy/feature-010-ark对话IPC快照.md`（含迁移决策表）经用户 P3 二次签字；8 个 agent:* IPC + preload 8 方法 + global.d.ts 8 类型已删除，全仓搜索对话链路零引用 |
| AC-10 | 全量测试只增不减、typecheck、build 通过 | ✅ T10-1/2/3：typecheck 零错误；全量单测 33 文件 **390 passed / 1 skipped**（基线 357/1，只增不减），无 flaky；`npm run build` 通过 |
| AC-11 | OD V-1~V-8 视觉验收逐项达标 | ✅ T10-6：V-1~V-8 全符合（三栏无 reflow/溢出、仅用既有 token、紫光标+滚底+idle 消失、reasoning 折叠 warn、工具三态、停止就地无弹窗、错误就地可重试、字号 10/11/12/14）；附带修复 I-002 header 折行 |
