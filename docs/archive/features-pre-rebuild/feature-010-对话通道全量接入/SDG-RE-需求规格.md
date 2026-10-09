# SDG-RE · 需求规格 · feature-010 对话通道全量接入（ChatPanel ⇄ opencode runtime）

> 版本：v1.0（待用户签字）
> 日期：2026-10-05
> 来源标签：[改编]（对话通道形态对齐 MiniMax Design，底层以 opencode + 自研 MCP 工具桥实现）
> 上游：feature-008（Agent 运行时集成）、feature-009（运行时界面接入 / 调试面板）

---

## 1. 背景与问题

feature-008 已在主进程建成 opencode runtime（单条 SSE 长连接、会话、promptAsync），feature-009 已交付仅用于调试的 420px 右侧抽屉。业务对话面板 [ChatPanel.tsx](../../../src/components/ChatPanel.tsx) 目前与 runtime **零连通**，其全部回复仍经由主进程 ark IPC：

- `window.api.diagnose`（立项诊断）
- `window.api.recommendVisualStyle / generateOutline / generateProfiles / generateScenes / generateDialogue / generateStoryboard`（各步产物）
- `window.api.reviseText`（修改流）

该通道与产物卡（brief/diagnosis/story-outline/…）、gate 定稿、消息落盘强绑定，且**一次性整卡返回、无流式、无推理过程、无工具过程可见、无中途停止**。

同时，opencode 的主控导演 agent（[director.md](../../../resources/opencode/agents/director.md)）仅放行 `read/glob/grep`，**不具备任何业务生产工具**；opencode 的 `tool.call` 事件无法承载现有业务生成。

### 用户决策（2026-10-05）

1. **全量切到 runtime**：ChatPanel 的所有消息（含工作流指令与产物生成）改走 opencode runtime；对话链路上的 ark IPC 弃用（触发 **K3** 旧系统改造）。
2. **对话能力首期四项全含**：纯文本流式 + 停止生成、推理过程展示、工具调用卡、结构化工具详情（后两项要求扩事件契约，触发 **K8**）。
3. **形态对齐 MiniMax Design**：主 Agent 理解意图 → 任务拆解 → 工具执行 → 关键节点确认 → 产物交付，过程在对话流中可见。

### L3 架构结论与解法

「director 无生产工具 ⇒ 全量切换在当前架构无法直接实现」。经评审，解法为：**在 Electron 主进程内实现一个仅绑 loopback 的 MCP（Model Context Protocol）工具服务，把现有业务能力注册为 opencode 可调用的工具；director 经 MCP 工具完成产物生产**。媒体类能力（图像 / 视频 / 音乐）本 Feature 仅注册文本侧业务工具；ComfyUI 媒体引擎工具的接入由后续 Feature 承接（见 §7）。

---

## 2. 角色与场景

| 角色 | 场景 | 期望效果 |
| :-- | :-- | :-- |
| 创作者（唯一用户） | 在右侧 ChatPanel 输入创意 / 工作流指令 | 消息经 runtime + director + MCP 工具处理，过程实时可见 |
| 创作者 | 等待产物生成时 | 看到流式正文、折叠的推理过程、工具调用卡（名称 / 状态 / 参数 / 结果） |
| 创作者 | 生成方向错误或想中止 | 随时点「停止生成」，本轮中止，输入恢复可用 |
| 创作者 | 生成报错 | 看到错误气泡，可点击重试；不出现整应用崩溃或僵尸 loading |
| 创作者 | 重启应用 | 当前项目会话与消息正常恢复，不产生重复产物或重复生成 |

---

## 3. 功能需求

### F1 · 主进程 MCP 工具服务（loopback）`[自研新增]`

- F1-1 Electron 主进程启动一个 **MCP over Streamable HTTP** 服务，仅绑定 `127.0.0.1`，端口动态空闲探测；服务生命周期与 runtime / 应用一致（随 runtime start 起、stop / before-quit 关闭）。
- F1-2 服务以**随机 Bearer 令牌**鉴权（复用 runtime 随机口令生成模式），令牌仅经 opencode 子进程环境变量注入，不写入任何配置文件、不出现在命令行。
- F1-3 首批注册**文本侧业务工具**（工具名与入参 / 出参在契约 §3 固化）：将现有 ark IPC 背后的业务逻辑（diagnose / recommendVisualStyle / generateOutline / generateProfiles / generateScenes / generateDialogue / generateStoryboard / reviseText）改造为 MCP 工具 handler，**复用其 service 层**，不在 renderer 或 MCP 进程内重新实现。
- F1-4 工具结构化结果：handler 返回结构化 JSON（文本侧为 JSON 字符串约定，由主进程解析），供「结构化工具详情」展示；错误返回 MCP 错误，映射为 runtime 错误码。
- F1-5 现有 [mcp/server.ts](../../../mcp/server.ts) 的 stdio 骨架保留；本 Feature 的 HTTP 服务在主进程侧新建模块，不破坏既有骨架（K6 决策见变更记录）。

### F2 · opencode 配置与 director 改造 `[改编]`

- F2-1 runtime 配置生成（[provider.ts](../../../electron/runtime/provider.ts)）新增 MCP remote 配置：配置内仅写字面占位符（`url: '{env:OPENCODE_MCP_URL}'`、`Authorization: 'Bearer {env:OPENCODE_MCP_TOKEN}'`），真实 URL 与随机 Bearer 经 opencode 子进程环境变量注入（opencode v1.18.34 内置 `{env:NAME}` 配置文本插值，在 JSON 解析前执行）。
- F2-2 [director.md](../../../resources/opencode/agents/director.md) 模板放行 MCP 工具前缀（frontmatter tools / permission），并补充「业务产物须经 MCP 工具产出、不得臆造产物」的行为约束。
- F2-3 runtime 客户端 prompt 组装的工具白名单（[client.ts](../../../electron/runtime/client.ts) `DIRECTOR_DECLARED_TOOLS`）扩展为包含 MCP 工具 ID；越权工具仍被拒绝。
- F2-4 桥接所需 Bearer、MCP 端口经 [manager.ts](../../../electron/runtime/manager.ts) 子进程环境变量注入（与 ARK key 同模式）。

### F3 · RuntimeEvent 契约扩展（K8）`[自研新增]`

- F3-1 扩展 `tool.call` 事件，在现有 `argsPreview/resultPreview` 之外增加结构化字段：`callId`（工具调用关联 ID）、`args`（完整入参原对象）、`result`（解析后的结果对象 / 文本）、`status`、`startedAt/endedAt`（耗时）。具体字段以契约 §4 为准。
- F3-2 保留 500 字符 preview 字段用于紧凑列表；结构化字段用于详情视图。`message.part` 字段不变；`message.delta` 在 T10-4 修复中新增 `track: 'text'|'reasoning'` 分轨字段（见契约 §4.2，决策 D-006）。
- F3-2a T10-4 修复投影 role 归属：用户消息的 text part（无 `time`）此前被误投为 agent 轮，定稿成"用户原文白气泡"；投影仅放行带 `time` 的 text/reasoning part（即 assistant 产出），用户 part 忽略（见契约 §4.2，决策 D-007）。
- F3-2b T10-4 修复正文重复：delta 与 part 快照并行覆盖同一正文，此前被拼接成两份。`message.part` 新增 `partId`，归约按 partId 快照 replace；delta 仅作首个快照到达前的预览；定稿以快照为准（见契约 §4.2/§7.2，决策 D-008）。
- F3-3 投影层（[projection.ts](../../../electron/runtime/projection.ts)）与两侧 DTO（[electron/runtime/types.ts](../../../electron/runtime/types.ts)、[src/lib/runtime-types.ts](../../../src/lib/runtime-types.ts)）同步修改，字段一一对应。

### F4 · ChatPanel 流式对话 UI `[改编]`

- F4-1 **流式正文**：renderer 新增按 `messageId` 聚合 `message.delta` 的 reducer，正文逐字渲染，自动滚底；`session.idle` 作为一轮结束信号。
- F4-2 **停止生成**：生成中输入区旁提供「停止生成」，调用 `abortSession(sessionId)`；停止后 loading 解除、已生成内容保留。
- F4-3 **推理过程**：`message.part(kind=reasoning)` 渲染为可折叠区（默认折叠），与正文视觉分轨。
- F4-4 **工具调用卡**：`tool.call` 驱动工具卡：工具名、状态图标（running/completed/error）、耗时、参数；completed 可展开查看结构化结果（JSON 视图），error 显示错误信息。
- F4-5 **发送路由切换**：[App.tsx](../../../src/App.tsx) 的 `handleSend` 改为经 runtime：确保 runtime running → 确保 opencode 会话存在并 `subscribe(sessionId)` → 本地 push user 消息 → `promptAsync` → 事件回流更新产物。
- F4-6 **产物卡与定稿不回归**：diagnosis / outline / profiles / scenes / dialogue / storyboard 等产物卡、gate、候选 / 修改 / 解锁流、清空、消息落盘与启动恢复行为保持现有契约；产物来源从 ark IPC 改为 MCP 工具结果，字段语义不变。
- F4-7 **错误与重试**：`runtime.error` / 工具 error 渲染错误气泡，`onRetry` 可重发上一轮；不产生僵尸 loading。

### F5 · 旧通道退役（K3）`[改编]`

- F5-1 对话链路不再调用 §1 所列 ark IPC；按存量迁移四步法：读真实源码 → 补快照到 `docs/SDG-OD-legacy/` → 落 🟢沿用 / 🟡改造 / 🔴弃用 / 🟣替换 决策 → 用户签字。
- F5-2 ark service 层中**被 MCP 工具复用**的部分 🟡改造保留；仅对话 IPC 入口与 mock 兜底链路按决策处理；不删除仍被复用的代码。
- F5-3 preload / global.d.ts 中被弃用的桥方法是否移除，依契约 §6 决策（移除即 K8，须记录）。

---

## 4. 不做什么（边界）

1. 不接入 ChatPanel 之外的八步业务页（不新增步骤页 / 路由）。
2. 不实现图像 / 视频 / 音乐 / 语音的 MCP 工具（ComfyUI 媒体引擎桥由后续 Feature 承接）；director 仍不声称媒体能力。
3. 不引入 zustand 等状态库（K9）；renderer 状态沿用 App.tsx useState + 纯函数层。
4. 不补齐资产 / 镜头 / 后期 /发布四类 Stage（K1，另立 Feature）。
5. 不做 MiniMax Design 的画布 / Skill 广场 / 插件市场 / 远程 IM 控制；仅对齐**对话内交互形态**。
6. 不改 `shared/types.ts`（K1）；新增 DTO 在 electron / renderer 两侧镜像。

---

## 5. 验收标准（AC，任务清单 AC 表为准）

- AC-1 MCP 工具服务仅 loopback 可访问，无 Bearer 请求被拒；令牌不落盘。
- AC-2 director 经 MCP 工具产出全部现有文本产物，产物卡字段语义无回归。
- AC-3 ChatPanel 正文流式逐字渲染、自动滚底；idle 后 loading 解除。
- AC-4 停止生成可中止本轮、解除 loading、保留已生成内容。
- AC-5 推理过程折叠区与正文分轨，默认折叠。
- AC-6 工具卡三态 + 耗时 + 参数；结果可展开为结构化 JSON 详情。
- AC-7 错误气泡可重试；无僵尸 loading；无重复生成。
- AC-8 重启恢复：消息、产物、工作流状态一致，无重复产物。
- AC-9 存量迁移：legacy 快照 + 决策表 + 用户签字齐全；ark 对话 IPC 在对话链路零引用。
- AC-10 全量测试只增不减、typecheck、build 通过。
- AC-11 视觉自检对照 OD §验收条目逐项达标。

---

## 6. 上下文加载清单（围栏）

见任务清单 §上下文加载清单。

## 7. 后续 Feature（不在本 Feature）

- 媒体引擎桥：ComfyUI 工作流注册为 MCP 工具（图像 / 视频 / 音乐，D-010 落地）。
- 八步补齐：资产 / 镜头 / 后期 /发布 Stage、产物卡、gate（K1）。
