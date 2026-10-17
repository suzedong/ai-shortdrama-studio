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

### T2 实现（2026-10-17，白名单内最小 diff）

- `ChatComposer.tsx` 五处契约改动：① import 增 `type ToolView`；② 新增 export 纯函数 `toolDurationLabel`（D1/D2/D3）/ `showStreamCursor`（C1/C2）；③ 新增内部组件 `TypingDots`（animate-bounce + 0/150/300ms 阶梯）/ `ToolRow`（三态：running spinner+「执行中」、completed ✓+耗时、error ✗+errorText truncate/title，无 errorText→「执行失败」）；④ AgentTurn 按 A1-A5 改造（reasoning→正文+光标→工具行区→空态三点，A4 取 X-001 修订后条件 `!text && running`）；⑤ 流式区并列新增占位气泡分支（`!stream && generating`，`data-testid="chat-turn-placeholder"`，与流式气泡同壳）+ L508 空态补 `&& !generating`。
- **零 diff 红线核验**：chat-runtime.ts / runtime-types.ts / shared/** / electron/** / package.json / tailwind.config.js / StudioApp.tsx / 既有测试文件——全部零改动（`animate-cursor-blink` 激活既有 token，配置零 diff）。
- 实施中发现规格内部冲突（AC7 ↔ 契约 A4），依治理 §8 L2 暂停呈报，用户裁决修订 A4 → 见修订记录 X-001。

### T3 单测（2026-10-17）

- 新增 `src/studio/chat-liveness.test.tsx` **22 例全过**（约定 ≥15）：纯函数 6 例（D1/D2/D3、C1/C2×2）+ 组件 16 例（AC1-AC8 全覆盖；AC7 以 `it.each` 参数化遍历 running 五状态：空转/仅推理/仅正文/正文+工具 running/工具全 completed 后静默，各断言 ≥1 个 `animate-*` 元素；含 X-001 仅推理态显式断言、工具行序 T1 断言）。

### T4 回归（2026-10-17）

- `npm run typecheck`：退出码 2，仍恰 3 条历史基线（同 T1 清单），**零新增**。
- `npm run test:run`：退出码 0；Test Files **49 passed (49)**（48+净增恰 1）；Tests **550 passed | 1 skipped (551)**（528+22，passed 不减少、skip 不增）；Duration 53.94s。
- 结论：AC9 回归红线全守。

### T5 真机目验（2026-10-17，通过）

- **方式**：CDP 自动化走查（Electron `--remote-debugging-port=9222` + Node 内置 WebSocket 直驱 renderer，驱动脚本置 %TEMP% 不入库，repo 零侵入）；真实链路 `.env` ARK 三元组 → opencode serve 惰性自启 → 火山方舟真实 LLM 流式。
- **走查**：临时项目「809目验-临时」发送真实创作指令，150ms 采样全程，产物 8 图 + timeline.json 落 [docs/design/verify-shots/](../../design/verify-shots/)。
- **相位时序**（timeline.json）：发送 t=3.83s → **占位气泡 t=3.99s（≈160ms，AC1 ✓）** → TypingDots 接续 → 正文光标 t=56.97s（AC2 ✓，前段 53s 空窗由占位/dots 全程覆盖）→ 工具行 t=60.11s（`执行中` spinner 与 `✓+耗时` 同框，AC4/AC6 ✓）→ 工具全毕 t=60.44s（0.0s/0.1s/0.1s/0.3s）→ 门卡 t=146.18s（「确认放行」可决）→ **定稿 t=180.25s 指示器全撤（AC3 ✓）**。
- **活跃不变式实测**：`gapPolls = 0 / polls = 1122`——首个指示器出现至终态全撤之间 1122 次采样零空窗（AC8 不变式成立）。
- **终态画面**：画布出现「立项单 v1 已完成」、状态机 initiating→story-outline、composer 复位可发，对话区无占位/光标/spinner/dots。
- **边界说明**：AC5（✗+错误条）真机未触发错误工具（属正常路径），由单测覆盖；AC7 五状态由单测 it.each 参数化覆盖，真机空窗期 dots 覆盖由不变式实测佐证。
- **清理**：走查临时项目已经应用 IPC 删除（先切走再删），目验环境零残留。

### T6 治理收尾（2026-10-17）

- [features/README.md](../README.md) 总表 809 行翻 ✅（落地日期 + 测试基线 49 文件 550 passed）；[版本记录.md](../../../版本记录.md) 2026-10 区块增行；任务清单 T1–T6 全勾。本包闭环。

## 三、修订记录

### X-001 契约 §3.1 A4 条件修订（2026-10-17，L2 规格缺陷，用户裁决）

- **冲突**：需求规格 AC7 要求 running 全组合（含「仅推理」态）气泡内 ≥1 个 `animate-*` 元素；契约 A4 原条件 `!text && !reasoning && running` 使仅推理态（有推理流、无正文、无工具）零动画，两条文矛盾。
- **处置**：依治理 §8 L2「暂停提问，不自行脑补」呈报；用户裁决「修订 A4 条件」。
- **修订**：A4 条件改为 `!text && status==='running'`——仅推理时在推理折叠块下方显示 TypingDots +「主控 Agent 正在思考…」。
- **影响面**：AC3（无正文无推理 → TypingDots）为新条件子集，不受影响；AC8 终态清除不受影响（status≠running 不渲染）；契约 §3.1 A4 行已同步修订；测试契约组件例按新条件断言。
