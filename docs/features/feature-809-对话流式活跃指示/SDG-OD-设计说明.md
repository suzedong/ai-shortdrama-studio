# SDG-OD-设计说明 · feature-809 对话流式活跃指示

## 1. 改动总览

```
发送 prompt ──► generating=true, stream=null
                  │
                  ▼
        ┌─ 占位气泡（新增分支）────────────┐
        │ ◉ showrunner  ● ● ● (typing)    │  data-testid=chat-turn-placeholder
        └──────────────────────────────────┘
                  │ 首个 runtime 事件到达 → stream 建轮
                  ▼
        ┌─ 流式气泡（AgentTurn 改造）──────┐
        │ ▸ 推理过程（details，原样）        │
        │ 正文 markdown……▍ ← 光标闪烁      │  data-testid=chat-stream-cursor
        │ ⠿ file.write · 执行中            │  ┐
        │ ✓ file.read · 0.8s               │  ├ ToolRow（新增）
        │ ✗ comfy.queue · 连接超时…        │  ┘  data-testid=chat-tool-row
        └──────────────────────────────────┘
                  │ session.idle / runtime.error → 终态锁定
                  ▼
        指示器全撤；stream 落 items（feature-808 既有链路）
        历史气泡 = 纯文本，无工具行（§3.5 D5）
```

## 2. 组件结构（改造后）

```
ChatComposer（props 零新增）
├─ TypingDots（新）          三圆点 animate-bounce + 0/150/300ms 延迟阶梯
├─ ToolRow（新）             三态图标 + 工具原名 + 耗时/错误
├─ AgentTurn（改造）         reasoning → text+cursor → ToolRow 区 → 空态三点
├─ toolDurationLabel（新纯函数，export）
├─ showStreamCursor（新纯函数，export）
└─ 流式区两分支：stream ? 现有气泡块（内部不动） : generating && 占位气泡
```

## 3. 与既有代码接触面核实表

| 触点 | 磁盘实况（2026-10-17 核） | 本包动作 |
|---|---|---|
| [ChatComposer.tsx L429-445](../../../src/studio/ChatComposer.tsx#L429-L445) AgentTurn | 三缺口实证：静态思考文案 / 无光标 / 不渲染 tools | 按契约 §3.1 改造 |
| L551-572 流式气泡块 | B-34 标签剥离 + B-35 选项只展不点 + GateCardView 随挂，均已就位 | **块内部零改动**；AgentTurn 调用签名不变 |
| L508 空态引导文案 | `items.length === 0 && !stream`，generating 时仍显示（与占位气泡矛盾） | 条件补 `&& !generating`（1 子句） |
| L466 busy / L504 spinner | `busy = sending \|\| generating \|\| historyLoading \|\| !!stream`；`animate-spin` 圆弧先例 | 不动 busy；ToolRow spinner 复用同类组合 |
| [tailwind.config.js L24-36](../../../tailwind.config.js#L24-L36) | `cursor-blink` / `dot-spin` 已定义，**全仓库零使用** | 激活 `cursor-blink`；配置文件零 diff |
| [chat-runtime.ts L15-41](../../../src/lib/chat-runtime.ts#L15-L41) | ToolView / StreamingTurn / 终态锁定齐备 | 只 import，零 diff |
| [StudioApp.tsx](../../../src/studio/StudioApp.tsx) 调用点 | `stream` / `generating` / `sending` / `onStop` 已下传（L747-759 一带） | 零 diff |
| 对话区唯一性 | B-34：ChatComposer 为全阶段唯一对话区；`src/pages/ChatPage.tsx` 不存在（已核实） | 无第二落点 |

## 4. 关键边界决策

| # | 决策 | 理由 |
|---|---|---|
| D1 | 工具名**直显 MCP 原名**（如 `file.write`），不建中文映射表 | 映射表每增一工具即改 UI 不可持续；原名即契约名，真实可溯 |
| D2 | 不渲染工具 args / result 详情 | 脱敏 + 气泡简洁；产物卡已由既有 completed-envelope 链路另落，详情查看属未来切片 |
| D3 | 光标 = 正文块后**尾随独立 span**，不注入 Markdown 末段 | 注入末段需改 MarkdownText 或引入 rehype-raw（新依赖/K9 风险）；尾随换行落位观感可接受，动画存在性优先 |
| D4 | TypingDots 用内置 `animate-bounce` + 延迟阶梯，光标用既有 `cursor-blink` | 零新 token、零配置 diff |
| D5 | 工具行**仅流式期可见**，定稿落 items 后不保留 | `ChatMessage` 无工具字段，留痕须扩 shared/types.ts（K1），明确排除另立切片 |
| D6 | spinner 复用 L504 `animate-spin` 圆弧类组合，不用 `dot-spin` | `dot-spin` 为整元素旋转 keyframe，无现成圆弧载体；圆弧形态与 L504 载入行一致，视觉同源 |
| D7 | 占位气泡与 stream 气泡**同壳同位**（同 Avatar、同气泡类） | 切换一瞬视觉连续，无跳动 |

## 5. 测试落点

新增 `src/studio/chat-liveness.test.tsx`（写法循 chat-markdown.test.tsx 先例，内存构造 StreamingTurn）：

| 组 | 用例 | 对应 AC |
|---|---|---|
| 纯函数 | toolDurationLabel：正常 1.2s / 缺端 null / 负值 null；showStreamCursor：running 有文 true / running 无文 false / done 有文 false | AC5 / AC2 |
| 组件 | 占位气泡出现与互斥（空态文案不同时显示） | AC1 |
| 组件 | 光标出现 / 无正文不出现 / done 消失 | AC2 / AC8 |
| 组件 | 空态 TypingDots + 思考文案 | AC3 |
| 组件 | 工具行三态（running spinner+原名 / completed ✓+耗时 / error ✗+摘要与兜底文案） | AC4 / AC5 / AC6 |
| 组件 | 活跃不变式参数化遍历（空转 / 仅推理 / 仅正文 / 正文+工具 running / 工具全 completed 静默）每种 ≥1 个 `animate-*` 元素 | AC7 |
| 组件 | done / error 终态无任何动画指示器 | AC8 |

## 6. 视觉基线

- 三点 typing + 行尾 ▍ 光标 + 行内工具行 = MiniMax Design / 主流聊天产品通行形态（形态对齐目标，[Design 原有]）；
- 色板零新增：violet（spinner 弧 / 光标）、muted（辅助文案）、ok / bad（✓ / ✗）全部取自既有 token；
- 工具行字号 ≤ 正文（text-[11px] 级别），单行高 16-18px，与气泡 12px/1.6 正文节奏协调。

## 7. 风险与缓解

| # | 风险 | 评估 | 缓解 |
|---|---|---|---|
| R1 | 光标尾随换行落位（未注入末段） | 观感略异于「贴在最后一个字后」，但通行产品亦多如此 | D3 记录在案；真机目验重点看 |
| R2 | 占位气泡 → stream 气泡切换瞬间闪烁 | 两分支同壳同位（D7），React 同位置替换，视觉连续 | T5 目验项①②衔接 |
| R3 | 高频 tool.call 事件致工具行频繁重渲染 | 工具行数 ≤ 回合工具调用数（个位数量级），无性能风险 | 无需处理 |
| R4 | `generating` 与 `stream` 短暂同真 | 渲染分支 `stream` 优先（占位仅在 `!stream` 时出现），不双泡 | 契约 §3.3 互斥条件 |
