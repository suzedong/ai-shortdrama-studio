> **归档状态**：已归档（D-037，2026-11-19）。本包已退出当前负责入口，仅作历史追溯。
> **当前负责包**：按本文件迁移覆盖表执行。
> **迁移覆盖**：见本包《SDG-AI-变更记录》“D-037 归档与迁移覆盖”。
> **历史边界**：以下正文为历史快照；原任务、AC、验证证据与决策记录均保留，不因归档改写其历史结论。

# feature-818 Renderer 基线类型修复 · 任务清单

> **来源与批准**：2026-11-15 用户明确要求修复 P0 基线中的 3 条 Renderer 构建类型错误，批准范围仅限本清单两份测试文件。
> **任务包形态**：两份代码文件，采用三文件任务包（任务清单 / 设计说明 / 变更记录）。
> **卡口**：K1/K8/K9 均不触发；不改 shared、IPC、preload、MCP、依赖或产品代码，不改既有测试行为目标。

## 工作围栏

| 文件 | 根因 | 允许修复 |
|---|---|---|
| `src/studio/canvas/canvas-zoom.test.tsx` | 测试 helper 的 `step: string` 宽于 `CanvasNode.step: StepId`；zoom 用例的 `viewport` 解构后未使用 | helper 改用 `CanvasNode['step']`；对应用例不解构 `viewport`，其余测试数据与断言不变 |
| `src/test/runtime/runtime-client.test.ts` | feature-808 给 `SdkHandle.session` 增加 `messages` 后，旧 fake SDK 未同步 | 仅在 `session` fake 中增加 `messages: vi.fn()`，不增加调用或改变既有断言 |

禁止修改 `shared/`、`electron/`、`src/global.d.ts`、产品组件、其他测试、`package.json` 及锁文件。

## T1 基线复现

- [x] 2026-11-15 运行 `npm run typecheck`，退出码 2，恰为上述 3 条错误：canvas TS2322/TS6133、runtime-client TS2741。

## T2 最小修复

- [x] 收紧画布测试 helper 的 `step` 参数类型并删除未使用解构。
- [x] 补齐 fake SDK 的 `session.messages` 类型成员。

## T3 验证

- [x] 两份相关测试通过，共 29/29。
- [x] `npm run typecheck` 通过。
- [x] `npm run build:renderer` 通过，仅保留既有 chunk 大小警告。
- [x] `git diff --check` 通过，代码 diff 仅限批准的两份测试文件。

## T4 收尾

- [x] 回填变更记录、任务包索引与 2026 编年条目；P0 基线报告保持历史快照，不改写。
