# SDG-RE-需求规格 · feature-809 对话流式活跃指示

> **包号**：feature-809（8xx 跨阶段平台基础段）
> **业务名**：对话流式活跃指示
> **性质**：纯 renderer 展示层改造；**K1 / K8 / K9 零触发**（不改 `shared/types.ts`、不动 electron/preload/IPC、零新依赖、零新动画 token）
> **事实源**：[chat-runtime.ts](../../../src/lib/chat-runtime.ts)（StreamingTurn / ToolView 归约模型，只读消费）、[ChatComposer.tsx](../../../src/studio/ChatComposer.tsx)（全阶段唯一对话区，见 B-34）
> **前置**：feature-808（会话续聊，`stream` / `generating` 双态已就位并下传 ChatComposer）
> **溯源标签**：[Design 原有 · 形态对齐]（MiniMax Design / opencode 均有流式活跃指示形态；底层为本项目自研实现，不复用闭源代码）
> **日期**：2026-10-17

## 1. 背景

用户反馈：与 Agent 对话时输出是间歇性的，**间歇期间气泡无任何变化或提示**，体验突兀，无法分辨「还在工作」还是「卡住了」。

对照代码实证，流式回合存在三处「静默黑洞」：

| # | 缺口 | 实证 |
|---|---|---|
| ① | **吐过文本后的间歇期气泡零变化**：[AgentTurn](../../../src/studio/ChatComposer.tsx#L429-L445) 仅在「无文本且无推理」时显示**静态**文字「主控 Agent 正在思考…」，一旦开始吐字该提示即消失；此后 token 停顿、多步 LLM step 切换等间歇期，气泡内无任何活跃信号 | ChatComposer.tsx L440-442 |
| ② | **工具调用期黑盒**：`ToolView` 已在归约层备齐（callId / 工具名 / running·completed·error 三态 / 起止耗时），但 AgentTurn **完全不渲染 `turn.tools`**——多步 Agent 的工具执行期（未来 ComfyUI 生图/生视频的最长间歇）用户看不到任何进展 | [chat-runtime.ts L15-24](../../../src/lib/chat-runtime.ts#L15-L24)、L106-122 |
| ③ | **发送→首事件窗口无气泡**：`generating=true` 且 `stream=null`（prompt 已发、首个 runtime 事件未达，可长达数秒）时右栏没有任何气泡（`{stream && …}`），且空态引导文案仍挂着，与「正在生成」的事实矛盾 | ChatComposer.tsx L508、L551 |

**既有资源**：[tailwind.config.js L24-36](../../../tailwind.config.js#L24-L36) 已备 `animate-cursor-blink`（1s 步进闪烁）与 `animate-dot-spin` 两枚动画 token，**当前全仓库零使用**——本包激活 `cursor-blink` 即可，配置层零改动。spinner 有 L504 `animate-spin` 圆弧先例可直接复用。

**业界参照（形态对齐目标）**：MiniMax Design / 主流聊天产品 = 三点 typing 动画 + 行尾闪烁光标 ▍ + 行内工具状态行，终态全部撤除；opencode TUI = spinner + 已用时长 + 工具状态行。共同原则：**活跃指示由「回合进行中」状态驱动并靠 CSS 动画自持，与 token 到达频率解耦**。

## 2. 角色与场景

| # | 角色 | 场景 | 期望表现 |
|---|---|---|---|
| R1 | 创作者 | 发送消息后到首个事件到达前（建会话 / 排队 / 首 token 前，可长达数秒） | 立即出现 Agent 占位气泡 + 三点打字动画 |
| R2 | 创作者 | 正文流出中的 token 停顿间歇 | 行尾光标 ▍ 持续闪烁，表明回合仍在进行 |
| R3 | 创作者 | Agent 调用 MCP 工具（file.write / canvas.update / brief.publish 等；未来 ComfyUI 生图生视频长任务） | 气泡内行内工具状态行：spinner + 工具名 + 「执行中」 |
| R4 | 创作者 | 工具执行完毕 / 失败 | ✓ + 耗时 / ✗ + 错误摘要，逐行可见 |
| R5 | 创作者 | 长推理（reasoning 流出中）或 LLM step 切换的静默间隙 | 始终有动画指示器在场 |
| R6 | 创作者 | 回合定稿（session.idle / runtime.error） | 全部动画指示器撤除，气泡定格为历史消息，无残留 |

## 3. 核心机制

### 3.1 活跃不变式（本包第一原则）

`turn.status === 'running'` 的任意时刻，流式气泡内**至少存在一个 CSS 动画元素**；所有指示器由 status 驱动、动画自持，不依赖新事件到达。终态（done / error）指示器全撤。

### 3.2 首事件前占位气泡

流式区渲染自「仅 `stream` 存在才出气泡」扩为两分支：`stream` 存在 → 现有流式气泡（原块不动）；否则 `generating` 为真 → **占位气泡**（Avatar + 气泡 + TypingDots）。同时 L508 空态引导文案条件补 `&& !generating`，与占位气泡互斥。

### 3.3 流式光标

`running` 且已有正文 → 正文末尾尾随 `<span class="animate-cursor-blink">▍</span>`；无正文或终态时不渲染。

### 3.4 三点打字动画（TypingDots）

三枚圆点，`animate-bounce`（Tailwind 内置）+ 0 / 150 / 300ms 延迟阶梯。两处复用：① 占位气泡（§3.2）；② 「主控 Agent 正在思考…」静态文案前补 TypingDots，文案保留。

### 3.5 行内工具状态行

AgentTurn 按首次出现顺序渲染 `Object.values(turn.tools)`，逐行：

| 状态 | 图标 | 文本 |
|---|---|---|
| running | `animate-spin` 圆弧 spinner（复用 L504 类组合） | 工具原名 + 「执行中」 |
| completed | ✓（text-ok） | 工具原名 + 耗时（如 `1.2s`，起止齐备才显示） |
| error | ✗（text-bad） | 工具原名 + errorText（单行省略，title 悬停见全文） |

工具名**直显原名**（如 `file.write`），不建中文映射表（每增一工具即改 UI 不可持续；工具名即 MCP 契约名，真实可溯）。

### 3.6 终态清除

status 翻 done / error 后：光标、TypingDots、spinner 一律不渲染；工具行以 ✓ / ✗ 终态定格。流式气泡随 StudioApp 定稿落 items 后整体卸载（feature-808 既有链路），历史气泡为纯文本、不含工具行（见 §4.2）。

## 4. 范围

### 4.1 做

1. [ChatComposer.tsx](../../../src/studio/ChatComposer.tsx)：`toolDurationLabel` / `showStreamCursor` 两纯函数 + TypingDots / ToolRow 两内部组件 + AgentTurn 改造（光标 / TypingDots / 工具行）；
2. 流式区占位气泡分支 + L508 空态提示联动（§3.2）；
3. 新增 `src/studio/chat-liveness.test.tsx` 单测。

### 4.2 不做（显式排除）

- 不改 [chat-runtime.ts](../../../src/lib/chat-runtime.ts) 归约逻辑、不增删事件类型（红线）；
- 不改 StudioApp.tsx 事件装配与 stream / generating 状态机（所需 props 已齐备并下传）；
- 不渲染工具 args / result 详情（脱敏 + 简洁；未来需要另立切片）;
- 工具行定稿后**不留在历史气泡**（`ChatMessage` 无工具字段，留痕须扩 `shared/types.ts` 触发 K1，另立切片）；
- 不加新动画 token、不加依赖、不改 tailwind.config.js；
- 不动 reasoning 折叠块形态、busy / OptionCard / GateCardView / B-34 标签 / B-35 选项逻辑；
- 无第二对话区落点（B-34：ChatComposer 为全阶段唯一对话区；`src/pages/ChatPage.tsx` 不存在，已核实）。

## 5. 验收标准（AC）

| # | 验收 | 判定方式 |
|---|---|---|
| AC1 | `generating=true && stream=null` 时一次渲染内出现 Agent 占位气泡（`data-testid="chat-turn-placeholder"`，含 TypingDots 动画） | 单测 |
| AC2 | `running` 且有正文 → 正文末尾存在 `animate-cursor-blink` 光标（`data-testid="chat-stream-cursor"`） | 单测 |
| AC3 | `running` 且无正文无推理 → 渲染 TypingDots（`data-testid="chat-typing-dots"`）+「主控 Agent 正在思考…」文案 | 单测 |
| AC4 | tools 含 running 工具 → 行内工具行（`data-testid="chat-tool-row"`）含 `animate-spin` spinner 与工具原名 | 单测 |
| AC5 | completed 工具 → ✓ + 耗时；`toolDurationLabel`：起止齐备且非负 → `(差/1000).toFixed(1)+'s'`；缺任一端或为负 → 不显示耗时 | 单测（纯函数 3 例 + 组件 1 例） |
| AC6 | error 工具 → ✗ + errorText 摘要（单行省略）；无 errorText → 「执行失败」 | 单测 |
| AC7 | **活跃不变式**：构造 running 全组合（空转 / 仅推理 / 仅正文 / 正文+工具 running / 工具全 completed 后的静默），每种渲染结果内 ≥1 个 `animate-*` 元素 | 单测 |
| AC8 | done / error 终态 → 无 cursor、无 TypingDots、无 spinner；工具行呈 ✓/✗ 定格 | 单测 |
| AC9 | 回归红线：`npx tsc --noEmit` 仅 3 条历史基线零新增；全量测试 **48 文件 528 passed / 0 failed / 1 skipped** 起步，passed 不减少、skip 不增 | 全量回归 |
| AC10 | 真机目验：发送 → 占位气泡即现 → 正文流出带光标 → 工具行三态 → 定稿指示器全撤 | 真机 |
