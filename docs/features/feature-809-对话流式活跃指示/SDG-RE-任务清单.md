# SDG-RE-任务清单 · feature-809 对话流式活跃指示

## 0. 上下文加载清单（工作围栏）

**必读**（执行 T2 前全部加载）：

1. [AGENTS.md](../../../AGENTS.md) + [AI-SDG-AI工具执行指令.md](../../governance/AI-SDG-AI工具执行指令.md)
2. 本包《SDG-RE-需求规格.md》《SDG-RE-契约.md》
3. [ChatComposer.tsx](../../../src/studio/ChatComposer.tsx)（重点 L429-581：AgentTurn / 流式气泡 / 空态提示 / busy）
4. [chat-runtime.ts](../../../src/lib/chat-runtime.ts)（L15-145：ToolView / StreamingTurn / turnText / turnReasoning）
5. [tailwind.config.js](../../../tailwind.config.js)（L24-36 既有动画 token）
6. [chat-markdown.test.tsx](../../../src/studio/chat-markdown.test.tsx)（测试写法先例）

**改动面白名单**：

| # | 文件 | 性质 |
|---|---|---|
| ① | `src/studio/ChatComposer.tsx` | 改造（唯一源码改动） |
| ② | `src/studio/chat-liveness.test.tsx` | 新增（唯一新文件） |

**红线（零 diff）**：`src/lib/chat-runtime.ts`、`src/lib/runtime-types.ts`、`shared/**`、`electron/**`、`package.json`、`tailwind.config.js`、`src/studio/StudioApp.tsx`、其余一切既有测试文件（只允许新增用例通过，不允许改既有断言）。

## 1. 任务

- [x] **T1 基线实测冻结**：跑 `npx tsc --noEmit` 与全量 `npm test`，把实测基线（预期：typecheck 仅 3 条历史基线；48 文件 528 passed / 0 failed / 1 skipped）记入变更记录实施段；实测与预期不符先停手呈报
- [x] **T2 实现**（严格按契约 §2/§3）：`toolDurationLabel` / `showStreamCursor` 纯函数 → TypingDots / ToolRow 内部组件 → AgentTurn 改造 → 占位气泡分支 → L508 空态联动
- [x] **T3 单测**：`chat-liveness.test.tsx` ≥15 例（纯函数 6 + 组件 ≥9），覆盖 AC1–AC8
- [x] **T4 回归**：`npx tsc --noEmit` 零新增；全量 `npm test` passed 不减少、skip 不增、文件数净增恰 1
- [x] **T5 真机目验**（Electron 真机，STAGE 0 走查自然触发 file.* / brief.* 工具链）：①发送后占位气泡即现 → ②正文流出带闪烁光标 → ③工具行 running→completed 三态与耗时 → ④定稿后指示器全撤无残留；截图留证存 `docs/design/verify-shots/`
- [x] **T6 治理收尾**：[features/README.md](../README.md) 总表 809 行状态翻 ✅（填落地日期与测试基线）；[版本记录.md](../../../版本记录.md) 增行；变更记录补实施记录并闭环

## 2. 产出物清单

| 产物 | 位置 |
|---|---|
| ChatComposer 改造（纯函数 ×2 + 组件 ×2 + AgentTurn + 两处分支） | `src/studio/ChatComposer.tsx` |
| 单测 ≥15 例 | `src/studio/chat-liveness.test.tsx` |
| 真机目验截图 | `docs/design/verify-shots/` |
| 变更记录实施段 + README / 版本记录同步 | 本包 / 索引 |

## 3. 不做

见《SDG-RE-需求规格.md》§4.2——工具留痕入历史气泡（K1）、args/result 渲染、工具名映射表、新动画 token、归约层 / StudioApp / tailwind 配置改动，全部排除在本包之外。
