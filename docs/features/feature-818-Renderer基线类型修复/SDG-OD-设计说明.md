# feature-818 Renderer 基线类型修复 · 设计说明

## 目标

解除 P0 基线中阻断 `npm run build:renderer` 的 3 条 TypeScript 错误，不改变运行时代码、用户可见行为或既有测试意图。

## 文件与方案矩阵

| 文件 | 小改内容 | 理由 |
|---|---|---|
| `src/studio/canvas/canvas-zoom.test.tsx` | helper 的 `step: string` 改为 `CanvasNode['step']`；zoom 用例不再解构未使用的 `viewport` | 对齐现行 `CanvasNode.step: StepId` 与 TypeScript `noUnusedLocals` |
| `src/test/runtime/runtime-client.test.ts` | fake `session` 增加 `messages: vi.fn()` | 对齐 feature-808 已实施的 `SdkHandle.session.messages` 类型契约 |

## 非目标

- 不修改 `getNodesForStep`、画布交互、Runtime Client 或 SDK 类型。
- 不借本包处理全量测试中的其他失败、Electron 真机缺口或 P1 功能。
- 不新增依赖、共享类型、IPC/MCP 通道或测试行为断言。

## 验证策略

先运行两份相关测试确认测试意图未变，再运行 Renderer typecheck 和完整 `build:renderer`。P0 报告与原始日志作为当时基线保留，本包仅追加新的修复证据。
