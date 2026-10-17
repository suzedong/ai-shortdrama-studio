# SDG-AI-变更记录 · feature-809 对话流式活跃指示

> 三分类：**决策记录**（永久保留）/ **实施记录**（过渡，T1–T6 推进中填写，闭环后可压缩）/ **修订记录**（规格落地后修订）。

## 一、决策记录（永久）

### D-001 建包、零卡口声明与评审报批（2026-10-17）

- **背景**：用户反馈「和 AI 对话时间歇性输出，间歇时气泡没有变化或提示，感觉突兀」，并要求对齐 MiniMax Design / opencode 的流式显示逻辑；诊断实证三处静默黑洞（需求规格 §1）。
- **包定位**：8xx 跨阶段平台基础段，纯 renderer 展示层改造，[Design 原有 · 形态对齐]。
- **卡口声明**：**K1 / K8 / K9 零触发**——不改 `shared/types.ts`；不动 electron/preload/IPC/MCP 工具面；零新依赖；动画 token 复用既有（tailwind.config.js 零 diff）。依据见《SDG-RE-契约.md》置顶声明与 §7 越界处置表。
- **改动面白名单**：`src/studio/ChatComposer.tsx`（唯一源码改动）+ 新增 `src/studio/chat-liveness.test.tsx`。
- **报批**：五文件呈用户评审；**用户明确批准即 T1→T6 一次授权，批准前不触碰任何代码**。
- **状态**：✅ 用户已批准（2026-10-17，同轮批准 D-002 ~ D-005），T1→T6 授权生效。

### D-002 工具名直显 MCP 原名，不建中文映射表（随 D-001 同轮报批）

- **理由**：映射表每增一工具即改 UI，不可持续；原名即 MCP 契约名，真实可溯（设计说明 §4 D1）。

### D-003 工具行仅流式期可见，定稿不留历史气泡（随 D-001 同轮报批）

- **理由**：`ChatMessage` 无工具字段，留痕须扩 `shared/types.ts` 触发 K1；本包明确排除，未来需要时另立切片走 K1（设计说明 §4 D5）。

### D-004 动画 token 零新增（随 D-001 同轮报批）

- **事实**：`animate-cursor-blink` / `animate-dot-spin` 已在 tailwind.config.js L24-36 定义但全仓库零使用；本包激活 `cursor-blink`，三点用内置 `animate-bounce`，spinner 复用 L504 `animate-spin` 圆弧先例（设计说明 §4 D4/D6）。

### D-005 占位气泡与空态提示互斥联动（随 D-001 同轮报批）

- **口径**：`!stream && generating` 出占位气泡；L508 空态引导文案同步补 `&& !generating` 条件，二者不同时出现（契约 §3.3/§3.4）。

## 二、实施记录（过渡）

### T1 基线冻结（2026-10-17 实测，与规格预期完全一致）

- `npm run typecheck`：退出码 2，恰 3 条历史基线，零新增——
  - `src/studio/canvas-zoom.test.tsx(13,9)` TS2322（string 不可赋 StepId）
  - `src/studio/canvas-zoom.test.tsx(90,13)` TS6133（'viewport' 已声明未使用）
  - `src/test/runtime-client.test.ts(45,5)` TS2741（缺 messages 属性）
- `npm run test:run`：退出码 0；Test Files **48 passed (48)**；Tests **528 passed | 1 skipped (529)**；Duration 52.26s。
- 结论：实测与《SDG-RE-需求规格.md》§5 AC9 / 《SDG-RE-契约.md》§5 红线预期一致，无需停手呈报，进入 T2。

## 三、修订记录

### X-001 契约 §3.1 A4 条件修订（2026-10-17，L2 规格缺陷，用户裁决）

- **冲突**：需求规格 AC7 要求 running 全组合（含「仅推理」态）气泡内 ≥1 个 `animate-*` 元素；契约 A4 原条件 `!text && !reasoning && running` 使仅推理态（有推理流、无正文、无工具）零动画，两条文矛盾。
- **处置**：依治理 §8 L2「暂停提问，不自行脑补」呈报；用户裁决「修订 A4 条件」。
- **修订**：A4 条件改为 `!text && status==='running'`——仅推理时在推理折叠块下方显示 TypingDots +「主控 Agent 正在思考…」。
- **影响面**：AC3（无正文无推理 → TypingDots）为新条件子集，不受影响；AC8 终态清除不受影响（status≠running 不渲染）；契约 §3.1 A4 行已同步修订；测试契约组件例按新条件断言。
