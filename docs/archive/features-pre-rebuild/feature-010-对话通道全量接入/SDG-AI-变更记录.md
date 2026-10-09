# SDG-AI 变更记录 · feature-010 对话通道全量接入（ChatPanel ⇄ opencode runtime）

> 版本：v1.0（待用户签字）
> 日期：2026-10-05

## 决策记录（K 卡口触发，永久保留）

### D-001 · K6 新增主进程业务模块 `electron/mcp/`（待签字）

- 触发：K6（新增顶层业务目录 / 模块）。
- 内容：新增 `electron/mcp/server.ts`（MCP over Streamable HTTP 服务、loopback、Bearer 鉴权、生命周期 handle）与 `electron/mcp/tools.ts`（8 个文本侧业务工具注册）；如实施需要可在同目录新增 `context.ts`（任务清单 T2-3 已列明）。
- 必要性：L3 冲突解法——director 无业务生产工具，全量切换须由主进程内 MCP 服务把现有业务能力暴露给 opencode；handler 与持久化 / ComfyUI 引擎同进程，满足媒体调用收敛红线。
- 边界：既有顶层 `mcp/server.ts`（stdio 骨架）不动；本目录仅承载主进程 MCP 服务。
- 签字：⬜ 用户签字后生效。

### D-002 · K3 ark 对话 IPC 链路退役（待签字）

- 触发：K3（旧系统弃用 / 替换）。
- 内容：8 个对话 IPC（`agent:diagnose` / `agent:visual-style` / `agent:revise-text` / `agent:story-outline` / `agent:character-profiles` / `agent:scenes` / `agent:dialogue` / `agent:storyboard`）的业务实现 🟣替换为 MCP 工具 handler，`ipcMain.handle` 注册块 🔴删除；preload 8 方法与 global.d.ts 8 类型 🔴移除；`app:ark-status` 依 T1 决策处理。
- 沿用：ark.ts `chat/isConfigured/maskKey`、prompts.ts、style-catalog.ts、持久化 / workflow / clear IPC 全部保留。
- 流程：先快照（`docs/SDG-OD-legacy/feature-010-ark对话IPC快照.md`）+ 迁移决策表，用户对决策表二次签字（P3）后方可删除。
- 签字：⬜ 用户签字后生效。

### D-003 · K8 RuntimeEvent 扩展与 IPC / preload / props 变更（待签字）

- 触发：K8（事件契约扩展、工具白名单、preload 方法移除、ChatPanel props 扩展）。
- 内容：
  1. `tool.call` 事件超集扩展：新增 callId / args / result / status / errorText / startedAt / endedAt（旧 preview 字段保留，旧消费方不破坏）；三处 DTO + projection 一一对应。
  2. runtime client prompt 白名单扩展 `shortdrama_*` 前缀，越权仍拒绝。
  3. preload 8 方法移除（K3 联动）。
  4. ChatPanel 新增受控 props `onStop?` / `streaming?`，既有 props 不变。
- 不新增 IPC 通道：renderer 仅使用 feature-009 已有 runtime 方法与事件。
- 签字：⬜ 用户签字后生效。

### D-004 · opencode `{env:NAME}` 配置插值机制采用（事实固化，随包签字）

- 内容：opencode v1.18.34 在配置文件 JSON 解析前对全文做 `{env:NAME}` / `{file:path}` 替换（env 缺失展开为空串）；生成态 opencode.json 的 mcp.shortdrama 只写占位符，MCP URL / token 只存在于子进程环境，不落盘、不进 argv。
- 证据：SDK 源码 config/variable.ts substitute 正则 `/\{env:([^}]+)\}/g`；本地二进制字符串核对一致。
- 备注：本条目为机制确认，不单独触发卡口；其落地方案属 D-001/D-003 授权范围。

### D-005 · K8 RuntimeErrorCode 封闭集合新增 `RUNTIME_UPSTREAM_ERROR`

- 触发：K8（错误码集合属事件/DTO 契约）。
- 背景：契约 §5 将上下文缺失（STORY_CTX_MISSING）、画风目录外（STYLE_NOT_IN_CATALOG）、ark 上游失败三类业务可恢复错误映射到 `RUNTIME_UPSTREAM_ERROR`，但既有 11 码封闭集合无此值，与"不新增错误码"表述构成 L2 冲突。
- 决策（2026-10-05 用户裁决）：两侧 DTO（electron/runtime/types.ts、src/lib/runtime-types.ts）的 `RuntimeErrorCode` 联合类型**新增 `'RUNTIME_UPSTREAM_ERROR'`**；契约 §5 已反向同步去掉"不新增"表述。业务错误经 envelope.error 透出，message 保留原始错误信息。

### D-006 · K8 `message.delta` 新增 `track` 分轨（初版按 `field` 前缀，⛔ 已由 D-009 反转）

- 触发：K8（封闭联合事件形态变更，renderer 归约必须读取）。
- 背景：T10-4 真机冒烟发现推理增量被无条件当正文累加，助手气泡正文混入内心推理（实测定稿白气泡为内心推理文本）。
- 内容：`message.delta` 在 feature-009 契约上新增必填字段 `track: 'text' | 'reasoning'`，三处镜像同步（electron/runtime/types.ts、src/lib/runtime-types.ts、projection.ts）。
- ⛔ 反转：原规定「按 delta 的 `field` 前缀分轨」被原始 SSE 取证证伪——opencode 1.18.34 对所有 delta（含 reasoning）一律下发 `field: "text"`。**分轨实现以 [D-009](#d-009-⛔-反转-d006delta-分轨按-partid--part-类型映射投影) 为准**；本条保留的是「新增 track 字段」这一契约事实。

### D-007 · K8 `message.part.updated` 的 role 过滤（投影层）

- 触发：K8（投影行为修正，不改 RuntimeEvent DTO 字段，无需镜像 DTO）。
- 背景：opencode 的用户消息同样携带 text part 并经 `message.part.updated` 下发，Part 载荷本身不带 role。此前投影把用户输入当 agent 轮惰性建轮，assistant 的 part 因 messageId 不匹配被忽略，session.idle 定稿产生"内容为用户原文的 agent 白气泡"。
- 决策：`text` / `reasoning` part 仅当 `part.time` 为含 `start` 的对象时才投影（assistant 必有 time，用户 text part 无 time）；用户 part 返回 null 忽略。tool part 仅 assistant 存在，规则不变。

### D-008 · K8 `message.part` 新增 `partId` + 快照 replace 归约

- 触发：K8（封闭联合事件形态变更，三处镜像同步）。
- 背景：opencode 对同一段正文并行下发逐 token 的 `message.part.delta` 与携带累积全量快照的 `message.part.updated`；此前归约把两路无条件拼接，定稿正文重复（实测"角色修复角色修复"）。
- 决策：`message.part` 新增必填 `partId`（取 opencode Part.id）；归约按 partId upsert——已存在则整体 replace（text 覆盖、绝不追加），delta 仅作该 track 尚无快照时的预览；定稿正文有快照则按 part 插入顺序拼接快照，无快照回退 deltaPreview。

### D-009 · ⛔ 反转 D-006：delta 分轨按 partID → part 类型映射投影

- 触发：D-006 反转（真机证伪，L2 修正）。
- 取证：opencode 1.18.34 对所有 delta 一律下发 `field: "text"`，field 不携带轨道信息；但 delta 事件稳定携带 `partID`，与 `message.part.updated` 的 `part.id` 一一对应。
- 决策：投影器维护 `partID → kind`（text / reasoning）映射——每收到 `message.part.updated` 登记 `id → type`；收到 `message.part.delta` 按 `properties.partID` 查表：命中 reasoning → `track:'reasoning'`；命中 text 或未登记 → `track:'text'`。**`field` 字段不作为分轨依据。**

### D-010 · 归约终态锁定（done / error 不可翻转）

- 触发：K8（归约语义，App / chat-runtime 行为约束）。
- 背景：opencode 1.18.34 真机取证，用户点停止后 `runtime.error(PROMPT_ABORTED)` 与 `session.idle` 先后成对到达（error 先、idle 后，各自重复一次）；不锁定则 error 定稿「已停止生成」后 idle 又定稿「本轮没有产出有效结果」，一轮落两个矛盾气泡。
- 决策：turn 一旦进入 done / error 即终态，`reduceRuntimeEvent` 首行锁定——后续任何事件（含另一类终态事件）一律原样返回该 turn。abort 以先到的 error 为准（finalizeErrorTurn）；正常完成时 error 不到达，idle 定稿 done 不受影响。

### D-011 · 纯归约 + 定稿 effect 按轮次 id 幂等（副作用隔离）

- 触发：K8（renderer 编排约束）。
- 背景：React 18 StrictMode 开发态双调用 state updater，并对 effect 做「setup → cleanup → setup」重放。真机取证：① updater 内「无轮则落错误气泡」分支被双调用，同一 abort 消息两次追加进 React messages（DOM 两个同 id 气泡，appendMessage 按 id 去重故落盘仅一条）；② 同一终态 turn 被定稿两次（同 id 两次 pushMessage）。
- 决策：
  1. `setStreamingTurn` 的 updater 必须是纯函数，只做 `reduceRuntimeEvent` 归约；禁止在 updater 内 pushMessage / 落盘。需读当前轮决定副作用时读独立的 `streamingTurnRef`（与 state 同步），在 updater 之外执行。
  2. 定稿 effect 维护 `finalizedIdsRef: Set<messageId>`，定稿前判 id 是否已在集合，命中跳过；会被复位的布尔锁不能作为跨 setup 去重依据。生产构建无 StrictMode 双调用，但幂等集合在两种环境都成立，作为定稿唯一去重依据。

### D-012 · MCP 远程工具调用超时取 180s（真机取证修订）

- 触发：契约 §6.3 受控取值（provider.ts `SHORTDRAMA_MCP_TIMEOUT_MS`）。
- 背景：初版写死 10s。真机 T10-4 触发 shortdrama_diagnose 时，工具内部经 ark.ts `chat()` 做整段非流式生成（diagnose / outline / profiles / scenes / dialogue / storyboard 均如此），实测 20–60s，10s 必然触发 opencode MCP 客户端 `-32001 Request timed out`，工具行落 ✕ 且产物永不交付。
- 决策：`SHORTDRAMA_MCP_TIMEOUT_MS = 180_000`（3 分钟），写入 opencode config 的 `mcp.shortdrama.timeout`；覆盖 ark 长生成 P99 并留余量，仅作兜底防 opencode 永久挂起。
- 边界：该超时是 opencode → 本机 MCP 工具服务这一跳的等待上限，不改变 renderer 侧「流式文本 + 停止生成」体验，也不改变工具内部 ark 调用行为。
- 真机佐证（修订前）：一轮重生复仇创意 diagnose 约 10s 报 -32001，同轮 read 卡 running 196s 未 idle，DOM / 磁盘均无 brief/diagnosis 产物。

## 实施记录（纯过程，落地后清理）

### I-001 · opencode 子进程异常退出后轮次永久 running 修复（2026-10-05）

- 取证：kill opencode LISTEN 进程后，renderer 进行轮长期卡「正在生成…」、工具 rows 0；SSE pump（projection.subscribeEvents）网络中断 catch 后静默收尾，不投影任何事件；main.ts 的 `handle.closed` 仅置句柄 null。
- 定性：契约 §5 已规定「opencode / 子进程异常 → runtime.error」，属实现未满足契约，直接修代码、无新决策。
- 修复：[main.ts](../../../electron/main.ts) 的 `runtimeManager.onStatusChange` 回调内，状态迁移到 `error` 且有 error 时经 `broadcastRuntimeEvent` 合成并广播 `runtime.error`（在自动重建事件流之前）。重建重启后复验：卡正常终止并落错误气泡，重试可拉起 runtime。

### I-002 · 流式卡 header 中文逐字折行修复（2026-10-05）

- 现象：流式卡 header 在窄空间出现「正在生/成…」「停止生/成」逐字折行。
- 修复：[ChatPanel.tsx](../../../src/components/ChatPanel.tsx) StreamingCard header 状态文本与停止按钮加 `whitespace-nowrap shrink-0`，中间「工具 N · 用时」段 `truncate min-w-0`；裁剪截图确认单行。

## 修订记录（修正 / 反转 / 闭环旧条目）

（无条目。）
